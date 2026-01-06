from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware #Untuk menghubungkan ke frontend
import requests
import pyarabic.araby as araby # Import library yang baru diinstall
from pydantic import BaseModel # Untuk mendefinisikan body request
import re  # <--- INI PENTING WOK
import json  # <--- INI JUGA PENTING WOK
from rapidfuzz import fuzz
import os
from dotenv import load_dotenv
from groq import AsyncGroq # Kita pakai versi Async
import numpy as np
import faiss
from sentence_transformers import SentenceTransformer


# === KAMUS ALIAS MANUAL (Untuk Typo/Ejaan Umum) ===
MANUAL_ALIASES = {
    "yasin": 36,
    "yaasin": 36,
    "yaseen": 36,
    "alfatihah": 1,
    "al fatihah": 1,
    "fatihah": 1,
    "annaba": 78,
    "an naba": 78,
    "annisa": 4,
    "an nisa": 4,
    "alanam": 6,
    "al anam": 6,
    "alkahfi": 18,
    "alkahf": 18,
    "al mulk": 67,
    "almulk": 67,
    "arrahman": 55,
    "ar rahman": 55
    # Tambahkan lainnya sesuai kebutuhan
}

# === Model untuk menerima data dari frontend ===
class VoiceSearchRequest(BaseModel):
    text: str
    
# =====================================================================
# === BLOK STARTUP APLIKASI ===
# =====================================================================

# === 1. STARTUP & KONFIGURASI ===
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Konfigurasi Kemenag
KEMENAG_BASE_URL = os.getenv("KEMENAG_BASE_URL", "https://quran-api.lpmqkemenag.id/api-alquran")
KEMENAG_HEADERS = {
    "user": os.getenv("KEMENAG_USER"),
    "Authorization": os.getenv("KEMENAG_TOKEN") # Token mentah sesuai temuan kita
}

# === 2. HELPER FUNCTIONS (ADAPTER/PENERJEMAH) ===

def adapt_surah_list(kemenag_data):
    """Mengubah format List Surat Kemenag ke format lama (Gading/Quran.com)"""
    adapted_list = []
    for item in kemenag_data:
        adapted_list.append({
            "number": item["id"],
            "name": {
                "transliteration": {"id": item["nama"]},
                "short": item["arabic"],
                "translation": {"id": item["arti"]}
            },
            "numberOfVerses": item["jmlAyat"],
            "revelation": {"id": item["kategori"]} # Makkiyah/Madaniyah
        })
    return adapted_list

# --- KAMUS PERBAIKAN TYPO (MOJIBAKE FIXER) ---
# Ini adalah daftar simbol aneh dari database Kemenag dan penggantinya
REPLACEMENT_DICT = {
    "±": "ā",   # Contoh: al-M±'idah -> al-Mā'idah
    "²": "ā",   # Contoh: ‘²d -> 'Ād
    "³": "ī",   # Contoh: 
    "µ": "ū",   # Contoh: ¤amµd -> Thamūd
    "¤": "Th",  # Contoh: ¤amµd -> Thamūd
    "‘": "'",   # Contoh: ‘²d -> 'Ād (Simbol Ain)
    "′": "'",   # Contoh: al-M±′idah -> al-Mā'idah
    "–": "-",
    "’": "'",
    "“": '"',
    "”": '"',
    "…": "...",
    "¬": "ḥ",   
    "­": "kh", 
    "®": "r", 
    "¯": "z", 
    "°": "s", 
    "»": "ṣ", 
    "½": "ḍ", 
    "¾": "ṭ", 
    "¿": "ẓ", 
    "À": "`", 
    "Á": "gh", 
    "Â": "f", 
    "Ã": "q", 
    "Ä": "k", 
    "Å": "l", 
    "Æ": "m", 
    "Ç": "n", 
    "È": "w", 
    "É": "h", 
    "Ê": "y"
}

def clean_kemenag_text(text):
    """
    Membersihkan teks tafsir Kemenag dari simbol encoding yang rusak.
    """
    if not text:
        return ""
        
    cleaned_text = text
    for bad_char, good_char in REPLACEMENT_DICT.items():
        cleaned_text = cleaned_text.replace(bad_char, good_char)
        
    return cleaned_text

def normalize_latin_for_search(text):
    """
    Mengubah teks latin menjadi format 'polos' untuk pencarian fleksibel.
    1. Bersihkan simbol aneh (Mojibake).
    2. Lowercase.
    3. Hapus SEMUA karakter selain huruf a-z (Hapus spasi, strip, koma, dll).
    Contoh: "Qul huwallāhu aḥad" -> "qulhuwallahuahad"
    """
    if not text:
        return ""
    
    # 1. Bersihkan simbol aneh dulu
    clean_text = clean_kemenag_text(text)
    if not clean_text:
        return ""
    
    # 2. Lowercase
    clean_text = clean_text.lower()
    
    # 3. Hapus apapun yang bukan huruf a-z (Termasuk spasi!)
    # Ini kuncinya agar "qulhu" match dengan "qul hu"
    import re
    clean_text = re.sub(r'[^a-z]', '', clean_text)
    
    return clean_text

