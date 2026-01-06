import requests
import json
import os
import time
import sys

# === ISI KREDENSIAL KAMU ===
USERNAME = "Nashif" 
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjM1MjJhMmE4NGQ4NGIyMDU0ZmUyN2Y3MzM2YmM1YTJhIiwiaWF0IjoxNzY0MDUzMjY3fQ.V3GRUBPshlYVDP2P6wkAwW-dVX6wLTuVAXNaetHzNOk"
# ===========================

BASE_URL = "https://quran-api.lpmqkemenag.id/api-alquran"
HEADERS = {
    "user": USERNAME,
    "Authorization": TOKEN
}

# Gunakan Path Absolut agar tidak salah folder
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data_tafsir")

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

print(f"🚀 Memulai Script Ekstraksi 'Pintar' (Target Folder: {DATA_DIR})")

def extract_tafsir_smart():
    # Loop 114 Surat
    for surah_num in range(1, 115):
        file_path = os.path.join(DATA_DIR, f"{surah_num}.json")
        
        # --- 1. LOGIKA RESUME YANG DIPERBAIKI ---
        if os.path.exists(file_path):
            try:
                # Wajib pakai utf-8 karena ada text Arab
                with open(file_path, 'r', encoding='utf-8') as f:
                    cek_data = json.load(f)
                    
                    # Cek validitas data
                    data_list = cek_data.get('data', [])
                    if isinstance(data_list, list) and len(data_list) > 0:
                        print(f"⏩ Surat ke-{surah_num} sudah ada ({len(data_list)} ayat). Skip.")
                        continue # LANJUT KE SURAT BERIKUTNYA
                    else:
                        print(f"⚠️ Surat ke-{surah_num} ada tapi isinya kosong/salah. Download ulang...")
            except Exception as e:
                # Tampilkan error kenapa file dianggap rusak
                print(f"⚠️ File {surah_num}.json terbaca error ({e}). Download ulang...")

        print(f"📂 Memproses Surat ke-{surah_num}...", end="")
        
        # --- 2. Ambil Daftar Ayat (Retry Logic) ---
        list_ayat = []
        retry_count = 0
        max_retries = 5
        
        while retry_count < max_retries:
            try:
                url_ayat = f"{BASE_URL}/ayat/local/{surah_num}"
                resp_ayat = requests.get(url_ayat, headers=HEADERS, timeout=15)
                
                if resp_ayat.status_code == 200:
                    data = resp_ayat.json().get("data", [])
                    if len(data) > 0:
                        list_ayat = data
                        break 
                    else:
                        print(" (List kosong? Aneh...) ", end="")
                elif resp_ayat.status_code == 429 or resp_ayat.status_code >= 500:
                    print(f"\n🛑 Kena Blokir/Limit (Code {resp_ayat.status_code}). Istirahat 60 detik...", end="")
                    time.sleep(60)
                
            except Exception as e:
                print(f" (Error Koneksi: {e}) ", end="")
            
            retry_count += 1
            if retry_count < max_retries:
                print(f" [Retry {retry_count}]", end="")
                time.sleep(5)

        if not list_ayat:
            print(f"\n❌ GAGAL TOTAL mengambil daftar ayat Surat {surah_num}. Script berhenti.")
            sys.exit()

        print(f" ({len(list_ayat)} Ayat) ", end="")
        
        # --- 3. Download Tafsir Per Ayat ---
        surah_tafsir_collection = []
        
        for ayat in list_ayat:
            ayat_id = ayat["id"]
            no_ayat = ayat["ayat"]
            
            success_fetch = False
            for attempt in range(3):
                try:
                    url_tafsir = f"{BASE_URL}/ayat/local/tafsir/{ayat_id}"
                    resp_tafsir = requests.get(url_tafsir, headers=HEADERS, timeout=10)
                    
                    if resp_tafsir.status_code == 200:
                        raw_data = resp_tafsir.json().get("data", [])
                        if raw_data:
                            t_data = raw_data[0]
                            surah_tafsir_collection.append({
                                "ayat": no_ayat,
                                "wajiz": t_data.get("teks"),
                                "tahlili": t_data.get("tahlili")
                            })
                            print(".", end="", flush=True)
                            success_fetch = True
                            break
                        else:
                            print("x", end="", flush=True)
                            success_fetch = True 
                            break
                    elif resp_tafsir.status_code == 429:
                        print("S", end="", flush=True)
                        time.sleep(10)
                    else:
                        print("!", end="", flush=True)
                        
                except:
                    print("e", end="", flush=True)
                    time.sleep(5)
            
            if not success_fetch:
                surah_tafsir_collection.append({
                    "ayat": no_ayat, "wajiz": None, "tahlili": None
                })

            time.sleep(3) # Jeda antar ayat

        # --- 4. Simpan File ---
        file_path = os.path.join(DATA_DIR, f"{surah_num}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            final_json = {
                "code": 200,
                "surah": surah_num,
                "data": surah_tafsir_collection
            }
            json.dump(final_json, f, ensure_ascii=False)
            
        print(" ✅ Tersimpan!")
        time.sleep(4)

if __name__ == "__main__":
    extract_tafsir_smart()