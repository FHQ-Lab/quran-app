import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { HiXMark, HiPaperAirplane, HiChatBubbleLeftRight, HiMicrophone } from 'react-icons/hi2';

// Setup Voice Recognition (Tetap sama)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'id-ID';
  recognition.continuous = false;
}

function Chatbot({ onClose }) {
  // 1. Ambil URL API dari Environment Variable (PENTING!)
  // Ini agar dia otomatis tahu alamat Hugging Face saat di Vercel, 
  // dan alamat localhost saat di laptop.
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      content: "Assalamu'alaikum! Saya asisten AI Tafsir Al-Qur'an. Tanyakan apa saja, misal: 'Apa hukum riba?' atau 'Jelaskan Al-Ikhlas'."
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // --- FUNGSI VOICE ---
  const handleVoiceInput = () => {
    if (!recognition) {
      alert("Browser Anda tidak mendukung fitur suara.");
      return;
    }
    
    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      return;
    }

    setIsRecording(true);
    recognition.start();

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error("Voice error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  };

  // --- FUNGSI KIRIM PESAN ---
  const handleSend = async (manualText = null) => {
    const textToSend = manualText || input;
    if (!textToSend.trim() || isLoading) return;

    // 1. Tambahkan pesan user ke UI
    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: textToSend.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // 2. Fetch ke URL API yang Dinamis (Bukan Localhost lagi)
      // Kita gunakan endpoint /chatbot yang baru
      const response = await fetch(`${API_BASE_URL}/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMessage.content })
      });
      
      const botResponseData = await response.json();
      let botMessageContent;

      if (!response.ok) {
        botMessageContent = botResponseData.detail || "Maaf, sedang ada gangguan koneksi ke server AI.";
      } else {
        // Backend baru selalu mengembalikan format { answer_type: "text", content: "..." }
        // Isi content adalah Markdown yang sudah diformat oleh Llama
        botMessageContent = botResponseData.content;
      }

      // 3. Tambahkan balasan Bot ke UI
      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        content: botMessageContent,
        isComponent: false // Kita matikan komponen khusus, serahkan semua ke Markdown
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        content: `Error: Gagal terhubung ke server. Pastikan server Hugging Face sudah bangun. (${err.message})`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 w-full max-w-md px-4 md:px-0">
      <div className="flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden h-[500px] md:h-[600px]">
        
        {/* Header */}
        <div className="bg-green-600 p-4 flex justify-between items-center text-white shadow-md">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-white/20 rounded-full">
               <HiChatBubbleLeftRight className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Asisten Tafsir AI</h2>
              <p className="text-xs text-green-100 opacity-90">Online • Llama 3.3 70B</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[90%] rounded-2xl p-3 text-sm shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-green-600 text-white rounded-br-none' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
              }`}>
                {/* RENDERER MARKDOWN 
                   Agar tulisan **Tebal**, baris baru, dan kutipan ayat tampil rapi 
                */}
                <div className={`prose prose-sm max-w-none ${msg.sender === 'user' ? 'text-white prose-invert' : 'text-gray-800'}`}>
                  <ReactMarkdown>{String(msg.content)}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-bl-none p-4 text-xs shadow-sm flex items-center gap-2">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span>Sedang membaca tafsir...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-gray-100">
          <div className="flex gap-2 items-center">
            
            {/* Tombol Mic */}
            {recognition && (
              <button 
                onClick={handleVoiceInput}
                className={`p-2 rounded-full transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title="Bicara sekarang"
              >
                <HiMicrophone className="w-5 h-5" />
              </button>
            )}

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder={isRecording ? "Mendengarkan..." : "Tanya tentang ayat..."}
              className="flex-grow px-4 py-2 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-green-500 border-transparent"
              disabled={isLoading || isRecording}
            />
            
            <button 
              onClick={() => handleSend()} 
              disabled={isLoading || (!input.trim() && !isRecording)}
              className="p-2 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-transform active:scale-95"
            >
              <HiPaperAirplane className="w-5 h-5 pl-0.5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export default Chatbot;