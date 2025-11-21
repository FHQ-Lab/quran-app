import React from 'react';

// Kamu bisa ganti <span> dengan logo <img> nanti
function Header() {
  return (
    // Kita gunakan padding dan flex untuk menyejajarkan
    <div className="flex items-center justify-between p-4">
      
      {/* Tombol Menu (Placeholder) */}
      <button className="p-2 rounded-full hover:bg-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>
      </button>

      {/* Judul Aplikasi (Link ke Halaman Utama) */}
      <a href="/" className="text-xl font-bold text-green-700">
        Quran App
      </a>

      {/* Ikon Pengaturan (Placeholder) */}
      <button className="p-2 rounded-full hover:bg-gray-100">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h3.75" />
        </svg>
      </button>
    </div>
  );
}

export default Header;