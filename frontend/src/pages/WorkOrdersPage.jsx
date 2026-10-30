import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Search,
  Plus,
  Clock,
  UserCheck,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Printer
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';
import { WorkOrderPrintModal } from '../components/work-orders/WorkOrderPrintModal';

export function WorkOrdersPage() {
  const { workOrders, updateWorkOrderStatus } = useAppData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOrder, setDetailModalOrder] = useState(null);
  const [printModalOrder, setPrintModalOrder] = useState(null);

  // Active and pending statuses only (Completed is tracked in Work Audits)
  const activeStatuses = ['Draft', 'Approved', 'In Progress', 'Cancelled'];
  const allWorkflowStatuses = ['Draft', 'Approved', 'In Progress', 'Completed', 'Cancelled'];

  // Work Orders table displays ONLY active/pending orders (not Completed)
  const activeWorkOrders = workOrders.filter(wo => wo.status?.toLowerCase() !== 'completed');

  const filteredOrders = activeWorkOrders.filter(wo => {
    const matchesSearch =
      wo.id.toLowerCase().includes(search.toLowerCase()) ||
      wo.machineId.toLowerCase().includes(search.toLowerCase()) ||
      wo.machineName.toLowerCase().includes(search.toLowerCase()) ||
      wo.technician.toLowerCase().includes(search.toLowerCase()) ||
      (wo.suspectedIssue && wo.suspectedIssue.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || wo.status?.toLowerCase() === statusFilter.toLowerCase();
    const matchesPriority = priorityFilter === 'ALL' || wo.priority.toLowerCase() === priorityFilter.toLowerCase();

    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <Layout pageTitle="Work Order Logistics">
      <div className="space-y-4 font-mono">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> ACTIVE MAINTENANCE WORK ORDERS
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              Draft, dispatch, and execute active maintenance tasks. Completed tasks are archived in{' '}
              <button
                onClick={() => navigate('/work-audits')}
                className="text-[#176B52] font-semibold underline hover:text-[#10543F]"
              >
                Work Audits
              </button>.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3.5 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus size={14} /> Create Work Order
          </button>
        </div>

        {/* METRIC COUNTERS (Active & Pending Statuses) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {activeStatuses.map(s => {
            const count = activeWorkOrders.filter(w => w.status?.toLowerCase() === s.toLowerCase()).length;
            return (
              <div
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  statusFilter === s
                    ? 'bg-[#F4F7F5] border-[#176B52] text-[#202A27]'
                    : 'bg-[#FFFFFF] border-[#E0E6E0] text-[#68756F] hover:border-[#C2CFC6]'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider">{s}</div>
                <div className="text-xl font-bold mt-1 text-[#202A27]">{count}</div>
              </div>
            );
          })}
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-6 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#68756F]" />
              <input
                type="text"
                placeholder="Search by WO#, machine, technician, defect..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded pl-8 pr-3 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none placeholder:text-[#829189]"
              />
            </div>
            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none"
              >
                <option value="ALL">Status: All Active</option>
                {activeStatuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none"
              >
                <option value="ALL">Priority: All</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* WORK ORDERS TABLE */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">WO Number</th>
                  <th className="py-3 px-4">Target Equipment</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Suspected Anomaly</th>
                  <th className="py-3 px-4">Assigned Tech</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4 text-right">Update Workflow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#68756F]">
                      No work orders matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(wo => (
                    <tr
                      key={wo.id}
                      onClick={() => setDetailModalOrder(wo)}
                      className="hover:bg-[#F4F7F5] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-bold text-[#176B52]">{wo.id}</td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#202A27]">{wo.machineId}</div>
                        <div className="text-[11px] text-[#75837D]">{wo.machineName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <PriorityBadge priority={wo.priority} />
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={wo.status} />
                      </td>
                      <td className="py-3 px-4 text-[#68756F] max-w-[220px] truncate">
                        {wo.suspectedIssue}
                      </td>
                      <td className="py-3 px-4 text-[#68756F]">{wo.technician}</td>
                      <td className="py-3 px-4 text-[#75837D]">{wo.scheduledDate}</td>
                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setPrintModalOrder(wo)}
                            title="Print Work Order Slip"
                            className="p-1 rounded bg-[#F4F7F5] hover:bg-[#E0E6E0] border border-[#E0E6E0] text-[#68756F] hover:text-[#176B52] transition-colors"
                          >
                            <Printer size={13} />
                          </button>
                          <select
                            value={wo.status}
                            onChange={(e) => updateWorkOrderStatus(wo.id, e.target.value)}
                            className="bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2 py-1 text-[11px] text-[#202A27] focus:border-[#176B52] focus:outline-none"
                          >
                            {allWorkflowStatuses.map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* WORK ORDER DETAIL DIALOG */}
      {detailModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono animate-fadeIn">
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs text-[#176B52] font-bold">{detailModalOrder.id}</span>
                <h3 className="text-sm font-bold text-[#202A27]">{detailModalOrder.machineName}</h3>
              </div>
              <StatusBadge status={detailModalOrder.status} />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#68756F] text-[11px] block uppercase">Suspected Anomaly:</span>
                <p className="text-[#202A27] bg-[#F4F7F5] p-2.5 rounded border border-[#D2DDD5] mt-1">
                  {detailModalOrder.suspectedIssue}
                </p>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase">Suggested Action Procedures:</span>
                <p className="text-[#202A27] bg-[#F4F7F5] p-2.5 rounded border border-[#D2DDD5] mt-1">
                  {detailModalOrder.suggestedInspection}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Assigned Technician</span>
                  <span className="text-[#202A27] font-semibold">{detailModalOrder.technician}</span>
                </div>
                <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <span className="text-[#75837D] text-[10px] block">Execution Date</span>
                  <span className="text-[#202A27] font-semibold">{detailModalOrder.scheduledDate}</span>
                </div>
              </div>

              <div>
                <span className="text-[#68756F] text-[11px] block uppercase">Log Notes:</span>
                <p className="text-[#68756F] text-[11px] mt-1">
                  {detailModalOrder.resolutionNotes || 'No notes logged.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-[#E0E6E0]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigate(`/machines/${detailModalOrder.machineId}`);
                    setDetailModalOrder(null);
                  }}
                  className="text-xs text-[#176B52] hover:underline"
                >
                  Telemetry Feed →
                </button>
                <button
                  onClick={() => {
                    setPrintModalOrder(detailModalOrder);
                    setDetailModalOrder(null);
                  }}
                  className="px-2.5 py-1 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] text-xs text-[#38BDF8] flex items-center gap-1 border border-[#D2DDD5]"
                >
                  <Printer size={12} /> Print Ticket
                </button>
              </div>
              <button
                onClick={() => setDetailModalOrder(null)}
                className="px-3 py-1.5 rounded bg-[#F7FAF8] hover:bg-[#DFE8E2] border border-[#E0E6E0] text-xs text-[#202A27]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <WorkOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <WorkOrderPrintModal
        order={printModalOrder}
        isOpen={Boolean(printModalOrder)}
        onClose={() => setPrintModalOrder(null)}
      />
    </Layout>
  );
}