def adapt_ayah_detail(kemenag_ayat):
    """Mengubah format Ayat Kemenag ke format lama"""
    raw_trans = kemenag_ayat.get("terjemah", "")
    raw_foot = kemenag_ayat.get("teks_foot") or ""
    return {
        "number": {"inSurah": kemenag_ayat["ayat"]},
        "text": {
            "arab": kemenag_ayat["teks_msi_usmani"],
            "transliteration": {"en": kemenag_ayat["teks"]} # Kemenag punya teks latin di 'teks'
        },
        "translation": {"id": clean_kemenag_text(raw_trans)}, 
        "tafsir": {
            "id": {
                "long": clean_kemenag_text(raw_foot) or clean_kemenag_text(raw_trans)
            }
        }
    }

# --- KONFIGURASI PATH ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__)) # Folder tempat main.py berada
MODEL_REPO = 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2'
SURAH_DATA_DIR = os.path.join(BASE_DIR, "data_surah")
SURAH_LIST_FILE = os.path.join(BASE_DIR, "surah_list.json")
TAFSIR_DATA_DIR = os.path.join(BASE_DIR, "data_tafsir")
# Path lokal (hanya ada di laptopmu, tidak ada di Railway karena gitignore)
MODEL_LOCAL_PATH = os.path.join(BASE_DIR, 'models', 'paraphrase-multilingual-MiniLM-L12-v2')

# Nama file data (Pastikan file ini ADA di GitHub!)
FAISS_INDEX_FILE = os.path.join(BASE_DIR, "quran_faiss.index")
VERSE_REF_FILE = os.path.join(BASE_DIR, "verse_references.json")
QURAN_TEXT_MAP = {}

# --- FUNGSI SMART LOADER ---
def load_embedding_model():
    """
    Logika Cerdas:
    1. Cek folder lokal dulu (agar cepat di laptop).
    2. Jika tidak ada (di Railway), download otomatis dari HuggingFace.
    """
    if os.path.exists(MODEL_LOCAL_PATH):
        print(f"INFO:    Menggunakan Model Lokal dari: {MODEL_LOCAL_PATH}")
        return SentenceTransformer(MODEL_LOCAL_PATH)
    else:
        print(f"INFO:    Model lokal tidak ditemukan. Mendownload dari HuggingFace: {MODEL_REPO}...")
        return SentenceTransformer(MODEL_REPO)

# --- INISIALISASI ---
try:
    print("INFO:    Memulai Inisialisasi Sistem AI...")
    
    # 1. Setup Client Groq
    GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
    if not GROQ_API_KEY:
        print("WARNING: GROQ_API_KEY tidak ditemukan di Environment Variables!")
    client = AsyncGroq(api_key=GROQ_API_KEY)

    # 2. Load Model (Pakai fungsi pintar tadi)
    RAG_MODEL = load_embedding_model()
    
    # 3. Load Database FAISS & JSON
    # Cek keberadaan file dulu untuk debugging yang lebih mudah
    if not os.path.exists(FAISS_INDEX_FILE):
        raise FileNotFoundError(f"File Index FAISS tidak ditemukan di: {FAISS_INDEX_FILE}")
        
    print(f"INFO:    Memuat Index FAISS...")
    FAISS_INDEX = faiss.read_index(FAISS_INDEX_FILE)
    
    print(f"INFO:    Memuat Referensi Ayat...")
    with open(VERSE_REF_FILE, 'r', encoding='utf-8') as f:
        VERSE_REFERENCES = json.load(f)
    

    
        
    print("INFO:    ✅ Sistem RAG Siap & Berhasil Dimuat.")

except Exception as e:
    print(f"CRITICAL WARNING: Gagal memuat sistem RAG. Error: {e}")
    print("Fitur Chatbot Cerdas mungkin tidak berfungsi, hanya fallback.")
    client, RAG_MODEL, FAISS_INDEX, QURAN_TEXT_MAP = None, None, None, {}


# --- 6. Muat Peta Nama Surah (dari API Kemenag) ---
SURAH_NAME_TO_NUMBER = {}
SURAH_NUMBER_TO_NAME = {}

