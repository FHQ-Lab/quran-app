from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware #Untuk menghubungkan ke frontend
import requests
import pyarabic.araby as araby # Import library yang baru diinstall
from pydantic import BaseModel # Untuk mendefinisikan body request
import re  # <--- INI PENTING WOK
import json  # <--- INI JUGA PENTING WOK
from thefuzz import fuzz

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
    
    # === ENDPOINT BARU UNTUK VOICE SEARCH ===
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