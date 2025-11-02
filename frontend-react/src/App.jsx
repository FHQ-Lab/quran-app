import React, { useState } from 'react';
import './App.css'; //buat file CSS
import Highlight from './Highlight.jsx'; 
// =======================================================
// !!! BAGIAN INI HILANG DARI KODE KAMU !!!
// Kamu perlu mendefinisikan 'recognition' DI LUAR komponen
// agar bisa diakses oleh logic dan JSX di bawah.
// =======================================================
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.lang = 'ar-SA'; // Set bahasa ke Arab
  recognition.continuous = false;
  recognition.interimResults = false;
}
// =======================================================
// BATAS KODE YANG HILANG
// =======================================================

function App() {
  // == DEKLARASI STATE ==
  // State untuk menyimpan nilai input form
  // const [surahInput, setSurahInput] = useState('67'); //Default Al-Mulk
  // const [ayahInput, setAyahInput] = useState('1'); //Default ayat 1 - Al-Mulk
  // TAMBAHKAN INI
  const [searchInput, setSearchInput] = useState('');
  // State untuk menyimpan hasil dari API
  const [searchResult, setSearchResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [multipleResults, setMultipleResults] = useState([]);
  // State untuk Highlight search
  const [spokenQuery, setSpokenQuery] = useState("");

  // == FUNGSI FETCHING ==
  // Fungsi ini akan dipanggil saat tombol "Cari" diklik
  // GANTI FUNGSI LAMA
const handleSearch = async () => {
  setIsLoading(true);
  setError(null);
  setSearchResult(null);
  setMultipleResults([]);

  try {
    // Panggil endpoint BARU kita
    const response = await fetch(`http://127.0.0.1:8000/search?q=${encodeURIComponent(searchInput)}`);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Pencarian gagal.');
    }

    const apiResponse = await response.json();

    // Cek jenis respons (Sama seperti logic voice search)
    if (apiResponse.match_type === "multiple") {
      setMultipleResults(apiResponse.results);
      setSearchResult(null);
    } else {
      setSearchResult(apiResponse.data);
      setMultipleResults([]);
    }

  } catch (err) {
    setError(err.message);
  } finally {
    setIsLoading(false);
  }
};

    // == FUNGSI UNTUK FETCH DATA SUARA ==
  const fetchBySpokenText = async (text) => {
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setMultipleResults([]);

    try {
      // Panggil endpoint /search-by-text dengan method POST
      const response = await fetch('http://127.0.0.1:8000/search-by-text', {

        // INI YANG HILANG SEBELUMNYA
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text }) // Kirim teks dalam format JSON
        // ---------------------------

      });

      if (!response.ok) {
        // Ambil detail error dari backend
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ayat tidak ditemukan!');
      }

      const apiResponse = await response.json();

      // === LOGIKA BARU UNTUK MEMBACA RESPONS ===
      if (apiResponse.match_type === "multiple") {
        // KASUS 2: Kita dapat daftar pilihan ganda
        setMultipleResults(apiResponse.results);
        setSearchResult(null); // Pastikan hasil tunggal kosong
      } else {
        // KASUS 1: Kita dapat objek ayat tunggal
        // (Backend sudah mengemasnya seperti respons '/surah/...')
        setSearchResult(apiResponse.data);
        setMultipleResults([]); // Pastikan hasil ganda kosong
      }
      // =======================================

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // =========================================

  // === FUNGSI BARU UNTUK HANDLE KLIK HASIL GANDA ===
  const handleMultipleResultClick = async (surahNumber, ayahNumber) => {
    console.log(`Mengambil detail untuk Surah ${surahNumber}, Ayat ${ayahNumber}`);
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setMultipleResults([]); // Langsung kosongkan list

    try {
      // Panggil endpoint yang SAMA dengan pencarian manual
      const response = await fetch(`http://127.0.0.1:8000/surah/${surahNumber}/${ayahNumber}`);

      if (!response.ok) {
        throw new Error(`Gagal mengambil data untuk QS ${surahNumber}:${ayahNumber}.`);
      }

      const apiResponse = await response.json();
      setSearchResult(apiResponse.data); // Simpan hasil LENGKAP ke state searchResult

    } catch (err) {
      setError(err.message);
      setSearchResult(null); // Pastikan searchResult kosong jika error
    } finally {
      setIsLoading(false);
    }
  };
  // ================================================

  // === FUNGSI BARU UNTUK HANDLE TOMBOL REKAM ===
  const handleVoiceSearch = () => {
    // Variabel 'recognition' sekarang sudah terdefinisi
    if (!recognition) {
      setError('Browser Anda tidak mendukung Voice Recognition.');
      return;
    }

    setIsRecording(true);
    setError(null);

    // Set event listener-nya di sini
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      console.log('Teks yang diucapkan:', spokenText);
      setSpokenQuery(spokenText); // Simpan ucapan ke state
      // Panggil fungsi fetch baru kita
      fetchBySpokenText(spokenText);
    };

    recognition.onerror = (event) => {
      setError(`Error rekaman: ${event.error}`);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
  };
  // ===========================================

  // === 3. RENDER TAMPILAN (JSX) ===
  return (
    <div className="container">
      {/* ... (H1 dan H2 tidak berubah) ... */}
      <h1>Aplikasi Tafsir Al-Qur'an (React Ver.)</h1>
      <p>Studi Kasus: Surah Al-Mulk</p>

      {/* --- Area Pencarian GLOBAL --- */}
      <div className="search-box">
        <input
          type="text"
          className="global-search-input" // Class baru
          placeholder="Cari ayat, arti, tafsir (misal: 2:255, al-fatihah:7, atau 'sabar')..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          // Tambahkan fitur 'Enter'
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
        />

        {/* Tombol Voice Search (tidak berubah) */}
        {recognition ? (
          <button
            className="voice-button"
            onClick={handleVoiceSearch}
            disabled={isLoading || isRecording}
          >
            {isRecording ? 'Mendengarkan...' : '🎤'}
          </button>
        ) : (
          <p className="error-message" style={{ margin: '0 10px' }}>
            No Mic
          </p>
        )}

        {/* Tombol Cari (tidak berubah) */}
        <button onClick={handleSearch} disabled={isLoading || isRecording}>
          {isLoading ? 'Mencari...' : 'Cari'}
        </button>
      </div>

      <hr />

      {/* --- Area Hasil Pencarian --- */}
      <div className="result-area">
        {isLoading && <p>Loading...</p>}
        {error && <p className="error-message">Terjadi kesalahan: {error}</p>}

        {/* --- BLOK 1: HASIL TUNGGAL (YANG SUDAH DIPERBAIKI) --- */}
        {searchResult && (
          <div className="ayah-display">
            <h2>
              {searchResult.surah.name.transliteration.id} ({searchResult.surah.name.short}) - 
              Ayat {searchResult.number.inSurah}
            </h2>

            {/* INI YANG HILANG SEBELUMNYA */}
            <h3 className="arabic-text">{searchResult.text.arab}</h3>
            <p><strong>Artinya:</strong> "{searchResult.translation.id}"</p>
            <h4>Tafsir (KEMENAG):</h4>
            {/* --------------------------- */}

            <p>{searchResult.tafsir.id.long}</p>
          </div>
        )}

        {/* ================================================ */}
        {/* === BLOK 2: HASIL GANDA (DENGAN onClick) === */}
      {multipleResults.length > 0 && (
        <div className="multiple-results-display">
          <h3>Ditemukan {multipleResults.length} ayat yang sangat mirip (klik untuk detail):</h3>
          {multipleResults.map((match, index) => (
            <div
              className="ayah-display-short clickable" // <-- Tambahkan class 'clickable'
              key={index}
              // === TAMBAHKAN onClick DI SINI ===
              onClick={() => handleMultipleResultClick(match.surah, match.ayah)}
              // ===================================
            >
              <Highlight text={match.text_arab} query={spokenQuery} />
              <p>
                <strong>(QS. {match.surah}: Ayat {match.ayah})</strong> -
                Skor: {match.score}%
              </p>
            </div>
          ))}
        </div>
      )}
      {/* ======================================= */}
      </div>
    </div>
  );
}

export default App;