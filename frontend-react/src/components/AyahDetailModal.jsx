import React from 'react';
import AyahCard from './AyahCard';

function AyahDetailModal({ data, onClose }) {
  if (!data) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      {/* Modal Content */}
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className="bg-green-50 px-6 py-4 border-b border-green-100 flex justify-between items-center sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <div>
              <h2 className="text-lg font-bold text-green-800">
                QS. {data.surah.name.transliteration.id}
              </h2>
              <p className="text-sm text-green-600">
                Ayat {data.number.inSurah}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-red-500 text-2xl font-bold">&times;</button>
        </div>

        {/* Body: AyahCard */}
        <div className="px-2 pt-4">
          <AyahCard 
            number={data.number.inSurah}
            arabic={data.text.arab}
            transliteration={data.text.transliteration?.en || ""} 
            translation={data.translation.id}
          />
        </div>

        {/* Footer: Tafsir Lengkap */}
        <div className="px-6 py-6">
          <h3 className="text-sm font-bold text-gray-500 uppercase mb-3 tracking-wider border-b pb-2">
            Tafsir Kemenag (Lengkap)
          </h3>
          <p className="text-gray-800 leading-loose text-justify text-base font-serif">
            {data.tafsir.id.long}
          </p>
        </div>

      </div>
    </div>
  );
}

export default AyahDetailModal;