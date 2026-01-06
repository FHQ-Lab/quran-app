import json
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
import time

# Nama file sumber dan file output
SOURCE_INDEX = "quran_search_index.json"
OUTPUT_INDEX_FILE = "quran_faiss.index"
OUTPUT_MAP_FILE = "verse_references.json"

# Kita akan menggunakan model 'MiniLM' multilingual. 
# Model ini cepat, kecil, dan bagus dalam memahami makna lintas bahasa.
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'

def build_vector_database():
    print(f"Memulai pembangunan database vektor...")
    print(f"Model yang digunakan: {MODEL_NAME}")
    
    # 1. Muat model Sentence Transformer
    print("Memuat model AI (mungkin butuh beberapa saat saat pertama kali)...")
    model = SentenceTransformer(MODEL_NAME)
    print("Model berhasil dimuat.")

    # 2. Muat data JSON kita
    try:
        with open(SOURCE_INDEX, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if not data:
            print(f"Error: {SOURCE_INDEX} kosong!")
            return
        print(f"Berhasil memuat {len(data)} ayat dari {SOURCE_INDEX}.")
    except Exception as e:
        print(f"Error saat membaca {SOURCE_INDEX}: {e}")
        return

    # 3. Siapkan teks untuk di-"vectorize"
    texts_to_embed = []
    verse_references = [] # Ini adalah "peta" kita
    
    for verse in data:
        # Kita gabungkan teks terjemahan dan tafsir untuk 'makna' yang lebih kaya
        combined_text = f"Terjemahan: {verse['translation']} Tafsir: {verse['tafsir']}"
        texts_to_embed.append(combined_text)
        
        # Simpan referensi: Indeks ke-0 -> "1:1", Indeks ke-1 -> "1:2", dst.
        verse_references.append(f"{verse['surah']}:{verse['ayah']}")

    # 4. Enkode semua teks menjadi vektor (Ini adalah bagian yang butuh kerja CPU)
    print(f"Memulai proses encoding {len(texts_to_embed)} teks. Ini mungkin butuh waktu beberapa menit...")
    start_time = time.time()
    
    # show_progress_bar=True akan menampilkan status
    embeddings = model.encode(texts_to_embed, show_progress_bar=True)
    
    end_time = time.time()
    print(f"Proses encoding selesai dalam {end_time - start_time:.2f} detik.")

    # 5. Buat dan simpan indeks FAISS
    try:
        # Ambil dimensi vektor (misal: 384 untuk model ini)
        d = embeddings.shape[1]
        
        # Buat indeks FAISS
        index = faiss.IndexFlatL2(d)
        
        # Tambahkan vektor ke indeks
        index.add(np.array(embeddings).astype('float32')) # FAISS butuh float32
        
        # Simpan indeks ke disk
        faiss.write_index(index, OUTPUT_INDEX_FILE)
        print(f"Database vektor berhasil disimpan ke: {OUTPUT_INDEX_FILE}")
        
        # Simpan "peta" referensi kita
        with open(OUTPUT_MAP_FILE, 'w', encoding='utf-8') as f:
            json.dump(verse_references, f, ensure_ascii=False)
        print(f"Peta referensi berhasil disimpan ke: {OUTPUT_MAP_FILE}")

        print("\n=============================================")
        print("🎉 SUKSES! Database vektor RAG telah dibuat.")
        print("=============================================")

    except Exception as e:
        print(f"\nError saat membuat atau menyimpan indeks FAISS: {e}")

# Jalankan fungsi saat script dipanggil
if __name__ == "__main__":
    build_vector_database()