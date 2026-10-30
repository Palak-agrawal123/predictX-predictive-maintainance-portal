import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardCheck,
  Search,
  Printer,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Wrench,
  Sparkles
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge, StatCard } from '../components/common/UIComponents';
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
    <Layout pageTitle="Work Audits">
      <div className="space-y-6">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DFE4DD] gap-3">
          <div>
            <h1 className="text-base font-semibold text-[#202925]">
              Maintenance Work Audits
            </h1>
            <p className="text-xs text-[#68736C] mt-0.5">
              Verified records of completed interventions, technician sign-offs, and resolution logs
            </p>
          </div>
          <button
            onClick={() => navigate('/work-orders')}
            className="px-3 py-1.5 rounded-md bg-white hover:bg-[#F0F2ED] border border-[#DFE4DD] text-[#246B52] text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
          >
            <Wrench size={13} />
            <span>Active Work Orders</span>
          </button>
        </div>

        {/* METRIC COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <StatCard
            title="Completed Audits"
            value={completedOrders.length}
            icon={ClipboardCheck}
          />
          <StatCard
            title="Critical Resolved"
            value={urgentCount}
            icon={ShieldCheck}
          />
          <StatCard
            title="Routine PMs"
            value={routineCount}
            icon={CheckCircle2}
          />
          <StatCard
            title="Assets Serviced"
            value={uniqueMachines}
            icon={Sparkles}
          />
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-8 relative">
              <Search size={14} className="absolute left-3 top-2.5 text-[#68736C]" />
              <input
                type="text"
                placeholder="Search audit records by WO#, machine ID, technician, resolution notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#FAFBF9] border border-[#DFE4DD] rounded-md pl-9 pr-3 py-1.5 text-xs text-[#202925] focus:border-[#246B52] focus:outline-none placeholder:text-[#68736C]/60"
              />
            </div>
            <div className="md:col-span-4">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-[#FAFBF9] border border-[#DFE4DD] rounded-md px-3 py-1.5 text-xs text-[#202925] focus:border-[#246B52] focus:outline-none"
              >
                <option value="ALL">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* WORK AUDITS TABLE */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#FAFBF9] border-b border-[#DFE4DD] text-[#68736C] text-[11px] font-medium">
                  <th className="py-2.5 px-4">WO Number</th>
                  <th className="py-2.5 px-4">Equipment</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Technician</th>
                  <th className="py-2.5 px-4">Scheduled</th>
                  <th className="py-2.5 px-4">Completed At</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECE5]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 px-4 text-center">
                      <div className="max-w-md mx-auto space-y-2">
                        <div className="w-9 h-9 rounded-full bg-[#E8F0EA] text-[#246B52] flex items-center justify-center mx-auto">
                          <ClipboardCheck size={18} />
                        </div>
                        <h3 className="text-xs font-semibold text-[#202925]">No completed work audits found</h3>
                        <p className="text-[12px] text-[#68736C]">
                          {search || priorityFilter !== 'ALL'
                            ? 'No archived audit entries match current filter parameters.'
                            : 'When an active work order is completed and signed off, its audit records and resolution notes are preserved here.'}
                        </p>
                        {search || priorityFilter !== 'ALL' ? (
                          <button
                            onClick={() => { setSearch(''); setPriorityFilter('ALL'); }}
                            className="mt-2 text-xs text-[#246B52] font-medium hover:underline cursor-pointer"
                          >
                            Reset filters
                          </button>
                        ) : (
                          <button
                            onClick={() => navigate('/work-orders')}
                            className="mt-2 px-3 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Wrench size={12} />
                            <span>Active Work Orders</span>
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
                        className="hover:bg-[#FAFBF9] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4">
                          <div className="font-mono font-medium text-[#246B52] flex items-center gap-1.5">
                            <CheckCircle2 size={13} className="text-[#368363]" />
                            <span>{wo.id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-mono font-medium text-[#202925]">{wo.machineId}</div>
                          <div className="text-[11px] text-[#68736C] truncate max-w-[160px]">{wo.machineName}</div>
                        </td>
                        <td className="py-3 px-4">
                          <PriorityBadge priority={wo.priority} />
                        </td>
                        <td className="py-3 px-4 text-[#202925]">
                          <span>{wo.technician}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-[#68736C] text-[11px]">{wo.scheduledDate}</td>
                        <td className="py-3 px-4">
                          <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E8F0EA] border border-[#246B52]/20 text-[#246B52] font-mono text-[11px]">
                            <Clock size={11} />
                            <span>{completedTimestamp}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status="Completed" />
                        </td>
                        <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setPrintModalOrder(wo);
                              }}
                              title="Print Audit Slip"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white hover:bg-[#EAF3EC] border border-[#DFE4DD] hover:border-[#1F6E55] text-[#55635C] hover:text-[#176B52] transition-all shadow-2xs active:scale-95 cursor-pointer group"
                            >
                              <Printer size={13.5} strokeWidth={1.9} className="group-hover:scale-105 transition-transform" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDetailModalOrder(wo);
                              }}
                              title="View Audit Details"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white hover:bg-[#F5F7F5] border border-[#DFE4DD] hover:border-[#4B5E55] text-[#55635C] hover:text-[#18231E] transition-all shadow-2xs active:scale-95 cursor-pointer"
                            >
                              <FileText size={13.5} strokeWidth={1.8} />
                            </button>
                            <select
                              value={wo.status}
                              onChange={(e) => updateWorkOrderStatus(wo.id, e.target.value)}
                              title="Update status"
                              className="bg-[#FAFBF9] border border-[#DFE4DD] rounded px-2 py-1 text-[11px] text-[#202925] focus:border-[#246B52] focus:outline-none cursor-pointer"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-[#DFE4DD] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#DFE4DD]">
              <div>
                <div className="flex items-center gap-1.5 text-xs text-[#246B52] font-medium">
                  <ClipboardCheck size={14} />
                  <span>Audit Record {detailModalOrder.id}</span>
                </div>
                <h3 className="text-sm font-semibold text-[#202925] mt-0.5">{detailModalOrder.machineName}</h3>
              </div>
              <StatusBadge status="Completed" />
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-[#FAFBF9] border border-[#DFE4DD]">
                  <span className="text-[#68736C] text-[11px] block">Machine ID</span>
                  <span className="font-mono font-medium text-[#202925] mt-0.5 block">{detailModalOrder.machineId}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#FAFBF9] border border-[#DFE4DD]">
                  <span className="text-[#68736C] text-[11px] block">Priority Classification</span>
                  <div className="mt-1">
                    <PriorityBadge priority={detailModalOrder.priority} />
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[#68736C] text-[11px] block font-medium">Suspected Anomaly:</span>
                <p className="text-[#202925] bg-[#FAFBF9] p-2.5 rounded-lg border border-[#DFE4DD] mt-1 text-xs">
                  {detailModalOrder.suspectedIssue}
                </p>
              </div>

              <div>
                <span className="text-[#68736C] text-[11px] block font-medium">Intervention Checklist:</span>
                <p className="text-[#202925] bg-[#FAFBF9] p-2.5 rounded-lg border border-[#DFE4DD] mt-1 text-xs">
                  {detailModalOrder.suggestedInspection}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-lg bg-[#FAFBF9] border border-[#DFE4DD]">
                  <span className="text-[#68736C] text-[11px] block">Certified Technician</span>
                  <span className="text-[#202925] font-medium mt-0.5 block">{detailModalOrder.technician}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-[#E8F0EA] border border-[#246B52]/20">
                  <span className="text-[#246B52] text-[11px] block font-medium">Completed Timestamp</span>
                  <span className="font-mono font-medium text-[#246B52] mt-0.5 block">
                    {detailModalOrder.completedAt || `${detailModalOrder.scheduledDate} 14:30`}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[#68736C] text-[11px] block font-medium">Resolution Notes:</span>
                <p className="text-[#202925] bg-[#FAFBF9] p-2.5 rounded-lg border border-[#DFE4DD] text-xs mt-1">
                  {detailModalOrder.resolutionNotes || 'All preventive maintenance checks successfully verified and calibrated. Machine returned to full operational readiness.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#DFE4DD]">
              <button
                onClick={() => {
                  setPrintModalOrder(detailModalOrder);
                  setDetailModalOrder(null);
                }}
                className="px-3 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer size={13} />
                <span>Print Slip</span>
              </button>
              <button
                onClick={() => setDetailModalOrder(null)}
                className="px-3 py-1.5 rounded-md bg-white hover:bg-[#F0F2ED] border border-[#DFE4DD] text-[#202925] text-xs font-medium transition-colors cursor-pointer"
              >
                Close
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
