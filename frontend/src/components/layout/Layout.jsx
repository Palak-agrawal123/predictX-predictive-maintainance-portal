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
        fixed md:sticky top-0 h-screen w-64 bg-[#F0F2ED] border-r border-[#DFE4DD] flex flex-col justify-between z-30 transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full">
          {/* Identity */}
          <div className="h-16 px-5 border-b border-[#DFE4DD] flex items-center justify-between bg-[#ECEFE9]/40">
            <NavLink to="/dashboard" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-lg bg-[#246B52] flex items-center justify-center text-white shadow-xs group-hover:bg-[#1B5440] transition-colors">
                <Activity size={16} strokeWidth={2.2} />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-[15px] tracking-tight text-[#16221D] font-heading leading-tight">
                  Predict<span className="text-[#246B52]">X</span>
                </span>
                <span className="text-[10px] text-[#63726A] tracking-wider uppercase font-semibold font-heading">
                  Fleet Intelligence
                </span>
              </div>
            </NavLink>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {navigationSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#798880] font-heading">
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
                        relative flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group
                        ${isActive
                          ? 'bg-[#E5ECE4] text-[#1E5C45] font-semibold shadow-xs'
                          : 'text-[#5A6860] hover:text-[#18231E] hover:bg-[#E9ECE6]'}
                      `}
                    >
                      {isActive && (
                        <span className="absolute left-1 top-2 bottom-2 w-1 bg-[#246B52] rounded-full" />
                      )}
                      <div className="flex items-center gap-2.5 min-w-0 pl-1">
                        <Icon
                          size={16}
                          strokeWidth={isActive ? 2.1 : 1.75}
                          className={`flex-shrink-0 transition-colors ${
                            isActive ? 'text-[#246B52]' : 'text-[#6B7971] group-hover:text-[#18231E]'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge !== undefined && item.badge !== null && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${item.badgeColor || 'bg-[#246B52] text-white'}`}>
                          {item.badge}
                        </span>
                      )}
                      {item.tag && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#246B52]/10 text-[#246B52] font-mono border border-[#246B52]/25 tracking-wide">
                          {item.tag}
                        </span>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Clean Footer without Connected / Port 5000 */}
          <div className="p-3 border-t border-[#DFE4DD] bg-[#ECEFE9]/40">
            <button
              onClick={resetAllDemoData}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-[#DFE4DD] bg-white hover:bg-[#F5F6F2] text-[#5A6860] hover:text-[#18231E] hover:border-[#C8D1C6] text-[11px] font-medium transition-all shadow-2xs cursor-pointer group"
              title="Reset data to baseline"
            >
              <RefreshCw size={12} strokeWidth={1.8} className="text-[#6B7971] group-hover:rotate-180 transition-transform duration-300" />
              <span>Reset Local Data</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 bg-[#F5F6F2]">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-[#DFE4DD] px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-bold tracking-tight text-[#16221D] font-heading">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 text-xs">
            {/* Launch Guided Demo */}
            <button
              onClick={() => setDemoModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-[#246B52] hover:bg-[#1B5440] text-white font-medium text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Sparkles size={13} strokeWidth={2} />
              <span className="hidden sm:inline">Guided Demo</span>
              <span className="sm:hidden">Demo</span>
            </button>

            {/* Sync Live Data */}
            <button
              onClick={() => refreshData(true)}
              disabled={isLoading}
              className="w-8 h-8 rounded-lg border border-[#DFE4DD] bg-white hover:bg-[#F5F6F2] hover:border-[#C8D1C6] text-[#55635C] hover:text-[#18231E] flex items-center justify-center transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Sync live data"
              aria-label="Sync live data"
            >
              <RefreshCw size={13} strokeWidth={2} className={isLoading ? 'animate-spin text-[#246B52]' : ''} />
            </button>

            {/* Clock Status Pill */}
            <div className="hidden sm:flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[#DFE4DD] bg-[#F7F8F5] text-[#55635C] text-xs font-mono font-medium shadow-2xs">
              <Clock size={12} strokeWidth={2} className="text-[#7A8881]" />
              <span>{currentTime}</span>
            </div>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative w-8 h-8 rounded-lg border border-[#DFE4DD] bg-white hover:bg-[#F5F6F2] hover:border-[#C8D1C6] text-[#55635C] hover:text-[#18231E] flex items-center justify-center transition-all shadow-2xs cursor-pointer"
                title="Notifications"
                aria-label="Notifications"
              >
                <Bell size={14} strokeWidth={1.8} />
                {unreadAlerts.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B74747] ring-2 ring-white" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#DFE4DD] rounded-xl shadow-lg p-3 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E7ECE5]">
                    <span className="text-xs font-bold font-heading text-[#18231E]">
                      Alerts ({alerts.length})
                    </span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[#68736C] hover:text-[#202925] p-1 rounded hover:bg-[#F5F6F2]"
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
                        className={`p-2.5 rounded-lg border cursor-pointer transition-all text-xs ${
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

            {/* Vertical Divider */}
            <div className="h-5 w-px bg-[#DFE4DD] mx-1" />

            {/* PredictX Logo Mark */}
            <div
              className="flex items-center pl-1 select-none"
              title="PredictX"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#164333] via-[#205E48] to-[#12382A] text-white flex items-center justify-center text-xs font-bold font-heading shadow-xs border border-[#164333]/40 hover:scale-[1.04] transition-transform cursor-pointer">
                <span className="flex items-center leading-none">
                  <span className="text-white tracking-tight">P</span>
                  <span className="text-[#5FE3A1] tracking-tight font-extrabold">X</span>
                </span>
              </div>
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
