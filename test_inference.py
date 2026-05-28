import torch
import os
import sys

# Add backend directory to path to allow importing app modules
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from app.services.inference import model, tokenizer, SENTIMENT_MAP, device

test_reviews = [
    "Warnanya bagus banget, bibir jadi merah merona",
    "Bikin bibir kering dan pecah-pecah, ga suka banget",
    "Biasa aja sih, ga ada yang spesial",
    "Gampang luntur kalau dipakai makan",
    "Harganya lumayan murah untuk kualitas segini"
]

model.eval()

for text in test_reviews:
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=128, padding=True)
    with torch.no_grad():
        logits = model(
            input_ids=inputs['input_ids'].to(device),
            attention_mask=inputs['attention_mask'].to(device)
        )
    pred_idx = torch.argmax(logits, dim=1).item()
    print(f"Text: {text}")
    print(f"Logits: {logits.tolist()}")
    print(f"Pred_idx: {pred_idx}")
    print(f"Mapped: {SENTIMENT_MAP.get(pred_idx, 'neutral')}\n")
