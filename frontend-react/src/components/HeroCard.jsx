import React from 'react';
// Import ikon minimalis dari Heroicons 2 (Outline version)
import { HiCalendarDays, HiBookOpen, HiMapPin } from 'react-icons/hi2';

function HeroCard() {
  return (
    <div className="relative mx-auto my-4 overflow-hidden bg-gradient-to-r from-green-600 to-green-800 rounded-3xl shadow-lg">
      
      {/* Background Pattern */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-white opacity-5 rounded-full translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center">
        
        {/* Gambar Kaligrafi */}
        <div className="mb-6">
          <img 
            src="/src/assets/closeup_quran.jpg" 
            alt="background" 
            className="absolute top-0 right-0 w-full h-full object-center opacity-20"
            />
          <img 
            src="/src/assets/kaligrafi.png" 
            alt="Kaligrafi"
            className="w-32 h-auto opacity-90 invert brightness-0 drop-shadow-md" 
          />

        </div>

        <div className="max-w-lg">
          <h1 className="text-3xl font-bold text-white md:text-4xl tracking-wide">
            Al-Qur'an dan Arti
          </h1>
          <p className="mt-2 text-sm text-green-100 md:text-base font-light">
            Alquran dan Terjemah Standar Indonesia
          </p>
          
          {/* Badge Info dengan Ikon Baru */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6 text-xs font-medium text-green-800">
            
            {/* Badge Tanggal */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full shadow-sm backdrop-blur-sm">
              {/* Gunakan komponen ikon langsung di sini */}
              <HiCalendarDays className="w-4 h-4 text-green-700" />
              <span>Rabu, 22 Oktober 2025</span>
            </div>

            {/* Badge Sumber */}
            <div className="flex items-center gap-2 px-4 py-2 bg-white/90 rounded-full shadow-sm backdrop-blur-sm">
              <HiMapPin className="w-4 h-4 text-green-700" />
              <span>LPMQ Kemenag</span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

export default HeroCard;