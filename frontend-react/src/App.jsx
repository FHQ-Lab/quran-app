import React, { useState, useEffect } from 'react';
import { HiStop, HiArrowLeft, HiMicrophone, HiChatBubbleLeftRight, HiChatBubbleLeft, HiChatBubbleBottomCenter} from 'react-icons/hi2';
import { useQuery } from '@tanstack/react-query';
import Header from './components/Header';
import HeroCard from './components/HeroCard';
import QuickLinks from './components/QuickLinks';
import SearchBar from './components/SearchBar';
import SurahCard from './components/SurahCard';
import ResultsArea from './components/ResultsArea';
import Chatbot from './components/Chatbot';
import SurahDetail from './components/SurahDetail';
import MenuSidebar from './components/MenuSidebar';
import SettingsModal from './components/SettingsModal';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";
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
  const [highlightQuery, setHighlightQuery] = useState("");  const [isChatOpen, setIsChatOpen] = useState(false);
  const [selectedSurahId, setSelectedSurahId] = useState(null);
  const [initialTargetAyah, setInitialTargetAyah] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);


  // === FETCH DAFTAR SURAT (DENGAN CACHE) ===
  const { data: allSurahs = [], isLoading: isSurahListLoading } = useQuery({
    queryKey: ['allSurahs'], // Ini "kunci" unik untuk cache data ini
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/surahs`);
      const json = await response.json();
      return json.data; // Langsung kembalikan array surat
    }
  });

  // === 3. SEMUA FUNGSI HANDLER ===
  // Fungsi Navigasi dari Bookmark
  const handleBookmarkNav = (surahId, ayahId) => {
    // Gunakan logika yang sama dengan QuickLink
    setInitialTargetAyah(ayahId);
    setSelectedSurahId(surahId);
    window.scrollTo(0, 0);
  };

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
    setHighlightQuery(searchInput);
    try {
      const response = await fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(searchInput)}`);
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

  // --- FETCH DATA DARI SUARA (Update Logika Backend Baru) ---
  const fetchBySpokenText = async (text) => {
    setIsLoading(true);
    setError(null);
    setSearchResult(null);
    setMultipleResults([]);

    // 1. FIX: Definisikan encodedText dengan benar!
    const encodedText = encodeURIComponent(text);

    try {
      // Panggil Endpoint Search "Cerdas" kita
      const response = await fetch(`${API_BASE_URL}/search?q=${encodedText}`);

      if (!response.ok) {
        // Tangani 404 (Tidak ketemu) dengan sopan
        if (response.status === 404) {
           throw new Error(`Tidak ditemukan hasil untuk "${text}"`);
        }
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Gagal mencari ayat.');
      }

      const apiResponse = await response.json();

      // --- SKENARIO 1: HASIL BANYAK (Teks/Latin/Topik) ---
      if (apiResponse.match_type === "multiple") {
        setMultipleResults(apiResponse.results);
        setSearchResult(null);
      } 
      
      // --- SKENARIO 2: USER CARI NAMA SURAT SAJA (Fitur Baru!) ---
      // Contoh suara: "Surat Yasin" -> Backend return match_type: "single_surah"
      else if (apiResponse.match_type === "single_surah") {
        const surahData = apiResponse.data.surah;
        setInitialTargetAyah(null);      // Tidak perlu scroll ke ayat tertentu
        setSelectedSurahId(surahData.number); // Pindah ke halaman surat
        setMultipleResults([]);
        setSearchInput(""); 
      }

      // --- SKENARIO 3: USER CARI AYAT SPESIFIK ---
      // Contoh suara: "Al Baqarah ayat 5" -> Backend return code: 200
      else if (apiResponse.code === 200 && apiResponse.data) {
        const data = apiResponse.data;
        
        // Set target scroll & pindah halaman
        setInitialTargetAyah(data.number.inSurah);
        setSelectedSurahId(data.surah.number);
        
        setMultipleResults([]);
        setSearchResult(null);
        setSearchInput(""); 
      }

    } catch (err) {
      setError(err.message);
      // Reset highlight jika gagal biar gak bingung
      setHighlightQuery(""); 
    } finally {
      setIsLoading(false);
    }
  };

  // --- FUNGSI 2: HANDLE VOICE BUTTON ---
  const handleVoiceSearch = () => {
    // Pastikan browser support API ini
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Maaf, browser Anda tidak mendukung fitur Voice Recognition.");
      return;
    }

    // Inisialisasi object recognition baru setiap klik (agar fresh)
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Set Bahasa Indonesia
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsRecording(true);
    setError(null);

    recognition.onstart = () => {
      console.log("Mulai mendengarkan...");
    };

    recognition.onresult = (event) => {
      // Ambil teks hasil transkrip
      const spokenText = event.results[0][0].transcript;
      console.log("Suara terdeteksi:", spokenText);
      
      setSearchInput(spokenText);      // Tampilkan di search bar
      setHighlightQuery(spokenText);   // Set highlight untuk hasil nanti
      
      // Langsung kirim ke backend
      fetchBySpokenText(spokenText);
    };

    recognition.onerror = (event) => {
      console.error("Voice Error:", event.error);
      if (event.error === 'no-speech') {
        alert("Tidak ada suara terdeteksi. Silakan coba lagi.");
      } else {
        setError(`Gagal merekam: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    // Mulai Rekam!
    recognition.start();
  };

  // Fungsi untuk klik hasil ganda (DIPERBARUI)
  const handleMultipleResultClick = (surahNumber, ayahNumber) => {
    console.log(`Navigasi ke Surah ${surahNumber}, Ayat ${ayahNumber}`);
    
    // 1. Bersihkan tampilan pencarian
    setMultipleResults([]);
    setSearchResult(null);
    setSearchInput(""); 
    setIsLoading(false);

    // 2. Set target ayat untuk auto-scroll (PENTING: Pastikan jadi integer)
    setInitialTargetAyah(parseInt(ayahNumber));

    // 3. Pindah Halaman ke Surat tersebut
    setSelectedSurahId(parseInt(surahNumber));
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
    <div className="min-h-screen bg-neutral-50">
      {/* --- SIDEBAR MENU BARU --- */}
      <MenuSidebar 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        onNavigate={handleBookmarkNav}
      />
      {/* Header 'sticky' di atas */}
      <header className="sticky top-0 z-50 bg-white shadow-sm">
        <div className="max-w-8xl mx-auto">
          <Header
          onSettingsClick={() => setIsSettingsOpen(true)} 
          onMenuClick={() => setIsMenuOpen(true)}
          />
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
            handleMultipleResultClick={handleMultipleResultClick}
            highlightQuery={highlightQuery}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 cursor-default">
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
                        arabicName={surah.revelation.id_ar} 
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
        className="fixed bottom-6 right-6 z-[999] p-4 bg-green-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 flex items-center justify-center"
        onClick={() => setIsChatOpen(!isChatOpen)}
        title="Tanya AI"
      >
        <HiChatBubbleLeft/>
      </button>
      {isChatOpen && <Chatbot onClose={() => setIsChatOpen(false)} />}
      {/* Taruh di bawah Chatbot atau MenuSidebar */}
      {isSettingsOpen && <SettingsModal onClose={() => setIsSettingsOpen(false)} />}
    </div>
  );
}

export default App; // <-- Kita ekspor 'App'