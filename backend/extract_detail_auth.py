import requests
import json
import os
import time

# === ISI KREDENSIAL KAMU ===
USERNAME = "Adi"
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjM4YzZiYzI4M2NkMWJlOGMxN2Y4ZjNkOWM5Y2UzN2QwIiwiaWF0IjoxNzY0MTUyMDU1fQ.Rkst6e6itvud5y41RZVdHnc2xfxSBVVBYUFxbTf8Bcc"
# ===========================

BASE_URL = "https://quran-api.lpmqkemenag.id/api-alquran"
HEADERS = {
    "user": USERNAME,
    "Authorization": TOKEN
}
DATA_DIR = "data_surah"

# Buat folder jika belum ada
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

print("🚀 Memulai Download Detail 114 Surat (Mode Authenticated)...")

for nomor in range(1, 115):
    print(f"Mengambil Surat ke-{nomor}...", end="")
    
    # Endpoint sesuai screenshot kamu: /ayat/local/{no_surah}
    endpoint = f"{BASE_URL}/ayat/local/{nomor}"
    
    try:
        response = requests.get(endpoint, headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            # Simpan file
            file_path = os.path.join(DATA_DIR, f"{nomor}.json")
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            print(" ✅ Sukses!")
        else:
            print(f" ❌ Gagal (Status: {response.status_code})")
            # Jangan simpan file error agar tidak merusak sistem
            
    except Exception as e:
        print(f" ❌ Error: {e}")
        
    time.sleep(0.5) # Jeda sopan

print("\n🎉 Selesai! Cek folder 'data_surah'.")