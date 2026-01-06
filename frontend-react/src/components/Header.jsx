import React from 'react';
import { HiBars3, HiCog6Tooth } from 'react-icons/hi2';

// Tambahkan prop 'onMenuClick'
function Header({ onMenuClick, onSettingsClick }) {
  return (
    <div className="flex items-center justify-between p-4">
      
      {/* Pasang onClick di sini */}
      <button 
        onClick={onMenuClick} // <--- INI PERUBAHANNYA
        className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600"
      >
        <HiBars3 className="w-7 h-7" />
      </button>

      {/* ... (Judul dan tombol setting tetap sama) ... */}
      <a href="/" className="text-xl font-bold text-green-700 tracking-tight">
        Quran App
      </a>

      <button 
      onClick={onSettingsClick}
      className="p-2 rounded-full hover:bg-gray-100 transition-colors text-gray-600">
        <HiCog6Tooth className="w-7 h-7" />
      </button>
    </div>
  );
}

export default Header;