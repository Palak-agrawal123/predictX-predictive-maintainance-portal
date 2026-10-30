import React, { useEffect } from 'react';
import { X, Printer, Wrench, Calendar, CheckSquare, ShieldAlert, User, Cpu } from 'lucide-react';
import { PriorityBadge, StatusBadge } from '../common/UIComponents';

export function WorkOrderPrintModal({ order, workOrder, isOpen, onClose }) {
  const activeOrder = order || workOrder;

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !activeOrder) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-xs animate-fadeIn"
    >
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #print-work-order-slip, #print-work-order-slip * {
            visibility: visible !important;
          }
          #print-work-order-slip {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            height: auto !important;
            margin: 0 !important;
            padding: 24px !important;
            background: white !important;
            box-shadow: none !important;
            border: none !important;
            z-index: 99999 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        id="print-work-order-slip"
        onClick={(e) => e.stopPropagation()}
        className="bg-[#FFFFFF] border border-[#D2DDD5] rounded-xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl font-mono overflow-hidden"
      >
        {/* HEADER BAR */}
        <div className="px-5 py-3.5 border-b border-[#E0E6E0] flex items-center justify-between bg-[#F4F7F5] no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#176B52]/15 border border-[#176B52]/40 text-[#176B52] flex items-center justify-center shadow-2xs">
              <Printer size={16} strokeWidth={2} />
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
              className="px-3.5 py-1.5 bg-[#176B52] hover:bg-[#10543F] active:scale-95 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Printer size={13.5} strokeWidth={2} /> Print / Export PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#68756F] hover:text-[#202A27] hover:bg-[#E8EFEA] transition-colors cursor-pointer"
              title="Close modal"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* PRINTABLE TICKET BODY */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs bg-[#F4F6F3]">
          {/* TICKET TOP BANNER */}
          <div className="border-2 border-dashed border-[#D2DDD5] rounded-lg p-5 bg-[#F4F7F5] space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3.5 border-b border-[#E0E6E0] gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-[#75837D] font-bold">PLANT MAINTENANCE DISPATCH SLIP</div>
                <div className="text-2xl font-bold text-[#176B52] tracking-tight">{activeOrder.id}</div>
                <div className="text-[10px] text-[#68756F]">Generated via PredictX Industrial Engine</div>
              </div>

              <div className="flex flex-col items-start sm:items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#68756F]">Priority:</span>
                  <PriorityBadge priority={activeOrder.priority} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[#68756F]">Status:</span>
                  <StatusBadge status={activeOrder.status} />
                </div>
              </div>
            </div>

            {/* BARCODE REPRESENTATION */}
            <div className="py-1.5 text-center font-mono tracking-[0.4em] text-[10px] text-[#829189] select-none border-y border-[#E0E6E0]">
              ||| | ||||| || |||||| | ||||| ||| |||| | ||| ||||||| {activeOrder.id}
            </div>

            {/* ASSET SPECIFICATION */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] pt-1">
              <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E0E6E0] shadow-2xs">
                <span className="text-[9px] text-[#75837D] uppercase block font-semibold">Asset ID</span>
                <span className="font-bold text-[#202A27]">{activeOrder.machineId || "N/A"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E0E6E0] shadow-2xs">
                <span className="text-[9px] text-[#75837D] uppercase block font-semibold">Asset Name</span>
                <span className="font-bold text-[#202A27] truncate block">{activeOrder.machineName || activeOrder.machineId || "Plant Equipment"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E0E6E0] shadow-2xs">
                <span className="text-[9px] text-[#75837D] uppercase block font-semibold">Assigned Tech</span>
                <span className="font-bold text-[#176B52] truncate block">{activeOrder.technician || "Unassigned"}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#FFFFFF] border border-[#E0E6E0] shadow-2xs">
                <span className="text-[9px] text-[#75837D] uppercase block font-semibold">
                  {activeOrder.completedAt ? "Completed At" : "Target Due Date"}
                </span>
                <span className="font-bold text-[#176B52]">{activeOrder.completedAt || activeOrder.scheduledDate || "Standard Shift"}</span>
              </div>
            </div>

            {/* ROOT DEFECT & EVIDENCE */}
            <div className="space-y-2.5 pt-2">
              <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#D2DDD5] space-y-1 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-[#B94040] flex items-center gap-1.5">
                  <ShieldAlert size={13} /> Predicted Failure Mode & Suspected Issue:
                </span>
                <p className="text-[#202A27] text-xs font-semibold leading-relaxed">
                  {activeOrder.suspectedIssue || activeOrder.title || "Routine preventive equipment maintenance."}
                </p>
                <div className="text-[10px] text-[#75837D] pt-1">
                  Trigger Source: {activeOrder.source || "PredictX Prognostics Engine"}
                </div>
              </div>

              {/* RECOMMENDED INSPECTION PROCEDURES */}
              <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#D2DDD5] space-y-2 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-[#0284C7] flex items-center gap-1.5">
                  <CheckSquare size={13} /> Required Physical Inspection Checklist:
                </span>
                <p className="text-[#384641] text-xs leading-relaxed">
                  {activeOrder.suggestedInspection || activeOrder.description || "Perform standard operational check and vibration sweep."}
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
                <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#E0E6E0] space-y-1 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-[#75837D]">Field Notes & Parts Used:</span>
                  <div className="text-[11px] text-[#68756F] min-h-[40px]">
                    {activeOrder.resolutionNotes || "Awaiting technician site dispatch."}
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#FFFFFF] border border-[#E0E6E0] space-y-2 shadow-2xs">
                  <span className="text-[10px] uppercase font-bold text-[#75837D]">Technician Sign-Off:</span>
                  <div className="pt-5 border-b border-dashed border-[#829189] text-right text-[10px] text-[#829189]">
                    Signature & Date
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="px-5 py-3 border-t border-[#E0E6E0] bg-[#F4F7F5] flex items-center justify-between text-xs no-print">
          <span className="text-[10px] text-[#75837D]">DEV-P04 Draft Maintenance Work Order Standard</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#E8EFEA] hover:bg-[#D5E0D9] text-[#202A27] text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
export default WorkOrderPrintModal;
