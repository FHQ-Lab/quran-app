import React from 'react';
import Highlight from './Highlight';
import { HiPlay, HiClipboard, HiBookmark } from 'react-icons/hi2';

function AyahCard({ number, arabic, translation, transliteration, isHighlighted }) {
  return (
    <div 
      className={`py-6 border-b border-gray-200 transition-all duration-1000 ease-in-out ${
        isHighlighted ? 'bg-yellow-100 scale-[1.01] shadow-md z-10 relative' : 'hover:bg-gray-50'
      }`}
    >
      
      {/* Baris Atas: Nomor & Opsi */}
      <div className="flex items-center justify-between mb-4 px-4">
        
        {/* Nomor Ayat */}
        <div className="flex items-center justify-center w-10 h-10 border-2 border-green-600 rounded-full text-green-700 font-bold text-sm relative shadow-sm">
          <span className="z-10">{number}</span>
          <div className="absolute inset-0 bg-green-50 rounded-full opacity-50 transform scale-110"></div>
        </div>
        
        {/* --- Buttons --- */}
        <div className="flex gap-4 text-gray-400">
          <button 
            className="text-green-500 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50" 
            title="Mainkan Audio"
          >
            <HiPlay className="w-6 h-6" />
          </button>
          
          <button 
            className="text-green-500 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50" 
            title="Salin Ayat"
          >
            <HiClipboard className="w-6 h-6" />
          </button>
          
          <button 
            className="text-green-500 hover:text-green-600 transition-colors p-1 rounded-full hover:bg-green-50" 
            title="Simpan"
          >
            <HiBookmark className="w-6 h-6" />
          </button>
        </div>
        {/* ---------------------------------- */}

      </div>

      {/* Baris Tengah: Teks Arab */}
      <div className="px-4 mb-4 text-right">
        <p 
          className="text-4xl leading-[2.5] text-gray-800" 
          style={{ fontFamily: 'Amiri, serif' }}
        >
          {arabic}
        </p>
      </div>

      {/* Baris Bawah: Transliterasi & Terjemahan */}
      <div className="px-4 text-left">
        <p className="text-sm text-green-700 mb-2 italic font-medium">
          {transliteration}
        </p>
        <p className="text-gray-700 text-base leading-relaxed">
          {translation}
        </p>
      </div>

    </div>
  );
}

export default AyahCard;