import React from 'react';

function AyahCard({ number, arabic, translation, transliteration }) {
  return (
    <div 
      className={`py-6 border-b border-gray-200 transition-all duration-1000 ease-in-out ${
        isHighlighted ? 'bg-yellow-100 scale-[1.01] shadow-md z-10 relative' : 'hover:bg-gray-50'
      }`}
    >
      {/* Baris Atas: Nomor & Opsi */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div className="flex items-center justify-center w-10 h-10 border-2 border-green-600 rounded-full text-green-700 font-bold text-sm relative">
          {/* Dekorasi nomor ala Kemenag (sederhana) */}
          <span className="z-10">{number}</span>
          <div className="absolute inset-0 bg-green-50 rounded-full opacity-50 transform scale-110"></div>
        </div>
        
        {/* Ikon-ikon aksi (Copy, Play, Bookmark) - Placeholder */}
        <div className="flex gap-3 text-gray-400">
          <button className="hover:text-green-600" title="Mainkan Audio">▶</button>
          <button className="hover:text-green-600" title="Salin Ayat">📋</button>
          <button className="hover:text-green-600" title="Simpan">🔖</button>
        </div>
      </div>

      {/* Baris Tengah: Teks Arab */}
      <div className="px-4 mb-4 text-right">
        <p 
          className="text-4xl leading-[2.5] text-gray-800" 
          style={{ fontFamily: 'Amiri, "LPMQ Isep Misbah", "Traditional Arabic", serif' }}
        >
          {arabic}
        </p>
      </div>

      {/* Baris Bawah: Transliterasi & Terjemahan */}
      <div className="px-4 text-left">
        {/* Transliterasi (Opsional, teks latin) */}
        <p className="text-sm text-green-700 mb-2 italic font-medium">
          {transliteration}
        </p>
        
        {/* Terjemahan */}
        <p className="text-gray-700 text-base leading-relaxed">
          {translation}
        </p>
      </div>

    </div>
  );
}

export default AyahCard;