import React, { useState, useRef, useEffect } from 'react';
import './Chatbot.css'; // Kita akan buat file CSS ini

// Komponen kecil untuk render balasan (mirip AyahDisplay)
function BotAyahResponse({ data }) {
  return (
    <div className="ayah-display-chat">
      <p>Tentu, ini tafsir untuk <strong>QS. Al-Mulk ({data.surah.number}) : Ayat {data.number.inSurah}</strong>:</p>
      <h4 className="arabic-text-chat">{data.text.arab}</h4>
      <p><strong>Artinya:</strong> "{data.translation.id}"</p>
      <p><strong>Tafsir Kemenag:</strong><br />{data.tafsir.id.long}</p>
    </div>
  );
}

function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      content: "Halo! Saya asisten khusus Surat Al-Mulk. Tanya saya tafsir ayat 1-30. (Contoh: 'tafsir ayat 5')"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null); // Untuk auto-scroll

  // Auto-scroll ke pesan terbaru
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

      try {
          const response = await fetch('http://127.0.0.1:8000/chatbot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: userMessage.content })
          });
          
          const botResponseData = await response.json();

          let botMessage;
          if (!response.ok) {
            // Jika error
            botMessage = {
              id: Date.now() + 1,
              sender: 'bot',
              content: botResponseData.detail || "Terjadi kesalahan."
            };
          } else {
            // === LOGIKA BARU UNTUK 2 TIPE JAWABAN ===
            if (botResponseData.answer_type === "text") {
              // KASUS 2: Jawaban teks dari RAG
              botMessage = {
                id: Date.now() + 1,
                sender: 'bot',
                content: botResponseData.content // Ini adalah string teks biasa
              };
            } else {
              // KASUS 1: Jawaban objek ayat (Logika lama)
              botMessage = {
                id: Date.now() + 1,
                sender: 'bot',
                content: <BotAyahResponse data={botResponseData.data} />
              };
            }
            // =======================================
          }
          setMessages(prev => [...prev, botMessage]);
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        content: `Error: ${err.message}`
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        Asisten Surat Al-Mulk
        <button onClick={onClose} className="chat-close-btn">×</button>
      </div>
      <div className="chat-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.sender}-message`}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="message bot-message">
            <i>Mengetik...</i>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-input-area">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Ketik nomor ayat..."
          disabled={isLoading}
        />
        <button onClick={handleSend} disabled={isLoading}>Kirim</button>
      </div>
    </div>
  );
}

export default Chatbot;