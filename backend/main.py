from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware #Untuk menghubungkan ke frontend
import requests
import pyarabic.araby as araby # Import library yang baru diinstall
from pydantic import BaseModel # Untuk mendefinisikan body request
import re  # <--- INI PENTING WOK
import json  # <--- INI JUGA PENTING WOK
from thefuzz import fuzz
import os
from dotenv import load_dotenv
from groq import AsyncGroq # Kita pakai versi Async
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer
# import google.generativeai as genai

# === Model untuk menerima data dari frontend ===
class VoiceSearchRequest(BaseModel):
    text: str
    
#Inisialisasi aplikasi FastAPI
app = FastAPI()

# == Middleware CORS ==
# ini WAJIB agar frontend (yang berjalan di domain berbeda) bisa mengakses API ini
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], #izinkan semua origin, bisa diperketat lagi nanti
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#Definisikan URL dasar dari QURAN API
QURAN_API_BASE_URL = "https://quran-api-id.vercel.app"

# =====================================================================
# === BLOK STARTUP APLIKASI ===
# =====================================================================

# --- 1. Muat Variabel Lingkungan (.env) ---
load_dotenv()

# --- 2. Konfigurasi Model AI (Groq) ---
try:
    client = AsyncGroq(api_key=os.environ["GROQ_API_KEY"])
    print("INFO:    Klien Groq (Model Llama 3) berhasil dikonfigurasi.")
except Exception as e:
    client = None
    print(f"!!! ERROR FATAL: Gagal mengkonfigurasi Groq: {e} !!!")

# --- 3. Muat Model Sentence Transformer (untuk RAG) ---
# Model ini akan mengubah pertanyaan user menjadi vektor
MODEL_NAME = 'paraphrase-multilingual-MiniLM-L12-v2'
try:
    print(f"INFO:    Memuat model RAG '{MODEL_NAME}'... (Mungkin butuh beberapa saat)")
    RAG_MODEL = SentenceTransformer(MODEL_NAME)
    print("INFO:    Model RAG berhasil dimuat.")
except Exception as e:
    RAG_MODEL = None
    print(f"!!! ERROR FATAL: Gagal memuat model RAG: {e} !!!")

# --- 4. Muat Database Vektor (FAISS) & Peta Referensi ---
FAISS_INDEX_FILE = "quran_faiss.index"
VERSE_MAP_FILE = "verse_references.json"
try:
    FAISS_INDEX = faiss.read_index(FAISS_INDEX_FILE)
    with open(VERSE_MAP_FILE, 'r', encoding='utf-8') as f:
        VERSE_REFERENCES = json.load(f) # Ini adalah list ["1:1", "1:2", ...]
    print(f"INFO:    Database Vektor ({FAISS_INDEX.ntotal} vektor) & Peta Referensi berhasil dimuat.")
except Exception as e:
    FAISS_INDEX = None
    VERSE_REFERENCES = []
    print(f"!!! ERROR FATAL: Gagal memuat database FAISS: {e} !!!")

