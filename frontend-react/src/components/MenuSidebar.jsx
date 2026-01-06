import React, { useEffect, useState } from 'react';
import { HiXMark, HiTrash } from 'react-icons/hi2';

function MenuSidebar({ isOpen, onClose, onNavigate }) {
  const [bookmarks, setBookmarks] = useState([]);

  // Ambil data bookmark dari LocalStorage setiap kali menu dibuka
  useEffect(() => {
    if (isOpen) {
      const saved = JSON.parse(localStorage.getItem('quran_bookmarks') || '[]');
      // Urutkan dari yang terbaru (paling atas)
      setBookmarks(saved.reverse());
    }
  }, [isOpen]);

  // Fungsi Hapus Bookmark
  const removeBookmark = (surah, ayah) => {
    const updated = bookmarks.filter(b => !(b.surah === surah && b.ayah === ayah));
    setBookmarks(updated);
    // Simpan balik ke LocalStorage (jangan lupa di-reverse balik atau simpan apa adanya sesuai logika awal)
    // Biar aman, kita baca ulang sumber aslinya untuk menghapus, lalu simpan
    const originalStorage = JSON.parse(localStorage.getItem('quran_bookmarks') || '[]');
    const newStorage = originalStorage.filter(b => !(b.surah === surah && b.ayah === ayah));
    localStorage.setItem('quran_bookmarks', JSON.stringify(newStorage));
  };

  return (
    <>
      {/* Overlay Gelap (Background) */}
      <div 
        className={`fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
        onClick={onClose}
      />

      {/* Sidebar Panel */}
      <div 
        className={`fixed top-0 left-0 h-full w-80 bg-white shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        
        {/* Header Sidebar */}
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-green-600 text-white">
          <h2 className="text-lg font-bold">Menu & Bookmark</h2>
          <button onClick={onClose} className="p-1 hover:bg-green-700 rounded-full">
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Content: Daftar Bookmark */}
        <div className="p-4 overflow-y-auto h-[calc(100vh-70px)]">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
            Ayat Tersimpan ({bookmarks.length})
          </h3>

          {bookmarks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center mt-10">
              Belum ada ayat yang disimpan.
            </p>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((b, index) => (
                <div 
                  key={`${b.surah}-${b.ayah}-${index}`}
                  className="bg-gray-50 p-3 rounded-lg border border-gray-100 hover:border-green-300 transition-colors group relative cursor-pointer"
                  onClick={() => {
                    onNavigate(b.surah, b.ayah);
                    onClose();
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-bold text-gray-800 text-sm">
                        QS. {b.surahName || `Surah ${b.surah}`}
                      </p>
                      <p className="text-xs text-green-600 font-medium">
                        Ayat {b.ayah}
                      </p>
                    </div>
                    {/* Tombol Hapus (muncul saat hover) */}
                    <button 
                      className="text-gray-400 hover:text-red-500 p-1"
                      onClick={(e) => {
                        e.stopPropagation(); // Biar gak memicu klik navigasi
                        removeBookmark(b.surah, b.ayah);
                      }}
                      title="Hapus Bookmark"
                    >
                      <HiTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

export default MenuSidebar;