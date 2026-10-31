import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Layers,
  SlidersHorizontal,
  Wrench,
  ClipboardCheck,
  Activity,
  UserCheck,
  Bell,
  RefreshCw,
  Menu,
  X,
  Clock,
  Sparkles,
  CheckCheck,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Radio
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { ToastContainer } from '../common/Toast';
import { GuidedDemoModal } from '../demo/GuidedDemoModal';

export function Layout({ children, pageTitle = "Overview" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const [activeFilter, setActiveFilter] = useState('ALL');
  const {
    alerts,
    markAlertAsRead,
    markAllAlertsAsRead,
    deleteAlert,
    clearReadAlerts,
    resetAllDemoData,
    pendingReviewsCount = 0,
    backendStatus,
    refreshData,
    isLoading
  } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadAlerts = alerts.filter(a => !a.read);

  const filteredAlerts = alerts.filter(a => {
    if (activeFilter === 'UNREAD') return !a.read;
    if (activeFilter === 'CRITICAL') return a.severity === 'Critical' || a.severity === 'CRITICAL';
    if (activeFilter === 'WORK_ORDER') return a.category === 'WORK_ORDER' || a.category === 'MAINTENANCE';
    return true;
  });

  const navigationSections = [
    {
      title: "Operations",
      items: [
        { to: "/dashboard", label: "Fleet Overview", icon: LayoutGrid },
        { to: "/sensor-simulator", label: "Sensor Simulator", icon: Radio, badge: "LIVE", badgeColor: "bg-[#246B52] text-white font-semibold text-[10px] px-1.5 py-0.5 rounded-full shadow-xs" },
        { to: "/machines", label: "Machine Fleet", icon: Layers },
        { to: "/maintenance-priority", label: "Priority Decision", icon: SlidersHorizontal }
      ]
    },
    {
      title: "Maintenance",
      items: [
        { to: "/work-orders", label: "Work Orders", icon: Wrench },
        { to: "/work-audits", label: "Work Audits", icon: ClipboardCheck }
      ]
    },
    {
      title: "Intelligence",
      items: [
        {
          to: "/reviews",
          label: "Human Review",
          icon: UserCheck,
          badge: pendingReviewsCount > 0 ? pendingReviewsCount : null,
          badgeColor: 'bg-[#B98232] text-white'
        },
        { to: "/predictions", label: "Models & Evaluation", icon: Activity }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#F5F6F2] text-[#202925] flex antialiased selection:bg-[#246B52] selection:text-white">
      <ToastContainer />

      {/* MOBILE TOPBAR */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#DFE4DD] px-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-7 h-7 rounded-lg bg-[#246B52] flex items-center justify-center text-white shadow-xs">
            <Activity size={16} strokeWidth={2.4} />
          </div>
          <span className="font-bold tracking-tight text-[16px] text-[#151D19]">
            Predict<span className="text-[#246B52]">X</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 text-[#68736C] hover:text-[#202925] relative rounded hover:bg-[#F5F6F2]"
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={1.75} />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B74747]" />
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#68736C] hover:text-[#202925] rounded hover:bg-[#F5F6F2]"
            aria-label="Toggle Navigation"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`
        fixed md:sticky top-0 h-screen w-60 bg-[#F0F2ED] border-r border-[#DFE4DD] flex flex-col justify-between z-30 transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Identity */}
          <div className="h-[72px] min-h-[72px] px-5 border-b border-[#DFE4DD] flex items-center justify-between">
            <NavLink to="/dashboard" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-[#246B52] flex items-center justify-center text-white shadow-xs">
                <Activity size={17} strokeWidth={2.4} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[17px] tracking-tight text-[#151D19] leading-tight">
                  Predict<span className="text-[#246B52]">X</span>
                </span>
                <span className="text-[11.5px] font-normal text-[#5C6A63] tracking-normal leading-tight">Fleet Intelligence</span>
              </div>
            </NavLink>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
            {navigationSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <div className="px-3 pt-2.5 pb-1.5 text-[13px] font-bold uppercase tracking-[0.65px] text-[#28362F] select-none">
                  {sec.title}
                </div>
                {sec.items.map(item => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.to || (item.to !== '/dashboard' && location.pathname.startsWith(item.to));
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-lg text-[14px] leading-snug transition-colors group select-none
                        ${isActive
                          ? 'bg-[#E2EDE4] text-[#1D634B] font-semibold shadow-2xs'
                          : 'text-[#47544E] font-medium hover:text-[#18231E] hover:bg-[#E5ECE3]'}
                      `}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon size={17} strokeWidth={isActive ? 2.1 : 1.8} className={`flex-shrink-0 ${isActive ? 'text-[#1D634B]' : 'text-[#5A6760] group-hover:text-[#18231E]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge !== null && (
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono font-medium ${item.badgeColor || 'bg-[#E2EDE4] text-[#1D634B]'}`}>
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Quiet Footer */}
          <div className="p-3 border-t border-[#DFE4DD] bg-[#ECEFE9]/60">
            <button
              onClick={resetAllDemoData}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-white hover:bg-[#F5F6F2] border border-[#DFE4DD] text-[#55635C] hover:text-[#18231E] text-xs font-medium transition-colors shadow-2xs"
              title="Reset data to baseline"
            >
              <RefreshCw size={13} strokeWidth={1.8} /> Reset Local Data
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 bg-[#F5F6F2]">
        {/* TOP HEADER */}
        <header className="h-[72px] min-h-[72px] bg-white border-b border-[#DFE4DD] px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-[#151D19]">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            {/* Launch Guided Demo */}
            <button
              onClick={() => setDemoModalOpen(true)}
              className="h-9 px-3.5 rounded-lg bg-[#246B52] hover:bg-[#1B5440] active:scale-95 text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles size={13} strokeWidth={2} />
              <span className="hidden sm:inline">Guided Demo</span>
              <span className="sm:hidden">Demo</span>
            </button>

            {/* Sync Live Data */}
            <button
              onClick={() => refreshData(true)}
              disabled={isLoading}
              className="w-9 h-9 rounded-lg border border-[#DFE4DD] bg-white hover:bg-[#F5F7F5] hover:border-[#C2CDC0] active:scale-95 text-[#55635C] hover:text-[#1E2B25] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
              title="Sync live data"
              aria-label="Sync live data"
            >
              <RefreshCw size={14} strokeWidth={1.8} className={isLoading ? 'animate-spin text-[#246B52]' : ''} />
            </button>

            {/* Clock Pill */}
            <div className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[#F5F7F5] border border-[#E2E8E2] text-[#4F5E57] text-[11px] font-mono tracking-tight shadow-2xs select-none">
              <Clock size={12} strokeWidth={2} className="text-[#6D7D75]" />
              <span className="font-semibold text-[#202925]">{currentTime}</span>
            </div>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="w-9 h-9 rounded-lg border border-[#DFE4DD] bg-white hover:bg-[#F5F7F5] hover:border-[#C2CDC0] active:scale-95 text-[#55635C] hover:text-[#1E2B25] flex items-center justify-center transition-all shadow-2xs relative cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell size={15} strokeWidth={1.8} />
                {unreadAlerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#D93838] ring-2 ring-white animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <>
                  {/* Backdrop to close on click outside */}
                  <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setNotificationsOpen(false)}
                  />

                  <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white border border-[#DFE4DD] rounded-xl shadow-xl z-50 overflow-hidden animate-fadeIn flex flex-col font-sans">
                    {/* DROPDOWN TOP BAR */}
                    <div className="px-3.5 py-2.5 bg-[#FAFBF9] border-b border-[#E7ECE5] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#151D19]">
                          Notifications
                        </span>
                        {unreadAlerts.length > 0 ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-[#D93838]/10 text-[#D93838] border border-[#D93838]/20">
                            {unreadAlerts.length} new
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono text-[#5C6A63] bg-[#E8ECE7]">
                            {alerts.length} total
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {unreadAlerts.length > 0 && (
                          <button
                            onClick={markAllAlertsAsRead}
                            className="text-[11px] text-[#176B52] hover:text-[#0F4E3A] font-medium flex items-center gap-1 hover:underline cursor-pointer"
                            title="Mark all notifications as read"
                          >
                            <CheckCheck size={12} /> Mark read
                          </button>
                        )}
                        <button
                          onClick={() => setNotificationsOpen(false)}
                          className="text-[#68736C] hover:text-[#151D19] p-0.5 rounded transition-colors cursor-pointer"
                          aria-label="Close notifications"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* COMPACT FILTER TABS */}
                    <div className="flex items-center gap-1 px-3 py-1.5 bg-white border-b border-[#E7ECE5] text-[11px] overflow-x-auto">
                      <button
                        onClick={() => setActiveFilter('ALL')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          activeFilter === 'ALL'
                            ? 'bg-[#E3EDE5] text-[#1D634B] font-semibold'
                            : 'text-[#68736C] hover:text-[#151D19] hover:bg-[#F0F2ED]'
                        }`}
                      >
                        All ({alerts.length})
                      </button>
                      <button
                        onClick={() => setActiveFilter('UNREAD')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          activeFilter === 'UNREAD'
                            ? 'bg-[#E3EDE5] text-[#1D634B] font-semibold'
                            : 'text-[#68736C] hover:text-[#151D19] hover:bg-[#F0F2ED]'
                        }`}
                      >
                        Unread ({unreadAlerts.length})
                      </button>
                      <button
                        onClick={() => setActiveFilter('CRITICAL')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          activeFilter === 'CRITICAL'
                            ? 'bg-[#FDF2F2] text-[#B91C1C] font-semibold'
                            : 'text-[#68736C] hover:text-[#151D19] hover:bg-[#F0F2ED]'
                        }`}
                      >
                        Critical
                      </button>
                      <button
                        onClick={() => setActiveFilter('WORK_ORDER')}
                        className={`px-2 py-0.5 rounded-md font-medium transition-colors cursor-pointer ${
                          activeFilter === 'WORK_ORDER'
                            ? 'bg-[#E3EDE5] text-[#1D634B] font-semibold'
                            : 'text-[#68736C] hover:text-[#151D19] hover:bg-[#F0F2ED]'
                        }`}
                      >
                        Work Orders
                      </button>
                    </div>

                    {/* NOTIFICATION CARDS LIST */}
                    <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto bg-[#F9FAF8]">
                      {filteredAlerts.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#68736C] space-y-1">
                          <CheckCircle2 size={24} className="mx-auto text-[#176B52]/60" />
                          <p className="font-semibold text-[#151D19]">No alerts to display</p>
                          <p className="text-[11px]">All plant systems operating within normal parameters.</p>
                        </div>
                      ) : (
                        filteredAlerts.map(alert => {
                          const isCrit = alert.severity === 'Critical' || alert.severity === 'CRITICAL';
                          const isWarn = alert.severity === 'Warning' || alert.severity === 'WARNING';
                          const isSucc = alert.severity === 'Success' || alert.severity === 'SUCCESS';

                          const cardBg = isCrit
                            ? 'bg-[#FDF4F4] border-[#F8B4B4] hover:border-[#DC2626]'
                            : isWarn
                            ? 'bg-[#FFFBEB] border-[#FDE68A] hover:border-[#D97706]'
                            : isSucc
                            ? 'bg-[#F0FDF4] border-[#BBF7D0] hover:border-[#16A34A]'
                            : 'bg-[#FFFFFF] border-[#E2E8E0] hover:border-[#94A3B8]';

                          return (
                            <div
                              key={alert.id || alert.notificationId}
                              onClick={() => {
                                markAlertAsRead(alert.id || alert.notificationId);
                                if (alert.actionUrl) {
                                  navigate(alert.actionUrl);
                                } else if (alert.machineId && alert.machineId !== 'SYSTEM') {
                                  navigate(`/machines/${alert.machineId}`);
                                } else {
                                  navigate('/dashboard');
                                }
                                setNotificationsOpen(false);
                              }}
                              className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs relative group shadow-2xs ${cardBg} ${
                                alert.read ? 'opacity-70 hover:opacity-100' : 'opacity-100'
                              }`}
                            >
                              <div className="flex items-center justify-between text-[10px] mb-1">
                                <div className="flex items-center gap-1.5">
                                  {!alert.read && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-[#176B52]" title="Unread" />
                                  )}
                                  <span
                                    className={`px-1.5 py-0.2 rounded font-mono font-bold uppercase text-[9px] ${
                                      isCrit
                                        ? 'bg-[#DC2626]/10 text-[#DC2626]'
                                        : isWarn
                                        ? 'bg-[#D97706]/10 text-[#D97706]'
                                        : isSucc
                                        ? 'bg-[#16A34A]/10 text-[#16A34A]'
                                        : 'bg-[#64748B]/10 text-[#64748B]'
                                    }`}
                                  >
                                    {alert.severity}
                                  </span>
                                  {alert.machineId && (
                                    <span className="font-semibold text-[#151D19] font-mono">
                                      {alert.machineId}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 text-[#68736C]">
                                  <span className="font-mono text-[10px]">{alert.timestamp || 'now'}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteAlert(alert.id || alert.notificationId);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity p-0.5"
                                    title="Dismiss alert"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>

                              <p className={`text-[11.5px] leading-snug ${alert.read ? 'text-[#3D4D46]' : 'text-[#151D19] font-medium'}`}>
                                {alert.message || alert.title}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* FOOTER BAR */}
                    <div className="px-3 py-2 bg-[#FAFBF9] border-t border-[#E7ECE5] flex items-center justify-between text-[10px] text-[#68736C]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A] animate-pulse" />
                        <span>Live Event Stream Active</span>
                      </div>
                      {alerts.some(a => a.read) && (
                        <button
                          onClick={clearReadAlerts}
                          className="hover:text-red-600 hover:underline transition-colors cursor-pointer"
                        >
                          Clear read
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Divider */}
            <div className="h-5 w-px bg-[#DFE4DD] mx-0.5" />

            {/* Operator Identifier Block */}
            <div className="w-9 h-9 rounded-lg bg-[#E6F3EC] border border-[#BFDFCD] hover:border-[#246B52]/40 text-[#176B52] font-bold text-xs flex items-center justify-center shadow-xs transition-colors cursor-default select-none tracking-wide" title="Plant Operator (PX)">
              <span>PX</span>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT BODY */}
        <main className="flex-1 p-5 md:p-6 max-w-7xl w-full mx-auto relative">
          {children}
          {/* Floating AI Copilot Trigger */}
          <button
            onClick={() => navigate('/ai-assistant')}
            className="fixed bottom-6 right-6 z-40 bg-[#176B52] hover:bg-[#11523E] text-white px-4 py-2.5 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2 border border-[#176B52]/20 transition-all font-sans text-xs font-semibold group cursor-pointer"
            title="Open PredictX AI Maintenance Assistant"
          >
            <Sparkles size={16} className="text-[#A2E3C4] group-hover:rotate-12 transition-transform" />
            <span>Ask PredictX AI</span>
          </button>
        </main>
      </div>

      <GuidedDemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
}
