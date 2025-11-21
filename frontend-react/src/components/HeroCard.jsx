import React from 'react';

// Ganti ikon-ikon ini
const CalendarIcon = () => <span>📅</span>;
const BookIcon = () => <span> L </span>; // Placeholder untuk logo LPMQ

function HeroCard() {
  return (
    // Wadah utama dengan background (tebakan: gradien hijau)
    <div className="relative p-6 mx-4 my-4 text-white bg-gradient-to-r from-green-600 to-green-800 rounded-2xl shadow-lg overflow-hidden">
      
      {/* Kaligrafi Background (dibuat transparan) */}
      <img 
        src="../assets/kaligrafi.png" // Ganti dengan URL/path ke gambar kaligrafi
        alt="Kaligrafi"
        className="absolute top-0 right-0 w-1/2 h-full object-cover opacity-20" 
      />

      {/* Konten Teks (dibuat di atas background) */}
      <div className="relative z-10">
        <h1 className="text-3xl font-bold">Al-Quran dan Arti</h1>
        <p className="mt-1 text-sm text-green-100">
          Alquran dan Terjemah Standar Indonesia
        </p>
        
        {/* Info Tanggal & LPMQ */}
        <div className="flex flex-wrap items-center gap-4 mt-6 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
            <CalendarIcon />
            <span>Rabu, 22 Oktober 2025</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full backdrop-blur-sm">
            <BookIcon />
            <span>LPMQ Kemenag</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroCard;