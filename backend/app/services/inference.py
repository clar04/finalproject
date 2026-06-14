import os

import torch                          # pyrefly: ignore [missing-import]
import torch.nn as nn                 # pyrefly: ignore [missing-import]
import torch.nn.functional as F       # pyrefly: ignore [missing-import]
from transformers import AutoModel, AutoTokenizer  # pyrefly: ignore [missing-import]

from app.models.product import ABSAAspect, SentimentDistribution


# ==============================================================================
# 1. CONFIG
# ==============================================================================

ASPECTS = ['PIGMENTATION', 'LONGEVITY', 'TEXTURE', 'HYDRATION', 'PRICE']

# HARUS SAMA DENGAN NOTEBOOK:
# index 0 = no_aspect
# index 1 = negative
# index 2 = neutral
# index 3 = positive
SENTIMENTS = ['no_aspect', 'negative', 'neutral', 'positive']
SENT2ID = {s: i for i, s in enumerate(SENTIMENTS)}
ID2SENT = {i: s for s, i in SENT2ID.items()}

CONFIG = {
    # Model
    'model_name': 'indobenchmark/indobert-base-p1',
    'freeze_bert': True,
    'num_outputs': 4,
    'dropout': 0.3,

    # Tokenization
    'max_length': 128,

    # CABiLSTM architecture
    'bilstm_hidden': 384,
    'bilstm_layers': 2,
    'attn_heads': 8,
    'conv_kernel': 5,
    'mlp_hidden_1': 1024,
    'mlp_hidden_2': 512,
}


# ==============================================================================
# 2. MODEL ARCHITECTURE
# ==============================================================================

