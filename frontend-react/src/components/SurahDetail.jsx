import React, { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query'; // Pakai React Query biar cepat
import AyahCard from './AyahCard';
import AyahDetailModal from './AyahDetailModal';
import { normalizeArabic, normalizeTransliteration } from '../utils/textUtils';
import { HiListBullet, HiSquares2X2, HiStop, HiMicrophone, HiArrowLeft } from 'react-icons/hi2';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://quran-api.lpmqkemenag.id/api-alquran";
// --- 1. SETUP VOICE RECOGNITION ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'ar-SA'; 
  recognition.continuous = false;
}

function SurahDetail({ surahNumber, initialTargetAyah, onBack }) {
  
  // --- 2. STATE MANAGEMENT ---
  // State untuk Pencarian Lokal
  const [searchInput, setSearchInput] = useState("");
  const [filteredResults, setFilteredResults] = useState([]); 
  const [showSuggestions, setShowSuggestions] = useState(false); 
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // State untuk Tampilan & Modal
  const [viewMode, setViewMode] = useState('ayat'); // 'ayat' (List) atau 'kata' (Renggang)
  const [modalData, setModalData] = useState(null); // Data untuk popup tafsir
  
  // Ref untuk Auto-Scroll
  const ayahRefs = useRef({});


  // --- 3. FETCH DATA (REACT QUERY) ---
  const { data: surahData, isLoading } = useQuery({
    queryKey: ['surah', surahNumber],
    queryFn: async () => {
      // const response = await fetch(`${API_BASE_URL}/surahs/${surahNumber}`); 
      const response = await fetch(`${API_BASE_URL}/surahs/${surahNumber}`);   
  
      const json = await response.json();
      if (json.data && json.data.verses) {
        json.data.verses.sort((a, b) => a.number.inSurah - b.number.inSurah);
      }
      return json.data;
    },
    enabled: !!surahNumber, 
    staleTime: 1000 * 60 * 30, 
  });


  // --- AUTO-SCROLL ---
  useEffect(() => {
    if (!isLoading && surahData && initialTargetAyah) {
      setTimeout(() => {
        jumpToAyah(initialTargetAyah);
      }, 500); // Delay
    }
  }, [isLoading, surahData, initialTargetAyah]);


  // --- LOGIKA PENCARIAN LOKAL ---
  useEffect(() => {
    if (!surahData || !searchInput) {
      setFilteredResults([]);
      setShowSuggestions(false);
      return;
    }

    const queryOriginal = searchInput.toLowerCase();
    
    // Normalisasi Query
    const queryArab = normalizeArabic(searchInput); 
    const queryLatin = normalizeTransliteration(searchInput); 

    const results = surahData.verses.filter((verse) => {
      // Cek Nomor Ayat
      const matchNumber = verse.number.inSurah.toString() === queryOriginal; // Pakai exact match atau includes
      
      // Cek Terjemahan
      const matchTranslation = verse.translation.id.toLowerCase().includes(queryOriginal);
      
      // Cek Transliterasi
      let matchTransliteration = false;
      if (queryLatin.length > 0) {
        const verseLatin = normalizeTransliteration(verse.text.transliteration.en);
        matchTransliteration = verseLatin.includes(queryLatin);
      }

      // Cek Teks Arab (Arab -> Arab)
      let matchArabic = false;
      if (queryArab.length > 0) {
        const verseArab = normalizeArabic(verse.text.arab);
        matchArabic = verseArab.includes(queryArab);
      }

      return matchNumber || matchTranslation || matchTransliteration || matchArabic;
    });

    setFilteredResults(results);
    setShowSuggestions(true); 
  }, [searchInput, surahData]);


  // --- FUNGSI JUMP ---
  const jumpToAyah = (ayahNum) => {
    const targetElement = ayahRefs.current[ayahNum];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedAyah(ayahNum);
      setTimeout(() => setHighlightedAyah(null), 3000); // Highlight selama 3 detik
      setShowSuggestions(false); // Tutup popup saran
    }
  };


  // --- FUNGSI VOICE ---
  const handleVoiceSearch = () => {
    if (!recognition) { alert("Browser tidak support voice."); return; }
    setIsRecording(true);
    recognition.start();
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript; 
      setSearchInput(spokenText); 
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
  };


  // --- 8. FUNGSI BUKA MODAL TAFSIR ---
  const openAyahDetail = async (ayahNum) => {
    try {
      // Fetch detail lengkap (Tafsir Tahlili) dari backend
      const response = await fetch(`${API_BASE_URL}/surah/${surahNumber}/${ayahNum}`);
      if (!response.ok) throw new Error("Gagal ambil detail");
      const apiResponse = await response.json();
      setModalData(apiResponse.data); 
    } catch (e) {
      alert("Gagal memuat detail tafsir: " + e.message);
    }
  };


  // --- 9. RENDER TAMPILAN ---

  if (isLoading) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen text-green-600">
        <svg className="w-10 h-10 animate-spin mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium animate-pulse">Memuat Surat...</p>
      </div>
    );
  }

  if (!surahData) return <p className="text-center mt-10 text-gray-500">Data surat tidak ditemukan.</p>;

  // Logika Bismillah (Kecuali Al-Fatihah & At-Taubah)
  const showBismillah = surahNumber !== 1 && surahNumber !== 9;

  return (
    <div className="bg-neutral-50 min-h-screen pb-20 relative font-sans">
      
      {/* --- MODAL DETAIL (Overlay) --- */}
      {modalData && (
        <AyahDetailModal data={modalData} onClose={() => setModalData(null)} />
      )}

      {/* --- HEADER STICKY --- */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
           
           {/* Baris Atas: Tombol Kembali, Judul, Toggle View */}
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 bg-green-500 hover:bg-green-600 rounded-full text-white transition">
                  <HiArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-lg font-bold text-gray-800 leading-none">
                    {surahData.name.transliteration.id}
                  </h1>
                  <p className="text-xs text-gray-500 mt-1">
                    {surahData.revelation.id} • {surahData.numberOfVerses} Ayat
                  </p>
                </div>
              </div>

              {/* Toggle View Mode */}
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button 
                  onClick={() => setViewMode('ayat')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'ayat' ? 'bg-white shadow text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Tampilan Per Ayat"
                >
                  <HiListBullet className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setViewMode('kata')}
                  className={`p-2 rounded-md transition-all ${viewMode === 'kata' ? 'bg-white shadow text-green-600' : 'text-gray-400 hover:text-gray-600'}`}
                  title="Tampilan Per Kata (Renggang)"
                >
                  <HiSquares2X2 className="w-5 h-5" />
                </button>
              </div>
           </div>

          {/* Baris Bawah: Search Bar Lokal */}
          <div className="relative"> 
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Cari ayat (Arab, Latin 'Fabiayyi', atau Nomor)..."
                className="flex-grow px-4 py-2 border border-green-500 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-green-500 transition-all"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => searchInput && setShowSuggestions(true)} 
              />
               {recognition && (
                <button 
                  onClick={handleVoiceSearch} 
                  className={`p-2 rounded-full transition ${isRecording ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-green-50 text-green-600 hover:bg-green-200 border border-green-600'}`}
                  title="Cari dengan suara (Bahasa Arab)"
                >
                  {isRecording ? <HiStop className="w-5 h-5" /> : <HiMicrophone className="w-5 h-5" />}
                </button>
              )}
            </div>

             {/* POPUP SUGGESTIONS */}
             {showSuggestions && filteredResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                {filteredResults.map((verse) => (
                  <div 
                    key={verse.number.inSurah}
                    onClick={() => jumpToAyah(verse.number.inSurah)}
                    className="px-4 py-3 border-b border-gray-100 hover:bg-green-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-green-700 text-sm">Ayat {verse.number.inSurah}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {verse.translation.id}
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pesan Tidak Ditemukan */}
            {showSuggestions && searchInput && filteredResults.length === 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center text-sm text-gray-500 z-50">
                    Tidak ditemukan ayat yang cocok.
                </div>
            )}
          </div>

        </div>
      </div>

      {/* --- KONTEN UTAMA (DAFTAR AYAT) --- */}
      <div className="max-w-4xl mx-auto pt-6 px-4">
        
        {/* Bismillah Header */}
        {showBismillah && (
          <div className="text-center mb-8 mt-2 p-2 bg-white rounded-2xl shadow-sm border border-green-50">
            <p className="text-3xl text-gray-800 leading-loose" style={{ fontFamily: 'Amiri, serif' }}>
              بِسْمِ اللّٰهِ الرَّحْمٰنِ الرَّحِيْمِ
            </p>
          </div>
        )}

        {/* Looping Kartu Ayat */}
        <div className="space-y-4">
          {surahData.verses?.map((verse) => (
            <div 
              key={verse.number.inSurah}
              ref={(el) => (ayahRefs.current[verse.number.inSurah] = el)}
              onClick={() => openAyahDetail(verse.number.inSurah)} 
              // Style Card Utama
              className={`cursor-pointer bg-white rounded-2xl border border-gray-100 shadow-sm hover:bg-emerald-50 transform transition-all duration-300 hover:-translate-y-2 hover:shadow-xl cursor-pointer
                ${highlightedAyah === verse.number.inSurah ? 'ring-2 ring-yellow-400 bg-yellow-50 scale-[1.01] z-10' : ''}
              `}
              title="Klik untuk melihat tafsir lengkap"
            >
              <AyahCard 
                surahNumber={surahData.number}
                surahName={surahData.name.transliteration.id}
                number={verse.number.inSurah}
                arabic={verse.text.arab}
                transliteration={verse.text.transliteration.en}
                translation={verse.translation.id}
                isHighlighted={highlightedAyah === verse.number.inSurah}
                viewMode={viewMode} 
              />
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}

export default SurahDetail;