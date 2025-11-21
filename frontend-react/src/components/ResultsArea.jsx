import React from 'react';
// Perhatikan path import baru karena file ini ada di dalam folder 'components'
import Highlight from './Highlight.jsx';

function ResultsArea({
  isLoading,
  error,
  searchResult,
  multipleResults,
  spokenQuery,
  handleMultipleResultClick
}) {
  return (
    <div className="result-area">
      {/* Tampilkan status loading */}
      {isLoading && <p>Loading...</p>}

      {/* Tampilkan pesan error jika ada */}
      {error && <p className="error-message">Terjadi kesalahan: {error}</p>}

      {/* Tampilkan hasil TUNGGAL jika data sudah ada */}
      {searchResult && (
        <div className="ayah-display">
          <h2>
            {searchResult.surah.name.transliteration.id} ({searchResult.surah.name.short}) -
            Ayat {searchResult.number.inSurah}
          </h2>
          <h3 className="arabic-text">{searchResult.text.arab}</h3>
          <p><strong>Artinya:</strong> "{searchResult.translation.id}"</p>
          <h4>Tafsir (KEMENAG):</h4>
          <p>{searchResult.tafsir.id.long}</p>
        </div>
      )}

      {/* Tampilkan hasil GANDA jika data sudah ada */}
      {multipleResults.length > 0 && (
        <div className="multiple-results-display">
          <h3>Ditemukan {multipleResults.length} ayat yang sangat mirip (klik untuk detail):</h3>
          {multipleResults.map((match, index) => (
            <div
              className="ayah-display-short clickable"
              key={index}
              onClick={() => handleMultipleResultClick(match.surah, match.ayah)}
            >
              <Highlight text={match.text_arab} query={spokenQuery} />
              <p>
                <strong>(QS. {match.surah}: Ayat {match.ayah})</strong> -
                Skor: {match.score}%
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ResultsArea;