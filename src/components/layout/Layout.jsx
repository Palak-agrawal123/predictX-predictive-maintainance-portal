import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutGrid,
  Layers,
  SlidersHorizontal,
  Wrench,
  Activity,
  Bell,
  RefreshCw,
  Terminal,
  ChevronRight,
  Menu,
  X,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Info
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { ToastContainer } from '../common/Toast';
import { GuidedDemoModal } from '../demo/GuidedDemoModal';

export function Layout({ children, pageTitle = "Overview", breadcrumb = [] }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString('en-US', { hour12: false }));
  const { alerts, markAlertAsRead, resetAllDemoData } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('en-US', { hour12: false }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const unreadAlerts = alerts.filter(a => !a.read);

  // Grouped Navigation strictly matching DEV-P04 Hackathon requirements
  const navigationSections = [
    {
      title: "OPERATIONS",
      items: [
        { to: "/dashboard", label: "Fleet Overview", icon: LayoutGrid, tag: "Live" },
        { to: "/machines", label: "Machine Fleet", icon: Layers, count: 8 },
        { to: "/maintenance-priority", label: "Priority Decision", icon: SlidersHorizontal, highlight: true }
      ]
    },
    {
      title: "MAINTENANCE ACTIONS",
      items: [
        { to: "/work-orders", label: "Work Orders", icon: Wrench, tag: "Draft/Log" }
      ]
    },
    {
      title: "ML DECISION ENGINE",
      items: [
        { to: "/predictions", label: "Models & Evaluation", icon: Activity, tag: "NASA" }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-[#F4F6F3] text-[#202A27] flex font-sans antialiased selection:bg-[#176B52] selection:text-white">
      <ToastContainer />

      {/* MOBILE TOPBAR */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#E0E6E0] px-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/dashboard')}>
          <div className="w-7 h-7 rounded bg-[#176B52]/10 border border-[#176B52]/30 flex items-center justify-center text-[#176B52]">
            <Terminal size={15} />
          </div>
          <span className="font-mono font-bold tracking-wider text-sm text-[#202A27]">
            PREDICT<span className="text-[#176B52]">X</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-1.5 text-[#68756F] hover:text-[#202A27] relative"
          >
            <Bell size={18} />
            {unreadAlerts.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#B94040]" />
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 text-[#68756F] hover:text-[#202A27]"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* SIDEBAR NAVIGATION (Cohesive Industrial Light Rail) */}
      <aside className={`
        fixed md:sticky top-0 h-screen w-64 bg-white border-r border-[#E0E6E0] flex flex-col justify-between z-30 transition-transform duration-200 ease-in-out shadow-sm
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Identity & Plant Info */}
          <div className="px-5 py-4 border-b border-[#E0E6E0] flex items-center justify-between bg-white">
            <NavLink to="/dashboard" className="flex items-center gap-3 group">
              <div className="w-8 h-8 rounded-lg bg-[#176B52]/10 border border-[#176B52]/30 flex items-center justify-center text-[#176B52] group-hover:bg-[#176B52]/20 transition-all">
                <Terminal size={17} />
              </div>
              <div>
                <div className="font-mono font-bold text-sm tracking-wider text-[#202A27]">
                  Predict<span className="text-[#176B52]">X</span>
                </div>
                <div className="text-[10px] font-mono text-[#68756F] tracking-tight">Plant Ops Platform</div>
              </div>
            </NavLink>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#F4F6F3] border border-[#E0E6E0] text-[#68756F]">
              PROT-V1
            </span>
          </div>

          {/* Plant Unit Context Badge */}
          <div className="px-3.5 py-2 mx-3 mt-3 rounded bg-[#F4F6F3] border border-[#E0E6E0] flex items-center justify-between text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-[#202A27] truncate min-w-0 pr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#27845C] flex-shrink-0 animate-pulse" />
              <span className="truncate">Line-01 Active</span>
            </span>
            <span className="text-[10px] text-[#176B52] bg-[#E8EFEA] border border-[#176B52]/20 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap flex-shrink-0">
              8 Nodes
            </span>
          </div>

          {/* Nav Categories */}
          <nav className="flex-1 px-3 py-4 space-y-5">
            {navigationSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                <div className="px-2 text-[10px] font-mono tracking-widest text-[#68756F] uppercase font-bold">
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
                        flex items-center justify-between px-3 py-2 rounded text-xs font-mono transition-all group
                        ${isActive
                          ? 'bg-[#E8EFEA] text-[#176B52] font-semibold border-l-2 border-[#176B52]'
                          : 'text-[#68756F] hover:text-[#202A27] hover:bg-[#F4F6F3]'}
                      `}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon size={15} className={`flex-shrink-0 ${isActive ? 'text-[#176B52]' : 'text-[#68756F] group-hover:text-[#202A27]'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {item.tag && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${isActive ? 'bg-[#176B52]/10 text-[#176B52] border border-[#176B52]/30' : 'bg-[#F4F6F3] text-[#68756F] border border-[#E0E6E0]'}`}>
                            {item.tag}
                          </span>
                        )}
                        {item.count && (
                          <span className={`text-[10px] font-normal ${isActive ? 'text-[#176B52]' : 'text-[#68756F]'}`}>{item.count}</span>
                        )}
                      </div>
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          {/* Footer Engine Status Panel */}
          <div className="p-3 border-t border-[#E0E6E0] bg-[#FAFCFA]">
            <div className="p-2.5 rounded bg-white border border-[#E0E6E0] text-xs font-mono space-y-2 shadow-xs">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#68756F] font-semibold">Pipeline Status</span>
                <span className="text-[#27845C] flex items-center gap-1 text-[10px] font-medium">
                  <ShieldCheck size={12} /> Local Replay
                </span>
              </div>
              <div className="text-[10px] text-[#68756F] leading-tight">
                Simulated NASA C-MAPSS dataset. Future integration endpoints pre-configured.
              </div>
              <button
                onClick={resetAllDemoData}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded bg-[#F4F6F3] hover:bg-[#E8EFEA] hover:text-[#176B52] border border-[#E0E6E0] text-[#202A27] text-[10px] font-semibold transition-colors"
                title="Reset local changes and work orders to baseline"
              >
                <RefreshCw size={11} /> Reset Local Data
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0 bg-[#F4F6F3]">
        {/* TOP UTILITY HEADER */}
        <header className="h-14 bg-white border-b border-[#E0E6E0] px-6 flex items-center justify-between sticky top-0 z-20 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-mono text-[#68756F] font-medium tracking-normal">CONTROL //</span>
            <span className="text-xs font-mono text-[#202A27] font-semibold tracking-wide uppercase">
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {/* Launch Guided Demo Button */}
            <button
              onClick={() => setDemoModalOpen(true)}
              className="px-3 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              title="Launch DEV-P04 End-to-End Guided Demo Flow"
            >
              <Sparkles size={13} />
              <span className="hidden sm:inline">Launch Guided Demo</span>
              <span className="sm:hidden">Demo</span>
            </button>

            {/* Clock & Replay Mode Tag */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#F4F7F5] border border-[#E0E6E0] text-[#68756F] text-[11px]">
              <Clock size={12} className="text-[#176B52]" />
              <span className="text-[#202A27] font-medium">{currentTime} UTC</span>
              <span className="text-[#D2DDD5]">|</span>
              <span className="text-[#27845C] font-medium">Offline Demo Mode</span>
            </div>

            {/* Quick Reset Button */}
            <button
              onClick={resetAllDemoData}
              className="p-1.5 rounded bg-[#F4F7F5] border border-[#E0E6E0] text-[#68756F] hover:text-[#202A27] hover:border-[#B5C4BA] transition-colors"
              title="Reset state to initial C-MAPSS demo data"
            >
              <RefreshCw size={14} />
            </button>

            {/* Notifications Menu */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-1.5 rounded bg-[#F4F7F5] border border-[#E0E6E0] text-[#68756F] hover:text-[#202A27] hover:border-[#B5C4BA] transition-colors relative"
                title="Plant Telemetry Alerts"
              >
                <Bell size={14} />
                {unreadAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#B94040] ring-2 ring-white" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-[#D2DDD5] rounded-lg shadow-xl p-3 z-50 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#EAF0EC]">
                    <span className="text-xs font-bold uppercase tracking-wider text-[#202A27]">
                      Plant Alerts ({alerts.length})
                    </span>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="text-[#68756F] hover:text-[#202A27]"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {alerts.map(alert => (
                      <div
                        key={alert.id}
                        onClick={() => {
                          markAlertAsRead(alert.id);
                          navigate(`/machines/${alert.machineId}`);
                          setNotificationsOpen(false);
                        }}
                        className={`p-2.5 rounded border cursor-pointer transition-colors text-xs ${
                          alert.severity === 'Critical'
                            ? 'bg-[#B94040]/5 border-[#B94040]/30 hover:border-[#B94040]'
                            : 'bg-[#D99A24]/5 border-[#D99A24]/30 hover:border-[#D99A24]'
                        } ${alert.read ? 'opacity-50' : 'opacity-100'}`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[#68756F] mb-0.5">
                          <span className="font-bold text-[#202A27]">{alert.machineId}</span>
                          <span>{alert.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-[#202A27] leading-tight">{alert.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Operator Identifier */}
            <div className="flex items-center gap-2 pl-3 border-l border-[#E0E6E0]">
              <div className="w-6 h-6 rounded bg-[#E8EFEA] border border-[#D2DDD5] flex items-center justify-center text-[10px] text-[#176B52] font-bold">
                PX
              </div>
              <span className="hidden lg:inline text-[11px] text-[#68756F]">Supervisor Mode</span>
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
