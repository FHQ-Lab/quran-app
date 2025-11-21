import React from 'react';

function SearchBar({
  searchInput,
  setSearchInput,
  handleSearch,
  handleVoiceSearch,
  isLoading,
  isRecording,
  recognition
}) {
  return (
    // === PERBAIKAN UTAMA ADA DI SINI ===
    // 1. "flex": Menyuruh semua anak (input, button) berbaris horizontal.
    // 2. "items-center": Menyejajarkan mereka di tengah secara vertikal.
    // 3. "gap-2": Memberi sedikit jarak antar elemen.
    <div className="flex items-center gap-2">
      
      {/* Input Teks */}
      <input
        type="text"
        // 4. "flex-grow": Menyuruh input ini mengambil semua sisa ruang.
        className="flex-grow p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
        placeholder="Cari ayat, arti, tafsir (misal: 2:255, al-fatihah:7, atau 'sabar')..."
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
      />

      {/* Tombol Voice Search */}
      {recognition ? (
        <button
          // 5. Beri style pada tombol-tombolnya
          className="p-3 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
          onClick={handleVoiceSearch}
          disabled={isLoading || isRecording}
        >
          {isRecording ? '🎧' : '🎤'}
        </button>
      ) : (
        <p className="p-3 text-gray-400" title="Browser tidak mendukung fitur suara">
          No Mic
        </p>
      )}

      {/* Tombol Cari */}
      <button
        className="p-3 font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:bg-green-300"
        onClick={handleSearch}
        disabled={isLoading || isRecording}
      >
        {isLoading ? '...' : 'Cari'}
      </button>
    </div>
  );
}

export default SearchBar;