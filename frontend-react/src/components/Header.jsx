import React from 'react';
// Import ikon Menu dan Setting
import { HiBars3, HiCog6Tooth } from 'react-icons/hi2';

function Header() {
  return (
    <div className="flex items-center justify-between p-4">
      
      {/* Tombol Menu */}
      <button className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
        <HiBars3 className="w-7 h-7" />
      </button>

      {/* Judul Aplikasi */}
      <a href="/" className="text-xl font-bold text-green-700 tracking-tight">
        Quran App
      </a>

      {/* Tombol Pengaturan */}
      <button className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
        <HiCog6Tooth className="w-7 h-7" />
      </button>
    </div>
  );
}

export default Header;