import os

import torch                          # pyrefly: ignore [missing-import]
import torch.nn as nn                 # pyrefly: ignore [missing-import]
import torch.nn.functional as F       # pyrefly: ignore [missing-import]
# pyrefly: ignore [missing-import]
from transformers import AutoModel, AutoTokenizer
from app.models.product import ABSAAspect, SentimentDistribution

# ==============================================================================
# 1. CONFIG
# ==============================================================================

ASPECTS    = ['PIGMENTATION', 'LONGEVITY', 'TEXTURE', 'HYDRATION', 'PRICE']
SENTIMENTS = ['negative', 'neutral', 'positive']   # index 0 / 1 / 2
ID2SENT    = {i: s for i, s in enumerate(SENTIMENTS)}

CONFIG = {
    # Model
    'model_name'         : 'indobenchmark/indobert-base-p1',
    'num_outputs'        : 15,          # 5 aspects × 3 sentiments
    'dropout'            : 0.3,
    # Tokenization
    'max_length'         : 128,
    # Partial unfreeze (top 4 BERT layers trainable)
    'num_unfrozen_layers': 4,
    'lr_bert'            : 2e-5,
    'lr_cabilstm'        : 5e-4,
    # CABiLSTM architecture (He et al., 2025)
    'bilstm_hidden'      : 384,
    'attn_heads'         : 8,
    'conv_kernel'        : 5,
    'mlp_hidden_1'       : 1024,
    'mlp_hidden_2'       : 512,
}

# ==============================================================================
# 2. MODEL ARCHITECTURE
# ==============================================================================

