import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Terminal, Layers, Shield, ArrowRight, Wrench, Activity, ChevronRight } from 'lucide-react';

export function WelcomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0C100E] text-[#202A27] flex flex-col items-center justify-center p-4 font-mono select-none antialiased">
      {/* Centered Industrial Command Card */}
      <div className="w-full max-w-lg bg-[#FFFFFF] border border-[#E0E6E0] rounded-xl p-6 sm:p-8 shadow-2xl relative">
        {/* Brand header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-11 h-11 rounded-lg bg-[#176B52]/15 border border-[#176B52]/40 flex items-center justify-center text-[#176B52] mb-3 shadow-[0_0_20px_rgba(255,128,95,0.15)]">
            <Terminal size={22} />
          </div>
          <h1 className="text-xl font-bold tracking-widest text-[#202A27]">
            PREDICT<span className="text-[#176B52]">X</span>
          </h1>
          <p className="text-xs text-[#68756F] mt-1.5 max-w-sm leading-relaxed">
            AI-Driven Industrial Asset Prognostics & Impact-Aware Maintenance Portal
          </p>
          <div className="inline-flex items-center gap-2 mt-3 px-2.5 py-0.5 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-[10px] text-[#27845C]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#27845C] animate-pulse" />
            NASA C-MAPSS FD001 Subsample Pipeline
          </div>
        </div>

        {/* Operational Entry Cards */}
        <div className="space-y-3">
          <div
            onClick={() => navigate('/dashboard')}
            className="group p-3.5 rounded-lg bg-[#F4F7F5] border border-[#176B52]/40 hover:border-[#176B52] transition-all cursor-pointer flex items-center justify-between shadow-[0_0_20px_rgba(255,128,95,0.06)]"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#176B52]/15 border border-[#176B52]/30 flex items-center justify-center text-[#176B52]">
                <Shield size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#202A27] group-hover:text-[#176B52] transition-colors">
                  Plant Operations Overview
                </div>
                <div className="text-[11px] text-[#68756F]">
                  Live fleet KPIs, risk distribution & workload trends
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-[#176B52] group-hover:translate-x-0.5 transition-transform" />
          </div>

          <div
            onClick={() => navigate('/maintenance-priority')}
            className="group p-3.5 rounded-lg bg-[#F7FAF8] border border-[#E0E6E0] hover:border-[#38BDF8]/60 transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#E8EFEA] border border-[#D2DDD5] flex items-center justify-center text-[#38BDF8] group-hover:bg-[#38BDF8]/10 transition-colors">
                <Activity size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#202A27] group-hover:text-[#38BDF8] transition-colors">
                  Decision Priority Matrix
                </div>
                <div className="text-[11px] text-[#68756F]">
                  Dynamic What-If sensitivity weights & action rankings
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-[#68756F] group-hover:text-[#38BDF8] group-hover:translate-x-0.5 transition-all" />
          </div>

          <div
            onClick={() => navigate('/machines')}
            className="group p-3.5 rounded-lg bg-[#F7FAF8] border border-[#E0E6E0] hover:border-[#27845C]/60 transition-all cursor-pointer flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-[#E8EFEA] border border-[#D2DDD5] flex items-center justify-center text-[#27845C] group-hover:bg-[#27845C]/10 transition-colors">
                <Layers size={16} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#202A27] group-hover:text-[#27845C] transition-colors">
                  Machine Fleet Registry
                </div>
                <div className="text-[11px] text-[#68756F]">
                  Multi-channel sensor telemetry & diagnostics
                </div>
              </div>
            </div>
            <ArrowRight size={15} className="text-[#68756F] group-hover:text-[#27845C] group-hover:translate-x-0.5 transition-all" />
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-6 pt-4 border-t border-[#E0E6E0] flex items-center justify-between text-[10px] text-[#75837D]">
          <span>DEV-P04 Decision Support Layer</span>
          <span>BTech CSE Prototype Build</span>
        </div>
      </div>
    </div>
  );
}
