import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Plus,
  Printer,
  X
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

  const activeStatuses = ['Draft', 'Approved', 'In Progress', 'Cancelled'];
  const allWorkflowStatuses = ['Draft', 'Approved', 'In Progress', 'Completed', 'Cancelled'];

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
    <Layout pageTitle="Work Orders">
      <div className="space-y-4">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DFE4DD] gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#202925]">Active Work Orders</h2>
            <p className="text-xs text-[#68736C] mt-0.5">
              Dispatch, track, and execute pending maintenance interventions.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="px-3 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
          >
            <Plus size={14} /> Create Work Order
          </button>
        </div>

        {/* METRIC COUNTERS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {activeStatuses.map(s => {
            const count = activeWorkOrders.filter(w => w.status?.toLowerCase() === s.toLowerCase()).length;
            const isSelected = statusFilter === s;
            return (
              <div
                key={s}
                onClick={() => setStatusFilter(statusFilter === s ? 'ALL' : s)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-[#E8F0EA] border-[#D1E1D5] text-[#246B52]'
                    : 'bg-white border-[#DFE4DD] text-[#68736C] hover:border-[#C2CDC0]'
                }`}
              >
                <div className="text-[11px] font-medium text-[#68736C]">{s}</div>
                <div className="text-xl font-semibold font-mono mt-1 text-[#202925]">{count}</div>
              </div>
            );
          })}
        </div>

        {/* SEARCH & FILTERS */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="md:col-span-6 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#68736C]" />
              <input
                type="text"
                placeholder="Search by WO#, machine, technician, or issue..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md pl-8 pr-3 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none placeholder:text-[#85918A]"
              />
            </div>
            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md px-2.5 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Active Statuses</option>
                {activeStatuses.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md px-2.5 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none"
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

        {/* WORK ORDERS TABLE */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7ECE5] text-[#68736C] text-[11px] font-medium bg-[#FAFCFA]">
                  <th className="py-2.5 px-3">WO Number</th>
                  <th className="py-2.5 px-3">Equipment</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3">Assigned Tech</th>
                  <th className="py-2.5 px-3">Scheduled Date</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECE5]">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#68736C]">
                      No active work orders match your filters.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(wo => (
                    <tr
                      key={wo.id}
                      onClick={() => setDetailModalOrder(wo)}
                      className="hover:bg-[#F5F6F2] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#246B52]">{wo.id}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#202925]">{wo.machineId}</div>
                        <div className="text-[11px] text-[#68736C]">{wo.machineName}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        <PriorityBadge priority={wo.priority} />
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusBadge status={wo.status} />
                      </td>
                      <td className="py-2.5 px-3 text-[#68736C] max-w-[220px] truncate" title={wo.suspectedIssue}>
                        {wo.suspectedIssue}
                      </td>
                      <td className="py-2.5 px-3 text-[#202925]">{wo.technician}</td>
                      <td className="py-2.5 px-3 text-[#68736C] font-mono">{wo.scheduledDate}</td>
                      <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintModalOrder(wo);
                            }}
                            title="Print Work Order Slip"
                            className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white hover:bg-[#EAF3EC] border border-[#DFE4DD] hover:border-[#1F6E55] text-[#55635C] hover:text-[#176B52] transition-all shadow-2xs active:scale-95 cursor-pointer group"
                          >
                            <Printer size={13.5} strokeWidth={1.9} className="group-hover:scale-105 transition-transform" />
                          </button>
                          <select
                            value={wo.status}
                            onChange={(e) => updateWorkOrderStatus(wo.id, e.target.value)}
                            className="bg-white border border-[#DFE4DD] rounded px-2 py-0.5 text-[11px] font-medium text-[#202925] focus:border-[#246B52] focus:outline-none"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white border border-[#DFE4DD] rounded-xl max-w-lg w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E7ECE5]">
              <div>
                <span className="font-mono text-xs text-[#246B52] font-semibold">{detailModalOrder.id}</span>
                <h3 className="text-sm font-semibold text-[#202925]">{detailModalOrder.machineName}</h3>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={detailModalOrder.status} />
                <button
                  onClick={() => setDetailModalOrder(null)}
                  className="p-1 text-[#68736C] hover:text-[#202925] rounded"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[#68736C] text-[11px] block font-medium">Issue Summary:</span>
                <p className="text-[#202925] bg-[#F5F6F2] p-2.5 rounded-md border border-[#DFE4DD] mt-1">
                  {detailModalOrder.suspectedIssue}
                </p>
              </div>

              <div>
                <span className="text-[#68736C] text-[11px] block font-medium">Procedures & Scope:</span>
                <p className="text-[#202925] bg-[#F5F6F2] p-2.5 rounded-md border border-[#DFE4DD] mt-1">
                  {detailModalOrder.suggestedInspection}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD]">
                  <span className="text-[#85918A] text-[10px] block font-medium">Technician</span>
                  <span className="text-[#202925] font-medium">{detailModalOrder.technician}</span>
                </div>
                <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD]">
                  <span className="text-[#85918A] text-[10px] block font-medium">Scheduled Date</span>
                  <span className="text-[#202925] font-mono">{detailModalOrder.scheduledDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#E7ECE5]">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[#68736C]">Change status:</span>
                  <select
                    value={detailModalOrder.status}
                    onChange={(e) => {
                      updateWorkOrderStatus(detailModalOrder.id, e.target.value);
                      setDetailModalOrder(prev => ({ ...prev, status: e.target.value }));
                    }}
                    className="bg-white border border-[#DFE4DD] rounded px-2 py-1 text-xs text-[#202925]"
                  >
                    {allWorkflowStatuses.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    setPrintModalOrder(detailModalOrder);
                    setDetailModalOrder(null);
                  }}
                  className="px-3 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <Printer size={13} /> Print Slip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <WorkOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />

      <WorkOrderPrintModal
        isOpen={Boolean(printModalOrder)}
        onClose={() => setPrintModalOrder(null)}
        order={printModalOrder}
        workOrder={printModalOrder}
      />
    </Layout>
  );
}
