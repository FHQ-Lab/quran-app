import React from 'react';
import AyahCard from './AyahCard';
import Highlight from './Highlight';

function ResultsArea({
  isLoading,
  error,
  searchResult,
  multipleResults,
  spokenQuery,
  handleMultipleResultClick
}) {
  
  // --- LOADING STATE ---
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-green-600">
        <svg className="w-10 h-10 animate-spin mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-lg font-medium">Sedang mencari...</p>
      </div>
    );
  }

  // --- ERROR STATE ---
  if (error) {
    return (
      <div className="p-4 mb-4 text-red-700 bg-red-100 border border-red-400 rounded-lg">
        <p className="font-bold">Terjadi kesalahan:</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="result-area space-y-6">
      
      {/* === HASIL GANDA (Pencarian Suara/Topik) === */}
      {multipleResults.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-700 px-2">
            Ditemukan {multipleResults.length} ayat yang relevan:
          </h3>
          
          <div className="grid gap-3">
            {multipleResults.map((match, index) => (
              <div
                key={index}
                onClick={() => handleMultipleResultClick(match.surah, match.ayah)}
                className="group bg-white p-5 rounded-lg shadow-sm border border-gray-200 cursor-pointer hover:border-green-500 hover:shadow-md transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-md">
                      QS. {match.surah}:{match.ayah}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      Skor: {match.score}%
                    </span>
                  </div>
                  <span className="text-gray-400 text-xs group-hover:text-green-600 transition-colors">
                    Lihat Detail →
                  </span>
                </div>

                {/* Teks Arab (Menggunakan Highlight) */}
                <div className="text-right mb-2" dir="rtl">
                  <Highlight text={match.text_arab} query={spokenQuery} />
                </div>

                {/* Terjemahan (Truncated/Dipotong biar rapi) */}
                <p className="text-sm text-gray-600 line-clamp-2">
                  {match.translation}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default ResultsArea;