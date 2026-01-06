import React, { createContext, useContext, useState, useEffect } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  // State ukuran font (Default)
  // Kita simpan di localStorage biar user tidak perlu setting ulang tiap buka
  const [arabicSize, setArabicSize] = useState(() => {
    return parseInt(localStorage.getItem('arabicSize')) || 40; // Default 40px (text-4xl)
  });
  
  const [translationSize, setTranslationSize] = useState(() => {
    return parseInt(localStorage.getItem('translationSize')) || 16; // Default 16px (text-base)
  });

  // Simpan ke localStorage setiap kali berubah
  useEffect(() => {
    localStorage.setItem('arabicSize', arabicSize);
    localStorage.setItem('translationSize', translationSize);
  }, [arabicSize, translationSize]);

  return (
    <SettingsContext.Provider value={{ arabicSize, setArabicSize, translationSize, setTranslationSize }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}