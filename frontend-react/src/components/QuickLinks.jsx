import React from 'react';

// Daftar link cepat
const links = ['Yaasin', 'Ayat Kursi', 'Al-Kahf', 'Al-Mulk', 'Ar-Rahman'];

function QuickLinks() {
  return (
    // Dibuat scrollable secara horizontal
    <div className="px-4 py-2 overflow-x-auto whitespace-nowrap">
      <div className="flex gap-3">
        {links.map((link) => (
          <button
            key={link}
            className="px-5 py-2 text-sm font-semibold text-green-800 bg-green-100 rounded-full hover:bg-green-200 transition-colors"
          >
            {link}
          </button>
        ))}
      </div>
    </div>
  );
}

export default QuickLinks;