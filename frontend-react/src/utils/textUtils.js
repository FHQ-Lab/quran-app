// Normalisasi Teks Arab (Hapus Harakat, Simbol, DAN SPASI)
export const normalizeArabic = (text) => {
  if (!text) return "";
  return text
    .replace(/[\u064B-\u065F\u0610-\u061A\u0670\u0671\u0653]/g, '') // Hapus Harakat
    .replace(/\u0640/g, '') // Hapus Tatweel
    .replace(/[أإآ]/g, 'ا') // Normalisasi Alif
    .replace(/ى/g, 'ي') // Normalisasi Ya
    .replace(/ة/g, 'ه') // Normalisasi Ta Marbuta
    .replace(/[^0-9\u0600-\u06FF]/g, '') // Hapus semua karakter NON-ARAB (termasuk spasi & tanda baca)
    .trim();
};

// Normalisasi Transliterasi (Hapus Aksen, Simbol, DAN SPASI)
export const normalizeTransliteration = (text) => {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Hapus aksen (ā -> a)
    .replace(/[^a-z0-9]/g, ""); // Hapus SEMUA kecuali huruf & angka (Spasi & tanda baca hilang)
};