try:
    print("INFO:    Mengambil data peta Surah dari Kemenag...")
    
    # GUNAKAN ENDPOINT KEMENAG + HEADERS
    url = f"{KEMENAG_BASE_URL}/surah/local/1/114" 
    response = requests.get(url, headers=KEMENAG_HEADERS)
    response.raise_for_status()
    
    surahs_data = response.json().get("data", [])
    
    for surah in surahs_data:
        # Struktur Kemenag: {'id': 1, 'nama': 'Al-Fātiḥah', 'arti': 'Pembuka', ...}
        number = surah["id"]
        
        # Simpan nama resmi untuk tampilan
        SURAH_NUMBER_TO_NAME[number] = surah["nama"]
        
        # Buat variasi nama untuk pencarian
        names_to_add = [
            str(surah["nama"]).lower(), # Pastikan string
            str(surah["arti"]).lower()
        ]
        
        for name in names_to_add:
            if name:
                # 1. Simpan nama asli
                SURAH_NAME_TO_NUMBER[name] = number
                
                # 2. Simpan nama tanpa tanda baca (untuk 'Al-Fātiḥah' -> 'alfatihah')
                # Hapus semua karakter non-alphanumeric
                clean_name = re.sub(r'[^a-z0-9]', '', name)
                SURAH_NAME_TO_NUMBER[clean_name] = number

    # Tambahkan manual aliases (agar 'yasin' tetap jalan walau Kemenag tulis 'Yā Sīn')
    MANUAL_ALIASES = {
        "yasin": 36, "yaasin": 36, "alfatihah": 1, "al fatihah": 1,
        "annaba": 78, "an naba": 78, "annisa": 4, "an nisa": 4,
        "alanam": 6, "al anam": 6, "alkahfi": 18, "alkahf": 18,
        "al mulk": 67, "almulk": 67, "arrahman": 55, "ar rahman": 55
    }
    for alias, num in MANUAL_ALIASES.items():
        clean_alias = re.sub(r'[^a-z0-9]', '', alias)
        SURAH_NAME_TO_NUMBER[clean_alias] = num

    print(f"INFO:    Berhasil memuat {len(SURAH_NAME_TO_NUMBER)} alias nama Surah.")
    
    SPECIAL_AYAH_MAPPING = {
    # --- GHARIB ---
    # 1. Imalah (Hud: 41) - "Majreha"
    "majreha": (11, 41),
    "bismillahimajreha": (11, 41),
    
    # 2. Isymam (Yusuf: 11) - "Laa ta'manna"
    "latamanna": (12, 11),
    "lalamanna": (12, 11), # Antisipasi salah dengar STT
    
    # 3. Saktah (4 tempat)
    "iwaja": (18, 1),       # Al-Kahf: 1 (Akhir ayat, tapi sering dibaca sambung sbg keyword)
    "marqadina": (36, 52),  # Yasin: 52
    "manraq": (75, 27),     # Al-Qiyamah: 27
    "balran": (83, 14),     # Al-Muthaffifin: 14
    
    # 4. Tashil (Fussilat: 44) - "A'a'jamiyyun"
    "aajamiyyun": (41, 44),
    "aajamiy": (41, 44),
    
    # 5. Naql (Al-Hujurat: 11) - "Bi'sal ismu"
    "bisalismu": (49, 11),
    
    # --- MUQATTA'AT (Ayat Pendek) ---
    # STT biasanya menuliskan bunyinya, bukan hurufnya.
    
    # Alif Lam Mim (Al-Baqarah: 1, Ali 'Imran: 1, dll). Kita arahkan ke Al-Baqarah 1 defaultnya
    "aliflammim": (2, 1),
    "aliflamim": (2, 1),
    
    # Alif Lam Mim Shad (Al-A'raf: 1)
    "aliflammimshad": (7, 1),
    "aliflammimsad": (7, 1),
    
    # Alif Lam Ra (Yunus: 1, Hud: 1, dll)
    "aliflamra": (10, 1),
    
    # Kaf Ha Ya 'Ain Shad (Maryam: 1)
    "kafhayaainshad": (19, 1),
    "kafhayaainsad": (19, 1),
    "kahayainshad": (19, 1),
    
    # Tha Ha (Taha: 1)
    "thaha": (20, 1),
    "toha": (20, 1),
    
    # Tha Sin Mim (Asy-Syu'ara: 1)
    "thasinmim": (26, 1),
    
    # Tha Sin (An-Naml: 1)
    "thasin": (27, 1),
    
    # Ya Sin (Yasin: 1)
    "yasin": (36, 1),
    "yaasin": (36, 1),
    
    # Ha Mim (Ghafir: 1, dll)
    "hamim": (40, 1),
    "hamiim": (40, 1),
    
    # Nun (Al-Qalam: 1)
    "nun": (68, 1),
    "nuun": (68, 1),
    
    # --- ARABIC STT VARIATIONS (Untuk menangani ucapan Arab) ---
    
    # Imalah (Hud: 41)
    "بسم الله مجريها": (11, 41),
    "بسم الله مجراها": (11, 41),  # Variasi umum
    "مجريها": (11, 41),
    "مجراها": (11, 41),
    "ما جريت": (11, 41),          # Dari error log kamu (ma jaryat...)
    
    # Isymam (Yusuf: 11)
    "لا تأمنا": (12, 11),
    "لاتأمنا": (12, 11),
    
    # Saktah
    "عوجا": (18, 1),
    "مرقدنا": (36, 52),
    "من راق": (75, 27),
    "بل ران": (83, 14),
    
    # Tashil
    "أأعجمي": (41, 44),
    
    # Naql
    "بئس الاسم": (49, 11),

    # Muqatta'at (Arab)
    "الم": (2, 1),
    "المر": (13, 1),
    "المص": (7, 1),
    "كهيعص": (19, 1),
    "طه": (20, 1),
    "طسم": (26, 1),
    "طس": (27, 1),
    "يس": (36, 1),
    "حم": (40, 1),
    "ن": (68, 1),

}



except Exception as e:
    print(f"!!! ERROR FATAL: Gagal memuat peta nama Surah: {e} !!!")

