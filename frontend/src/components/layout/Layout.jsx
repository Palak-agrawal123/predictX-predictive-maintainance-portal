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
  Sparkles
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { ToastContainer } from '../common/Toast';
import { GuidedDemoModal } from '../demo/GuidedDemoModal';

export function Layout({ children, pageTitle = "Overview" }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const { alerts, markAlertAsRead, resetAllDemoData, pendingReviewsCount = 0, backendStatus, refreshData, isLoading } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadAlerts = alerts.filter(a => !a.read);

  const navigationSections = [
    {
      title: "Operations",
      items: [
        { to: "/dashboard", label: "Fleet Overview", icon: LayoutGrid },
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
          <div className="w-7 h-7 rounded-md bg-[#246B52] flex items-center justify-center text-white">
            <Activity size={15} strokeWidth={2.2} />
          </div>
          <span className="font-semibold tracking-tight text-sm text-[#202925]">
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
          <div className="px-5 py-4 border-b border-[#DFE4DD] flex items-center justify-between">
            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 rounded-md bg-[#246B52] flex items-center justify-center text-white shadow-xs">
                <Activity size={15} strokeWidth={2.2} />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm tracking-tight text-[#202925]">
                  Predict<span className="text-[#246B52]">X</span>
                </span>
                <span className="text-[10px] text-[#68736C] tracking-tight">Fleet Intelligence</span>
              </div>
            </NavLink>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {navigationSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <div className="px-2.5 pb-1 text-[11px] font-medium text-[#85918A]">
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
                        flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors group
                        ${isActive
                          ? 'bg-[#E8F0EA] text-[#246B52] font-semibold'
                          : 'text-[#68736C] hover:text-[#202925] hover:bg-[#E9ECE6]'}
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={15} strokeWidth={1.8} className={`flex-shrink-0 ${isActive ? 'text-[#246B52]' : 'text-[#68736C] group-hover:text-[#202925]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge !== null && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-medium ${item.badgeColor || 'bg-[#E8F0EA] text-[#246B52]'}`}>
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
          <div className="p-3 border-t border-[#DFE4DD] bg-[#ECEFE9]/60 text-xs">
            <div className="flex items-center justify-between text-[11px] text-[#68736C] mb-2 px-1">
              <span className="flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${backendStatus?.online ? 'bg-[#368363]' : 'bg-[#B98232]'}`} />
                <span>{backendStatus?.online ? 'Connected' : 'Offline Mode'}</span>
              </span>
              <span className="font-mono text-[10px] text-[#85918A]">Port 5000</span>
            </div>
            <button
              onClick={resetAllDemoData}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-white hover:bg-[#F5F6F2] border border-[#DFE4DD] text-[#68736C] hover:text-[#202925] text-[11px] font-medium transition-colors"
              title="Reset data to baseline"
            >
              <RefreshCw size={11} strokeWidth={1.75} /> Reset Local Data
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 bg-[#F5F6F2]">
        {/* TOP HEADER */}
        <header className="h-13 bg-white border-b border-[#DFE4DD] px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-[#202925]">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3 text-xs">
            {/* Launch Guided Demo */}
            <button
              onClick={() => setDemoModalOpen(true)}
              className="px-2.5 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Sparkles size={12} strokeWidth={2} />
              <span className="hidden sm:inline">Guided Demo</span>
              <span className="sm:hidden">Demo</span>
            </button>

            {/* Sync Live Data */}
            <button
              onClick={() => refreshData(true)}
              disabled={isLoading}
              className="p-1.5 rounded-md border border-[#DFE4DD] bg-white text-[#68736C] hover:text-[#202925] hover:border-[#C2CDC0] transition-colors"
              title="Sync live data"
              aria-label="Sync live data"
            >
              <RefreshCw size={13} strokeWidth={1.75} className={isLoading ? 'animate-spin text-[#246B52]' : ''} />
            </button>

            {/* Clock */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-[#68736C] text-[11px] font-mono">
              <Clock size={11} strokeWidth={1.75} />
              <span>{currentTime}</span>
            </div>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 rounded-md border border-[#DFE4DD] bg-white text-[#68736C] hover:text-[#202925] hover:border-[#C2CDC0] transition-colors relative"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell size={13} strokeWidth={1.75} />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#B74747]" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#DFE4DD] rounded-lg shadow-lg p-3 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E7ECE5]">
                    <span className="text-xs font-semibold text-[#202925]">
                      Alerts ({alerts.length})
                    </span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[#68736C] hover:text-[#202925]"
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {alerts.map(alert => (
                      <div
                        key={alert.id}
                        onClick={() => {
                          markAlertAsRead(alert.id);
                          navigate(`/machines/${alert.machineId}`);
                          setNotificationsOpen(false);
                        }}
                        className={`p-2 rounded border cursor-pointer transition-colors text-xs ${
                          alert.severity === 'Critical'
                            ? 'bg-[#F8EBEB]/60 border-[#EFCACA] hover:border-[#B74747]'
                            : 'bg-[#FAF3E7]/60 border-[#F3E0BD] hover:border-[#B98232]'
                        } ${alert.read ? 'opacity-60' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#68736C] mb-0.5">
                          <span className="font-semibold text-[#202925] font-mono">{alert.machineId}</span>
                          <span className="font-mono">{alert.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-[#202925] leading-tight">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Operator Identifier */}
            <div className="flex items-center gap-1.5 pl-2 border-l border-[#DFE4DD]">
              <div className="w-5 h-5 rounded bg-[#E8F0EA] border border-[#D1E1D5] flex items-center justify-center text-[10px] text-[#246B52] font-semibold">
                PX
              </div>
            </div>
          </div>
        </header>

        {/* WORKSPACE CONTENT BODY */}
        <main className="flex-1 p-5 md:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      <GuidedDemoModal
        isOpen={demoModalOpen}
        onClose={() => setDemoModalOpen(false)}
      />
    </div>
  );
}
