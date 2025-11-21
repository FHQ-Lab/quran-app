import React from 'react';

// Props:
// - number: 1
// - name: "Al-Fatihah"
// - details: "Makkiyah • 7 Ayat"
// - arabicName: "الفاتحة"

function SurahCard({ number, name, details, arabicName }) {
  return (
    // Wadah Card: putih, bayangan, sudut bulat
    <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
      
      {/* Bagian Kiri: Info */}
      <div className="flex items-center gap-4">
        {/* Nomor Surah (Lingkaran) */}
        <div className="relative flex items-center justify-center w-10 h-10">
          <span className="absolute text-xs text-gray-500">{number}</span>
          <svg className="w-full h-full text-gray-200" fill="none" viewBox="0 0 40 40">
             {/* Ini adalah SVG untuk bentuk oktagon (mirip di Kemenag) */}
             <path d="M16.18 3.064a4 4 0 0 1 7.64 0l11.082 11.082a4 4 0 0 1 0 7.64l-11.082 11.082a4 4 0 0 1-7.64 0L5.098 21.786a4 4 0 0 1 0-7.64L16.18 3.064z" stroke="currentColor" strokeWidth="2"/>
          </svg>
        </div>
        <div>
          <h3 className="text-base font-semibold text-gray-900">{name}</h3>
          <p className="text-xs text-gray-500 uppercase">{details}</p>
        </div>
      </div>

      {/* Bagian Kanan: Teks Arab */}
      <div>
        <h2 className="text-2xl text-green-700" style={{ fontFamily: 'Amiri, "Times New Roman", serif' }}>
          {arabicName}
        </h2>
      </div>
      
    </div>
  );
}

export default SurahCard;