def load_quran_data_to_memory():
    """
    Membaca 114 file JSON lokal ke dalam RAM.
    """
    global QURAN_TEXT_MAP
    print("⏳ Memuat ulang data Al-Quran dari folder local...")
    
    QURAN_TEXT_MAP.clear()
    count = 0
    
    for surah_num in range(1, 115):
        file_path = os.path.join(SURAH_DATA_DIR, f"{surah_num}.json")
        
        if os.path.exists(file_path):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    verses = data.get('data', [])
                    
                    for v in verses:
                        key = f"{surah_num}:{v['ayat']}"
                        
                        # --- TEKNIK PENGAMAN (OR '') ---
                        # Jika v.get mengembalikan None, dia akan ambil '' (string kosong)
                        raw_latin = v.get('teks') or '' 
                        raw_arab = v.get('teks_msi_usmani') or ''
                        raw_terjemah = v.get('terjemah') or ''
                        raw_foot = v.get('teks_foot') or ''
                        
                        QURAN_TEXT_MAP[key] = {
                            "surah": surah_num,
                            "ayah": v['ayat'],
                            "text_arab": raw_arab,
                            "text_normalized": normalize_arabic(raw_arab),
                            
                            # Transliterasi Display (Bersih tapi masih ada spasi/tanda baca)
                            "transliteration": clean_kemenag_text(raw_latin), 
                            
                            # Transliterasi Search (Polos tanpa spasi)
                            "transliteration_clean": normalize_latin_for_search(raw_latin),
                            
                            "translation": raw_terjemah,
                            "tafsir": clean_kemenag_text(raw_foot)
                        }
                        count += 1
            except Exception as e:
                print(f"Error loading surah {surah_num}: {e}")
    
    print(f"✅ SUKSES: {count} ayat dimuat ke memori pencarian!")

@app.on_event("startup")
def startup_event():
    # 1. Load Data Quran (Fungsi baru kita)
    load_quran_data_to_memory()
# =====================================================================
# === AKHIR BLOK STARTUP ===
# =====================================================================


@app.get("/surahs")
def get_all_surahs():
    # Path ke file JSON lokal
    if os.path.exists(SURAH_LIST_FILE):
        print("INFO: Mengambil daftar surat dari file lokal.")
        try:
            with open(SURAH_LIST_FILE, 'r', encoding='utf-8') as f:
                source_data = json.load(f)
            
            # --- MULAI LOGIKA ADAPTER ---
            # Kita cek dulu, apakah datanya pakai format baru (yang ada key 'nama')?
            # List data biasanya ada di dalam key 'data'
            raw_list = source_data.get('data', [])
            
            formatted_list = []
            for item in raw_list:
                # Cek apakah ini Format Baru (Kemenag)?
                if 'nama' in item:
                    # Kita ubah ("petakan") ke Format Lama yang disukai Frontend
                    formatted_item = {
                        "number": item.get('id'),
                        "name": {
                            "transliteration": {
                                "id": item.get('nama')
                            },
                            "short": item.get('arabic'),
                            "translation": {
                                "id": item.get('arti')
                            }
                        },
                        "numberOfVerses": item.get('jmlAyat'),
                        "revelation": {
                            "id": item.get('kategori')
                        }
                    }
                    formatted_list.append(formatted_item)
                else:
                    # Jika ternyata formatnya sudah benar/lama, pakai saja langsung
                    formatted_list.append(item)
            
            # Kembalikan dengan bungkus standar
            return {"code": 200, "message": "Success", "data": formatted_list}
            # --- SELESAI LOGIKA ADAPTER ---

        except Exception as e:
            print(f"ERROR reading json: {e}")
            return {"code": 500, "message": "Corrupt JSON", "data": []}

    # Fallback ke API (Jaga-jaga)
    print("WARNING: File lokal tidak ada. Mencoba API...")

@app.get("/surahs/{surah_number}")
def get_surah_detail(surah_number: int):
    # --- 1. SIAPKAN WADAH DATA ---
    combined_data = {}
    
    # --- 2. AMBIL HEADER SURAT (Nama, Arti, Jumlah Ayat) ---
    # Kita baca dari surah_list.json karena di situ info headernya lengkap
    if os.path.exists(SURAH_LIST_FILE):
        try:
            with open(SURAH_LIST_FILE, 'r', encoding='utf-8') as f:
                list_data = json.load(f)
                
            # Cari surat yang ID-nya cocok
            all_surahs = list_data.get('data', [])
            found_surah = next((s for s in all_surahs if s.get('id') == surah_number), None)
            
            if found_surah:
                # 🔥 MAGIC MAPPING: Ubah kunci Kemenag jadi kunci Frontend
                combined_data = {
                    "number": found_surah.get('id'),
                    "name": {
                        "transliteration": {
                            "id": found_surah.get('nama'), # Kemenag: nama -> Frontend: transliteration.id
                            "en": found_surah.get('nama')
                        },
                        "short": found_surah.get('arabic'), # Kemenag: arabic -> Frontend: short
                        "translation": {
                            "id": found_surah.get('arti')   # Kemenag: arti -> Frontend: translation.id
                        }
                    },
                    "numberOfVerses": found_surah.get('jmlAyat'), # Kemenag: jmlAyat -> Frontend: numberOfVerses
                    "revelation": {
                        "id": found_surah.get('kategori')
                    },
                    "tafsir": {
                        "id": "Kemenag RI"
                    }
                }
        except Exception as e:
            print(f"Error reading header: {e}")

    # --- 3. AMBIL DETAIL AYAT (Isi Surat) ---
    file_path = os.path.join(SURAH_DATA_DIR, f"{surah_number}.json")
    verses_formatted = []
    
    if os.path.exists(file_path):
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                raw_data = json.load(f)
                
            ayat_list_raw = raw_data.get('data', [])
            
            for item in ayat_list_raw:
                verse = {
                    "number": {
                        "inSurah": item.get('ayat'),
                        "inQuran": item.get('id')
                    },
                    "text": {
                        "arab": item.get('teks_msi_usmani'),
                        "transliteration": {
                            "en": item.get('teks')
                        }
                    },
                    "translation": {
                        "id": item.get('terjemah')
                    },
                    "audio": {
                        "primary": f"https://cdn.islamic.network/quran/audio/128/ar.alafasy/{item.get('id')}.mp3"
                    },
                    "tafsir": {
                        "id": {
                            "short": item.get('teks_foot'),
                            "long": item.get('keterangan')
                        }
                    }
                }
                verses_formatted.append(verse)
        except Exception as e:
             print(f"Error reading verses: {e}")
    
    # --- 4. GABUNGKAN SEMUANYA ---
    # Masukkan list ayat ke dalam data header tadi
    combined_data["verses"] = verses_formatted
    
    # Jika header kosong (file list rusak), minimal kasih nomor & ayat
    if "number" not in combined_data:
        combined_data["number"] = surah_number
        combined_data["verses"] = verses_formatted

    return {
        "code": 200,
        "status": "OK",
        "message": "Success fetching detail locally",
        "data": combined_data
    }

