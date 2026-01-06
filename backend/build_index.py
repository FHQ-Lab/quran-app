import requests
import json
import pyarabic.araby as araby
import time
import sys
import re  # <--- INI PENTING WOK

# URL dasar dari API eksternal
QURAN_API_BASE_URL = "https://quran-api-id.vercel.app"

# Nama file output kita
OUTPUT_FILENAME = "quran_search_index.json"

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

def build_index():
    """
    Fungsi utama untuk men-download semua data surah,
    menormalisasinya, dan menyimpannya ke file JSON lokal.
    """
    print("Memulai proses pembuatan indeks pencarian Al-Qur'an...")
    print(f"Data akan disimpan di: {OUTPUT_FILENAME}\n")
    
    # Ini adalah list yang akan menyimpan semua 6236 ayat
    search_index = []
    
    # Loop untuk 114 surah
    for surah_number in range(1, 115):
        api_url = f"{QURAN_API_BASE_URL}/surah/{surah_number}"
        
        print(f"Mengambil data Surah {surah_number}/114...", end="")
        
        try:
            # 1. Mengambil data dari API
            response = requests.get(api_url)
            response.raise_for_status()  # Error jika status code bukan 2xx
            
            data = response.json().get("data", {})
            verses = data.get("verses", [])
            
            if not verses:
                print(f" GAGAL! Tidak ada data ayat ditemukan untuk Surah {surah_number}.")
                continue

            # 2. Memproses setiap ayat dalam surah
            for verse in verses:
                try:
                    ayah_number = verse["number"]["inSurah"]
                    arabic_text_original = verse["text"]["arab"]

                    translation_text = verse["translation"]["id"]
                    tafsir_text = verse["tafsir"]["id"]["long"] # Ambil tafsir Kemenag
                    
                    # Normalisasi teks Arab
                    normalized_text = normalize_arabic(arabic_text_original)
                    
                    # 3. Menyimpan data yang kita butuhkan saja
                    search_index.append({
                        "surah": surah_number,
                        "ayah": ayah_number,
                        "text_normalized": normalized_text, # <-- Teks bersih untuk dicari
                        "text_arab": arabic_text_original, # <-- Teks asli untuk ditampilkan
                        "translation": translation_text, # <-- FIELD BARU
                        "tafsir": tafsir_text       # <-- FIELD BARU
                    })
                except KeyError as e:
                # Ini untuk menangani jika ada ayat yang tidak punya tafsir/terjemahan
                    print(f"\nError parsing data (KeyError): {e} di Surah {surah_number}, Ayat {verse.get('number', {}).get('inSurah', '?')}")
                except Exception as e:
                    print(f"\nError tidak diketahui saat memproses ayat: {e}")

            print(f" SELESAI ({len(verses)} ayat diproses)")
            
            # 4. Beri jeda agar tidak membebani API
            time.sleep(0.1) # Jeda 0.1 detik antar surah

        except requests.exceptions.RequestException as e:
            print(f" GAGAL! Error mengambil data Surah {surah_number}: {e}")
            print("Proses dihentikan.")
            sys.exit(1) # Keluar dari script jika ada error API
            
    # 5. Menyimpan hasil akhir ke file JSON
    print(f"\nTotal {len(search_index)} ayat telah diproses.")
    print(f"Menyimpan indeks ke {OUTPUT_FILENAME}...")
    
    try:
        with open(OUTPUT_FILENAME, 'w', encoding='utf-8') as f:
            # ensure_ascii=False sangat penting untuk menyimpan teks Arab
            json.dump(search_index, f, ensure_ascii=False, indent=2)
        
        print("\n=============================================")
        print("🎉 SUKSES! File indeks pencarian telah dibuat.")
        print("=============================================")
        
    except IOError as e:
        print(f" GAGAL menyimpan file: {e}")
        sys.exit(1)

# Ini memastikan fungsi build_index() hanya berjalan
# saat kita menjalankan file ini secara langsung
if __name__ == "__main__":
    build_index()