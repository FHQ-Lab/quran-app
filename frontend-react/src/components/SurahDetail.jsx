import React, { useEffect, useState, useRef } from 'react';
import AyahCard from './AyahCard';
import AyahDetailModal from './AyahDetailModal';
import { HiMicrophone, HiStop, HiArrowLeft} from 'react-icons/hi2';

// Setup Voice Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'id-ID'; 
  recognition.continuous = false;
}

function SurahDetail({ surahNumber, initialTargetAyah, onBack }) {
  const [surahData, setSurahData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

// KUMPULAN STATE 
  // --- STATE PENCARIAN LOKAL ---
  const [searchInput, setSearchInput] = useState("");
  const [filteredResults, setFilteredResults] = useState([]); // Menyimpan hasil pencarian
  const [showSuggestions, setShowSuggestions] = useState(false); // Mengatur visibilitas popup
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  
  // State Modal Detail
  const [modalData, setModalData] = useState(null);

  const ayahRefs = useRef({});

  // Fetch Data (Tidak Berubah)
  useEffect(() => {
    const fetchSurah = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`https://quran-api-id.vercel.app/surah/${surahNumber}`);
        const apiResponse = await response.json();
        setSurahData(apiResponse.data);
      } catch (error) {
        console.error("Gagal mengambil data surat:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (surahNumber) {
      fetchSurah();
    }
  }, [surahNumber]);

  // Auto-Scroll saat data siap (Jika ada initialTargetAyah)
  useEffect(() => {
    if (!isLoading && surahData && initialTargetAyah) {
      // Beri sedikit delay agar DOM benar-benar siap
      setTimeout(() => {
        jumpToAyah(initialTargetAyah);
      }, 500);
    }
  }, [isLoading, surahData, initialTargetAyah]);

  // --- LOGIKA FILTERING REAL-TIME ---
  useEffect(() => {
    if (!surahData || !searchInput) {
      setFilteredResults([]);
      setShowSuggestions(false);
      return;
    }

    const query = searchInput.toLowerCase();
    
    // Filter ayat berdasarkan: Nomor ATAU Terjemahan ATAU Teks Arab
    const results = surahData.verses.filter((verse) => {
      const matchNumber = verse.number.inSurah.toString().includes(query);
      const matchTranslation = verse.translation.id.toLowerCase().includes(query);
      // Kita bisa tambah matchArabic jika mau, tapi butuh normalisasi dulu biar akurat
      return matchNumber || matchTranslation;
    });

    setFilteredResults(results);
    setShowSuggestions(true); // Tampilkan popup jika ada input
  }, [searchInput, surahData]);


  // --- FUNGSI JUMP TO AYAH (Scroll) ---
  const jumpToAyah = (ayahNum) => {
    const targetElement = ayahRefs.current[ayahNum];
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedAyah(ayahNum);
      setTimeout(() => setHighlightedAyah(null), 2000);
      
      // Reset Pencarian setelah memilih
      setShowSuggestions(false); 
      // Opsional: setSearchInput("") kalau mau inputnya bersih
    }
  };

  // --- FUNGSI VOICE ---
  const handleVoiceSearch = () => {
    if (!recognition) {
      alert("Browser tidak support voice.");
      return;
    }
    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript.replace(/\.$/, ""); // Hapus titik di akhir jika ada
      setSearchInput(spokenText); 
      setIsRecording(false);
      // useEffect di atas akan otomatis memicu filtering
    };
    
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
  };

  // === Fungsi Membuka Modal Detail ===
  const openAyahDetail = async (ayahNum) => {
    // Kita panggil backend kita sendiri untuk dapat Tafsir Lengkap
    // (Karena API 'quran-api-id' di list surah mungkin tafsirnya pendek/tidak lengkap)
    try {
      const response = await fetch(`http://127.0.0.1:8000/surah/${surahNumber}/${ayahNum}`);
      if (!response.ok) throw new Error("Gagal ambil detail");
      const apiResponse = await response.json();
      setModalData(apiResponse.data); // Isi data modal
    } catch (e) {
      alert("Gagal memuat detail tafsir: " + e.message);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen text-green-600">
        <p className="text-xl font-bold animate-pulse">Memuat Surat...</p>
      </div>
    );
  }

  if (!surahData) return <p className="text-center mt-10">Data tidak ditemukan.</p>;

  return (
    <div className="bg-white min-h-screen pb-20">
      {modalData && (
        <AyahDetailModal data={modalData} onClose={() => setModalData(null)} />
      )}
      {/* --- Header Sticky --- */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          
          {/* Info Surat */}
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full text-green-600 border border-b-green-600 transition">
              <HiArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-gray-800">
                {surahData.name.transliteration.id}
              </h1>
              <p className="text-xs text-gray-500">
                {surahData.revelation.id} • {surahData.numberOfVerses} Ayat
              </p>
            </div>
          </div>

          {/* --- SEARCH BAR LOKAL + POPUP --- */}
          <div className="relative"> {/* Container Relative untuk menampung Popup Absolute */}
            
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Cari '15', 'puasa', 'sholat'..." 
                className="flex-grow px-4 py-2 border border-green-500 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onFocus={() => searchInput && setShowSuggestions(true)} // Tampilkan lagi saat fokus
              />
              {recognition && (
                <button 
                  onClick={handleVoiceSearch}
                  className={`p-2 rounded-full transition ${isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-green-500'}`}
                >
                  {isRecording ? <HiStop className="w-4 h-4 text-red-600" /> : <HiMicrophone className="w-4 h-4 text-green-700" /> }
                </button>
              )}
            </div>

            {/* === POPUP LIST HASIL PENCARIAN === */}
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
                      {/* Tampilkan potongan teks Arab pendek */}
                      <span className="text-xs text-gray-400 font-amiri dir-rtl truncate w-24 text-right">
                        {verse.text.arab}
                      </span>
                    </div>
                    {/* Tampilkan potongan terjemahan */}
                    <p className="text-xs text-gray-600 mt-1 truncate">
                      {verse.translation.id}
                    </p>
                  </div>
                ))}
              </div>
            )}
            
            {/* Pesan jika tidak ada hasil */}
            {showSuggestions && searchInput && filteredResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center text-sm text-gray-500 z-50">
                Tidak ditemukan ayat yang cocok.
              </div>
            )}

          </div>
          {/* -------------------------------- */}

        </div>
      </div>

      {/* --- Konten Ayat --- */}
      <div className="max-w-4xl mx-auto pt-6">
        {surahData.preBismillah && (
          <div className="text-center mb-10 mt-4">
            <p className="text-3xl text-gray-800" style={{ fontFamily: 'Amiri, serif' }}>
              {surahData.preBismillah?.text?.arab}
            </p>
          </div>
        )}

        {surahData.verses?.map((verse) => (
          <div 
            key={verse.number.inSurah}
            ref={(el) => (ayahRefs.current[verse.number.inSurah] = el)}
            onClick={() => openAyahDetail(verse.number.inSurah)} 
            className="cursor-pointer" // Ubah kursor jadi tangan
            title="Klik untuk melihat tafsir lengkap"
          >
            <AyahCard 
              number={verse.number.inSurah}
              arabic={verse.text.arab}
              transliteration={verse.text.transliteration.en}
              translation={verse.translation.id}
              isHighlighted={highlightedAyah === verse.number.inSurah}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default SurahDetail;