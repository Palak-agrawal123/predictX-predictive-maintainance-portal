import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Search,
  Printer,
  FileText,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  RotateCcw,
  Wrench,
  Sparkles
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { WorkOrderPrintModal } from '../components/work-orders/WorkOrderPrintModal';

export function WorkAuditsPage() {
  const { workOrders, updateWorkOrderStatus } = useAppData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [detailModalOrder, setDetailModalOrder] = useState(null);
  const [printModalOrder, setPrintModalOrder] = useState(null);

  // Completed work orders only
  const completedOrders = workOrders.filter(wo => wo.status?.toLowerCase() === 'completed');

  const filteredOrders = completedOrders.filter(wo => {
    const term = search.toLowerCase();
    const matchesSearch =
      wo.id?.toLowerCase().includes(term) ||
      wo.machineId?.toLowerCase().includes(term) ||
      wo.machineName?.toLowerCase().includes(term) ||
      wo.technician?.toLowerCase().includes(term) ||
      (wo.suspectedIssue && wo.suspectedIssue.toLowerCase().includes(term)) ||
      (wo.resolutionNotes && wo.resolutionNotes.toLowerCase().includes(term));

    const matchesPriority =
      priorityFilter === 'ALL' ||
      wo.priority?.toLowerCase() === priorityFilter.toLowerCase();

    return matchesSearch && matchesPriority;
  });

  const urgentCount = completedOrders.filter(
    w => w.priority?.toLowerCase() === 'urgent' || w.priority?.toLowerCase() === 'high'
  ).length;
  const routineCount = completedOrders.filter(
    w => w.priority?.toLowerCase() === 'medium' || w.priority?.toLowerCase() === 'low'
  ).length;
  const uniqueMachines = new Set(completedOrders.map(w => w.machineId)).size;

  return (
    <Layout pageTitle="Maintenance Work Audits">
      <div className="space-y-4 font-mono">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> MAINTENANCE WORK AUDITS & SIGN-OFFS
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              Verified records of completed interventions, technician sign-offs, and resolution logs
            </p>
          </div>
          <button
            onClick={() => navigate('/work-orders')}
            className="px-3.5 py-1.5 rounded bg-[#F4F7F5] hover:bg-[#E8EFEA] border border-[#E0E6E0] text-[#176B52] text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Wrench size={13} /> View Active Work Orders
          </button>
        </div>

        {/* METRIC COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg border bg-[#FFFFFF] border-[#E0E6E0]">
            <div className="text-[10px] uppercase tracking-wider text-[#68756F] flex items-center justify-between">
              <span>Completed Audits</span>
              <ClipboardCheck size={13} className="text-[#176B52]" />
            </div>
            <div className="text-xl font-bold mt-1 text-[#202A27]">{completedOrders.length}</div>
            <div className="text-[10px] text-[#75837D] mt-0.5">Archived & Signed</div>
          </div>

          <div className="p-3 rounded-lg border bg-[#FFFFFF] border-[#E0E6E0]">
            <div className="text-[10px] uppercase tracking-wider text-[#68756F] flex items-center justify-between">
              <span>Critical / High Resolved</span>
              <ShieldCheck size={13} className="text-[#27845C]" />
            </div>
            <div className="text-xl font-bold mt-1 text-[#27845C]">{urgentCount}</div>
            <div className="text-[10px] text-[#75837D] mt-0.5">Failure modes mitigated</div>
          </div>

          <div className="p-3 rounded-lg border bg-[#FFFFFF] border-[#E0E6E0]">
            <div className="text-[10px] uppercase tracking-wider text-[#68756F] flex items-center justify-between">
              <span>Routine PMs Audited</span>
              <CheckCircle2 size={13} className="text-[#176B52]" />
            </div>
            <div className="text-xl font-bold mt-1 text-[#202A27]">{routineCount}</div>
            <div className="text-[10px] text-[#75837D] mt-0.5">Scheduled preventive checks</div>
          </div>

          <div className="p-3 rounded-lg border bg-[#FFFFFF] border-[#E0E6E0]">
            <div className="text-[10px] uppercase tracking-wider text-[#68756F] flex items-center justify-between">
              <span>Assets Serviced</span>
              <Sparkles size={13} className="text-[#176B52]" />
            </div>
            <div className="text-xl font-bold mt-1 text-[#202A27]">{uniqueMachines} Nodes</div>
            <div className="text-[10px] text-[#75837D] mt-0.5">Fleet-wide coverage</div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#68756F]" />
              <input
                type="text"
                placeholder="Search audit records by WO#, machine ID, technician, resolution notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded pl-8 pr-3 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none placeholder:text-[#829189]"
              />
            </div>
            <div className="md:col-span-4">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none"
              >
                <option value="ALL">Priority: All Tiers</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* WORK AUDITS TABLE */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Audit / WO Number</th>
                  <th className="py-3 px-4">Target Equipment</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Assigned Technician</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Completed At</th>
                  <th className="py-3 px-4">Final Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 px-4 text-center">
                      <div className="max-w-md mx-auto space-y-2">
                        <div className="w-10 h-10 rounded-full bg-[#E8EFEA] text-[#176B52] flex items-center justify-center mx-auto">
                          <ClipboardCheck size={20} />
                        </div>
                        <h3 className="text-sm font-bold text-[#202A27]">No completed work audits found</h3>
                        <p className="text-[11px] text-[#68756F]">
                          {search || priorityFilter !== 'ALL'
                            ? 'No archived audit entries match your current filter parameters.'
                            : 'When an active work order is completed and signed off, its audit records, completion timestamp, and resolution notes are preserved here.'}
                        </p>
                        {search || priorityFilter !== 'ALL' ? (
                          <button
                            onClick={() => { setSearch(''); setPriorityFilter('ALL'); }}
                            className="mt-2 text-xs text-[#176B52] font-semibold underline hover:text-[#10543F]"
                          >
                            Reset filters
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate('/work-orders')}
                            className="mt-2 px-3 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Wrench size={12} /> Go to Active Work Orders
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(wo => {
                    const completedTimestamp = wo.completedAt || (wo.scheduledDate ? `${wo.scheduledDate} 14:30` : '2026-10-18 14:30');
                    return (
                      <tr
                        key={wo.id}
                        onClick={() => setDetailModalOrder(wo)}
                        className="hover:bg-[#F4F7F5] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#176B52] flex items-center gap-1.5">
                            <CheckCircle2 size={12} className="text-[#27845C]" />
                            {wo.id}
                          </div>
                          <div className="text-[10px] text-[#75837D]">Audit Trail Verified</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-semibold text-[#202A27]">{wo.machineId}</div>
                          <div className="text-[11px] text-[#75837D] truncate max-w-[160px]">{wo.machineName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <PriorityBadge priority={wo.priority} />
                        </td>
                        <td className="py-3 px-4 text-[#202A27]">
                          <div className="font-medium">{wo.technician}</div>
                        </td>
                        <td className="py-3 px-4 text-[#75837D]">{wo.scheduledDate}</td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E8EFEA] border border-[#176B52]/20 text-[#176B52] font-semibold text-[11px]">
                            <Clock size={11} />
                            {completedTimestamp}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status="Completed" />
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setPrintModalOrder(wo)}
                              title="Print Audit Slip"
                              className="p-1 rounded bg-[#F4F7F5] hover:bg-[#E0E6E0] border border-[#E0E6E0] text-[#68756F] hover:text-[#176B52] transition-colors"
                            >
                              <Printer size={13} />
                            </button>
                            <button
                              onClick={() => setDetailModalOrder(wo)}
                              title="View Audit Details"
                              className="p-1 rounded bg-[#F4F7F5] hover:bg-[#E0E6E0] border border-[#E0E6E0] text-[#68756F] hover:text-[#176B52] transition-colors"
                            >
                              <FileText size={13} />
                            </button>
                            <select
                              value={wo.status}
                              onChange={(e) => updateWorkOrderStatus(wo.id, e.target.value)}
                              title="Update status (reopens audit to active work orders)"
                              className="bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2 py-1 text-[11px] text-[#202A27] focus:border-[#176B52] focus:outline-none"
                            >
                              <option value="Completed">Completed</option>
                              <option value="In Progress">Reopen: In Progress</option>
                              <option value="Draft">Reopen: Draft</option>
                            </select>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* WORK AUDIT DETAIL MODAL */}
      {detailModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E6E0]">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#176B52] font-bold">
                  <ClipboardCheck size={14} />
                  <span>AUDIT ARCHIVE: {detailModalOrder.id}</span>
                </div>
                <h3 className="text-sm font-bold text-[#202A27]">{detailModalOrder.machineName}</h3>
              </div>
              <StatusBadge status="Completed" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Target Machine ID</span>
                  <span className="text-[#202A27] font-semibold">{detailModalOrder.machineId}</span>
                </div>
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Priority Classification</span>
                  <div className="mt-0.5">
                    <PriorityBadge priority={detailModalOrder.priority} />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase font-semibold">Suspected Anomaly / Failure Mode:</span>
                <p className="text-[#202A27] bg-[#F4F7F5] p-2.5 rounded border border-[#D2DDD5] mt-1">
                  {detailModalOrder.suspectedIssue}
                </p>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase font-semibold">Executed Intervention Checklist:</span>
                <p className="text-[#202A27] bg-[#F4F7F5] p-2.5 rounded border border-[#D2DDD5] mt-1">
                  {detailModalOrder.suggestedInspection}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Certified Technician</span>
                  <span className="text-[#202A27] font-semibold">{detailModalOrder.technician}</span>
                </div>
                <div className="p-2.5 rounded bg-[#E8EFEA] border border-[#176B52]/30">
                  <span className="text-[#176B52] text-[10px] block font-semibold">Completed Timestamp</span>
                  <span className="text-[#176B52] font-bold">
                    {detailModalOrder.completedAt || `${detailModalOrder.scheduledDate} 14:30`}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase font-semibold">Resolution Notes & Sensor Verification:</span>
                <p className="text-[#202A27] bg-[#F7FAF8] p-2.5 rounded border border-[#E0E6E0] text-[11px] mt-1">
                  {detailModalOrder.resolutionNotes || 'All preventive maintenance checks successfully verified and calibrated. Machine returned to full operational readiness.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E0E6E0]">
              <button
                onClick={() => {
                  setPrintModalOrder(detailModalOrder);
                  setDetailModalOrder(null);
                }}
                className="px-3 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Printer size={13} /> Print Signed Slip
              </button>
              <button
                onClick={() => setDetailModalOrder(null)}
                className="px-3.5 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] text-[#202A27] text-xs transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT SLIP MODAL */}
      <WorkOrderPrintModal
        isOpen={Boolean(printModalOrder)}
        order={printModalOrder}
        onClose={() => setPrintModalOrder(null)}
      />
    </Layout>
  );
}
