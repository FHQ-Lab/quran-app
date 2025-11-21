import React, { useState } from 'react';

// --- 1. IMPORT SEMUA KOMPONEN KITA ---
// (Asumsi semua file ini ada di ./components/)
import Header from './components/Header';
import HeroCard from './components/HeroCard';
import QuickLinks from './components/QuickLinks';
import SearchBar from './components/SearchBar';
import SurahCard from './components/SurahCard';
import ResultsArea from './components/ResultsArea';
import Chatbot from './components/Chatbot';
import './components/Chatbot.css'; // CSS untuk Chatbot (tetap terpisah)
import SurahDetail from './components/SurahDetail'; // <-- Tambahkan ini


// Cek SpeechRecognition API (Tetap di sini)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.interimResults = false;
}

// --- DATA DUMMY (NANTI KITA PINDAHKAN) ---
// Data dummy untuk daftar surah
const surahList = [
  { id: 1, number: 1, name: "Al-Fatihah", details: "Makkiyyah • 7 Ayat", arabicName: "الفاتحة" },
  { id: 2, number: 2, name: "Al-Baqarah", details: "Madaniyah • 286 Ayat", arabicName: "البقرة" },
  { id: 3, number: 3, name: "Ali 'Imran", details: "Madaniyah • 200 Ayat", arabicName: "آل عمران" },
  { id: 4, number: 4, name: "An-Nisa'", details: "Madaniyah • 176 Ayat", arabicName: "النساء" },
  { id: 5, number: 5, name: "Al-Ma'idah", details: "Madaniyah • 120 Ayat", arabicName: "المائدة" },
  { id: 6, number: 6, name: "Al-An'am", details: "Makkiyah • 165 Ayat", arabicName: "الأنعام" },
];

// =====================================================================
// KOMPONEN UTAMA APP.JSX (File-mu)
// =====================================================================
function App() { // <-- Kita ganti namanya kembali ke 'App'
  
  // === 2. SEMUA STATE KITA ===
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [multipleResults, setMultipleResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenQuery, setSpokenQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState(null);

  // === 3. SEMUA FUNGSI HANDLER KITA (YANG HILANG) ===

  // Fungsi ini dipanggil saat kartu surat diklik
  const handleSurahClick = (id) => {
    setSelectedSurahId(id);
    window.scrollTo(0, 0); // Scroll ke atas saat pindah halaman
  };
  if (selectedSurahId) {
    return (
      <SurahDetail 
        surahNumber={selectedSurahId} 
        onBack={() => setSelectedSurahId(null)} // Tombol kembali meng-null-kan state
      />
    );
  }

  const handleSearch = async () => {
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setMultipleResults([]);
    try {
      const response = await fetch(`http://127.0.0.1:8000/search?q=${encodeURIComponent(searchInput)}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Pencarian gagal.');
      }
      const apiResponse = await response.json();
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

  const fetchBySpokenText = async (text) => {
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setMultipleResults([]);
    try {
      const response = await fetch('http://127.0.0.1:8000/search-by-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Ayat tidak ditemukan!');
      }
      const apiResponse = await response.json();
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

  const handleVoiceSearch = () => {
    if (!recognition) {
      setError("Browser Anda tidak mendukung Voice Recognition.");
      return;
    }
    setIsRecording(true);
    setError(null);
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      console.log("Teks yang diucapkan:", spokenText);
      setSpokenQuery(spokenText);
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

  const handleMultipleResultClick = async (surahNumber, ayahNumber) => {
    console.log(`Mengambil detail untuk Surah ${surahNumber}, Ayat ${ayahNumber}`);
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setMultipleResults([]);
    try {
      const response = await fetch(`http://127.0.0.1:8000/surah/${surahNumber}/${ayahNumber}`);
      if (!response.ok) {
        throw new Error(`Gagal mengambil data untuk QS ${surahNumber}:${ayahNumber}.`);
      }
      const apiResponse = await response.json();
      setSearchResult(apiResponse.data);
    } catch (err) {
      setError(err.message);
      setSearchResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Tentukan apa yang akan ditampilkan: Halaman Utama atau Halaman Hasil
  const hasSearchResults = searchResult || multipleResults.length > 0 || isLoading || error;

  // === 4. TAMPILAN JSX (LAYOUT GABUNGAN) ===
  return (
    // Wadah aplikasi utama
    <div className="min-h-screen bg-gray-100">

      {/* Header 'sticky' di atas */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-8xl mx-auto">
          <Header />
        </div>
      </header>

      {/* Konten utama */}
      <main className="max-w-6xl mx-auto py-4 px-4">

        {/* --- Logika Tampilan Kondisional --- */}
        {hasSearchResults ? (
          
          // TAMPILAN B: JIKA ADA HASIL PENCARIAN
          <ResultsArea
            isLoading={isLoading}
            error={error}
            searchResult={searchResult}
            multipleResults={multipleResults}
            spokenQuery={spokenQuery}
            handleMultipleResultClick={handleMultipleResultClick}
          />

        ) : (

          // TAMPILAN A: JIKA TIDAK ADA HASIL (HALAMAN UTAMA)
          <>
            <HeroCard />

            {/* --- Area Search Bar --- */}
          <div className="my-4">
            <SearchBar
              searchInput={searchInput}
              setSearchInput={setSearchInput}
              handleSearch={handleSearch}
              handleVoiceSearch={handleVoiceSearch}
              isLoading={isLoading}
              isRecording={isRecording}
              recognition={recognition}
            />
          </div>

            <QuickLinks />
            
            {/* Daftar Surah (Grid Baru) */}
            <div className="mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {surahList.map((surah) => (
                  <div key={surah.id} onClick={() => handleSurahClick(surah.id)}>
                  <SurahCard
                    key={surah.id}
                    number={surah.number}
                    name={surah.name}
                    details={surah.details}
                    arabicName={surah.arabicName}
                  />
                  </div>
                ))}
              </div>
            </div>
          </>
          
        )}
      </main>

      {/* --- Chatbot (di luar <main>) --- */}
      <button
        className="chat-toggle-btn"
        onClick={() => setIsChatOpen(!isChatOpen)}
      >
        🤖
      </button>
      {isChatOpen && <Chatbot onClose={() => setIsChatOpen(false)} />}
      
    </div>
  );
}

export default App; // <-- Kita ekspor 'App'