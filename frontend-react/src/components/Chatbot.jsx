import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { HiXMark, HiPaperAirplane, HiChatBubbleLeftRight, HiMicrophone } from 'react-icons/hi2'; // Tambah HiMicrophone

// Setup Voice Recognition (Lokal untuk komponen ini)
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;
if (recognition) {
  recognition.lang = 'id-ID'; // Bahasa Indonesia untuk Chatbot
  recognition.continuous = false;
}

// Komponen untuk merender Ayat di dalam chat
function BotAyahResponse({ data }) {
  return (
    <div className="mt-2 p-4 bg-white rounded-xl border border-green-100 shadow-sm">
      <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2">
        QS. {data.surah.name.transliteration.id} : {data.number.inSurah}
      </p>
      <h4 className="text-2xl text-right font-serif text-gray-800 leading-loose mb-3" dir="rtl" style={{ fontFamily: 'Amiri, serif' }}>
        {data.text.arab}
      </h4>
      <p className="text-sm text-gray-600 italic mb-3">"{data.translation.id}"</p>
      
      <div className="text-xs text-gray-500 border-t border-gray-100 pt-2">
        <span className="font-semibold">Tafsir Kemenag:</span>
        <div className="mt-1 line-clamp-4 hover:line-clamp-none transition-all cursor-pointer text-justify">
           {data.tafsir.id.short || data.tafsir.id.long}
        </div>
      </div>
    </div>
  );
}

function Chatbot({ onClose }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      content: "Assalamu'alaikum! Saya asisten AI Tafsir Al-Qur'an. Ada yang bisa saya bantu? (Misal: 'Tafsir Al-Fatihah ayat 1' atau 'Jelaskan tentang sabar')"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false); // State perekaman
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
      setInput(transcript); // Masukkan teks ke input box
      setIsRecording(false);
      // Opsional: Langsung kirim setelah bicara?
      // handleSend(transcript); 
    };

    recognition.onerror = (event) => {
      console.error("Voice error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };
  };

  const handleSend = async (manualText = null) => {
    const textToSend = manualText || input;
    if (!textToSend.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: textToSend.trim()
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

      let botMessageContent;
      let isComponent = false;

      if (!response.ok) {
        botMessageContent = botResponseData.detail || "Maaf, terjadi kesalahan pada server.";
      } else {
        if (botResponseData.answer_type === "text") {
          botMessageContent = botResponseData.content;
        } else {
          botMessageContent = <BotAyahResponse data={botResponseData.data} />;
          isComponent = true;
        }
      }

      const botMessage = {
        id: Date.now() + 1,
        sender: 'bot',
        content: botMessageContent,
        isComponent: isComponent
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        sender: 'bot',
        content: `Error: Gagal terhubung ke server. (${err.message})`
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
              <p className="text-xs text-green-100 opacity-90">Online • Powered by Groq</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <HiXMark className="w-6 h-6" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-3 text-sm shadow-sm ${msg.sender === 'user' ? 'bg-green-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'}`}>
                {msg.isComponent ? msg.content : <div className={`prose prose-sm max-w-none ${msg.sender === 'user' ? 'text-white prose-invert' : 'text-gray-800'}`}><ReactMarkdown>{String(msg.content)}</ReactMarkdown></div>}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-100 text-gray-500 rounded-2xl rounded-bl-none p-3 text-xs shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-gray-100">
          <div className="flex gap-2 items-center">
            
            {/* Tombol Mic Baru */}
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
              placeholder={isRecording ? "Mendengarkan..." : "Tanya tafsir..."}
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