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
import google.generativeai as genai

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

# === Data Cache: Memuat Indeks dari File Lokal ===
SEARCH_INDEX_FILE = "quran_search_index.json"
QURAN_SEARCH_INDEX = [] # Default list kosong

try:
    # Buka dan baca file JSON yang sudah kita buat
    with open(SEARCH_INDEX_FILE, 'r', encoding='utf-8') as f:
        QURAN_SEARCH_INDEX = json.load(f)
    
    if QURAN_SEARCH_INDEX:
        print(f"INFO:    Berhasil memuat {len(QURAN_SEARCH_INDEX)} ayat dari {SEARCH_INDEX_FILE}")
    else:
        print(f"!!! WARNING: {SEARCH_INDEX_FILE} ditemukan tapi kosong.")

except FileNotFoundError:
    print(f"!!! ERROR FATAL: File {SEARCH_INDEX_FILE} tidak ditemukan. !!!")
    print("!!! Pastikan Anda sudah menjalankan 'python build_index.py' terlebih dahulu. !!!")
except Exception as e:
    print(f"!!! ERROR FATAL: Gagal memuat {SEARCH_INDEX_FILE}: {e} !!!")
# =======================================================

# === Muat Peta Nama Surah ===
SURAH_NAME_TO_NUMBER = {}
SURAH_NUMBER_TO_NAME = {}
try:
    print("INFO:    Mengambil data peta Surah...")
    response = requests.get(f"{QURAN_API_BASE_URL}/surah")
    response.raise_for_status()
    surahs_data = response.json().get("data", [])
    
    for surah in surahs_data:
        # 1. Ambil nomor
        number = surah["number"]
        
        # 2. Siapkan nama yang bagus untuk ditampilkan
        SURAH_NUMBER_TO_NAME[number] = surah["name"]["transliteration"]["id"]
        
        # 3. Buat daftar semua kemungkinan alias nama
        names_to_add = [
            surah["name"]["transliteration"]["id"].lower(), # misal: "al-fatihah"
            surah["name"]["short"].lower(),                 # misal: "al-fatihah"
            surah["name"]["translation"]["id"].lower()      # misal: "pembukaan"
        ]
        
        # 4. Tambahkan semua alias (termasuk yang dinormalisasi) ke peta
        for name in names_to_add:
            if name:
                # Tambahkan versi asli (misal: "al-fatihah")
                SURAH_NAME_TO_NUMBER[name] = number
                
                # Tambahkan versi normalisasi (misal: "alfatihah")
                norm_name = name.replace("-", "").replace(" ", "")
                SURAH_NAME_TO_NUMBER[norm_name] = number


    print(f"INFO:    Berhasil memuat {len(SURAH_NAME_TO_NUMBER)} alias nama Surah.")

except Exception as e:
    print(f"!!! ERROR FATAL: Gagal memuat peta nama Surah: {e} !!!")
# =======================================================

# Setup API Gemini
load_dotenv() # Memuat .env file

try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    # Inisialisasi model
    model = genai.GenerativeModel('gemini-1.0-pro') # Model gemini yang cukup stabil
    print("INFO:    Model Generatif Gemini berhasil dikonfigurasi.")
except Exception as e:
    model = None
    print(f"!!! ERROR FATAL: Gagal mengkonfigurasi Gemini: {e} !!!")

# Kita akan memuat semua tafsir Al-Mulk ke memori
AL_MULK_CONTEXT = ""
try:
    for verse in QURAN_SEARCH_INDEX:
        if verse["surah"] == 67:
            AL_MULK_CONTEXT += f"Tafsir Ayat {verse['ayah']}: {verse['tafsir']}\n"
    print("INFO:    Berhasil memuat konteks tafsir Al-Mulk.")
except Exception as e:
    print(f"!!! ERROR: Gagal memuat konteks Al-Mulk: {e}")


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
        for verse in QURAN_SEARCH_INDEX:
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
    
    for verse in QURAN_SEARCH_INDEX:
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
    if not QURAN_SEARCH_INDEX:
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

    for verse in QURAN_SEARCH_INDEX:
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
    
# === ENDPOINT BARU UNTUK CHATBOT (KONTEKS AL-MULK) ===
# === ENDPOINT CHATBOT BARU (VERSI UPGRADE PINTAR) ===
@app.post("/chatbot")
async def handle_chatbot_message(request: VoiceSearchRequest):
    user_message = request.text.lower()
    
    # --- LOGIKA BARU UNTUK MEMBEDAKAN NIAT ---

    # 1. Cek apakah ini pertanyaan RAG (analisis)?
    # Kita cari kata kunci analisis ATAU rentang angka (misal: 1-5)
    rag_keywords = ["hubungan", "jelaskan", "apa", "kenapa", "mengapa", "ringkasan", "rangkuman"]
    is_rag_question = any(word in user_message for word in rag_keywords) or re.search(r'\d+-\d+', user_message)

    # 2. Cek apakah ini permintaan ayat sederhana?
    # Kita cari angka yang "sendirian" (dikelilingi spasi/batas kata)
    # Ini akan cocok dengan "ayat 5", "tafsir 11", atau bahkan "11"
    match_simple = re.search(r'\b(\d+)\b', user_message)
    
    ayah_number = None
    if match_simple:
        num = int(match_simple.group(1))
        if 0 < num <= 30: # Pastikan angkanya valid untuk Al-Mulk
            ayah_number = num

    # --- PENENTUAN KEPUTUSAN ---

    # KASUS 1: Ini adalah permintaan ayat sederhana
    # JIKA ada angka ditemukan DAN INI BUKAN pertanyaan analisis RAG
    if ayah_number is not None and not is_rag_question:
        try:
            print(f"INFO: Chatbot (Simple) terdeteksi. Mencari Al-Mulk (67) ayat {ayah_number}")
            return get_spesific_ayah(surah_number=67, ayah_number=ayah_number)
        except HTTPException as e:
            raise e # Lemparkan error jika get_spesific_ayah gagal
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error saat mengambil ayat: {e}")

    # KASUS 2: Ini adalah pertanyaan RAG (atau fallback jika tidak ada angka)
    print(f"INFO: Chatbot (RAG) terdeteksi. Menerima pertanyaan: {user_message}")
    if not model or not AL_MULK_CONTEXT:
        raise HTTPException(status_code=500, detail="Model AI tidak terkonfigurasi atau konteks tidak dimuat.")

    # Susun Prompt RAG (tidak berubah)
    prompt_template = f"""
    Anda adalah asisten AI yang ahli dalam Tafsir Al-Qur'an, dengan fokus pada Surat Al-Mulk.
    Tugas Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan konteks tafsir (Tafsir Kemenag) dari 30 ayat Surat Al-Mulk yang saya berikan di bawah ini.
    Jawab dengan ringkas, jelas, dan dalam bahasa Indonesia.
    Jika pertanyaan pengguna tidak relevan dengan konteks tafsir Al-Mulk, jawab dengan sopan bahwa Anda hanya bisa menjawab seputar tafsir Al-Mulk.

    --- KONTEKS TAFSIR 30 AYAT AL-MULK ---
    {AL_MULK_CONTEXT}
    --- AKHIR KONTEKS ---

    Pertanyaan Pengguna: "{user_message}"

    Jawaban Anda:
    """
    
    try:
        # Kirim prompt ke Gemini API
        response = await model.generate_content_async(prompt_template)
        return {"answer_type": "text", "content": response.text}
        
    except Exception as e:
        print(f"Error Gemini API: {e}")
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan saat menghubungi model AI: {e}")