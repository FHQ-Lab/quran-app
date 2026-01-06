import React from 'react';
import AyahCard from './AyahCard';
import { useSettings } from '../contexts/SettingsContext';
import FormattedText from './FormattedText';


const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

function AyahDetailModal({ data, onClose }) {
  const { arabicSize, translationSize } = useSettings();
  // const { translationSize } = useSettings();

  if (!data) return null;

  return (
    // Overlay
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity" 
      onClick={onClose}
    >
      {/* Modal Content */}
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col" 
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* --- Header (Sticky) --- */}
        <div className="bg-white px-6 py-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 text-green-700 rounded-full font-bold text-sm">
              {data.number.inSurah}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800 leading-none">
                QS. {data.surah.name.transliteration.id}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Ayat {data.number.inSurah}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-red-100 hover:text-red-500 transition-colors font-bold text-xl"
          >
            &times;
          </button>
        </div>

        {/* --- Body: Konten Scrollable --- */}
        <div className="p-6 space-y-8">
          
          {/* 1. Kartu Ayat (Arab & Latin) */}
          <div className="bg-teal-50 p-4 rounded-xl border border-teal-100">
             <div className="mb-4 text-right">
                <p className="leading-[2.5] text-gray-800" style={{ fontFamily: 'Amiri, serif', fontSize: `${arabicSize}px` }} dir="rtl">
                  {data.text.arab}
                </p>
             </div>
             {data.text.transliteration?.en && (
               <p className="text-green-700 italic font-medium">
                 {data.text.transliteration.en}
               </p>
             )}
          </div>

          {/* 2. Terjemahan */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold text-green-700 uppercase mb-3 tracking-wider">
              <span className="w-1 h-4 bg-green-600 rounded-full"></span>
              Terjemahan
            </h3>
            <FormattedText 
              text={data.translation.id}
              className="text-gray-800 text-lg leading-relaxed font-medium"
              style={{ fontSize: `${translationSize}px` }}
            />
          </div>

          {/* 3. Catatan Kaki (Kondisional) */}
          {data.tafsir.id.footnotes && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-orange-600 uppercase mb-3 tracking-wider">
                <span className="w-1 h-4 bg-orange-500 rounded-full"></span>
                Catatan Kaki
              </h3>
              <div 
              className="text-gray-700 text-base leading-relaxed bg-orange-50 p-4 rounded-lg border border-orange-100 italic text-sm"
              style={{ fontSize: `${translationSize}px` }}
              >
                {data.tafsir.id.footnotes}
              </div>
            </div>
          )}

          {/* 4. Tafsir Ringkas (Wajiz) */}
          {data.tafsir.id.wajiz && (
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-teal-600 uppercase mb-3 tracking-wider">
                <span className="w-1 h-4 bg-teal-500 rounded-full"></span>
                Tafsir Wajiz
              </h3>
              <div className="text-gray-700 text-base leading-relaxed bg-teal-50 p-5 rounded-xl border border-teal-100"
              style={{ fontSize: `${translationSize}px` }}>
                {data.tafsir.id.wajiz}
              </div>
            </div>
          )}

          {/* 5. Tafsir Tahlili (Lengkap) */}
          <div>
             <h3 className="flex items-center gap-2 text-sm font-bold text-blue-700 uppercase mb-3 tracking-wider">
              <span className="w-1 h-4 bg-blue-600 rounded-full"></span>
              Tafsir Tahlili
            </h3>
            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
              {data.tafsir.id.tahlili ? (
                <div 
                  dangerouslySetInnerHTML={{ __html: data.tafsir.id.tahlili }} 
                  className="text-gray-700 leading-loose text-justify text-base font-serif prose prose-sm max-w-none"
                  style={{ fontSize: `${translationSize}px` }}
                />
              ) : (
                <span className="italic text-gray-400">Tafsir Tahlili tidak tersedia.</span>
              )}
            </div>
         

       
          </div>

        </div>

      </div>
    </div>
  );
}

export default AyahDetailModal;