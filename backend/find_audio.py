import requests

# ==========================================
# ISI KREDENSIAL TEMANMU DI SINI
# ==========================================
MY_USERNAME = "Adi"
MY_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjM4YzZiYzI4M2NkMWJlOGMxN2Y4ZjNkOWM5Y2UzN2QwIiwiaWF0IjoxNzY0MTUyMDU1fQ.Rkst6e6itvud5y41RZVdHnc2xfxSBVVBYUFxbTf8Bcc"
# ==========================================

BASE_URL = "https://quran-api.lpmqkemenag.id/api-alquran"
headers = {
    "user": MY_USERNAME,
    "Authorization": MY_TOKEN
}

# Daftar tebakan pola endpoint audio
# Kita coba variasi umum untuk mengambil audio ayat ke-1 atau surat ke-1
potential_endpoints = [
    "/audio/1",
    "/audio/001001",        # Format standar audio (SurahAyat)
    "/ayat/audio/1",
    "/surah/audio/1",
    "/ayat/local/audio/1",  # Mengikuti pola '/ayat/local/...'
    "/surah/local/audio/1", # Mengikuti pola '/surah/local/...'
    "/audio/ayat/1",
    "/mp3/1",
    "/suara/1",
    "/recitation/1",
    "/media/audio/1"
]

print("=== MEMULAI MISI PENCARIAN AUDIO ===")
print(f"Target Base URL: {BASE_URL}\n")

found = False

for path in potential_endpoints:
    url = f"{BASE_URL}{path}"
    print(f"Testing: {path} ... ", end="")
    
    try:
        # Kita gunakan HEAD request dulu biar cepat (atau GET jika HEAD diblokir)
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            print(f"✅ TEMBUS! (Status 200)")
            print("   >>> ISI RESPON:")
            print(f"   {response.text[:300]}") # Tampilkan 300 huruf pertama
            found = True
        elif response.status_code == 404:
            print("❌ Tidak Ada (404)")
        elif response.status_code == 403:
            print("⛔ Dilarang (403 - Mungkin endpoint benar tapi butuh izin lain)")
        else:
            print(f"⚠️ Status Aneh ({response.status_code})")
            
    except Exception as e:
        print(f"Error: {e}")

print("\n========================================")
if found:
    print("🎉 KABAR BAIK: Sepertinya kita menemukan endpoint audio!")
else:
    print("😔 KABAR BURUK: Tidak ada tebakan yang berhasil.")
    print("Saran: Tetap gunakan EveryAyah.com yang sudah pasti stabil.")