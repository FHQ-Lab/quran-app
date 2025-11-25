import React from 'react';

// Kita ubah data links menjadi objek yang lebih detail
const links = [
  { label: 'Yaasin', surahId: 36 },
  { label: 'Ayat Kursi', surahId: 2, targetAyah: 255 }, // <-- Spesial: Ada targetAyah
  { label: 'Al-Kahf', surahId: 18 },
  { label: 'Al-Mulk', surahId: 67 },
  { label: 'Ar-Rahman', surahId: 55 }
];

function QuickLinks({ onLinkClick }) { // <-- Terima fungsi handler dari App
  return (
    <div className="flex justify-center px-4 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
      <div className="inline-flex gap-3">
        
        {links.map((link) => (
          <button
            key={link.label}
            // Panggil handler saat diklik, kirim ID dan Target (jika ada)
            onClick={() => onLinkClick(link.surahId, link.targetAyah)}
            className="px-5 py-2 text-sm font-semibold text-green-800 bg-green-100 rounded-full hover:bg-green-200 transition-colors whitespace-nowrap"
          >
            {link.label}
          </button>
        ))}
        
      </div>
    </div>
  );
}

export default QuickLinks;