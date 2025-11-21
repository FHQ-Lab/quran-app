import React from 'react';

// Fungsi normalisasi (tetap sama)
const normalizeArabicJS = (text) => {
  if (!text) return "";
  return text
    // 1. Hapus Harakat etc.
    .replace(/[\u064B-\u065F\u0610-\u061A\u0670\u0671\u0653]/g, '')
    // 2. Hapus Tatweel
    .replace(/\u0640/g, '')
    // 3. Normalisasi Alif
    .replace(/[\u0622\u0623\u0625]/g, '\u0627')
    // 4. Normalisasi Ya
    .replace(/\u0649/g, '\u064A')
    // 5. Normalisasi Ta Marbuta
    .replace(/\u0629/g, '\u0647')
    // 6. Hapus sisa non-huruf/spasi
    .replace(/[^\u0621-\u064A\s]/g, '')
    // 7. Trim spasi
    .replace(/\s+/g, ' ').trim();
};


function Highlight({ text, query }) {
  // Normalisasi teks YANG AKAN DITAMPILKAN
  const normTextToShow = normalizeArabicJS(text);
  const normQuery = normalizeArabicJS(query);

  const startIndex = normTextToShow.indexOf(normQuery);

  // Jika query tidak ditemukan atau kosong, tampilkan teks normalisasi TANPA highlight
  if (startIndex === -1 || !query) {
    return <span className="arabic-text">{normTextToShow}</span>;
  }

  // Temukan akhir dari string yang cocok di teks normalisasi
  const endIndex = startIndex + normQuery.length;

  // Potong teks NORMALISASI berdasarkan indeks yang ditemukan
  const before = normTextToShow.substring(0, startIndex);
  const matched = normTextToShow.substring(startIndex, endIndex);
  const after = normTextToShow.substring(endIndex);

  return (
    // Tampilkan teks NORMALISASI dengan bagian yang cocok di-highlight
    <span className="arabic-text">
      {before}
      <mark>{matched}</mark>
      {after}
    </span>
  );
}

export default Highlight;