import React, { useState, useEffect, useMemo, memo } from 'react';
import { HiPlay, HiPause, HiClipboard, HiBookmark, HiCheck } from 'react-icons/hi2';
import Highlight from './Highlight';
import FormattedText from './FormattedText'; // <-- Import Baru
import { useSettings } from '../contexts/SettingsContext';


// Gunakan 'memo' untuk mencegah render ulang yang tidak perlu
const AyahCard = memo(function AyahCard({ 
  surahNumber,     
  surahName,       
  number, 
  arabic, 
  translation, 
  transliteration, 
  isHighlighted,
  viewMode = 'ayat' 
}) {
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [audio, setAudio] = useState(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const { arabicSize, translationSize } = useSettings();


  // --- 1. LOGIKA AUDIO (TETAP SAMA) ---
  const handlePlay = (e) => {
    e.stopPropagation(); 
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      const sNumVal = parseInt(surahNumber);
      const aNumVal = parseInt(number);
      if (isNaN(sNumVal) || isNaN(aNumVal)) return;
      const sNum = String(sNumVal).padStart(3, '0');
      const aNum = String(aNumVal).padStart(3, '0');
      const url = `https://everyayah.com/data/Alafasy_128kbps/${sNum}${aNum}.mp3`;
      const newAudio = new Audio(url);
      newAudio.onended = () => setIsPlaying(false);
      newAudio.onerror = () => { alert("Gagal memuat audio."); setIsPlaying(false); };
      newAudio.play();
      setAudio(newAudio);
      setIsPlaying(true);
    }
  };

  useEffect(() => { return () => { if (audio) audio.pause(); }; }, [audio]);

  // --- 2. LOGIKA COPY (TETAP SAMA) ---
  const handleCopy = (e) => {
    e.stopPropagation();
    const header = surahName ? `QS. ${surahName}: ${number}` : `QS. ${surahNumber}:${number}`;
    const textToCopy = `${header}\n\n${arabic}\n\n${translation}\n\n(via Quran App)`;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); 
  };

  // --- 3. LOGIKA BOOKMARK (TETAP SAMA) ---
  useEffect(() => {
    const bookmarks = JSON.parse(localStorage.getItem('quran_bookmarks') || '[]');
    const exists = bookmarks.some(b => parseInt(b.surah) === parseInt(surahNumber) && parseInt(b.ayah) === parseInt(number));
    setIsBookmarked(exists);
  }, [surahNumber, number]);

  const handleBookmark = (e) => {
    e.stopPropagation();
    const bookmarks = JSON.parse(localStorage.getItem('quran_bookmarks') || '[]');
    if (isBookmarked) {
      const newBookmarks = bookmarks.filter(b => !(parseInt(b.surah) === parseInt(surahNumber) && parseInt(b.ayah) === parseInt(number)));
      localStorage.setItem('quran_bookmarks', JSON.stringify(newBookmarks));
      setIsBookmarked(false);
    } else {
      bookmarks.push({ surah: parseInt(surahNumber), ayah: parseInt(number), surahName: surahName, time: Date.now() });
      localStorage.setItem('quran_bookmarks', JSON.stringify(bookmarks));
      setIsBookmarked(true);
    }
  };

  // --- 4. LOGIKA TAMPILAN (DIOPTIMASI DENGAN useMemo) ---
  // React akan "mengingat" hasil render ini dan tidak menghitung ulang kecuali arabic/viewMode berubah
  const renderedArabicText = useMemo(() => {
    if (viewMode === 'kata') {
      // MODE KATA: Tampilan "Chip" / Blok Hijau Terang
      return (
        <div className="flex flex-wrap justify-start gap-4 leading-loose" dir="rtl">
          {arabic.split(' ').map((word, idx) => (
            <span 
              key={idx} 
              className="
                inline-block px-3 py-4 
                bg-green-50 border border-green-100 rounded-lg 
                hover:bg-green-200 hover:border-green-300 
                transition-colors duration-200 cursor-pointer
                text-3xl font-serif
              "
              title="Klik untuk detail kata (Coming Soon)"
              style={{ fontFamily: 'Amiri, serif' }}
            >
              {word}
            </span>
          ))}
        </div>
      );
    }
    
    // MODE AYAT (Normal)
    return (
      <p 
        className="text-4xl leading-[2.5] text-gray-800" 
        style={{ fontFamily: 'Amiri, serif' }} 
        dir="rtl"
      >
          {arabic} 
      </p>
    );
  }, [arabic, viewMode]);


  return (
    <div className={`py-6 transition-colors duration-300`}>
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6 px-6">
        <div className="flex items-center justify-center w-10 h-10 bg-green-50 text-green-700 rounded-full font-bold text-sm border border-green-100 shadow-sm">
          {number}
        </div>
        <div className="flex gap-2 text-gray-400">
          <button onClick={handlePlay} className={`p-2 rounded-full transition-all ${isPlaying ? 'text-green-600 bg-green-100 ring-2 ring-green-200' : 'hover:bg-gray-100 hover:text-green-600'}`}>
            {isPlaying ? <HiPause className="w-5 h-5" /> : <HiPlay className="w-5 h-5" />}
          </button>
          <button onClick={handleCopy} className={`p-2 rounded-full transition-all ${isCopied ? 'text-blue-600 bg-blue-100' : 'hover:bg-gray-100 hover:text-blue-600'}`}>
            {isCopied ? <HiCheck className="w-5 h-5" /> : <HiClipboard className="w-5 h-5" />}
          </button>
          <button onClick={handleBookmark} className={`p-2 rounded-full transition-all ${isBookmarked ? 'text-yellow-500 bg-yellow-50' : 'hover:bg-gray-100 hover:text-yellow-500'}`}>
            <HiBookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
          </button>
        </div>
      </div>

      {/* Teks Arab (Rendered Memoized) */}
      <div className="px-6 mb-6 text-right">
        {renderedArabicText}
      </div>

      {/* Terjemahan */}
      <div className="px-6 text-left border-t border-gray-50 pt-4">
        {transliteration && (
             <p className="text-sm text-green-700 mb-2 italic font-medium tracking-wide">{transliteration}</p>
        )}
        <FormattedText 
          text={translation}
          className="text-gray-600 text-base leading-relaxed"
          // (Opsional) Jika kamu mau font size dinamis dari settings, oper style di sini
          style={{ fontSize: `${translationSize}px` }} 
        />
      </div>

    </div>
  );
}); // Tutup memo

export default AyahCard;