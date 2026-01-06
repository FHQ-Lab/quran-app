import requests
import json
import os

# === ISI KREDENSIAL KAMU DI SINI ===
USERNAME = "Adi" 
TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjM4YzZiYzI4M2NkMWJlOGMxN2Y4ZjNkOWM5Y2UzN2QwIiwiaWF0IjoxNzY0MTUyMDU1fQ.Rkst6e6itvud5y41RZVdHnc2xfxSBVVBYUFxbTf8Bcc"
# ===================================

BASE_URL = "https://quran-api.lpmqkemenag.id/api-alquran"
HEADERS = {
    "user": USERNAME,
    "Authorization": TOKEN
}

def get_surah_list():
    print("🚀 Sedang login dan mengambil daftar 114 Surat...")
    
    # Sesuai screenshot kamu: /surah/local/{first_number}/{number}
    # Kita minta dari surat ke-1 sebanyak 114 surat
    endpoint = f"{BASE_URL}/surah/local/1/114"
    
    try:
        response = requests.get(endpoint, headers=HEADERS)
        
        if response.status_code == 200:
            data = response.json()
            
            # Simpan ke surah_list.json
            with open("surah_list.json", "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                
            print("✅ BERHASIL! File 'surah_list.json' sudah dibuat.")
            print(f"📄 Total data: {len(data.get('data', []))} surat.")
        else:
            print(f"❌ GAGAL! Status Code: {response.status_code}")
            print("Pesan:", response.text)
            
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    get_surah_list()