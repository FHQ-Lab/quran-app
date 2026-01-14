import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { HiXMark } from 'react-icons/hi2';

function SettingsModal({ onClose }) {
  const { arabSize, setArabSize, translationSize, setTranslationSize } = useSettings();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-gray-800">Pengaturan Tampilan</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <HiXMark className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* 1. Ukuran Font Arab */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <label className="font-semibold text-gray-700">Ukuran Arab</label>
            <span className="text-sm text-gray-500">{arabSize}px</span>
          </div>
          <input 
            type="range" min="24" max="70" step="2"
            value={arabSize}
            onChange={(e) => setArabSize(parseInt(e.target.value))}
            className="w-full h-2 bg-green-200 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
          {/* Preview */}
          <p className="mt-3 text-right text-gray-800 border p-2 rounded-lg bg-gray-50" 
             style={{ fontFamily: 'Amiri, serif', fontSize: `${arabSize}px` }}>
            بِسْمِ اللّٰهِ
          </p>
        </div>

        {/* 2. Ukuran Font Terjemahan */}
        <div className="mb-6">
          <div className="flex justify-between mb-2">
            <label className="font-semibold text-gray-700">Ukuran Terjemahan</label>
            <span className="text-sm text-gray-500">{translationSize}px</span>
          </div>
          <input 
            type="range" min="12" max="24" step="1"
            value={translationSize}
            onChange={(e) => setTranslationSize(parseInt(e.target.value))}
            className="w-full h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          {/* Preview */}
          <p className="mt-3 text-gray-700 border p-2 rounded-lg bg-gray-50" 
             style={{ fontSize: `${translationSize}px` }}>
            Dengan nama Allah...
          </p>
        </div>

        <button onClick={onClose} className="w-full py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
          Selesai
        </button>

      </div>
    </div>
  );
}

export default SettingsModal;