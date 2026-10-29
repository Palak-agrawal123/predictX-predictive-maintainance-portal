import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Search, Filter, Wrench, CheckCircle2, DollarSign, Clock, ArrowRight } from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { StatusBadge } from '../components/common/UIComponents';
import { initialMaintenanceHistory } from '../data/maintenanceHistory';

export function MaintenanceHistoryPage() {
  const navigate = useNavigate();
  const [historyList] = useState(initialMaintenanceHistory);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);

  const filtered = historyList.filter(item => {
    return (
      item.id.toLowerCase().includes(search.toLowerCase()) ||
      item.machineId.toLowerCase().includes(search.toLowerCase()) ||
      item.machineName.toLowerCase().includes(search.toLowerCase()) ||
      item.activityType.toLowerCase().includes(search.toLowerCase()) ||
      item.technician.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <Layout pageTitle="Maintenance Service Audit">
      <div className="space-y-4 font-mono">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> SERVICE AUDIT TRAIL & INTERVENTION LOGS
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              Historical repair records, parts replacement tracking, downtime auditing, and post-maintenance verification
            </p>
          </div>
          <div className="text-xs text-[#75837D]">
            Total Completed Audits: {historyList.length}
          </div>
        </div>

        {/* SEARCH BAR */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3 text-xs">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-2.5 text-[#68756F]" />
            <input
              type="text"
              placeholder="Search historical records by Machine ID, Technician, Work Order #, or Consumable..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded pl-8 pr-3 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none placeholder:text-[#829189]"
            />
          </div>
        </div>

        {/* LOGS TABLE */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Audit ID</th>
                  <th className="py-3 px-4">Origin WO</th>
                  <th className="py-3 px-4">Equipment Unit</th>
                  <th className="py-3 px-4">Intervention Executed</th>
                  <th className="py-3 px-4">Technician</th>
                  <th className="py-3 px-4">Date Completed</th>
                  <th className="py-3 px-4 text-center">Downtime</th>
                  <th className="py-3 px-4 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#68756F]">
                      No history available for the selected search query.
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="hover:bg-[#F4F7F5] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-[#176B52]">{item.id}</td>
                      <td className="py-3 px-4 text-[#68756F]">{item.workOrderId}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#202A27]">{item.machineId}</div>
                        <div className="text-[11px] text-[#75837D]">{item.machineName}</div>
                      </td>
                      <td className="py-3 px-4 text-[#202A27]">{item.activityType}</td>
                      <td className="py-3 px-4 text-[#68756F]">{item.technician}</td>
                      <td className="py-3 px-4 text-[#75837D]">{item.completedDate}</td>
                      <td className="py-3 px-4 text-center text-[#68756F]">{item.downtimeHours} hrs</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(item);
                          }}
                          className="px-2 py-1 rounded bg-[#F7FAF8] hover:bg-[#DFE8E2] text-[#202A27] text-[11px]"
                        >
                          View Audit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs text-[#176B52] font-bold">{selectedItem.id}</span>
                <h3 className="text-sm font-bold text-[#202A27]">{selectedItem.activityType}</h3>
              </div>
              <StatusBadge status={selectedItem.status} />
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Machine Asset</span>
                  <span className="text-[#202A27] font-semibold">{selectedItem.machineId} - {selectedItem.machineName}</span>
                </div>
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Associated Work Order</span>
                  <span className="text-[#202A27] font-semibold">{selectedItem.workOrderId}</span>
                </div>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase">Resolution & Sign-off Notes:</span>
                <p className="text-[#202A27] bg-[#F4F7F5] p-2.5 rounded border border-[#D2DDD5] mt-1 leading-relaxed">
                  {selectedItem.resolutionNotes}
                </p>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase">Parts Replaced:</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {selectedItem.partsReplaced?.map((part, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-[#F7FAF8] border border-[#E0E6E0] text-[#68756F] text-[11px]">
                      {part}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Technician</span>
                  <span className="text-[#202A27] font-semibold">{selectedItem.technician.split(' ')[0]}</span>
                </div>
                <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Downtime</span>
                  <span className="text-[#202A27] font-semibold">{selectedItem.downtimeHours} hrs</span>
                </div>
                <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Cost Est.</span>
                  <span className="text-[#27845C] font-semibold">{selectedItem.costEstimate}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E0E6E0]">
              <button
                onClick={() => {
                  navigate(`/machines/${selectedItem.machineId}`);
                  setSelectedItem(null);
                }}
                className="text-xs text-[#176B52] hover:underline flex items-center gap-1"
              >
                Inspect Equipment Feed <ArrowRight size={13} />
              </button>
              <button
                onClick={() => setSelectedItem(null)}
                className="px-3 py-1.5 rounded bg-[#F7FAF8] hover:bg-[#DFE8E2] border border-[#E0E6E0] text-xs text-[#202A27]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
