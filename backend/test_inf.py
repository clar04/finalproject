from app.services.inference import run_inference
reviews = [{"content": "bagus banget", "id": "1", "author": "a", "date": "1", "isVerified": True}]
print("Running inference...")
out = run_inference(reviews)
print(out)
