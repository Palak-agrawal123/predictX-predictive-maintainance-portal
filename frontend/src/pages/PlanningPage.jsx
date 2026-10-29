import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarRange,
  List,
  Calendar,
  AlertTriangle,
  Clock,
  Plus,
  UserCheck,
  CheckCircle2
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';

export function PlanningPage() {
  const { workOrders, machines } = useAppData();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'
  const [modalOpen, setModalOpen] = useState(false);

  // Derive upcoming and overdue based on current mock date (2026-10-27)
  const todayStr = "2026-10-27";
  const overdueOrders = workOrders.filter(w => w.scheduledDate < todayStr && w.status !== 'Completed' && w.status !== 'Cancelled');
  const upcomingOrders = workOrders.filter(w => w.scheduledDate >= todayStr && w.status !== 'Completed' && w.status !== 'Cancelled');
  const completedOrders = workOrders.filter(w => w.status === 'Completed');

  // Days in calendar view (October 25 to November 07, 2026)
  const calendarDays = [
    { date: "2026-10-25", day: "25", label: "Sun" },
    { date: "2026-10-26", day: "26", label: "Mon" },
    { date: "2026-10-27", day: "27", label: "Tue", isToday: true },
    { date: "2026-10-28", day: "28", label: "Wed" },
    { date: "2026-10-29", day: "29", label: "Thu" },
    { date: "2026-10-30", day: "30", label: "Fri" },
    { date: "2026-10-31", day: "31", label: "Sat" },
    { date: "2026-11-01", day: "01", label: "Sun" },
    { date: "2026-11-02", day: "02", label: "Mon" },
    { date: "2026-11-03", day: "03", label: "Tue" },
    { date: "2026-11-04", day: "04", label: "Wed" },
    { date: "2026-11-05", day: "05", label: "Thu" },
    { date: "2026-11-06", day: "06", label: "Fri" },
    { date: "2026-11-07", day: "07", label: "Sat" },
  ];

  return (
    <Layout pageTitle="Planning & Scheduling Horizon">
      <div className="space-y-4 font-mono">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> DISPATCH PLANNING & MAINTENANCE TIMELINE
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              Work-order scheduling windows, overdue alerts, and technician allocations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#FFFFFF] border border-[#E0E6E0] rounded p-0.5 text-xs">
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === 'list' ? 'bg-[#E8EFEA] text-[#202A27] font-semibold' : 'text-[#68756F] hover:text-[#202A27]'
                }`}
              >
                <List size={14} /> List View
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
                  viewMode === 'calendar' ? 'bg-[#E8EFEA] text-[#202A27] font-semibold' : 'text-[#68756F] hover:text-[#202A27]'
                }`}
              >
                <Calendar size={14} /> Horizon View
              </button>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white text-xs font-semibold flex items-center gap-1.5"
            >
              <Plus size={14} /> Schedule Order
            </button>
          </div>
        </div>

        {/* STATUS METRIC CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-[#FFFFFF] border border-[#B94040]/30 rounded-lg">
            <div className="flex items-center justify-between text-[#B94040]">
              <span className="text-[11px] uppercase tracking-wider font-bold">Overdue Interventions</span>
              <AlertTriangle size={15} />
            </div>
            <div className="text-2xl font-bold text-[#202A27] mt-1">{overdueOrders.length}</div>
            <span className="text-[10px] text-[#75837D]">Past scheduled date</span>
          </div>

          <div className="p-3 bg-[#FFFFFF] border border-[#D99A24]/30 rounded-lg">
            <div className="flex items-center justify-between text-[#D99A24]">
              <span className="text-[11px] uppercase tracking-wider font-bold">Upcoming Scheduled</span>
              <Clock size={15} />
            </div>
            <div className="text-2xl font-bold text-[#202A27] mt-1">{upcomingOrders.length}</div>
            <span className="text-[10px] text-[#75837D]">Dispatched in horizon</span>
          </div>

          <div className="p-3 bg-[#FFFFFF] border border-[#27845C]/30 rounded-lg">
            <div className="flex items-center justify-between text-[#27845C]">
              <span className="text-[11px] uppercase tracking-wider font-bold">Completed & Cleared</span>
              <CheckCircle2 size={15} />
            </div>
            <div className="text-2xl font-bold text-[#202A27] mt-1">{completedOrders.length}</div>
            <span className="text-[10px] text-[#75837D]">Validated repairs</span>
          </div>
        </div>

        {/* TIMELINE / CALENDAR VIEW */}
        {viewMode === 'calendar' ? (
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E0E6E0]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#202A27]">
                Maintenance Horizon (October 25 – November 07, 2026)
              </span>
              <span className="text-[11px] text-[#176B52]">Current Plant Ref: 2026-10-27</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
              {calendarDays.map((d, i) => {
                const dayOrders = workOrders.filter(w => w.scheduledDate === d.date);
                return (
                  <div
                    key={i}
                    className={`min-h-[120px] p-2 rounded-lg border flex flex-col justify-between ${
                      d.isToday
                        ? 'bg-[#F4F7F5] border-[#176B52]'
                        : 'bg-[#FFFFFF] border-[#E0E6E0]'
                    }`}
                  >
                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-[#E0E6E0] text-[10px]">
                      <span className={d.isToday ? 'text-[#176B52] font-bold' : 'text-[#68756F]'}>{d.label}</span>
                      <span className={`px-1.5 py-0.2 rounded font-bold ${d.isToday ? 'bg-[#176B52] text-white' : 'text-[#202A27]'}`}>
                        {d.day}
                      </span>
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-24">
                      {dayOrders.map(wo => (
                        <div
                          key={wo.id}
                          onClick={() => navigate('/work-orders')}
                          className="p-1 rounded bg-[#F7FAF8] border border-[#E0E6E0] text-[10px] hover:border-[#176B52] cursor-pointer truncate"
                          title={`${wo.id}: ${wo.machineName} - ${wo.suspectedIssue}`}
                        >
                          <span className="font-bold text-[#176B52]">{wo.id}</span> {wo.machineId}
                        </div>
                      ))}
                    </div>

                    <div className="text-[9px] text-[#829189] text-right mt-1">
                      {dayOrders.length} task{dayOrders.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* LIST VIEW */
          <div className="space-y-4">
            {/* Overdue Section */}
            {overdueOrders.length > 0 && (
              <div className="bg-[#FFFFFF] border border-[#B94040]/30 rounded-lg p-4">
                <div className="flex items-center gap-2 pb-2 mb-3 border-b border-[#E0E6E0] text-[#B94040] font-bold text-xs uppercase">
                  <AlertTriangle size={15} /> Overdue Maintenance Tasks
                </div>
                <div className="space-y-2">
                  {overdueOrders.map(wo => (
                    <div key={wo.id} className="p-3 rounded bg-[#F7FAF8] border border-[#B94040]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#B94040]">{wo.id}</span>
                          <span className="text-[#202A27] font-semibold">{wo.machineName} ({wo.machineId})</span>
                          <StatusBadge status={wo.status} />
                        </div>
                        <p className="text-[#68756F] text-[11px] mt-1">{wo.suspectedIssue}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-[#B94040]">Due: {wo.scheduledDate}</span>
                        <button
                          onClick={() => navigate('/work-orders')}
                          className="px-2.5 py-1 rounded bg-[#E8EFEA] hover:bg-[#D2DDD5] text-[#202A27] text-[11px]"
                        >
                          Dispatch
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Section */}
            <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E0E6E0] text-xs font-bold uppercase text-[#202A27]">
                <span className="flex items-center gap-2">
                  <Clock size={15} className="text-[#176B52]" /> Upcoming Maintenance Queue
                </span>
                <span className="text-[11px] text-[#75837D]">{upcomingOrders.length} Planned Tasks</span>
              </div>
              <div className="space-y-2">
                {upcomingOrders.map(wo => (
                  <div key={wo.id} className="p-3 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:border-[#C2CFC6] transition-colors">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#176B52]">{wo.id}</span>
                        <span className="text-[#202A27] font-semibold">{wo.machineName}</span>
                        <PriorityBadge priority={wo.priority} />
                        <StatusBadge status={wo.status} />
                      </div>
                      <p className="text-[#68756F] text-[11px] mt-1">{wo.suggestedInspection}</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#68756F]">
                      <span className="flex items-center gap-1">
                        <UserCheck size={13} /> {wo.technician.split(' ')[0]}
                      </span>
                      <span>Date: <strong className="text-[#202A27]">{wo.scheduledDate}</strong></span>
                      <button
                        onClick={() => navigate(`/machines/${wo.machineId}`)}
                        className="px-2 py-1 rounded bg-[#FFFFFF] border border-[#E0E6E0] hover:bg-[#E8EFEA] text-[#202A27] text-[11px]"
                      >
                        Telemetry
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <WorkOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </Layout>
  );
}
