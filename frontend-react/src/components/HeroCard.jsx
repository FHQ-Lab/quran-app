import React, { useState } from 'react';
import { HiCalendarDays, HiMapPin } from 'react-icons/hi2';

function HeroCard() {
  const [showHijri, setShowHijri] = useState(false);

  // Fungsi untuk mendapatkan tanggal saat ini
  const getTodayDate = (isHijri) => {
    const today = new Date();
    const options = { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    };

    if (isHijri) {
      try {
        return new Intl.DateTimeFormat('id-ID-u-ca-islamic', options).format(today);
      } catch (e) {
        return "Kalender Error"; // Fallback jika browser tidak support
      }
    } else {
      return new Intl.DateTimeFormat('id-ID', options).format(today);
    }
  };

  // Link Google Maps LPMQ (Gedung Bayt Al-Qur'an)
  const openMap = () => {
    window.open("https://maps.app.goo.gl/WQEuTEWDNrMdXgHj9", "_blank"); // Ganti link ini jika ada yg lebih spesifik
  };

  return (
    <div className="relative mx-auto my-4 overflow-hidden bg-gradient-to-r from-green-600 to-green-800 rounded-3xl shadow-xl transform transition-all">
      
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center">
        
        {/*Kaligrafi & Background */}
        <div className="mb-4 pointer-events-none select-none">
          <img 
            src="/closeup_quran.jpg" 
            alt="Background"
            className="absolute right-0 top-0 opacity-20 w-full h-full object-center" 
          />
           <img 
            src="/kaligrafi.png" 
            alt="Kaligrafi"
            className="w-50 h-auto opacity-90 invert brightness-0 drop-shadow-md" 
          />
        </div>

        <div className="max-w-lg">
          <h1 className="text-3xl font-bold text-white md:text-4xl tracking-wide mb-2 cursor-default">
            Al-Qur'an Digital
          </h1>
          <p className="text-sm text-green-100 font-light opacity-90 cursor-default">
            Lajnah Pentashihan Mushaf Al-Qur'an
          </p>
          
          {/* --- BADGE INTERAKTIF --- */}
          <div className="z-50 flex flex-wrap items-center justify-center gap-3 mt-6 text-xs font-bold text-green-800 cursor-pointer">
            
            {/* 1. Tombol Kalender */}
            <button 
              onClick={() => {
                console.log("Kalender diklik!"); // Cek console kalau masih gak bisa
                setShowHijri(!showHijri);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:bg-green-50 cursor-pointer transition-transform hover:scale-[1.01] active:scale-95 select-none"
            >
              <HiCalendarDays className="w-4 h-4 text-green-600" />
              <span>{getTodayDate(showHijri)}</span>
            </button>

            {/* 2. Tombol Lokasi */}
            <button 
              onClick={openMap}
              className="flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md hover:bg-green-50 cursor-pointer transition-transform hover:scale-[1.01] active:scale-95 select-none"
            >
              <HiMapPin className="w-4 h-4 text-green-600" />
              <span>Lokasi LPMQ</span>
            </button>

          </div>
        </div>

      </div>
    </div>
  );
}

export default HeroCard;