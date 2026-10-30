import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  X,
  BookOpen,
  Cpu,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { api } from '../../services/api';

export function AIAssistantModal({ isOpen, onClose, machineContext = null }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedCitationId, setExpandedCitationId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      const machineTitle = machineContext ? `${machineContext.id} (${machineContext.name})` : "General Machine Fleet";
      setMessages([
        {
          id: "modal-welcome",
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `### PredictX AI Maintenance Copilot\nActive Context: **${machineTitle}**\n\nAsk me about current failure probabilities, sensor thresholds (vibration, T30, EGT), RUL expectations, or troubleshooting steps.`,
          citations: []
        }
      ]);
    }
  }, [isOpen, machineContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const handleSend = async (questionText) => {
    const q = (questionText || inputValue).trim();
    if (!q || loading) return;

    const userMessage = {
      id: `usr-${Date.now()}`,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: q
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      const sensors = machineContext ? {
        airTemperature: machineContext.sensors?.airTempKelvin || 300,
        processTemperature: machineContext.sensors?.processTempKelvin || 310,
        rotationalSpeed: machineContext.sensors?.rotationalSpeedRpm || 1500,
        torque: machineContext.sensors?.torqueNm || 40,
        toolWear: machineContext.sensors?.toolWearMinutes || 0,
        vibration: machineContext.vibration || 2.0
      } : {};

      const response = await api.chatWithRAG({
        question: q,
        machine_id: machineContext ? machineContext.id : null,
        sensors,
        conversation_id: "modal-session"
      });

      setMessages(prev => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: response.answer,
          citations: response.citations || [],
          machineId: response.machine_id
        }
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `**Notice**: Could not complete request: ${err.message}`,
          citations: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white border border-[#E0E6E0] rounded-2xl shadow-2xl w-full max-w-2xl h-[620px] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* HEADER */}
        <div className="px-5 py-3.5 border-b border-[#E0E6E0] bg-[#FAFCFA] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#176B52]/10 border border-[#176B52]/30 flex items-center justify-center text-[#176B52]">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#202A27]">AI Maintenance Assistant</h3>
                {machineContext && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#176B52]/10 text-[#176B52] font-semibold">
                    {machineContext.id}
                  </span>
                )}
              </div>
              <p className="text-[10px] text-[#68756F]">Grounded across C-MAPSS Specifications & Standards</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#68756F] hover:text-[#202A27] rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F9FAF8]">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[9px] font-mono text-[#68756F] uppercase">
                  {msg.role === 'user' ? 'You' : 'PredictX AI'}
                </span>
                <span className="text-[9px] text-[#9BA89F]">{msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-[#176B52] text-white rounded-tr-none'
                    : 'bg-white border border-[#E0E6E0] text-[#202A27] rounded-tl-none'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans space-y-1.5 text-[11px]">
                  {msg.text}
                </div>

                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-2.5 pt-2 border-t border-[#E8EEE8]">
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-[#176B52] mb-1">
                      <BookOpen size={11} />
                      <span>Citations ({msg.citations.length})</span>
                    </div>
                    <div className="space-y-1">
                      {msg.citations.map((c) => (
                        <div
                          key={c.citation_id}
                          onClick={() => setExpandedCitationId(expandedCitationId === c.citation_id ? null : c.citation_id)}
                          className="text-[10px] bg-[#F4F7F4] hover:bg-[#EAF0EA] p-1.5 rounded border border-[#D8E2D8] cursor-pointer"
                        >
                          <div className="flex justify-between font-mono font-medium">
                            <span>{c.document_name}</span>
                            <span className="text-[#176B52]">p.{c.page_number}</span>
                          </div>
                          {expandedCitationId === c.citation_id && (
                            <p className="mt-1 text-[9px] text-[#3D4D46] italic bg-white p-1 rounded">
                              "{c.excerpt}"
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-1.5 text-xs text-[#68756F] p-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#176B52] animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#176B52] animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 rounded-full bg-[#176B52] animate-bounce" style={{ animationDelay: '300ms' }} />
              <span className="ml-2 text-[11px]">Querying technical knowledge...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT */}
        <div className="p-3 border-t border-[#E0E6E0] bg-white flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={machineContext ? `Ask about ${machineContext.id} health or diagnostics...` : "Ask a maintenance question..."}
            className="flex-1 bg-[#F4F6F3] border border-[#CCD6CC] rounded-xl px-3 py-2 text-xs text-[#202A27] focus:outline-none focus:border-[#176B52]"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || loading}
            className="bg-[#176B52] hover:bg-[#11523E] disabled:opacity-40 text-white p-2 rounded-xl transition-all"
          >
            <Send size={14} />
          </button>
        </div>

      </div>
    </div>
  );
}
