import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import { SettingsProvider } from './contexts/SettingsContext';

// 1. Import React Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// 2. Buat Client (Konfigurasi Cache)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data dianggap "segar" selama 5 menit (tidak akan fetch ulang)
      cacheTime: 1000 * 60 * 30, // Data disimpan di memori selama 30 menit
      refetchOnWindowFocus: false, // Jangan fetch ulang otomatis saat pindah tab
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)