import requests
import json

# === ISI KREDENSIAL TEMANMU ===
MY_USERNAME = "Nashif"
MY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjM1MjJhMmE4NGQ4NGIyMDU0ZmUyN2Y3MzM2YmM1YTJhIiwiaWF0IjoxNzY0MDUzMjY3fQ.V3GRUBPshlYVDP2P6wkAwW-dVX6wLTuVAXNaetHzNOk"
# ==============================

BASE_URL = "https://quran-api.lpmqkemenag.id/api-alquran"

headers = {
    "user": MY_USERNAME,
    "Authorization": MY_TOKEN
}

# Kita coba ambil tafsir untuk Al-Fatihah Ayat 1 (ID Database: 5870 atau 1, tergantung sistem mereka)
# Mari kita cari ID-nya dulu
print("1. Mencari ID Database untuk Al-Fatihah Ayat 1...")
resp_ayat = requests.get(f"{BASE_URL}/ayat/local/1", headers=headers)
ayat_data = resp_ayat.json().get("data", [])
target_ayat = next((a for a in ayat_data if a["ayat"] == 1), None)

if target_ayat:
    ayat_id = target_ayat["id"]
    print(f"   ID Ditemukan: {ayat_id}")
    
    print(f"2. Mengambil Tafsir untuk ID {ayat_id}...")
    url_tafsir = f"{BASE_URL}/ayat/local/tafsir/{ayat_id}"
    resp_tafsir = requests.get(url_tafsir, headers=headers)
    
    print(f"   Status: {resp_tafsir.status_code}")
    print("   Isi JSON Tafsir:")
    print("   ---------------------------------------------------")
    # Pretty print JSON agar mudah dibaca strukturnya
    print(json.dumps(resp_tafsir.json(), indent=2))
    print("   ---------------------------------------------------")
else:
    print("Gagal mendapatkan ID ayat.")