@app.get("/surah/{surah_number}/{ayah_number}")
def get_spesific_ayah(surah_number: int, ayah_number: int):
    """
    Endpoint Spesifik Ayat + Tafsir Lengkap (Sumber: File Lokal Kemenag)
    """
    # --- A. AMBIL DATA AYAT DASAR (Teks, Terjemah, Footnote) ---
    ayat_file_path = os.path.join(SURAH_DATA_DIR, f"{surah_number}.json")
    
    if not os.path.exists(ayat_file_path):
        raise HTTPException(status_code=404, detail="Data surat tidak ditemukan.")

    target_ayat = None
    try:
        with open(ayat_file_path, 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
            verses = raw_data.get('data', [])
            target_ayat = next((v for v in verses if v.get('ayat') == ayah_number), None)
    except Exception as e:
        print(f"Error baca file ayat: {e}")

    if not target_ayat:
         raise HTTPException(status_code=404, detail=f"Ayat {ayah_number} tidak ditemukan.")


    # --- B. AMBIL DATA TAFSIR (Dari folder data_tafsir) ---
    tafsir_file_path = os.path.join(TAFSIR_DATA_DIR, f"{surah_number}.json")
    
    # Default values (kosong jika file tafsir belum ada)
    text_wajiz = None
    text_tahlili = None
    
    if os.path.exists(tafsir_file_path):
        try:
            with open(tafsir_file_path, 'r', encoding='utf-8') as f:
                raw_tafsir = json.load(f)
                # Ambil list data tafsir
                tafsir_list = raw_tafsir.get('data', [])
                
                # Cari tafsir yang ayatnya cocok
                found_tafsir = next((t for t in tafsir_list if t.get('ayat') == ayah_number), None)
                
                if found_tafsir:
                    # Sesuai script extract kita: key-nya adalah 'wajiz' dan 'tahlili'
                    text_wajiz = found_tafsir.get('wajiz')
                    text_tahlili = found_tafsir.get('tahlili')
                    
        except Exception as e:
            print(f"Error baca file tafsir: {e}")


    # --- C. RAKIT HASIL AKHIR ---
    # 1. Bersihkan Footnote (dari file ayat)
    raw_footnote = target_ayat.get('teks_foot')
    clean_footnote = clean_kemenag_text(raw_footnote)
    
    # 2. Bersihkan Wajiz & Tahlili (dari file tafsir)
    # Variabel text_wajiz & text_tahlili didapat dari Bagian B sebelumnya
    clean_wajiz = clean_kemenag_text(text_wajiz)
    clean_tahlili = clean_kemenag_text(text_tahlili)
    
    result_data = {
        "number": {
            "inSurah": target_ayat.get('ayat'),
            "inQuran": target_ayat.get('id')
        },
        "text": {
            "arab": target_ayat.get('teks_msi_usmani'),
            "transliteration": {
                "en": target_ayat.get('teks')
            }
        },
        "translation": {
            "id": target_ayat.get('terjemah') # Terjemah biasanya aman, tapi kalau mau dibersihkan juga boleh
        },
        "tafsir": {
            "id": {
                "footnotes": clean_footnote,  # ✅ SUDAH BERSIH
                "wajiz": clean_wajiz,         # ✅ SUDAH BERSIH
                "tahlili": clean_tahlili      # ✅ SUDAH BERSIH
            }
        },
        "surah": {
            "number": surah_number,
            "name": {
                "transliteration": {"id": f"Surah ke-{surah_number}"}, 
                "short": ""
            }
        }
    }
    
    return {"code": 200, "data": result_data}




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
    query_clean = re.sub(r'[^a-z0-9]', '', name.lower())
    
    return SURAH_NAME_TO_NUMBER.get(query_clean)
        
    # return None # Tidak ditemukan



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

    # === Pola 1.5: Pencarian "Nama Surah Saja" ===
    
    # Bersihkan awalan "surah"/"surat" dulu
    clean_q = re.sub(r'^(surah|surat)\s+', '', query, flags=re.IGNORECASE).strip()
    
    surah_number_match = get_surah_number_from_name(clean_q)
    
    if surah_number_match:
        print(f"INFO: Pola 1.5 (Nama Surah) terdeteksi: {clean_q} -> {surah_number_match}")
        
        # KITA KEMBALIKAN FORMAT SPESIAL UNTUK REDIRECT
        return {
            "match_type": "single_surah", # Tipe baru!
            "data": {
                "surah": {
                    "number": surah_number_match,
                    "name": SURAH_NUMBER_TO_NAME.get(surah_number_match)
                }
            }
        }
    
    # Normalisasi kueri (hapus spasi dan karakter non-huruf)
    query_special = re.sub(r'[^a-z]', '', query.lower())
    
    if query_special in SPECIAL_AYAH_MAPPING:
        spec_surah, spec_ayah = SPECIAL_AYAH_MAPPING[query_special]
        print(f"INFO: Pola 1.8 (Special Ayah) terdeteksi: '{query}' -> {spec_surah}:{spec_ayah}")
        try:
            return get_spesific_ayah(spec_surah, spec_ayah)
        except Exception as e:
            pass # Jika gagal, lanjut ke pencarian biasa

    # === Pola 2: Pencarian Teks (Full-Text Search) ===
    print(f"INFO: Melakukan Full-Text Search untuk: '{query}'")
    
    # Normalisasi kueri
    query_norm_arab = normalize_arabic(query)
    query_lower = query.lower()
    query_latin_clean = normalize_latin_for_search(query)
    
    matches = []
    found_ids = set() 
    
    # Ambang batas skor (Bisa disesuaikan)
    MIN_ARABIC_SCORE = 90
    MIN_LATIN_SCORE = 85 # "alhamdulillah" vs "al-hamdu" butuh toleransi
    
    for verse in QURAN_TEXT_MAP.values():
        verse_id = f"{verse['surah']}:{verse['ayah']}"
        if verse_id in found_ids:
            continue 

        score = 0
        match_type = ""
        
        # 1. Cek Terjemahan (Indo) - Prioritas Tertinggi
        if query_lower in verse["translation"].lower():
            score = 100
            match_type = "translation"
        
        # 2. Cek Transliterasi (Latin/Bacaan) - Fitur Baru! 🚀
        # Kita pakai fuzz ratio agar "qulhu" bisa match "qul huwallahu"
        elif verse["transliteration_clean"]:
            # Ambil data polos dari memori
            latin_data_clean = verse["transliteration_clean"]
            
            # Cek Substring (Pasti Match)
            # Contoh: "qulhu" ada di dalam "qulhuwallahuahad"
            if query_latin_clean in latin_data_clean:
                score = 100 # Langsung prioritas tinggi!
                match_type = "latin_exact"
            else:
                if len(latin_data_clean) < 10:
                    continue
                # Cek Fuzzy (Untuk Typo)
                # Contoh: "malikinas" (satu n) vs "malikinnas"
                latin_score = fuzz.partial_ratio(query_latin_clean, latin_data_clean)
                if latin_score >= 85:
                    score = latin_score
                    match_type = "latin_fuzzy"

        # 3. Cek Lafadz Arab
        if score < MIN_ARABIC_SCORE: # Hanya cek jika belum ketemu di Indo/Latin
            arabic_score = fuzz.partial_ratio(query_norm_arab, verse["text_normalized"])
            if arabic_score >= MIN_ARABIC_SCORE:
                score = arabic_score
                match_type = "lafadz"
        
        # 4. Cek Tafsir (Prioritas Terakhir)
        if score == 0 and query_lower in verse["tafsir"].lower():
            score = 80
            match_type = "tafsir"

        # --- Simpan Hasil ---
        if score > 0:
            # Kita pastikan surah_name terisi
            s_name = SURAH_NUMBER_TO_NAME.get(verse['surah'], f"Surah {verse['surah']}")
            
            matches.append({
                "surah": verse["surah"],
                "ayah": verse["ayah"],
                "text_arab": verse["text_arab"],
                "transliteration": verse["transliteration"], # Kirim juga latinnya ke frontend
                "translation": verse["translation"],
                "surah_name": s_name, 
                "score": score,
                "match_type": match_type
            })
            found_ids.add(verse_id)

    if not matches:
        raise HTTPException(status_code=404, detail="Tidak ada hasil yang cocok ditemukan.")
        
    # Sortir berdasarkan skor tertinggi, lalu urutan ayat
    matches.sort(key=lambda x: (x['score'], -x['surah']), reverse=True)
    
    # Batasi hasil agar tidak overload (misal max 50 hasil)
    return {
        "match_type": "multiple",
        "results": matches[:50] 
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
        if num > 0: # <-- Hapus batasan 30
            numbers.add(num)

    # 2. Cari rentang angka (misal: "1-5" atau "10-15")
    for match in re.finditer(r'(\d+)\s*-\s*(\d+)', message):
        start = int(match.group(1))
        end = int(match.group(2))
        if start < end: # <-- Hapus batasan 30
            for num in range(start, end + 1):
                numbers.add(num)

    return sorted(list(numbers)) 

# Helper pendeteksi nama surah
def find_surah_in_query(query: str) -> int | None:
    """Mencari nama surah yang dinormalisasi di dalam kueri."""
    # Bersihkan kueri dan pecah jadi kata-kata
    query = query.lower().replace("surat", "").replace("surah", "").strip()
    
    # Cek apakah seluruh kueri adalah nama surah (Paling cepat)
    num = get_surah_number_from_name(query)
    if num:
        return num
        
    # Cek apakah bagian dari kueri adalah nama surah
    parts = re.split(r'\s+|-', query)
    for part in parts:
        num = get_surah_number_from_name(part)
        if num:
            return num
    
    # Cek gabungan 2 kata (untuk "al mulk" dll)
    if len(parts) > 1:
        for i in range(len(parts) - 1):
            two_words = f"{parts[i]}{parts[i+1]}" # "almulk"
            num = get_surah_number_from_name(two_words)
            if num:
                return num
                
    return None  

async def run_rag_generation(user_message: str, dynamic_context: str, context_source_text: str):
    """Fungsi helper terpusat untuk memanggil Groq RAG."""
    
    # Susun Prompt RAG
    prompt = f"""
    Anda adalah asisten AI yang ahli dalam Tafsir Al-Qur'an.
    Tugas Anda adalah menjawab pertanyaan pengguna HANYA berdasarkan konteks tafsir dari {context_source_text} yang saya berikan.
    Jawab dengan ringkas, jelas, dan dalam bahasa Indonesia.
    Sebutkan sumber ayat (Contoh: "Berdasarkan tafsir...") jika relevan.
    Jika pertanyaan pengguna tidak relevan dengan konteks, jawab dengan sopan bahwa Anda tidak menemukan jawabannya di konteks tersebut.

    --- KONTEKS TAFSIR ---
    {dynamic_context}
    --- AKHIR KONTEKS ---
    """
    
    try:
        print("INFO:    Mengirim prompt RAG ke Groq...")
        
        chat_completion = await client.chat.completions.create(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": user_message}
            ],
            model="llama-3.3-70b-versatile", 
        )
        
        return {"answer_type": "text", "content": chat_completion.choices[0].message.content}

    except Exception as e:
        print(f"Error Groq API atau RAG: {e}")
        if "413" in str(e):
             raise HTTPException(status_code=500, detail="Permintaan Anda terlalu besar (melebihi batas token). Coba ajukan pertanyaan yang lebih spesifik.")
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan saat menghubungi model AI: {e}")

#


# === ENDPOINT CHATBOT (FINAL DENGAN LOGIKA 5 KASUS) ===
@app.post("/chatbot")
async def handle_chatbot_message(request: VoiceSearchRequest):
    user_message = request.text.lower()
    
    # Cek apakah ada kunci mapping yang MUNCUL di dalam pesan user
    target_special = None
    
    # Normalisasi pesan user (hapus spasi ganda)
    norm_msg = " " + user_message.strip() + " " # Tambah spasi biar boundary jelas
    
    for key, val in SPECIAL_AYAH_MAPPING.items():
        # Jika key ada di dalam pesan (misal: "مجريها" ada di "بسم الله مجريها")
        # ATAU jika key latin (misal "majreha") ada di pesan
        if key in norm_msg or key in re.sub(r'[^a-z]', '', user_message): 
            target_special = val
            break
            
    if target_special:
        spec_surah, spec_ayah = target_special
        print(f"INFO: Chatbot (Special Gharib/Muqatta'at) terdeteksi: {spec_surah}:{spec_ayah}")
        try:
            return get_spesific_ayah(spec_surah, spec_ayah)
        except Exception as e:
            pass
    
    # --- 1. DETEKSI NIAT ---
    rag_keywords = ["hubungan", "jelaskan", "apa", "kenapa", "mengapa", "ringkasan", "rangkuman", "tentang", "bagaimana", "pelajaran"]
    is_rag_question = any(word in user_message for word in rag_keywords) or re.search(r'\d+-\d+', user_message)
    ayat_list = extract_ayat_numbers(user_message)
    surah_found = find_surah_in_query(user_message)

    # --- 2. PENENTUAN KEPUTUSAN ---

    # KASUS 1: Permintaan ayat sederhana (Contoh: "tafsir 5", "tunjukkan 11")
    # -> ADA 1 angka, BUKAN RAG, DAN TIDAK sebut surah lain
    if len(ayat_list) == 1 and not is_rag_question and (surah_found is None or surah_found == 67):
        try:
            ayah_number = ayat_list[0]
            if ayah_number > 30: # Jika "tafsir 35" (di luar Al-Mulk)
                 raise HTTPException(status_code=404, detail="Maaf, untuk permintaan ayat spesifik (tanpa nama surah), saya hanya bisa mengambil dari Surah Al-Mulk (1-30).")
            
            print(f"INFO: Chatbot (Kasus 1: Simple Al-Mulk) terdeteksi. Mencari 67:{ayah_number}")
            return get_spesific_ayah(surah_number=67, ayah_number=ayah_number)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error saat mengambil ayat: {e}")

    # KASUS 2: Pertanyaan RAG spesifik Al-Mulk (Contoh: "hubungan 1-5")
    # -> ADA angka, INI RAG, DAN (tidak sebut surah ATAU sebut Al-Mulk)
    elif len(ayat_list) > 0 and is_rag_question and (surah_found is None or surah_found == 67):
        print(f"INFO: Chatbot (Kasus 2: Al-Mulk RAG) terdeteksi untuk ayat: {ayat_list}")
        dynamic_context = ""
        valid_ayat_list = [num for num in ayat_list if num <= 30] # Filter hanya 1-30
        if not valid_ayat_list:
             raise HTTPException(status_code=404, detail="Angka yang Anda sebutkan di luar jangkauan Surah Al-Mulk (1-30).")

        for num in valid_ayat_list:
            verse_data = QURAN_TEXT_MAP.get(f"67:{num}")
            if verse_data:
                dynamic_context += f"Tafsir Ayat {num}: {verse_data['tafsir']}\n"
        
        context_source_text = f"Tafsir Al-Mulk ayat {', '.join(map(str, valid_ayat_list))}"
        
        return await run_rag_generation(user_message, dynamic_context, context_source_text)

    # KASUS 3: Pertanyaan RAG Global (TAPI SPESIFIK SURAH)
    # (Contoh: "rangkuman ar-rahman", "pelajaran al-baqarah 1-5")
    elif is_rag_question and surah_found is not None and surah_found != 67:
        print(f"INFO: Chatbot (Kasus 3: Global Surah RAG) terdeteksi untuk Surah {surah_found}")
        
        ayat_to_fetch = ayat_list if ayat_list else range(1, 287) # Ambil semua ayat jika tidak spesifik (misal 286 u/ Baqarah)
        
        dynamic_context = ""
        context_source = []
        
        for num in ayat_to_fetch:
            verse_ref = f"{surah_found}:{num}"
            verse_data = QURAN_TEXT_MAP.get(verse_ref)
            if verse_data:
                # KITA PAKAI TERJEMAHAN, KARENA TAFSIR PASTI MELEDAK
                dynamic_context += f"Terjemahan Ayat {num}: {verse_data['translation']}\n"
                context_source.append(str(num))
        
        if not dynamic_context:
             raise HTTPException(status_code=404, detail=f"Saya menemukan Surah {SURAH_NUMBER_TO_NAME[surah_found]}, tapi gagal mengambil konteks ayatnya.")

        context_source_text = f"Terjemahan {SURAH_NUMBER_TO_NAME[surah_found]} ayat {', '.join(context_source)}"
        return await run_rag_generation(user_message, dynamic_context, context_source_text)

    # KASUS 4: Pertanyaan RAG Umum/Vektor (Contoh: "apa itu sabar?")
    # -> INI RAG, TAPI TIDAK ADA angka, DAN TIDAK ADA nama surah
    elif is_rag_question and len(ayat_list) == 0 and surah_found is None:
        print(f"INFO: Chatbot (Kasus 4: Vector RAG) terdeteksi. Menerima: {user_message}")
        
        try:
            query_vector = RAG_MODEL.encode([user_message], normalize_embeddings=True)
            k = 5
            distances, indices = FAISS_INDEX.search(np.array(query_vector).astype('float32'), k)
            
            dynamic_context = ""
            context_source = []
            for i in indices[0]:
                verse_ref = VERSE_REFERENCES[i]
                verse_data = QURAN_TEXT_MAP.get(verse_ref)
                if verse_data:
                    surah_name = SURAH_NUMBER_TO_NAME.get(verse_data['surah'], 'Unknown')
                    context_source.append(f"QS. {surah_name} ({verse_ref})")
                    # Kita pakai tafsir + terjemahan di sini, karena konteksnya kecil (hanya 5)
                    dynamic_context += f"Konteks dari {surah_name} ayat {verse_data['ayah']}:\n"
                    dynamic_context += f"Terjemahan: {verse_data['translation']}\nTafsir: {verse_data['tafsir']}\n---\n"
            
            if not dynamic_context:
                 raise HTTPException(status_code=404, detail="Tidak ditemukan konteks yang relevan untuk pertanyaan Anda.")
            
            context_source_text = f"konteks {', '.join(context_source)}"
            return await run_rag_generation(user_message, dynamic_context, context_source_text)

        except Exception as e:
            print(f"Error Vector RAG: {e}")
            raise HTTPException(status_code=500, detail=f"Gagal melakukan pencarian vektor: {e}")
            
    # KASUS 5: Obrolan Ringan / Tidak Dikenali
    # -> BUKAN pertanyaan RAG DAN tidak ada angka
    else:
        print(f"INFO: Chatbot (Kasus 5: Small Talk) terdeteksi.")
        if "halo" in user_message or "hai" in user_message or "salam" in user_message:
            return {"answer_type": "text", "content": "Halo! Saya adalah asisten AI yang bisa membantu Anda mencari tafsir di seluruh Al-Qur'an. Silakan tanyakan apa saja (misal: 'apa itu sabar?' atau 'rangkuman surah ar-rahman')."}
        elif "terima kasih" in user_message or "makasih" in user_message:
            return {"answer_type": "text", "content": "Sama-sama! Senang bisa membantu."}
        else:
            return {"answer_type": "text", "content": "Maaf, saya tidak mengerti pertanyaan Anda. Coba tanyakan tentang tema, ayat, atau surah tertentu (misal: 'apa itu sabar?')."}


@app.get("/debug-path")
def debug_server_paths():
    """
    Endpoint detektif untuk mengecek struktur folder di dalam Server Railway
    """
    try:
        # Cek posisi file main.py sekarang
        current_dir = os.path.dirname(os.path.abspath(__file__))
        
        # Cek path folder data yang kita set
        data_dir = SURAH_DATA_DIR # Pastikan variabel ini sama dengan yang di atas
        
        # Cek apakah folder itu beneran ada?
        is_folder_exists = os.path.exists(data_dir)
        
        # Cek isi foldernya (kalau ada)
        files_inside = []
        if is_folder_exists:
            files_inside = os.listdir(data_dir)[:5] # Tampilkan 5 file pertama aja
            
        return {
            "status": "Debug Info",
            "current_working_directory": os.getcwd(),
            "main_py_location": current_dir,
            "target_data_dir": data_dir,
            "folder_found": is_folder_exists,
            "files_found_sample": files_inside,
            "can_read_1_json": os.path.exists(os.path.join(data_dir, "1.json"))
        }
    except Exception as e:
        return {"error": str(e)}