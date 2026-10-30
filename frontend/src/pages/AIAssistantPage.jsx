import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Trash2,
  Cpu,
  FileText,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { useAppData } from '../context/AppDataContext';
import { api } from '../services/api';

const EXAMPLE_QUESTIONS = [
  "Why is this machine showing high failure risk?",
  "Explain my machine's current health and predicted RUL.",
  "Which sensor readings are abnormal or drifting?",
  "What is the vibration severity limit under ISO 10816-3?",
  "Explain High Pressure Compressor blade tip erosion limits.",
  "What should I inspect if tool wear exceeds 200 minutes?"
];

export function AIAssistantPage() {
  const [searchParams] = useSearchParams();
  const machineParam = searchParams.get('machineId');
  const { machines, addToast } = useAppData();

  const [selectedMachineId, setSelectedMachineId] = useState(machineParam || "");
  const [messages, setMessages] = useState(() => {
    return [
      {
        id: "msg-welcome",
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `### Welcome to PredictX AI Maintenance Assistant\nI am your intelligent industrial copilot for predictive maintenance, NASA C-MAPSS turbofan diagnostics, and root-cause failure analysis.\n\nI combine **real-time sensor telemetry**, **machine learning predictions** (XGBoost, Random Forest, Attention-CNN-BiLSTM), and **official technical manuals** to give you evidence-grounded maintenance guidance.\n\nSelect a machine above or choose a suggested question below to begin.`,
        citations: []
      }
    ];
  });
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedCitationId, setExpandedCitationId] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (machineParam) {
      setSelectedMachineId(machineParam);
    }
  }, [machineParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const selectedMachine = machines.find(m => m.id === selectedMachineId || m.machineId === selectedMachineId);
  const targetMachineIdentifier = selectedMachine?.machineId || selectedMachine?.id || selectedMachineId;

  const handleSendMessage = async (textToSend) => {
    const question = (textToSend || inputValue).trim();
    if (!question || loading) return;

    const userMsgId = `usr-${Date.now()}`;
    const userMessage = {
      id: userMsgId,
      role: "user",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: question,
      machineId: selectedMachineId || null
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setLoading(true);

    try {
      // Gather sensor telemetry from selected machine
      const sensors = selectedMachine ? {
        airTemperature: selectedMachine.sensors?.airTempKelvin || 300,
        processTemperature: selectedMachine.sensors?.processTempKelvin || 310,
        rotationalSpeed: selectedMachine.sensors?.rotationalSpeedRpm || 1500,
        torque: selectedMachine.sensors?.torqueNm || 40,
        toolWear: selectedMachine.sensors?.toolWearMinutes || 0,
        vibration: selectedMachine.vibration || 2.0
      } : {};

      const response = await api.chatWithRAG({
        question,
        machine_id: targetMachineIdentifier || null,
        machineId: targetMachineIdentifier || null,
        sensors,
        conversation_id: "conv-session-1"
      });

      const assistantMessage = {
        id: `asst-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: response.answer,
        citations: response.citations || [],
        maxRelevance: response.max_relevance_score,
        hasSufficientContext: response.has_sufficient_context,
        machineContextUsed: response.machine_context_used,
        predictionContextUsed: response.prediction_context_used,
        machineId: response.machine_id
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      addToast(`Error communicating with RAG service: ${err.message}`, 'error');
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          isError: true,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          text: `**Service Communication Notice**\nCould not reach the RAG microservice. Please ensure the backend and RAG service are running on ports 5000 and 8001.\n*Details: ${err.message}*`,
          citations: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "msg-welcome-cleared",
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Conversation cleared. I am ready for your next maintenance or technical query.`,
        citations: []
      }
    ]);
    addToast('Chat history cleared', 'info');
  };

  return (
    <Layout pageTitle="AI Maintenance Assistant" breadcrumb={["Decision Support", "AI Assistant"]}>
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col lg:flex-row gap-6">
        
        {/* MAIN CHAT CONTAINER */}
        <div className="flex-1 flex flex-col bg-white border border-[#E0E6E0] rounded-xl shadow-sm overflow-hidden min-h-[640px] max-h-[85vh]">
          
          {/* HEADER BAR */}
          <div className="px-5 py-3.5 border-b border-[#E0E6E0] bg-[#FAFCFA] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#176B52]/10 border border-[#176B52]/30 flex items-center justify-center text-[#176B52]">
                <Sparkles size={17} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-[#202A27]">PredictX AI Copilot</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#176B52]/10 text-[#176B52] border border-[#176B52]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#176B52] animate-pulse" />
                    RAG Grounded
                  </span>
                </div>
                <p className="text-[11px] text-[#68756F]">NASA C-MAPSS + ChromaDB Vector Knowledge Base</p>
              </div>
            </div>

            {/* MACHINE CONTEXT SELECTOR */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#68756F] font-medium hidden sm:inline">Machine Context:</span>
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="text-xs bg-white border border-[#CCD6CC] rounded-lg px-2.5 py-1.5 font-medium text-[#202A27] focus:outline-none focus:border-[#176B52] transition-colors"
              >
                <option value="">General Fleet Knowledge</option>
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id} — {m.name} ({m.status})
                  </option>
                ))}
              </select>

              <button
                onClick={handleClearChat}
                title="Clear Conversation"
                className="p-1.5 text-[#68756F] hover:text-[#B94040] hover:bg-[#B94040]/10 rounded-lg transition-colors"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* CHAT MESSAGES AREA */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#F9FAF8]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {/* ROLE BADGE & TIME */}
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-mono text-[#68756F] uppercase">
                    {msg.role === 'user' ? 'You' : 'PredictX AI'}
                  </span>
                  <span className="text-[10px] text-[#9BA89F]">{msg.timestamp}</span>
                  {msg.machineId && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#E4EAE4] text-[#3D4D46]">
                      {msg.machineId}
                    </span>
                  )}
                </div>

                {/* MESSAGE BUBBLE */}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${
                    msg.role === 'user'
                      ? 'bg-[#176B52] text-white rounded-tr-none'
                      : msg.isError
                      ? 'bg-[#FDF2F2] border border-[#F5B9B9] text-[#991B1B] rounded-tl-none'
                      : 'bg-white border border-[#E0E6E0] text-[#202A27] rounded-tl-none'
                  }`}
                >
                  <div className="prose prose-xs max-w-none space-y-2 whitespace-pre-wrap font-sans">
                    {msg.text}
                  </div>

                  {/* CITATIONS ACCORDION */}
                  {msg.citations && msg.citations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#E8EEE8]">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#176B52] mb-2">
                        <BookOpen size={13} />
                        <span>Verified Technical Sources ({msg.citations.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {msg.citations.map((cit) => (
                          <div
                            key={cit.citation_id}
                            onClick={() => setExpandedCitationId(expandedCitationId === cit.citation_id ? null : cit.citation_id)}
                            className="bg-[#F4F7F4] hover:bg-[#EAF0EA] border border-[#D8E2D8] rounded-lg p-2 cursor-pointer transition-all text-left"
                          >
                            <div className="flex items-center justify-between text-[11px] font-mono font-medium text-[#202A27]">
                              <span className="truncate max-w-[170px]" title={cit.document_name}>
                                {cit.document_name}
                              </span>
                              <span className="text-[10px] bg-[#176B52]/10 text-[#176B52] px-1.5 py-0.5 rounded font-sans font-semibold">
                                p.{cit.page_number}
                              </span>
                            </div>
                            <div className="text-[10px] text-[#68756F] mt-0.5 truncate">
                              {cit.section_name || 'Technical Section'}
                            </div>

                            {expandedCitationId === cit.citation_id && (
                              <div className="mt-1.5 pt-1.5 border-t border-[#D0DCD0] text-[10px] text-[#3D4D46] italic bg-white/70 p-1.5 rounded">
                                "{cit.excerpt}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* LOADING TYPING INDICATOR */}
            {loading && (
              <div className="flex flex-col items-start">
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-mono text-[#68756F] uppercase">PredictX AI</span>
                  <span className="text-[10px] text-[#9BA89F]">Synthesizing knowledge...</span>
                </div>
                <div className="bg-white border border-[#E0E6E0] rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[#176B52] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#176B52] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[#176B52] animate-bounce" style={{ animationDelay: '300ms' }} />
                  <span className="text-xs text-[#68756F] ml-2">Searching ChromaDB & evaluating ML models...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* SUGGESTED CHIPS */}
          <div className="px-4 py-2 border-t border-[#E8EEE8] bg-[#FAFCFA] overflow-x-auto flex items-center gap-1.5 no-scrollbar">
            <span className="text-[10px] font-bold text-[#68756F] uppercase tracking-wider shrink-0 mr-1">
              Suggestions:
            </span>
            {EXAMPLE_QUESTIONS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(q)}
                disabled={loading}
                className="text-[11px] whitespace-nowrap bg-white hover:bg-[#176B52]/10 border border-[#D5DFD5] hover:border-[#176B52]/40 text-[#3D4D46] hover:text-[#176B52] px-2.5 py-1 rounded-full transition-all shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* INPUT BAR */}
          <div className="p-3 border-t border-[#E0E6E0] bg-white flex items-center gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedMachineId
                  ? `Ask about ${selectedMachineId} health, risk, telemetry, or maintenance steps...`
                  : "Ask about machine health, C-MAPSS benchmarks, sensor thresholds, or maintenance..."
              }
              rows={1}
              className="flex-1 resize-none bg-[#F4F6F3] border border-[#CCD6CC] rounded-xl px-3.5 py-2.5 text-xs text-[#202A27] placeholder-[#8A9690] focus:outline-none focus:border-[#176B52] focus:bg-white transition-all"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputValue.trim() || loading}
              className="bg-[#176B52] hover:bg-[#11523E] disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0"
            >
              <Send size={15} />
            </button>
          </div>
        </div>

        {/* SIDEBAR: MACHINE CONTEXT & KNOWLEDGE STATS */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          
          {/* MACHINE TELEMETRY CARD */}
          {selectedMachine ? (
            <div className="bg-white border border-[#E0E6E0] rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-[#E8EEE8]">
                <div>
                  <span className="text-[10px] font-mono text-[#68756F] uppercase">Active Machine</span>
                  <h3 className="text-sm font-bold text-[#202A27]">{selectedMachine.id}</h3>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  selectedMachine.status === 'Operational' ? 'bg-[#43D17D]/15 text-[#176B52]' :
                  selectedMachine.status === 'Warning' ? 'bg-[#F5B942]/15 text-[#9E6E00]' : 'bg-[#FF5B64]/15 text-[#B94040]'
                }`}>
                  {selectedMachine.status}
                </span>
              </div>

              <div className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-[#F4F6F3]">
                  <span className="text-[#68756F]">Failure Risk:</span>
                  <span className="font-mono font-bold text-[#B94040]">{selectedMachine.riskScore}%</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F6F3]">
                  <span className="text-[#68756F]">Predicted RUL:</span>
                  <span className="font-mono font-bold text-[#176B52]">{selectedMachine.predictedRul} cycles</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F6F3]">
                  <span className="text-[#68756F]">Machine Type:</span>
                  <span className="font-medium text-[#202A27]">{selectedMachine.type}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F6F3]">
                  <span className="text-[#68756F]">Operating Hours:</span>
                  <span className="font-mono text-[#202A27]">{selectedMachine.operatingHours} hrs</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#68756F]">Vibration:</span>
                  <span className="font-mono text-[#202A27]">{selectedMachine.vibration || 2.1} mm/s</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-[#E0E6E0] rounded-xl p-4 shadow-sm text-center">
              <Cpu className="mx-auto text-[#68756F] mb-2" size={24} />
              <h4 className="text-xs font-bold text-[#202A27]">No Machine Selected</h4>
              <p className="text-[11px] text-[#68756F] mt-1">
                Select a machine from the dropdown to automatically bind live telemetry and RUL predictions to your queries.
              </p>
            </div>
          )}

          {/* KNOWLEDGE BASE METRICS */}
          <div className="bg-white border border-[#E0E6E0] rounded-xl p-4 shadow-sm">
            <h4 className="text-xs font-bold text-[#202A27] uppercase tracking-wider mb-3 flex items-center gap-2">
              <BookOpen size={14} className="text-[#176B52]" />
              Knowledge Base Coverage
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-[#F4F6F3]">
                <span className="text-[#68756F]">Indexed Chunks:</span>
                <span className="font-mono font-bold text-[#176B52]">36 chunks</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#F4F6F3]">
                <span className="text-[#68756F]">Embedding Model:</span>
                <span className="font-mono text-[11px] text-[#202A27]">all-MiniLM-L6-v2</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-[#F4F6F3]">
                <span className="text-[#68756F]">Vector DB:</span>
                <span className="font-mono text-[11px] text-[#202A27]">ChromaDB (Cosine)</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-[#68756F]">Search Method:</span>
                <span className="font-medium text-[11px] text-[#176B52]">Hybrid (Dense + BM25)</span>
              </div>
            </div>
          </div>

          {/* INDUSTRIAL SAFETY DISCLAIMER */}
          <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3 text-[11px] text-[#92400E] flex items-start gap-2">
            <ShieldAlert size={16} className="shrink-0 mt-0.5 text-[#D97706]" />
            <div>
              <p className="font-semibold">Engineering Disclaimer</p>
              <p className="mt-0.5 leading-relaxed text-[10px]">
                Predictions and RAG answers provide decision support. Always confirm physical mechanical condition via borescope or dial gauge inspection before dispatching major overhauls.
              </p>
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}

export default AIAssistantPage;
