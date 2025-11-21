import React, { useEffect, useState, useRef } from 'react';
import AyahCard from './AyahCard';

// Setup Voice Recognition (Lokal untuk komponen ini)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'id-ID'; // Kita pakai Bahasa Indonesia agar bisa mendeteksi "Ayat 5" dengan baik
  recognition.continuous = false;
}

function SurahDetail({ surahNumber, onBack }) {
  const [surahData, setSurahData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk pencarian lokal
  const [searchInput, setSearchInput] = useState("");
  const [highlightedAyah, setHighlightedAyah] = useState(null);
  const [isRecording, setIsRecording] = useState(false);

  // REF MAP: Ini untuk menyimpan alamat/posisi setiap kartu ayat di layar
  const ayahRefs = useRef({});

  useEffect(() => {
    const fetchSurah = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`https://quran-api-id.vercel.app/surah/${surahNumber}`);
        const apiResponse = await response.json();
        setSurahData(apiResponse.data); // Akses .data sesuai perbaikan sebelumnya
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

  // --- FUNGSI PENCARIAN LOKAL ---
  const handleLocalSearch = (query) => {
    if (!query) return;

    // Ekstrak angka dari input (misal: "Ayat 5" -> 5, "5" -> 5)
    const match = query.match(/(\d+)/);
    
    if (match) {
      const ayahNum = parseInt(match[0]);
      
      // Cek apakah elemen HTML untuk ayat tersebut ada di dalam Ref Map kita
      const targetElement = ayahRefs.current[ayahNum];

      if (targetElement) {
        // 1. Scroll ke elemen tersebut
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // 2. Set highlight (nyalakan lampu sorot)
        setHighlightedAyah(ayahNum);

        // 3. Matikan highlight setelah 2 detik (biar kembali normal)
        setTimeout(() => setHighlightedAyah(null), 2000);
        
        setSearchInput(""); // Kosongkan input setelah ketemu
      } else {
        alert(`Ayat ${ayahNum} tidak ditemukan di surat ini.`);
      }
    }
  };

  // --- FUNGSI VOICE LOKAL ---
  const handleVoiceSearch = () => {
    if (!recognition) {
      alert("Browser tidak support voice.");
      return;
    }
    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      console.log("Suara lokal:", spokenText);
      setSearchInput(spokenText); // Tampilkan apa yang diucapkan
      handleLocalSearch(spokenText); // Langsung cari
      setIsRecording(false);
    };
    
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
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
      
      {/* --- Header Sticky (Diupdate dengan Search Bar) --- */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col gap-3">
          
          {/* Baris 1: Tombol Back & Judul */}
          <div className="flex items-center gap-4">
            <button 
              onClick={onBack}
              className="p-2 hover:bg-gray-100 rounded-full text-gray-600 transition"
            >
              ←
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

          {/* Baris 2: Search Bar Lokal */}
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Cari ayat (misal: '5')..." 
              className="flex-grow px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-1 focus:ring-green-500"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLocalSearch(searchInput)}
            />
            {recognition && (
              <button 
                onClick={handleVoiceSearch}
                className={`p-2 rounded-full transition ${isRecording ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {isRecording ? '👂' : '🎤'}
              </button>
            )}
            <button 
              onClick={() => handleLocalSearch(searchInput)}
              className="px-4 py-2 bg-green-600 text-white rounded-full text-sm font-bold hover:bg-green-700"
            >
              Cari
            </button>
          </div>

        </div>
      </div>

      {/* --- Konten Ayat --- */}
      <div className="max-w-4xl mx-auto pt-6">
        
        {/* Bismillah */}
        {surahData.preBismillah && (
          <div className="text-center mb-10 mt-4">
            <p className="text-3xl text-gray-800" style={{ fontFamily: 'Amiri, serif' }}>
              {surahData.preBismillah?.text?.arab}
            </p>
          </div>
        )}

        {/* Mapping Ayat dengan REF */}
        {surahData.verses.map((verse) => (
          // Kita bungkus AyahCard dengan div yang memiliki REF
          <div 
            key={verse.number.inSurah}
            // INI KUNCINYA: Kita simpan referensi elemen ini ke dalam map ayahRefs
            ref={(el) => (ayahRefs.current[verse.number.inSurah] = el)}
          >
            <AyahCard 
              number={verse.number.inSurah}
              arabic={verse.text.arab}
              transliteration={verse.text.transliteration.en}
              translation={verse.translation.id}
              // Kirim status apakah ayat ini sedang di-highlight
              isHighlighted={highlightedAyah === verse.number.inSurah}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default SurahDetail;