class CABiLSTMCore(nn.Module):
    """
    CABiLSTM deep implicit feature extraction layer.

    Pipeline:
      1. Dual-layer BiLSTM menghasilkan 5 feature groups: V, F1, B1, F2, B2
      2. Multi-Head Self-Attention untuk setiap feature group
      3. Conv2D untuk menggabungkan 5 channel menjadi 1 channel

    Input : x  [B, L, 768]
    Output: Co [B, L, 768]
    """

    def __init__(
        self,
        hidden_dim: int = 768,
        bilstm_hidden: int = 384,
        num_heads: int = 8,
        conv_kernel: int = 5,
    ):
        super().__init__()

        self.bilstm1 = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=bilstm_hidden,
            num_layers=1,
            bidirectional=True,
            batch_first=True,
        )

        self.bilstm2 = nn.LSTM(
            input_size=hidden_dim,
            hidden_size=bilstm_hidden,
            num_layers=1,
            bidirectional=True,
            batch_first=True,
        )

        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_dim,
            num_heads=num_heads,
            dropout=0.0,
            batch_first=True,
        )

        pad = conv_kernel // 2
        self.conv = nn.Conv2d(
            in_channels=5,
            out_channels=1,
            kernel_size=conv_kernel,
            padding=pad,
        )

    def _split_bidirectional(self, out: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        Split output BiLSTM menjadi forward dan backward.

        out shape: [B, L, 768]
        forward : [B, L, 384]
        backward: [B, L, 384]

        Lalu masing-masing diulang agar kembali ke 768,
        sama seperti implementasi notebook.
        """
        half = out.size(-1) // 2
        fwd = out[..., :half]
        bwd = out[..., half:]

        return torch.cat([fwd, fwd], dim=-1), torch.cat([bwd, bwd], dim=-1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out1, _ = self.bilstm1(x)
        F1, B1 = self._split_bidirectional(out1)

        out2, _ = self.bilstm2(out1)
        F2, B2 = self._split_bidirectional(out2)

        attended = [
            self.attention(fg, fg, fg)[0]
            for fg in [x, F1, B1, F2, B2]
        ]

        Ao = torch.stack(attended, dim=1)      # [B, 5, L, 768]
        Co = F.relu(self.conv(Ao).squeeze(1)) # [B, L, 768]

        return Co


class M2_CABiLSTM_IndoBERT(nn.Module):
    """
    M2: CABiLSTM-IndoBERT multilabel wide format.

    Input:
        review_text saja, bukan [aspect] + [review_text]

    Output:
        [B, 5, 4]

        5 aspek:
        PIGMENTATION, LONGEVITY, TEXTURE, HYDRATION, PRICE

        4 kelas:
        0 = no_aspect
        1 = negative
        2 = neutral
        3 = positive
    """

    def __init__(self, config: dict):
        super().__init__()

        self.config = config
        self.bert = AutoModel.from_pretrained(config['model_name'])

        if config['freeze_bert']:
            for p in self.bert.parameters():
                p.requires_grad = False

        hidden_dim = self.bert.config.hidden_size

        self.cabilstm = CABiLSTMCore(
            hidden_dim=hidden_dim,
            bilstm_hidden=config['bilstm_hidden'],
            num_heads=config['attn_heads'],
            conv_kernel=config['conv_kernel'],
        )

        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim, config['mlp_hidden_1']),
            nn.ReLU(),
            nn.Dropout(config['dropout']),

            nn.Linear(config['mlp_hidden_1'], config['mlp_hidden_2']),
            nn.ReLU(),
            nn.Dropout(config['dropout']),

            nn.Linear(config['mlp_hidden_2'], len(ASPECTS) * config['num_outputs']),
        )

        self._init_weights()

    def _init_weights(self) -> None:
        for layer in self.classifier:
            if isinstance(layer, nn.Linear):
                nn.init.xavier_uniform_(layer.weight)
                nn.init.zeros_(layer.bias)

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        token_type_ids: torch.Tensor | None = None,
    ) -> torch.Tensor:
        bert_inputs = {
            'input_ids': input_ids,
            'attention_mask': attention_mask,
        }

        if token_type_ids is not None:
            bert_inputs['token_type_ids'] = token_type_ids

        with torch.no_grad():
            V = self.bert(**bert_inputs).last_hidden_state  # [B, L, 768]

        Co = self.cabilstm(V)  # [B, L, 768]

        mask_expand = attention_mask.unsqueeze(-1).float()  # [B, L, 1]
        M = (Co * mask_expand).sum(dim=1) / mask_expand.sum(dim=1).clamp(min=1)

        out = self.classifier(M)  # [B, 20]

        return out.view(
            -1,
            len(ASPECTS),
            self.config['num_outputs'],
        )  # [B, 5, 4]


# ==============================================================================
# 3. MODEL INITIALISATION
# ==============================================================================

device = torch.device('cpu')

tokenizer = AutoTokenizer.from_pretrained(CONFIG['model_name'])
model = M2_CABiLSTM_IndoBERT(CONFIG).to(device)

MODEL_PATH = 'app/m2-4cls_best.pt'

if os.path.exists(MODEL_PATH):
    state_dict = torch.load(MODEL_PATH, map_location=device)
    model.load_state_dict(state_dict)
    print(f'Loaded weights from {MODEL_PATH}')
else:
    print(f'[WARN] No weights found at {MODEL_PATH}. Using random initialisation.')

model.eval()


# ==============================================================================
# 4. INFERENCE
# ==============================================================================

def _predict_aspects(text: str) -> list[dict]:
    """
    Run M2 CABiLSTM-IndoBERT on a single review text.

    Output:
        [
            {'aspect': 'pigmentation', 'sentiment': 'positive'},
            {'aspect': 'texture', 'sentiment': 'negative'},
            ...
        ]

    Aspect dengan prediksi no_aspect akan di-skip.
    """
    enc = tokenizer(
        text,
        max_length=CONFIG['max_length'],
        padding='max_length',
        truncation=True,
        return_tensors='pt',
    )

    input_ids = enc['input_ids'].to(device)
    attention_mask = enc['attention_mask'].to(device)
    token_type_ids = enc.get('token_type_ids')

    if token_type_ids is not None:
        token_type_ids = token_type_ids.to(device)

    with torch.no_grad():
        logits = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        )  # [1, 5, 4]

    probs = torch.softmax(logits[0], dim=-1)  # [5, 4]

    predictions = []

    for asp_idx, aspect in enumerate(ASPECTS):
        asp_probs = probs[asp_idx]
        best_cls_idx = int(torch.argmax(asp_probs).item())
        best_sentiment = ID2SENT[best_cls_idx]

        # Di notebook:
        # 0 = no_aspect
        # Jadi bukan index 3.
        if best_sentiment == 'no_aspect':
            continue

        predictions.append({
            'aspect': aspect.lower(),
            'sentiment': best_sentiment,
            'confidence': float(asp_probs[best_cls_idx].item()),
        })

    return predictions


def run_inference(reviews_raw: list[dict]) -> list[dict]:
    """
    Run ABSA inference over a list of raw review dicts.

    Input minimal:
        [{'content': 'tekstur lip product ini ringan...', ...}]

    Output:
        Satu review bisa menghasilkan beberapa row,
        karena satu review bisa punya beberapa aspek aktif.
    """
    results = []

    for review in reviews_raw:
        text = review.get('content', '').strip()

        if not text:
            results.append({
                **review,
                'aspect': 'texture',
                'sentiment': 'neutral',
                'confidence': 0.0,
            })
            continue

        predictions = _predict_aspects(text)

        if predictions:
            for pred in predictions:
                results.append({**review, **pred})
        else:
            # Semua aspek diprediksi no_aspect.
            # Fallback ini hanya supaya frontend tetap punya row.
            results.append({
                **review,
                'aspect': 'texture',
                'sentiment': 'neutral',
                'confidence': 0.0,
            })

    return results


# ==============================================================================
# 5. NSS CALCULATION
# ==============================================================================

MINIMUM_REVIEW_THRESHOLD = 25


def calculate_nss_with_metadata(reviews_flat: list, aspect: str) -> dict:
    """
    Hitung NSS per aspek dengan metadata reliabilitas.
    Formula NSS tetap standar: (pos - neg) / total × 100
    Metadata tambahan digunakan frontend untuk warning display.
    """
    aspect_reviews = [
        r for r in reviews_flat
        if r.get('aspect') == aspect and r.get('sentiment') != 'no_aspect'
    ]

    review_count = len(aspect_reviews)

    if review_count == 0:
        return {
            'nss': None,
            'review_count': 0,
            'is_low_count': True,
            'low_count_warning': 'Tidak ada ulasan yang membahas aspek ini.',
        }

    pos = sum(1 for r in aspect_reviews if r.get('sentiment') == 'positive')
    neg = sum(1 for r in aspect_reviews if r.get('sentiment') == 'negative')
    nss = round((pos - neg) / review_count * 100, 1)

    is_low_count = review_count < MINIMUM_REVIEW_THRESHOLD

    return {
        'nss': nss,
        'review_count': review_count,
        'is_low_count': is_low_count,
        'low_count_warning': (
            f'Skor aspek ini dihitung dari {review_count} ulasan '
            f'(di bawah threshold {MINIMUM_REVIEW_THRESHOLD}). '
            f'Hasil mungkin belum representatif.'
        ) if is_low_count else None,
    }


def calculate_overall_nss_with_metadata(absa_aspects: list) -> dict:
    """
    Hitung overall NSS dari rata-rata NSS per aspek.
    Formula tetap standar, metadata low_count diwariskan dari aspek.
    """
    valid_aspects = [a for a in absa_aspects if a.get('nss') is not None]

    if not valid_aspects:
        return {
            'overall_nss': None,
            'overall_is_low_confidence': True,
            'overall_low_count_warning': 'Tidak cukup data untuk menghitung skor keseluruhan.',
        }

    overall_nss = round(
        sum(a['nss'] for a in valid_aspects) / len(valid_aspects), 1
    )

    low_count_aspects = [a for a in valid_aspects if a.get('is_low_count')]

    aspect_labels = {
        'pigmentation': 'Pigmentasi', 'longevity': 'Ketahanan',
        'texture': 'Tekstur', 'hydration': 'Hidrasi', 'price': 'Harga',
    }

    warning = None
    if low_count_aspects:
        names = [aspect_labels.get(a['aspect'], a['aspect']) for a in low_count_aspects]
        warning = (
            f'Skor keseluruhan mungkin belum representatif karena '
            f'aspek {", ".join(names)} memiliki ulasan yang terbatas '
            f'(< {MINIMUM_REVIEW_THRESHOLD} ulasan).'
        )

    return {
        'overall_nss': overall_nss,
        'overall_is_low_confidence': len(low_count_aspects) > len(valid_aspects) / 2,
        'overall_low_count_warning': warning,
    }


def calculate_nss_and_breakdown(reviews: list[dict]) -> dict:
    """
    Aggregate per-aspect NSS and overall sentiment distribution.
    """
    aspect_names = [a.lower() for a in ASPECTS]

    absa_aspects_raw = []
    nss_scores = {}

    for aspect in aspect_names:
        aspect_reviews = [r for r in reviews if r.get('aspect') == aspect]
        pos = sum(1 for r in aspect_reviews if r.get('sentiment') == 'positive')
        neg = sum(1 for r in aspect_reviews if r.get('sentiment') == 'negative')
        neu = sum(1 for r in aspect_reviews if r.get('sentiment') == 'neutral')

        nss_meta = calculate_nss_with_metadata(reviews, aspect)

        absa_aspects_raw.append(ABSAAspect(
            aspect=aspect,
            positive=pos,
            negative=neg,
            neutral=neu,
            **nss_meta,
        ).model_dump())

        if nss_meta['nss'] is not None:
            nss_scores[aspect] = nss_meta['nss']

    overall_meta = calculate_overall_nss_with_metadata(absa_aspects_raw)

    review_sentiments: dict[str, dict[str, int]] = {}

    for r in reviews:
        rid = str(r.get('id', r.get('content', '')))

        if rid not in review_sentiments:
            review_sentiments[rid] = {
                'positive': 0,
                'negative': 0,
                'neutral': 0,
            }

        sentiment = r.get('sentiment')

        if sentiment in review_sentiments[rid]:
            review_sentiments[rid][sentiment] += 1

    total_pos = 0
    total_neg = 0
    total_neu = 0

    for counts in review_sentiments.values():
        winner = max(counts, key=counts.get)

        if winner == 'positive':
            total_pos += 1
        elif winner == 'negative':
            total_neg += 1
        else:
            total_neu += 1

    return {
        'overall_nss':               overall_meta['overall_nss'],
        'overall_is_low_confidence': overall_meta['overall_is_low_confidence'],
        'overall_low_count_warning': overall_meta['overall_low_count_warning'],
        'nss_scores':                nss_scores,
        'absa_aspects':              absa_aspects_raw,
        'sentiment_distribution':    SentimentDistribution(
            positive=total_pos,
            negative=total_neg,
            neutral=total_neu,
        ).model_dump(),
    }


def group_reviews_by_id(reviews_labeled: list[dict]) -> list[dict]:
    """
    Collapse expanded ABSA rows into one entry per unique review.

    Output per review:
        {
            content: ...,
            aspects: [
                {'aspect': 'texture', 'sentiment': 'positive'},
                ...
            ],
            overall: 'positive'
        }
    """
    from collections import Counter

    grouped: dict[str, dict] = {}
    order: list[str] = []

    for row in reviews_labeled:
        rid = str(row.get('id', row.get('content', '')))

        if rid not in grouped:
            order.append(rid)
            grouped[rid] = {
                'id': row.get('id'),
                'content': row.get('content'),
                'date': row.get('date'),
                'author': row.get('author'),
                'isVerified': row.get('isVerified', False),
                'aspects': [],
            }

        grouped[rid]['aspects'].append({
            'aspect': row.get('aspect'),
            'sentiment': row.get('sentiment'),
            'confidence': row.get('confidence'),
        })

    result = []

    for rid in order:
        entry = grouped[rid]
        sentiments = [
            a['sentiment']
            for a in entry['aspects']
            if a.get('sentiment') in {'positive', 'negative', 'neutral'}
        ]

        if not sentiments:
            entry['overall'] = 'neutral'
        else:
            counts = Counter(sentiments)
            top_two = counts.most_common(2)
            # Tie: dua sentimen dengan jumlah sama → fallback ke neutral
            if len(top_two) >= 2 and top_two[0][1] == top_two[1][1]:
                entry['overall'] = 'neutral'
            else:
                entry['overall'] = top_two[0][0]
        result.append(entry)

    return result