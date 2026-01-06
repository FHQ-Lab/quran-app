import React from 'react';

function FormattedText({ text, className, style }) {
  if (!text) return null;

  // Regex untuk memecah teks berdasarkan pola angka+kurung tutup.
  // Contoh: "Tuhan1)" -> ["Tuhan", "1)"]
  // (\d+\)) artinya: Tangkap (Capture Group) digit angka (\d+) diikuti kurung tutup \)
  const parts = text.split(/(\d+\))/g);

  return (
    <p className={className} style={style}>
      {parts.map((part, index) => {
        // Cek apakah bagian ini adalah nomor footnote (angka + kurung tutup)
        if (/^\d+\)$/.test(part)) {
          return (
            <sup 
              key={index} 
              // Style: Ukuran 60% dari font asli, bold, warna hijau, geser ke atas sedikit
              className="text-[0.6em] font-bold text-green-600 ml-[1px] -top-1 relative align-baseline"
            >
              {part}
            </sup>
          );
        }
        // Jika teks biasa, kembalikan apa adanya
        return part;
      })}
    </p>
  );
}

export default FormattedText;