class CABiLSTMCore(nn.Module):
    """
    CABiLSTM deep implicit feature extraction layer (He et al., 2025 §3.3).

    Pipeline:
      1. Dual-layer BiLSTM  →  5 feature groups {V, F1, B1, F2, B2}
      2. Independent MHSA on each group
      3. Channel-wise concat via Conv2d(5 → 1) + ReLU

    Input : x  [B, L, hidden_dim]
    Output: Co [B, L, hidden_dim]
    """

    def __init__(self, hidden_dim: int = 768, bilstm_hidden: int = 384,
                 num_heads: int = 8, conv_kernel: int = 5):
        super().__init__()

        lstm_args = dict(num_layers=1, bidirectional=True, batch_first=True)
        self.bilstm1 = nn.LSTM(hidden_dim, bilstm_hidden, **lstm_args)
        self.bilstm2 = nn.LSTM(hidden_dim, bilstm_hidden, **lstm_args)

        self.attention = nn.MultiheadAttention(
            embed_dim=hidden_dim, num_heads=num_heads,
            dropout=0.0, batch_first=True,
        )

        self.conv = nn.Conv2d(
            in_channels=5, out_channels=1,
            kernel_size=conv_kernel, padding=conv_kernel // 2,
        )

    @staticmethod
    def _expand_bidirectional(out: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """Split BiLSTM output into forward/backward halves, then cat to full hidden_dim."""
        half = out.size(-1) // 2
        fwd, bwd = out[..., :half], out[..., half:]
        return torch.cat([fwd, fwd], dim=-1), torch.cat([bwd, bwd], dim=-1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out1, _ = self.bilstm1(x)
        F1, B1  = self._expand_bidirectional(out1)

        out2, _ = self.bilstm2(out1)
        F2, B2  = self._expand_bidirectional(out2)

        # Independent self-attention on each of the 5 feature groups
        attended = [self.attention(fg, fg, fg)[0] for fg in (x, F1, B1, F2, B2)]

        Ao = torch.stack(attended, dim=1)        # [B, 5, L, hidden_dim]
        Co = F.relu(self.conv(Ao).squeeze(1))    # [B, L, hidden_dim]
        return Co


class M3v2CE_CABiLSTM_IndoBERT(nn.Module):
    """
    M3-v2-CE: CABiLSTM-IndoBERT with partial BERT unfreeze.

    Output: 15 logits  (5 aspects × 3 sentiments, flat layout)
    Loss  : Masked Weighted BCE — no Focal modulation (ablation variant of M3-v2).
    """

    def __init__(self, config: dict):
        super().__init__()

        self.bert = AutoModel.from_pretrained(config['model_name'])
        self._apply_partial_freeze(config['num_unfrozen_layers'])

        hidden_dim = self.bert.config.hidden_size

        self.cabilstm = CABiLSTMCore(
            hidden_dim    = hidden_dim,
            bilstm_hidden = config['bilstm_hidden'],
            num_heads     = config['attn_heads'],
            conv_kernel   = config['conv_kernel'],
        )

        self.classifier = nn.Sequential(
            nn.Linear(hidden_dim,             config['mlp_hidden_1']),
            nn.ReLU(),
            nn.Dropout(config['dropout']),
            nn.Linear(config['mlp_hidden_1'], config['mlp_hidden_2']),
            nn.ReLU(),
            nn.Dropout(config['dropout']),
            nn.Linear(config['mlp_hidden_2'], config['num_outputs']),
        )
        self._init_classifier_weights()

    # ------------------------------------------------------------------
    def _apply_partial_freeze(self, num_unfrozen: int) -> None:
        """Freeze BERT embeddings + all but the top `num_unfrozen` encoder layers."""
        n_total  = len(self.bert.encoder.layer)
        n_frozen = n_total - num_unfrozen

        for p in self.bert.embeddings.parameters():
            p.requires_grad = False

        for i, layer in enumerate(self.bert.encoder.layer):
            for p in layer.parameters():
                p.requires_grad = (i >= n_frozen)

    def _init_classifier_weights(self) -> None:
        for layer in self.classifier:
            if isinstance(layer, nn.Linear):
                nn.init.xavier_uniform_(layer.weight)
                nn.init.zeros_(layer.bias)

    # ------------------------------------------------------------------
    def forward(self, input_ids: torch.Tensor,
                attention_mask: torch.Tensor,
                token_type_ids: torch.Tensor) -> torch.Tensor:
        V = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            token_type_ids=token_type_ids,
        ).last_hidden_state                                  # [B, L, 768]

        Co = self.cabilstm(V)                               # [B, L, 768]

        # Masked mean-pooling over non-padding tokens
        mask_exp = attention_mask.unsqueeze(-1).float()
        M = (Co * mask_exp).sum(dim=1) / mask_exp.sum(dim=1).clamp(min=1)

        return self.classifier(M)                           # [B, 15]


# ==============================================================================
# 3. MODEL INITIALISATION
# ==============================================================================

device    = torch.device('cpu')
tokenizer = AutoTokenizer.from_pretrained(CONFIG['model_name'])
model     = M3v2CE_CABiLSTM_IndoBERT(CONFIG).to(device)

MODEL_PATH = 'app/m3v2ce_best.pt'
if os.path.exists(MODEL_PATH):
    model.load_state_dict(torch.load(MODEL_PATH, map_location=device))
    print(f'Loaded weights from {MODEL_PATH}')
else:
    print(f'[WARN] No weights found at {MODEL_PATH} — using random initialisation.')

model.eval()

# ==============================================================================
# 4. INFERENCE
# ==============================================================================

def _predict_aspects(text: str) -> list[dict]:
    """
    Run the M3v2CE model on a single review text.

    Returns a list of dicts, one per active aspect:
        [{'aspect': 'PIGMENTATION', 'sentiment': 'positive'}, ...]

    Slots where the model outputs no_aspect (all three sentiment probs < 0.5)
    are silently skipped.
    """
    enc = tokenizer(
        text,
        max_length=CONFIG['max_length'],
        padding='max_length',
        truncation=True,
        return_tensors='pt',
    )

    with torch.no_grad():
        logits = model(
            input_ids      = enc['input_ids'].to(device),
            attention_mask = enc['attention_mask'].to(device),
            token_type_ids = enc['token_type_ids'].to(device),
        )                                           # [1, 15]

    probs = torch.sigmoid(logits).view(5, 3)       # [5 aspects, 3 sentiments]

    predictions = []
    for asp_idx, aspect in enumerate(ASPECTS):
        asp_probs = probs[asp_idx]                  # [3]
        best_sent_idx = asp_probs.argmax().item()
        best_prob     = asp_probs[best_sent_idx].item()

        # Treat aspect as active only when at least one sentiment prob ≥ 0.5
        if best_prob >= 0.5:
            predictions.append({
                'aspect'   : aspect.lower(),
                'sentiment': ID2SENT[best_sent_idx],
            })

    return predictions


def run_inference(reviews_raw: list[dict]) -> list[dict]:
    """
    Run ABSA inference over a list of raw review dicts.

    Each input dict must have a 'content' key with the review text.
    Each output dict gains 'aspect' and 'sentiment' keys.

    A single review may produce multiple output rows (one per active aspect).
    If no aspect is detected, the review is emitted once with aspect='texture'
    and sentiment='neutral' as a safe fallback.
    """
    results = []

    for review in reviews_raw:
        text = review.get('content', '').strip()

        if not text:
            results.append({**review, 'aspect': 'texture', 'sentiment': 'neutral'})
            continue

        predictions = _predict_aspects(text)

        if predictions:
            for pred in predictions:
                results.append({**review, **pred})
        else:
            # Model found no active aspect — emit neutral fallback
            results.append({**review, 'aspect': 'texture', 'sentiment': 'neutral'})

    return results


# ==============================================================================
# 5. NSS CALCULATION
# ==============================================================================

def calculate_nss_and_breakdown(reviews: list[dict]) -> dict:
    """
    Aggregate per-aspect NSS (Net Sentiment Score) and overall sentiment distribution.

    NSS = (positive - negative) / total  × 100  (rounded to int)

    sentiment_distribution reflects unique reviews (majority-vote per review),
    NOT the expanded aspect rows, so the pie chart total matches total_reviews.
    """
    aspect_names = [a.lower() for a in ASPECTS]
    absa_aspects = []
    nss_scores   = {}

    for aspect in aspect_names:
        aspect_reviews = [r for r in reviews if r.get('aspect') == aspect]
        if not aspect_reviews:
            continue

        pos   = sum(1 for r in aspect_reviews if r['sentiment'] == 'positive')
        neg   = sum(1 for r in aspect_reviews if r['sentiment'] == 'negative')
        neu   = sum(1 for r in aspect_reviews if r['sentiment'] == 'neutral')
        total = pos + neg + neu

        nss = round(((pos - neg) / total) * 100) if total > 0 else 0

        absa_aspects.append(ABSAAspect(
            aspect=aspect, positive=pos, negative=neg, neutral=neu, nss=nss
        ))
        nss_scores[aspect] = nss

    # ── Sentiment distribution: per unique review via majority vote ──────────
    # Group all rows by review id, then pick the dominant sentiment.
    review_sentiments: dict[str, dict[str, int]] = {}
    for r in reviews:
        rid = r.get('id', r.get('content', ''))   # fall back to content if no id
        if rid not in review_sentiments:
            review_sentiments[rid] = {'positive': 0, 'negative': 0, 'neutral': 0}
        review_sentiments[rid][r['sentiment']] = review_sentiments[rid].get(r['sentiment'], 0) + 1

    total_pos = total_neg = total_neu = 0
    for counts in review_sentiments.values():
        winner = max(counts, key=counts.get)
        if winner == 'positive':
            total_pos += 1
        elif winner == 'negative':
            total_neg += 1
        else:
            total_neu += 1

    total_unique = total_pos + total_neg + total_neu
    overall_nss = round(((total_pos - total_neg) / total_unique) * 100) if total_unique > 0 else 0

    return {
        'overall_nss'           : overall_nss,
        'nss_scores'            : nss_scores,
        'absa_aspects'          : [a.model_dump() for a in absa_aspects],
        'sentiment_distribution': SentimentDistribution(
            positive=total_pos, negative=total_neg, neutral=total_neu
        ).model_dump(),
    }


def group_reviews_by_id(reviews_labeled: list[dict]) -> list[dict]:
    """
    Collapse the ABSA-expanded review list back into one entry per unique review.

    Each entry keeps the original review fields (content, date, author, id,
    isVerified) and adds:
        aspects   : list of {aspect, sentiment} dicts detected by the model
        overall   : dominant sentiment across all detected aspects (majority vote)

    This is used to drive the "Per Ulasan" tab in the frontend so users can
    see each review once with all its aspect labels side-by-side.
    """
    from collections import defaultdict, Counter

    grouped: dict[str, dict] = {}
    order:   list[str]       = []   # preserve insertion order

    for row in reviews_labeled:
        rid = row.get('id', row.get('content', ''))
        if rid not in grouped:
            order.append(rid)
            grouped[rid] = {
                'id'        : row.get('id'),
                'content'   : row.get('content'),
                'date'      : row.get('date'),
                'author'    : row.get('author'),
                'isVerified': row.get('isVerified', False),
                'aspects'   : [],
            }
        grouped[rid]['aspects'].append({
            'aspect'   : row.get('aspect'),
            'sentiment': row.get('sentiment'),
        })

    # Compute overall sentiment via majority vote and attach it
    result = []
    for rid in order:
        entry = grouped[rid]
        sentiments = [a['sentiment'] for a in entry['aspects']]
        entry['overall'] = Counter(sentiments).most_common(1)[0][0] if sentiments else 'neutral'
        result.append(entry)

    return result