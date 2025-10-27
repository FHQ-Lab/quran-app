// Menangkap elemen-elemen dari HTML
const surahInput = document.getElementById('surahInput');
const ayahInput = document.getElementById('ayahInput');
const searchButton = document.getElementById('searchButton');
const resultDiv = document.getElementById('result');

// Menambahkan event listener untuk tombol Cari
searchButton.addEventListener('click', async () => {
    const surah = surahInput.value;
    const ayah = ayahInput.value;

    // Validasi input sederhana
    if (!surah || !ayah) {
        alert('Mohon isi nomor surat dan ayat');
        return;
    }

    try {
        // Memanggil API backend kita menggunakan fetch!
        const response = await fetch(`http://127.0.0.1:8000/surah/${surah}/${ayah}`);

        if (!response.ok) {
            throw new Error('Data tidak ditemukan!');
        }

        const apiResponse = await response.json(); // Data lengkap dari API

        // Gunakan console.log untuk melihat struktur jika ada error lagi
        console.log("Data yang diterima dari backend:", apiResponse); 

        // Menampilkan data ke dalam div hasil
        displayResult(apiResponse);

    } catch (error) {
        resultDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${error.message}</p>`;
    }
});

function displayResult(apiResponse) {
    // BARIS KUNCI: Ambil objek yang kita butuhkan dari dalam "amplop" data
    const data = apiResponse.data;

    // Mengolah dan menampilkan data dengan format yang bagus
    resultDiv.innerHTML = `
        <h2>${data.surah.name.transliteration.id} (${data.surah.name.short}) - Ayat ${data.number.inSurah}</h2>
        <h3>${data.text.arab}</h3>
        <p><strong>Artinya:</strong> "${data.translation.id}"</p>
        <hr>
        <h4>Tafsir (KEMENAG):</h4>
        <p>${data.tafsir.id.long}</p>
    `;
}

// =======================================================
// KODE UNTUK VOICE RECOGNITION
// =======================================================

const recordButton = document.getElementById('recordButton');

// Cek apakah browser mendukung Web Speech API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
    const recognition = new SpeechRecognition();

    // --- Konfigurasi Penting ---
    recognition.lang = 'ar-SA'; // Set bahasa ke Arab (Saudi Arabia)
    recognition.continuous = false; // Berhenti merekam setelah ada jeda
    recognition.interimResults = false; // Hanya berikan hasil final

    // Event listener untuk tombol rekam
    recordButton.addEventListener('click', () => {
        resultDiv.innerHTML = `<p>Mendengarkan...</p>`;
        recognition.start();
    });

    // Event yang berjalan ketika suara berhasil dikenali
    recognition.onresult = async (event) => {
        const spokenText = event.results[0][0].transcript;
        console.log("Teks yang diucapkan:", spokenText);

        // Kirim teks hasil rekaman ke backend
        await searchBySpokenText(spokenText);
    };

    // Event untuk error
    recognition.onerror = (event) => {
        resultDiv.innerHTML = `<p style="color: red;">Error rekaman: ${event.error}</p>`;
    };

} else {
    // Sembunyikan tombol jika browser tidak support
    recordButton.style.display = 'none';
    alert('Browser Anda tidak mendukung Voice Recognition.');
}


// Fungsi baru untuk mengirim teks ke backend
async function searchBySpokenText(text) {
    try {
        // Kita akan membuat endpoint baru di backend: /search-by-text
        const response = await fetch('http://127.0.0.1:8000/search-by-text', {
            method: 'POST', // Gunakan POST karena kita mengirim data
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text }) // Kirim teks dalam format JSON
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Ayat tidak ditemukan!');
        }

        const apiResponse = await response.json();
        displayResult(apiResponse); // Gunakan lagi fungsi displayResult yang sudah ada

    } catch (error) {
        resultDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${error.message}</p>`;
    }
}