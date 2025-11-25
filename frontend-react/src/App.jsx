import React, { useState, useEffect } from 'react';

// --- 1. IMPORT SEMUA KOMPONEN ---
import Header from './components/Header';
import HeroCard from './components/HeroCard';
import QuickLinks from './components/QuickLinks';
import SearchBar from './components/SearchBar';
import SurahCard from './components/SurahCard';
import ResultsArea from './components/ResultsArea';
import Chatbot from './components/Chatbot';
import './components/Chatbot.css'; 
import SurahDetail from './components/SurahDetail';


// Cek SpeechRecognition API
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'ar-SA';
  recognition.continuous = false;
  recognition.interimResults = false;
}



// =====================================================================
// KOMPONEN UTAMA
// =====================================================================
function App() { 
  
  // === 2. SEMUA STATE ===
  const [searchInput, setSearchInput] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [multipleResults, setMultipleResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [spokenQuery, setSpokenQuery] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState(null);
  const [initialTargetAyah, setInitialTargetAyah] = useState(null);
  const [allSurahs, setAllSurahs] = useState([]);
  const [isSurahListLoading, setIsSurahListLoading] = useState(true); 

  // === FETCH DAFTAR 114 SURAT SAAT STARTUP ===
  useEffect(() => {
    const fetchAllSurahs = async () => {
      try {
        setIsSurahListLoading(true);
        // memanggil endpoint yang memberikan list semua surat
        const response = await fetch('https://quran-api-id.vercel.app/surah');
        const data = await response.json();
        
        setAllSurahs(data.data); 
      } catch (error) {
        console.error("Gagal memuat daftar surat:", error);
      } finally {
        setIsSurahListLoading(false);
      }
    };

    fetchAllSurahs();
  }, []);

  // === 3. SEMUA FUNGSI HANDLER ===

  // Fungsi ini dipanggil saat kartu surat diklik
  const handleSurahClick = (id) => {
    setSelectedSurahId(id);
    window.scrollTo(0, 0); // Scroll ke atas saat pindah halaman
  };
  if (selectedSurahId) {
    return (
      <SurahDetail 
        surahNumber={selectedSurahId}
        initialTargetAyah={initialTargetAyah} 
        onBack={() =>{
          setSelectedSurahId(null)
          setInitialTargetAyah(null);
        }}
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
      // === LOGIKA HANDLING RESPONS BARU ===

      // Kasus A: Hasil Banyak (Vector Search / Pencarian Teks)
      if (apiResponse.match_type === "multiple") {
        setMultipleResults(apiResponse.results);
        setSearchResult(null);
      } 
      
      // Kasus B: Redirect ke Surah (Pencarian Nama Surah Saja)
      else if (apiResponse.match_type === "single_surah") {
        // Langsung pindah halaman ke nomor surat tersebut
        setSelectedSurahId(apiResponse.data.surah.number);
        setInitialTargetAyah(null); // Tidak scroll ke ayat tertentu, cuma buka surat
        
        // Reset UI
        setMultipleResults([]);
        setSearchResult(null);
        setSearchInput("");
      }
      
      // Kasus C: Hasil Tunggal Spesifik (Surah + Ayat)
      else {
        const ayahData = apiResponse.data;
        // Redirect DAN Scroll ke ayat
        setInitialTargetAyah(ayahData.number.inSurah); // Set target scroll
        setSelectedSurahId(ayahData.surah.number);     // Pindah halaman
        
        // Reset UI
        setMultipleResults([]);
        setSearchResult(null);
        setSearchInput("");
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
        const data = apiResponse.data; // Data ayat lengkap
        // 1. Set target ayat untuk auto-scroll
        setInitialTargetAyah(data.number.inSurah);
        // 2. Pindah ke halaman Surat tersebut
        setSelectedSurahId(data.surah.number);
        // 3. Reset UI pencarian
        setMultipleResults([]);
        setSearchResult(null);
        setSearchInput(""); // Opsional: bersihkan search bar
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



  // === FUNGSI HANDLER QUICK LINKS ===
  const handleQuickLinkClick = (surahId, targetAyah = null) => {
    // 1. Set target ayat (bisa null, atau angka seperti 255)
    setInitialTargetAyah(targetAyah);

    // 2. Pindah halaman ke surat tersebut
    setSelectedSurahId(surahId);

    // 3. Scroll window ke paling atas (agar rapi saat ganti halaman)
    window.scrollTo(0, 0);
  };

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

            <QuickLinks onLinkClick={handleQuickLinkClick} />
            
            {/* Daftar Surah (Grid Baru) */}
            <div className="mt-4">
              {isSurahListLoading ? (
                // Tampilkan Skeleton/Loading sederhana jika sedang memuat
                <div className="text-center py-10 text-gray-500 col-span-full">
                  Memuat 114 Surat...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Kita map dari 'allSurahs', bukan 'surahList' lagi */}
                  {allSurahs.map((surah) => (
                    <div 
                      key={surah.number} 
                      onClick={() => handleSurahClick(surah.number)} 
                      className="cursor-pointer"
                    >
                      <SurahCard
                        number={surah.number}
                        // API mengembalikan nama di dalam object 'name'
                        name={surah.name.transliteration.id} 
                        // Kita gabungkan info wahyu dan jumlah ayat
                        details={`${surah.revelation.id} • ${surah.numberOfVerses} Ayat`}
                        // Nama Arab pendek
                        arabicName={surah.name.short} 
                      />
                    </div>
                  ))}
                </div>
              )}
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