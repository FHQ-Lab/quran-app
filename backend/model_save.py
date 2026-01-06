from sentence_transformers import SentenceTransformer
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2') # Ganti dengan model yang kamu pakai
model.save('./backend/models/paraphrase-multilingual-MiniLM-L12-v2')