# --- 5. Muat Peta Teks (dari quran_search_index.json) ---
# Kita tetap butuh ini untuk mengambil teks tafsir berdasarkan referensi
SOURCE_INDEX_FILE = "quran_search_index.json"
QURAN_TEXT_MAP = {} # Kita ubah dari list jadi DICTIONARY untuk akses cepat
try:
    with open(SOURCE_INDEX_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Ubah list jadi dictionary (hash map)
    for verse in data:
        key = f"{verse['surah']}:{verse['ayah']}"
        QURAN_TEXT_MAP[key] = verse # Simpan semua data ayat
    print(f"INFO:    Berhasil memuat {len(QURAN_TEXT_MAP)} teks ayat ke dalam Peta.")
except Exception as e:
    QURAN_TEXT_MAP = {}
    print(f"!!! ERROR FATAL: Gagal memuat {SOURCE_INDEX_FILE}: {e} !!!")

# --- 6. Muat Peta Nama Surah (dari API) ---
SURAH_NAME_TO_NUMBER = {}
SURAH_NUMBER_TO_NAME = {}
try:
    # (Kode untuk memuat peta nama surah tetap sama seperti sebelumnya)
    print("INFO:    Mengambil data peta Surah...")
    response = requests.get(f"{QURAN_API_BASE_URL}/surah") 
    response.raise_for_status()
    surahs_data = response.json().get("data", [])
    
    for surah in surahs_data:
        number = surah["number"]
        SURAH_NUMBER_TO_NAME[number] = surah["name"]["transliteration"]["id"]
        names_to_add = [
            surah["name"]["transliteration"]["id"].lower(),
            surah["name"]["short"].lower(),
            surah["name"]["translation"]["id"].lower()
        ]
        for name in names_to_add:
            if name:
                SURAH_NAME_TO_NUMBER[name] = number
                norm_name = name.replace("-", "").replace(" ", "")
                SURAH_NAME_TO_NUMBER[norm_name] = number
    print(f"INFO:    Berhasil memuat {len(SURAH_NAME_TO_NUMBER)} alias nama Surah.")
except Exception as e:
    print(f"!!! ERROR FATAL: Gagal memuat peta nama Surah: {e} !!!")

# =====================================================================
# === AKHIR BLOK STARTUP ===
# =====================================================================


def normalize_arabic(text: str) -> str:
    """
    Fungsi Normalisasi Master BARU.
    Sinkron dengan normalizeArabicJS di frontend.
    """
    try:
        # 1. Hapus Harakat, Dagger Alif, Annotations, Alif Wasl, Madda
        text = re.sub(r'[\u064B-\u065F\u0610-\u061A\u0670\u0671\u0653]', '', text)
        
        # 2. Hapus Tatweel
        text = re.sub(r'\u0640', '', text)
        
        # 3. Normalisasi Alif (أ, إ, آ -> ا)
        text = re.sub(r'[\u0622\u0623\u0625]', '\u0627', text)
        
        # 4. Normalisasi Ya (ى -> ي)
        text = re.sub(r'\u0649', '\u064A', text)
        
        # 5. Normalisasi Ta Marbuta (ة -> ه)
        text = re.sub(r'\u0629', '\u0647', text)

        # 6. Hapus semua sisa non-huruf Arab dan non-spasi
        text = re.sub(r'[^\u0621-\u064A\s]', '', text)
        
        # 7. Hapus spasi berlebih
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    except Exception as e:
        print(f"Error normalisasi teks: {e}")
        return text
    
def get_surah_number_from_name(name: str) -> int | None:
    """Mengubah string nama surah menjadi nomor surah."""
    # Normalisasi input (lowercase, hapus strip, hapus spasi)
    query = name.lower().strip().replace("-", "").replace(" ", "")
    
    # Langsung cek di peta kita yang sudah pintar
    return SURAH_NAME_TO_NUMBER.get(query)
        
    # return None # Tidak ditemukan

# Endpoint pertama: mendapatkan detail ayat sepsifik
@app.get("/surah/{surah_number}/{ayah_number}")
def get_spesific_ayah(surah_number: int, ayah_number: int):
    #membentuk URL lengkap untuk direquest
    url = f"{QURAN_API_BASE_URL}/surah/{surah_number}/{ayah_number}"

    try:
        # Mengirim request dari Quran API
        response = requests.get(url)
        response.raise_for_status() #Akan error jika status code bukan 2xx

        # Mengambil data JSON dari respons
        data = response.json()
        return data
    
    except requests.exceptions.RequestException as e:
        #Jika gagal, akan terkirim pesan error yang jelas
        raise HTTPException(status_code=404, detail=f"Gagal mengambil data atau data tidak ditemukan: {e}")

# === ENDPOINT GLOBAL BARU (VERSI UPGRADE) ===
@app.get("/search")
def search_global(q: str):
    """
    Endpoint "Otak" yang menangani semua jenis pencarian.
    - Pola "Surah 2 Ayat 255"
    - Pola "2:255" atau "2 255"
    - Pola "al-baqarah:255" atau "al baqarah 255"
    - Pola "Surah Al-Mulk"
    - Pola "sabar" (teks Indo)
    - Pola "بسم الله" (teks Arab)
    """
    query = q.strip()
    
    # === Pola 1: Pencarian Ayat Spesifik (di-upgrade) ===
    
    # Pola A: "Surah 2 Ayat 255" (Natural Language)
    # re.IGNORECASE membuatnya tidak peduli huruf besar/kecil
    match_natural = re.match(r'^(surah|surat)\s+(\d+)\s+(ayat)\s+(\d+)$', query, re.IGNORECASE)
    if match_natural:
        try:
            surah_number = int(match_natural.group(2)) # Ambil angka surah
            ayah_number = int(match_natural.group(4))  # Ambil angka ayat
            print(f"INFO: Pola 1A (Natural) terdeteksi: {surah_number}:{ayah_number}")
            return get_spesific_ayah(surah_number, ayah_number)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error mengambil ayat: {e}")

    # Pola B: "2:255" atau "2 255" (Hanya Angka)
    # [:\s]+ artinya separator bisa berupa ":" atau spasi (atau keduanya)
    match_num_num = re.match(r'^(\d+)[:\s]+(\d+)$', query)
    if match_num_num:
        try:
            surah_number = int(match_num_num.group(1))
            ayah_number = int(match_num_num.group(2))
            print(f"INFO: Pola 1B (Num-Num) terdeteksi: {surah_number}:{ayah_number}")
            return get_spesific_ayah(surah_number, ayah_number)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error mengambil ayat: {e}")

    # Pola C: "al-fatihah:7" atau "al fatihah 7" (Nama Surah + Angka)
    match_name_num = re.match(r'^(.*?)[:\s]+(\d+)$', query)
    if match_name_num:
        surah_part = match_name_num.group(1).strip()
        ayah_part = int(match_name_num.group(2))
        
        # Gunakan helper kita untuk mengubah "al fatihah" menjadi 1
        surah_number = get_surah_number_from_name(surah_part) 
            
        if surah_number:
            try:
                print(f"INFO: Pola 1C (Name-Num) terdeteksi: {surah_number}:{ayah_part}")
                return get_spesific_ayah(surah_number, ayah_part)
            except HTTPException as e:
                raise e # Lemparkan error jika ayat tidak ada
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error mengambil ayat: {e}")
        else:
            # Jika nama surah tidak ditemukan, kita biarkan jatuh ke Pola 2
            print(f"INFO: Pola 1C gagal, '{surah_part}' bukan nama surah. Jatuh ke Pola 2.")
            pass

    # === Pola 1.5: Pencarian "Nama Surah Saja" (di-upgrade) ===
    
    # Salinan kueri untuk dicek
    surah_query = query
    
    # Coba bersihkan awalan "surah" atau "surat" (case-insensitive)
    if re.match(r'^(surah|surat)\s+', surah_query, re.IGNORECASE):
        # Ganti "surah " / "surat " dengan string kosong
        surah_query = re.sub(r'^(surah|surat)\s+', '', surah_query, flags=re.IGNORECASE).strip()

    # Cek kueri yang sudah bersih (misal "Al-Mulk") ATAU kueri asli (jika tidak ada awalan "surah")
    surah_number_match = get_surah_number_from_name(surah_query)
    
    if surah_number_match:
        print(f"INFO: Pola 1.5 (Nama Surah) terdeteksi untuk: '{query}' ({surah_number_match})")
        matches = []
        # Loop di file indeks kita
        for verse in QURAN_TEXT_MAP.values():
            if verse["surah"] == surah_number_match:
                matches.append({
                    "surah": verse["surah"],
                    "ayah": verse["ayah"],
                    "text_arab": verse["text_arab"],
                    "translation": verse["translation"],
                    "surah_name": SURAH_NUMBER_TO_NAME.get(verse['surah'], 'Unknown'),
                    "score": 100, # Ini adalah pencocokan pasti
                    "match_type": "surah_match" 
                })
        
        if not matches:
            raise HTTPException(status_code=404, detail=f"Surah {query} ditemukan, tapi tidak ada ayat di indeks.")
        
        # Kembalikan sebagai daftar
        return {
            "match_type": "multiple",
            "results": matches
        }

    # === Pola 2: Pencarian Teks (Full-Text Search) ===
    # Jika tidak ada pola di atas yang cocok, baru jalankan ini
    print(f"INFO: Tidak ada pola cocok. Melakukan Full-Text Search untuk: '{query}'")
    
    # Normalisasi kueri
    query_norm_arab = normalize_arabic(query)
    query_lower_indo = query.lower()
    
    matches = []
    found_ids = set() 
    
    MIN_ARABIC_SCORE = 95 
    
    for verse in QURAN_TEXT_MAP.values():
        verse_id = f"{verse['surah']}:{verse['ayah']}"
        if verse_id in found_ids:
            continue 

        score = 0
        match_type = ""
        
        if query_lower_indo in verse["translation"].lower():
            score = 100
            match_type = "translation"
        
        elif query_lower_indo in verse["tafsir"].lower():
            score = 99 
            match_type = "tafsir"
            
        else:
            arabic_score = fuzz.partial_ratio(query_norm_arab, verse["text_normalized"])
            if arabic_score >= MIN_ARABIC_SCORE:
                score = arabic_score
                match_type = "lafadz"
        
        if score > 0:
            matches.append({
                "surah": verse["surah"],
                "ayah": verse["ayah"],
                "text_arab": verse["text_arab"],
                "translation": verse["translation"],
                "surah_name": SURAH_NUMBER_TO_NAME.get(verse['surah'], 'Unknown'),
                "score": score,
                "match_type": match_type
            })
            found_ids.add(verse_id)

    if not matches:
        raise HTTPException(status_code=404, detail="Tidak ada hasil yang cocok ditemukan.")
        
    matches.sort(key=lambda x: x['score'], reverse=True)
    
    return {
        "match_type": "multiple",
        "results": matches
    }


    # === ENDPOINT UNTUK VOICE SEARCH ===
@app.post("/search-by-text")
def search_by_text(request: VoiceSearchRequest):
    if not QURAN_TEXT_MAP.values():
        raise HTTPException(status_code=500, detail="Indeks pencarian Qur'an tidak bisa dimuat.")

    spoken_text_normalized = normalize_arabic(request.text)

    # === LOGIKA PENCARIAN BARU ===

    # Kita tidak lagi mencari 'best_score', tapi 'semua skor bagus'
    matches = []

    # Skor minimal untuk dianggap sebagai kecocokan (sangat tinggi)
    MIN_CONFIDENCE_SCORE = 95 

    print("-" * 30)
    print(f"==> Menerima Teks: {request.text}")
    print(f"==> Teks Normalisasi: {spoken_text_normalized}")
    print("==> Memulai Pencarian... (Mencari skor >= {MIN_CONFIDENCE_SCORE}%)")

    for verse in QURAN_TEXT_MAP.values():
        # Bandingkan dengan 'text_normalized' yang baru
        verse_text_normalized = verse["text_normalized"]

        # Kita tetap pakai partial_ratio, sangat bagus untuk ucapan
        current_score = fuzz.partial_ratio(spoken_text_normalized, verse_text_normalized)
        
        # =======================================================
        # === FILTER UNTUK HURUFUL MUQATTA'AT ===

        # Cek apakah teks indeks sangat pendek DAN tidak ada spasi
        is_muqattaat_like = len(verse_text_normalized) < 10 and ' ' not in verse_text_normalized

        # Cek apakah teks ucapan jauh lebih panjang
        is_spoken_text_long = len(spoken_text_normalized) > (len(verse_text_normalized) * 2)

        # Jika ini adalah 'false positive' (الم cocok di dalam الملك)
        if is_muqattaat_like and is_spoken_text_long:
            current_score = 0 # Buang skor ini, jangan dilaporkan

        # =======================================================

        # Jika skornya lolos threshold, masukkan ke daftar
        if current_score >= MIN_CONFIDENCE_SCORE:
            matches.append({
                "surah": verse["surah"],
                "ayah": verse["ayah"],
                "text_arab": verse["text_arab"], # Ambil teks asli
                "score": current_score
            })

    print(f"==> Pencarian Selesai. Ditemukan {len(matches)} kecocokan.")
    print("-" * 30)

    # --- Bagian Paling Penting: Mengembalikan Respons ---

    if not matches:
        # Jika tidak ada yang cocok sama sekali
        raise HTTPException(status_code=404, detail="Ayat yang Anda ucapkan tidak ditemukan.")

    elif len(matches) == 1:
        # --- KASUS 1: HANYA ADA 1 HASIL ---
        # Ini adalah kasus normal (misal: Al-Mulk 18)
        # Kita panggil endpoint lama untuk dapat data LENGKAP (termasuk tafsir)
        match = matches[0]
        try:
            # Kita ubah formatnya agar SAMA dengan respons 'get_spesific_ayah'
            # Ini PENTING agar frontend tidak bingung
            full_ayat_data = get_spesific_ayah(match["surah"], match["ayah"])
            return full_ayat_data
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Gagal mengambil detail ayat: {e}")

    else:
        # --- KASUS 2: ADA BANYAK HASIL (Ar-Rahman) ---
        # Kita kembalikan format JSON baru yang menandakan "pilihan ganda"

        # Sortir berdasarkan skor (walau mungkin semua sama)
        matches.sort(key=lambda x: x['score'], reverse=True)

        return {
            "match_type": "multiple",
            "results": matches
        }
        
# Helper Function
def extract_ayat_numbers(message: str) -> list[int]:
    """Mengekstrak nomor ayat (termasuk rentang) dari pesan."""
    numbers = set()
    
    # 1. Cari angka individual (misal: "ayat 5" atau "10")
    for match in re.finditer(r'\b(\d+)\b', message):
        num = int(match.group(1))
        if 0 < num <= 30:
            numbers.add(num)
            
    # 2. Cari rentang angka (misal: "1-5" atau "10-15")
    for match in re.finditer(r'(\d+)\s*-\s*(\d+)', message):
        start = int(match.group(1))
        end = int(match.group(2))
        if start < end and end <= 30:
            for num in range(start, end + 1):
                numbers.add(num)
                
    return sorted(list(numbers)) 
  

# === ENDPOINT CHATBOT (VERSI RAG VEKTOR) ===
@app.post("/chatbot")
async def handle_chatbot_message(request: VoiceSearchRequest):
    user_message = request.text.lower()
    
    # --- LOGIKA BARU UNTUK MEMBEDAKAN NIAT ---

    # 1. Cek apakah ini pertanyaan RAG (analisis)?
    rag_keywords = ["hubungan", "jelaskan", "apa", "kenapa", "mengapa", "ringkasan", "rangkuman", "tentang"]
    is_rag_question = any(word in user_message for word in rag_keywords) or re.search(r'\d+-\d+', user_message)

    # 2. Ekstrak SEMUA angka ayat Al-Mulk (1-30) dari pertanyaan
    ayat_list = extract_ayat_numbers(user_message) # Gunakan helper function yang sudah ada

    # --- PENENTUAN KEPUTUSAN ---

    # KASUS 1: Permintaan ayat sederhana (Contoh: "tafsir 5", "tunjukkan 11")
    # -> ADA 1 angka, dan BUKAN pertanyaan RAG
    if len(ayat_list) == 1 and not is_rag_question:
        try:
            ayah_number = ayat_list[0]
            print(f"INFO: Chatbot (Kasus 1: Simple) terdeteksi. Mencari Al-Mulk (67) ayat {ayah_number}")
            return get_spesific_ayah(surah_number=67, ayah_number=ayah_number)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error saat mengambil ayat: {e}")

    # KASUS 2: Pertanyaan RAG khusus Al-Mulk (Contoh: "hubungan 1-5", "jelaskan ayat 10")
    # -> ADA angka, DAN INI pertanyaan RAG
    elif len(ayat_list) > 0 and is_rag_question:
        print(f"INFO: Chatbot (Kasus 2: Al-Mulk RAG) terdeteksi untuk ayat: {ayat_list}")
        
        if not client or not QURAN_TEXT_MAP:
            raise HTTPException(status_code=500, detail="Model AI atau Peta Teks tidak terkonfigurasi.")
        
        # Bangun konteks dinamis HANYA dari Al-Mulk
        dynamic_context = ""
        for num in ayat_list:
            verse_ref = f"67:{num}"
            verse_data = QURAN_TEXT_MAP.get(verse_ref)
            if verse_data:
                dynamic_context += f"Tafsir Ayat {num}: {verse_data['tafsir']}\n"
        
        if not dynamic_context:
            raise HTTPException(status_code=404, detail="Tidak ditemukan konteks tafsir untuk ayat-ayat tersebut di Al-Mulk.")
        
        context_source_text = f"Tafsir Al-Mulk ayat {', '.join(map(str, ayat_list))}"
        
    # KASUS 3: Pertanyaan RAG Umum (Contoh: "apa itu sabar?", "jelaskan neraka")
    # -> TIDAK ADA angka, ATAU pertanyaan RAG tanpa angka
    else:
        print(f"INFO: Chatbot (Kasus 3: Vector RAG) terdeteksi. Menerima pertanyaan: {user_message}")
        
        if not client or not RAG_MODEL or not FAISS_INDEX or not QURAN_TEXT_MAP:
            raise HTTPException(status_code=500, detail="Model AI atau Database Vektor tidak terkonfigurasi.")

        try:
            # 1. Ubah pertanyaan user menjadi vektor
            query_vector = RAG_MODEL.encode([user_message], normalize_embeddings=True)
            # 2. Cari di FAISS
            k = 5 # Ambil 5 hasil teratas
            distances, indices = FAISS_INDEX.search(np.array(query_vector).astype('float32'), k)
            
            # 3. Bangun Konteks Dinamis
            dynamic_context = ""
            context_source = []
            for i in indices[0]:
                verse_ref = VERSE_REFERENCES[i]
                verse_data = QURAN_TEXT_MAP.get(verse_ref)
                if verse_data:
                    surah_name = SURAH_NUMBER_TO_NAME.get(verse_data['surah'], 'Unknown')
                    context_source.append(f"QS. {surah_name} ({verse_ref})")
                    dynamic_context += f"Konteks dari {surah_name} ayat {verse_data['ayah']}:\n"
                    dynamic_context += f"Terjemahan: {verse_data['translation']}\n"
                    dynamic_context += f"Tafsir: {verse_data['tafsir']}\n---\n"
            
            if not dynamic_context:
                raise HTTPException(status_code=404, detail="Tidak ditemukan konteks yang relevan untuk pertanyaan Anda.")
            
            context_source_text = f"konteks {', '.join(context_source)}"

        except Exception as e:
            print(f"Error Vector RAG: {e}")
            raise HTTPException(status_code=500, detail=f"Gagal melakukan pencarian vektor: {e}")

    # --- BAGIAN GENERASI (Umum untuk Kasus 2 & 3) ---
    try:
        # Susun Prompt RAG (INI DIPERBAIKI - Bug #2)
        prompt = f"""
        Anda adalah asisten AI yang ahli dalam Tafsir Al-Qur'an.
        Tugas Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan konteks tafsir dari {context_source_text} yang saya berikan.
        Jawab dengan ringkas, jelas, dan dalam bahasa Indonesia.
        Jika pertanyaan pengguna tidak relevan dengan konteks, jawab dengan sopan bahwa Anda hanya bisa menjawab seputar tafsir Al-Mulk.

        --- KONTEKS TAFSIR ---
        {dynamic_context}
        --- AKHIR KONTEKS ---
        """

        print("INFO:    Mengirim prompt RAG ke Groq...")
        
        # Ini adalah perbaikan untuk Bug #2
        chat_completion = await client.chat.completions.create(
            messages=[
                {
                    "role": "system", # Prompt sistem HANYA berisi instruksi dan konteks
                    "content": prompt 
                },
                {
                    "role": "user", # Prompt user HANYA berisi pertanyaan asli
                    "content": user_message 
                }
            ],
            model="llama-3.3-70b-versatile", 
        )
        
        return {"answer_type": "text", "content": chat_completion.choices[0].message.content}

    except Exception as e:
        print(f"Error Groq API atau RAG: {e}")
        if "413" in str(e):
             raise HTTPException(status_code=500, detail="Permintaan Anda terlalu besar (melebihi batas token). Coba ajukan pertanyaan yang lebih spesifik.")
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan saat menghubungi model AI: {e}")