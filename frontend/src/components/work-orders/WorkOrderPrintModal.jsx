import React from 'react';
import { X, Printer, Wrench, Calendar, CheckSquare, ShieldAlert, User, Cpu } from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../common/UIComponents';

export function WorkOrderPrintModal({ order, isOpen, onClose }) {
  if (!isOpen || !order) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#FFFFFF] border border-[#D2DDD5] rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl font-mono overflow-hidden">
        {/* HEADER BAR */}
        <div className="px-5 py-3.5 border-b border-[#E0E6E0] flex items-center justify-between bg-[#F4F7F5]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-[#176B52]/15 border border-[#176B52]/40 text-[#176B52]">
              <Printer size={15} />
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#202A27]">
                Industrial Maintenance Work Order Slip
              </h2>
              <p className="text-[10px] text-[#68756F]">
                Official physical dispatch ticket for maintenance technicians
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3 py-1 bg-[#176B52] hover:bg-[#10543F] text-white font-bold text-xs rounded flex items-center gap-1.5 transition-colors"
            >
              <Printer size={13} /> Print / Export PDF
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#68756F] hover:text-[#202A27] hover:bg-[#E8EFEA] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PRINTABLE TICKET BODY */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs bg-[#F4F6F3]">
          {/* TICKET TOP BANNER */}
          <div className="border-2 border-dashed border-[#D2DDD5] rounded-lg p-4 bg-[#F4F7F5] space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#75837D]">PLANT MAINTENANCE DISPATCH SLIP</div>
                <div className="text-xl font-bold text-[#176B52] tracking-tight">{order.id}</div>
                <div className="text-[10px] text-[#68756F]">Generated via PredictX Industrial Engine</div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#68756F]">Priority:</span>
                  <PriorityBadge priority={order.priority} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#68756F]">Status:</span>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            </div>

            {/* BARCODE REPRESENTATION */}
            <div className="py-1 text-center font-mono tracking-[0.4em] text-[10px] text-[#829189] select-none border-y border-[#E0E6E0]">
              ||| | ||||| || |||||| | ||||| ||| |||| | ||| ||||||| {order.id}
            </div>

            {/* ASSET SPECIFICATION */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
              <div className="p-2 rounded bg-[#F4F7F5] border border-[#E0E6E0]">
                <span className="text-[9px] text-[#75837D] uppercase block">Asset ID</span>
                <span className="font-bold text-[#202A27]">{order.machineId}</span>
              </div>
              <div className="p-2 rounded bg-[#F4F7F5] border border-[#E0E6E0]">
                <span className="text-[9px] text-[#75837D] uppercase block">Asset Name</span>
                <span className="font-bold text-[#202A27] truncate block">{order.machineName}</span>
              </div>
              <div className="p-2 rounded bg-[#F4F7F5] border border-[#E0E6E0]">
                <span className="text-[9px] text-[#75837D] uppercase block">Assigned Tech</span>
                <span className="font-bold text-[#176B52] truncate block">{order.technician}</span>
              </div>
              <div className="p-2 rounded bg-[#F4F7F5] border border-[#E0E6E0]">
                <span className="text-[9px] text-[#75837D] uppercase block">
                  {order.completedAt ? "Completed At" : "Target Due Date"}
                </span>
                <span className="font-bold text-[#176B52]">{order.completedAt || order.scheduledDate}</span>
              </div>
            </div>

            {/* ROOT DEFECT & EVIDENCE */}
            <div className="space-y-2 pt-2">
              <div className="p-3 rounded bg-[#F4F7F5] border border-[#D2DDD5] space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#B94040] flex items-center gap-1.5">
                  <ShieldAlert size={13} /> Predicted Failure Mode & Suspected Issue:
                </span>
                <p className="text-[#202A27] text-xs font-semibold leading-relaxed">
                  {order.suspectedIssue}
                </p>
                <div className="text-[10px] text-[#75837D] pt-1">
                  Trigger Source: {order.source || "PredictX Prognostics Engine"}
                </div>
              </div>

              {/* RECOMMENDED INSPECTION PROCEDURES */}
              <div className="p-3 rounded bg-[#F4F7F5] border border-[#D2DDD5] space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-[#38BDF8] flex items-center gap-1.5">
                  <CheckSquare size={13} /> Required Physical Inspection Checklist:
                </span>
                <p className="text-[#384641] text-xs leading-relaxed">
                  {order.suggestedInspection}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-[#E0E6E0] text-[10px] text-[#68756F]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-[#176B52]" />
                    <span>Lockout / Tagout (LOTO) verified</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-[#176B52]" />
                    <span>Clearance measured with calibrated gauge</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-[#176B52]" />
                    <span>Telemetry transducer re-zeroed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="accent-[#176B52]" />
                    <span>Post-repair run test completed</span>
                  </label>
                </div>
              </div>

              {/* RESOLUTION & SIGN-OFF BLOCKS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded bg-[#F4F7F5] border border-[#E0E6E0] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[#75837D]">Field Notes & Parts Used:</span>
                  <div className="text-[11px] text-[#68756F] min-h-[40px]">
                    {order.resolutionNotes || "Awaiting technician site dispatch."}
                  </div>
                </div>

                <div className="p-3 rounded bg-[#F4F7F5] border border-[#E0E6E0] space-y-2">
                  <span className="text-[10px] uppercase font-bold text-[#75837D]">Technician Sign-Off:</span>
                  <div className="pt-4 border-b border-dashed border-[#829189] text-right text-[10px] text-[#829189]">
                    Signature & Date
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-[#E0E6E0] bg-[#F4F7F5] flex items-center justify-between text-xs">
          <span className="text-[10px] text-[#75837D]">DEV-P04 Draft Maintenance Work Order Standard</span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] text-[#202A27] text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
