import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Wrench,
  ArrowRight,
  Flame,
  UserCheck,
  RotateCw,
  Radio,
  ExternalLink,
  Cpu,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatCard, StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { FleetRiskBarChart, MaintenanceWorkloadTrendChart } from '../components/charts/ChartComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';
import { calculatePriorityScore, predictiveMaintenanceApi } from '../services/api';
import {
  INITIAL_FLEET_DATA,
  packetToFleetMachine,
  generateLivePacket
} from '../services/simulationDataService';

/**
 * Mini Real-Time SVG Waveform Visualizer for Dashboard
 */
function MiniLiveWaveform({ points = [], sensorKey = 'vibration' }) {
  if (!points || points.length === 0) return null;
  const vals = points.map(p => Number(p?.cleaned_sensors?.[sensorKey] ?? p?.raw_sensors?.[sensorKey] ?? 0));
  const rawVals = points.map(p => Number(p?.raw_sensors?.[sensorKey] ?? p?.cleaned_sensors?.[sensorKey] ?? 0));
  const minV = Math.min(...vals, ...rawVals);
  const maxV = Math.max(...vals, ...rawVals);
  const pad = Math.max(0.1, (maxV - minV) * 0.15);
  const yMin = Math.max(0, minV - pad);
  const yMax = maxV + pad;
  const range = (yMax - yMin) || 1;

  const w = 480;
  const h = 75;
  const padX = 20;
  const padY = 6;
  const cW = w - padX * 2;
  const cH = h - padY * 2;

  const getX = idx => padX + (idx / Math.max(1, points.length - 1)) * cW;
  const getY = val => padY + cH - ((val - yMin) / range) * cH;

  const cleanPath = vals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`).join(' ');
  const rawPath = rawVals.map((v, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(v).toFixed(1)}`).join(' ');
  const areaPath = `${cleanPath} L ${getX(points.length - 1)} ${padY + cH} L ${getX(0)} ${padY + cH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-18 overflow-visible">
      <defs>
        <linearGradient id="dashCleanArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#246B52" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#246B52" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#dashCleanArea)" />
      <path d={rawPath} fill="none" stroke="#F59E0B" strokeWidth="1.2" strokeDasharray="3 2" />
      <path d={cleanPath} fill="none" stroke="#246B52" strokeWidth="2.0" strokeLinecap="round" />
    </svg>
  );
}

export function DashboardPage() {
  const {
    machines,
    workOrders,
    alerts,
    priorityWeights,
    dashboardSummary,
    pendingReviewsCount = 0
  } = useAppData();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMachineForOrder, setSelectedMachineForOrder] = useState(null);
  const navigate = useNavigate();

  // ---------------------------------------------------------------------------
  // Real-Time Simulator Telemetry State (Fast sync with /sensor-simulator)
  // ---------------------------------------------------------------------------
  const [activeSimMachineId, setActiveSimMachineId] = useState('MOTOR-003');
  const [simFrames, setSimFrames] = useState(() => {
    try {
      const saved = localStorage.getItem('predictx_simulation_frames_all');
      return saved ? JSON.parse(saved) : INITIAL_FLEET_DATA.latestFrames;
    } catch {
      return INITIAL_FLEET_DATA.latestFrames;
    }
  });
  const [simHistory, setSimHistory] = useState(() => INITIAL_FLEET_DATA.history);
  const [simCyclesCount, setSimCyclesCount] = useState(0);

  // Live simulation subscription + background 10s streaming on Dashboard
  useEffect(() => {
    const handleTickEvent = e => {
      const pkt = e.detail;
      if (!pkt || !pkt.machine_id) return;
      const mid = pkt.machine_id;
      setSimFrames(prev => ({ ...prev, [mid]: pkt }));
      setSimHistory(prev => {
        const hist = prev[mid] || [];
        return { ...prev, [mid]: [...hist, pkt].slice(-30) };
      });
      setSimCyclesCount(c => c + 1);
    };

    window.addEventListener('predictx_simulation_tick', handleTickEvent);

    // Continuous 10s automatic telemetry generation on dashboard
    const simInterval = setInterval(() => {
      ['MOTOR-001', 'MOTOR-002', 'MOTOR-003', 'Engine-001'].forEach(mid => {
        setSimHistory(prev => {
          const hist = prev[mid] || [];
          const lastCycle = hist.length > 0 ? hist[hist.length - 1].cycle : 45;
          const nextCycle = lastCycle + 1;
          const nextPacket = generateLivePacket(mid, nextCycle, {
            injectAnomalies: true,
            fleetMode: mid.startsWith('MOTOR') ? 'industrial' : 'turbofan'
          });

          setSimFrames(fPrev => {
            const nextFrames = { ...fPrev, [mid]: nextPacket };
            try {
              localStorage.setItem('predictx_simulation_frames_all', JSON.stringify(nextFrames));
            } catch {}
            return nextFrames;
          });

          return { ...prev, [mid]: [...hist, nextPacket].slice(-30) };
        });
      });
      setSimCyclesCount(c => c + 1);
    }, 10000);

    return () => {
      window.removeEventListener('predictx_simulation_tick', handleTickEvent);
      clearInterval(simInterval);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Merge Simulated Fleet into All Fleet Machines
  // ---------------------------------------------------------------------------
  const simulatedFleet = useMemo(() => {
    return Object.values(simFrames).map(packetToFleetMachine).filter(Boolean);
  }, [simFrames]);

  const allFleetMachines = useMemo(() => {
    const simIds = new Set(simulatedFleet.map(m => m.id));
    const nonSim = machines.filter(m => !simIds.has(m.id));
    return [...simulatedFleet, ...nonSim];
  }, [machines, simulatedFleet]);

  // Fleet analytics calculated dynamically combining live simulation & database
  const totalMachines = allFleetMachines.length || 6;
  const criticalRiskCount = allFleetMachines.filter(m => (m.riskScore || 0) >= 60).length;
  const activeOrders = dashboardSummary?.openWorkOrders ?? workOrders.filter(w => ['Draft', 'Approved', 'In Progress'].includes(w.status)).length;
  const avgHealth = Math.round(
    allFleetMachines.reduce((acc, m) => acc + (m.healthScore || 80), 0) / (allFleetMachines.length || 1)
  );

  // Fleet risk tiers for bar chart
  const fleetRiskDistribution = [
    { name: 'Healthy', count: Math.max(1, allFleetMachines.filter(m => (m.riskScore || 0) < 35).length), color: '#368363' },
    { name: 'Warning', count: Math.max(1, allFleetMachines.filter(m => (m.riskScore || 0) >= 35 && (m.riskScore || 0) < 60).length), color: '#B98232' },
    { name: 'Critical', count: Math.max(1, allFleetMachines.filter(m => (m.riskScore || 0) >= 60).length), color: '#B74747' }
  ];

  // Maintenance Workload Trend Data
  const draftCount = workOrders.filter(w => w.status === 'Draft').length;
  const approvedCount = workOrders.filter(w => w.status === 'Approved').length;
  const inProgressCount = workOrders.filter(w => w.status === 'In Progress').length;
  const completedCount = dashboardSummary?.completedWorkOrders ?? workOrders.filter(w => w.status === 'Completed').length;

  const workloadTrendData = [
    { period: 'Mon', created: draftCount + 1, resolved: completedCount + 2 },
    { period: 'Tue', created: approvedCount + 2, resolved: completedCount + 1 },
    { period: 'Wed', created: 2, resolved: 3 },
    { period: 'Thu', created: inProgressCount + 3, resolved: completedCount + 2 },
    { period: 'Fri', created: activeOrders, resolved: completedCount + 1 },
    { period: 'Sat', created: 1, resolved: 2 },
    { period: 'Today', created: activeOrders, resolved: completedCount }
  ];

  // Ranked priority list computed dynamically from weights
  const rankedMachines = [...allFleetMachines]
    .map(m => ({
      ...m,
      calculated: calculatePriorityScore(m, priorityWeights)
    }))
    .sort((a, b) => b.calculated.score - a.calculated.score);

  const topUrgentMachine = rankedMachines[0];

  // Active Simulation Machine Frame details
  const activeSimFrame = simFrames?.[activeSimMachineId] || INITIAL_FLEET_DATA.latestFrames?.[activeSimMachineId] || {};
  const activeSimHistory = simHistory?.[activeSimMachineId] || INITIAL_FLEET_DATA.history?.[activeSimMachineId] || [];
  const activeSimPred = activeSimFrame?.prediction || {};
  const cleanSensors = activeSimFrame?.cleaned_sensors || {};

  const activeSensorsList = activeSimMachineId.startsWith('MOTOR')
    ? [
        { label: 'Temperature', val: cleanSensors.temperature ?? 46.5, unit: '°C' },
        { label: 'Vibration', val: cleanSensors.vibration ?? 1.42, unit: 'mm/s' },
        { label: 'Speed', val: cleanSensors.rpm ?? 1485, unit: 'RPM' },
        { label: 'Pressure', val: cleanSensors.pressure ?? 4.21, unit: 'bar' },
        { label: 'Current', val: cleanSensors.current ?? 12.2, unit: 'A' },
        { label: 'Voltage', val: cleanSensors.voltage ?? 400.1, unit: 'V' },
        { label: 'Torque', val: cleanSensors.torque ?? 38.5, unit: 'Nm' }
      ]
    : [
        { label: 'T24 Temp', val: cleanSensors.s_2 ?? 642.1, unit: '°R' },
        { label: 'T30 Temp', val: cleanSensors.s_3 ?? 1586.5, unit: '°R' },
        { label: 'T50 Temp', val: cleanSensors.s_4 ?? 1402.4, unit: '°R' },
        { label: 'P30 Press', val: cleanSensors.s_7 ?? 553.8, unit: 'psia' },
        { label: 'Ps30 Press', val: cleanSensors.s_11 ?? 47.32, unit: 'psia' },
        { label: 'Fan Ratio', val: cleanSensors.s_12 ?? 521.6, unit: 'ratio' },
        { label: 'Core Speed', val: cleanSensors.s_14 ?? 8132, unit: 'rpm' }
      ];

  return (
    <Layout pageTitle="Fleet Overview">
      <div className="space-y-6">
        {/* PENDING HUMAN REVIEW ALERT BANNER */}
        {pendingReviewsCount > 0 && (
          <div className="bg-[#FAF3E7] border border-[#F3E0BD] rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md bg-[#B98232]/10 border border-[#B98232]/25 flex items-center justify-center text-[#B98232] flex-shrink-0">
                <UserCheck size={16} strokeWidth={2} />
              </div>
              <div>
                <div className="text-xs font-semibold text-[#202925] flex items-center gap-2">
                  <span>Pending Human Review</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-medium bg-[#B98232] text-white">
                    {pendingReviewsCount}
                  </span>
                </div>
                <p className="text-[12px] text-[#68736C] mt-0.5">
                  High-risk model predictions require engineer confirmation or operational override.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/reviews')}
              className="px-3 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white font-medium text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <span>Review Predictions</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* 4 CLEAN OPERATIONAL KPIS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            title="Monitored Assets"
            value={totalMachines}
            badge="Online"
            badgeType="success"
          />
          <StatCard
            title="Fleet Health"
            value={`${avgHealth}%`}
            badge={avgHealth >= 70 ? 'Optimal' : avgHealth >= 50 ? 'Moderate' : 'Degraded'}
            badgeType={avgHealth >= 70 ? 'success' : avgHealth >= 50 ? 'warning' : 'danger'}
            progressBar={avgHealth}
          />
          <StatCard
            title="High-Risk Assets"
            value={criticalRiskCount}
            badge={criticalRiskCount > 0 ? 'Attention' : 'Clear'}
            badgeType={criticalRiskCount > 0 ? 'danger' : 'success'}
            valueColor={criticalRiskCount > 0 ? 'text-[#B74747]' : 'text-[#1A2520]'}
          />
          <StatCard
            title="Open Work Orders"
            value={activeOrders}
            badge={activeOrders > 0 ? 'Active' : 'None'}
            badgeType={activeOrders > 0 ? 'neutral' : 'success'}
          />
        </div>

        {/* =================================================================== */}
        {/* LIVE INDUSTRIAL IOT SIMULATION TELEMETRY STREAM ON DASHBOARD       */}
        {/* =================================================================== */}
        <div className="bg-white border border-[#DFE4DD] rounded-xl p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E7ECE5] gap-2">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#246B52] opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#246B52]" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-[#151D19] flex items-center gap-1.5">
                <Radio size={14} className="text-[#246B52]" />
                Live Industrial Sensor Telemetry (10s Continuous Stream)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-semibold bg-[#ECFDF5] text-[#246B52] border border-[#A7F3D0]">
                Cycle #{activeSimFrame?.cycle || 45} &bull; Transmitting
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Machine Switcher Tabs */}
              <div className="inline-flex items-center bg-[#F6F8F5] p-0.5 rounded-lg border border-[#DFE4DD] text-xs">
                {[
                  { id: 'MOTOR-001', name: 'MOTOR-001 (Healthy)' },
                  { id: 'MOTOR-002', name: 'MOTOR-002 (Degrading)' },
                  { id: 'MOTOR-003', name: 'MOTOR-003 (Critical)' },
                  { id: 'Engine-001', name: 'Engine-001 (Turbofan)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setActiveSimMachineId(opt.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono font-semibold transition-all ${
                      activeSimMachineId === opt.id
                        ? 'bg-[#246B52] text-white shadow-xs'
                        : 'text-[#68736C] hover:text-[#151D19]'
                    }`}
                  >
                    {opt.id}
                  </button>
                ))}
              </div>

              <button
                onClick={() => navigate('/sensor-simulator')}
                className="px-2.5 py-1 rounded-md bg-[#F6F8F5] hover:bg-[#E8F0EA] border border-[#DFE4DD] text-xs font-medium text-[#246B52] flex items-center gap-1 transition-colors"
                title="Open complete Sensor Simulator & Cleaning Pipeline"
              >
                <span>Full Simulator</span>
                <ExternalLink size={12} />
              </button>
            </div>
          </div>

          {/* Real-Time Sensor Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {activeSensorsList.map((s, idx) => (
              <div key={idx} className="bg-[#F9FAF8] p-2 rounded-lg border border-[#DFE4DD] text-center">
                <span className="text-[10px] text-[#68736C] font-semibold block truncate">{s.label}</span>
                <span className="font-mono font-bold text-[#151D19] text-xs">
                  {s.val !== undefined && s.val !== null ? Number(s.val).toFixed(2) : '-'}
                </span>
                <span className="text-[9px] text-[#8A968E] ml-1">{s.unit}</span>
              </div>
            ))}
          </div>

          {/* Mini Dynamic Waveform & Live ML Prognostics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div className="md:col-span-2 bg-[#F6F8F5] rounded-lg p-2.5 border border-[#DFE4DD]">
              <div className="flex items-center justify-between text-[11px] font-medium text-[#68736C] mb-1 px-1">
                <span className="font-semibold text-[#151D19]">
                  Live Vibration Telemetry Waveform ({activeSimMachineId})
                </span>
                <span className="font-mono text-[10px] text-[#246B52]">
                  Raw Spike vs Cleaned EMA &bull; Auto-streaming
                </span>
              </div>
              <MiniLiveWaveform points={activeSimHistory} sensorKey={activeSimMachineId.startsWith('MOTOR') ? 'vibration' : 's_4'} />
            </div>

            {/* Prognostics Card */}
            <div className="bg-[#F6F8F5] rounded-lg p-3 border border-[#DFE4DD] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-1.5 border-b border-[#E7ECE5]">
                  <span className="text-[11px] font-bold text-[#151D19] flex items-center gap-1">
                    <Cpu size={12} className="text-[#246B52]" />
                    ML Prognostics
                  </span>
                  <span
                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono ${
                      activeSimPred?.riskLevel === 'critical'
                        ? 'bg-[#EF4444] text-white'
                        : activeSimPred?.riskLevel === 'medium'
                        ? 'bg-[#F59E0B] text-white'
                        : 'bg-[#10B981] text-white'
                    }`}
                  >
                    {(activeSimPred?.riskLevel || 'HEALTHY').toUpperCase()}
                  </span>
                </div>
                <div className="py-2 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#68736C]">Health Score:</span>
                    <span className="font-mono font-bold text-[#151D19]">{activeSimPred?.healthScore ?? 98}%</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[#68736C]">Anomaly Risk:</span>
                    <span className="font-mono font-bold text-[#B74747]">{activeSimPred?.anomalyScore ?? 2}%</span>
                  </div>
                  <div className="text-[11px] text-[#68736C] truncate mt-1">
                    Fault: <span className="text-[#151D19] font-medium">{activeSimPred?.suspectedFailureMode || 'Nominal Operation'}</span>
                  </div>
                </div>
              </div>
              <div className="text-[10px] text-[#246B52] bg-[#246B52]/10 p-1.5 rounded truncate font-medium">
                {activeSimPred?.recommendedAction || 'Continue routine condition monitoring'}
              </div>
            </div>
          </div>
        </div>

        {/* CHARTS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Fleet Risk Distribution */}
          <div className="lg:col-span-6 bg-white border border-[#DFE4DD] rounded-lg p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">
                Risk Tier Distribution
              </span>
              <span className="text-[11px] text-[#68736C] font-mono">{totalMachines} assets</span>
            </div>
            <FleetRiskBarChart data={fleetRiskDistribution} height={180} />
          </div>

          {/* Maintenance Workload Trend */}
          <div className="lg:col-span-6 bg-white border border-[#DFE4DD] rounded-lg p-4">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">
                Maintenance Workload
              </span>
              <div className="flex items-center gap-3 text-[11px] text-[#68736C]">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#246B52]" /> Created ({workOrders.length})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#368363]" /> Resolved ({completedCount})
                </span>
              </div>
            </div>
            <MaintenanceWorkloadTrendChart data={workloadTrendData} height={180} />
          </div>
        </div>

        {/* OPERATIONAL SUMMARY: Primary Action Asset & Recent Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Primary Action Asset */}
          <div className="lg:col-span-7 bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-[#B74747]" />
                <span className="text-xs font-semibold text-[#202925]">
                  Primary Action Required
                </span>
              </div>
              <span className="text-[11px] text-[#68736C]">Priority Rank #1</span>
            </div>

            {topUrgentMachine && (
              <div className="p-3.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#202925]">{topUrgentMachine.name}</span>
                    <PriorityBadge priority={topUrgentMachine.calculated.band} />
                  </div>
                  <div className="text-xs text-[#68736C]">
                    <span className="font-mono font-medium text-[#202925]">{topUrgentMachine.id}</span> &bull; {topUrgentMachine.line}
                  </div>
                  <p className="text-[12px] text-[#B74747] font-medium mt-1">
                    {topUrgentMachine.predictedFault}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end justify-between gap-3">
                  <div className="text-left md:text-right">
                    <span className="text-[11px] text-[#68736C] block">Priority Score</span>
                    <span className="text-2xl font-semibold font-mono text-[#246B52]">{topUrgentMachine.calculated.score}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (topUrgentMachine.isSimulated) {
                          navigate('/sensor-simulator');
                        } else {
                          navigate(`/machines/${topUrgentMachine.id}`);
                        }
                      }}
                      className="px-2.5 py-1 rounded-md bg-white hover:bg-[#E8F0EA] border border-[#DFE4DD] text-xs font-medium text-[#202925] transition-colors"
                    >
                      Telemetry
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMachineForOrder(topUrgentMachine);
                        setModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white font-medium text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Wrench size={12} /> Dispatch Order
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Plant Telemetry Alerts */}
          <div className="lg:col-span-5 bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">
                Telemetry Alerts ({alerts.length})
              </span>
              <button
                onClick={() => navigate('/machines')}
                className="text-[11px] text-[#246B52] hover:underline"
              >
                All Machines
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {alerts.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#828F87]">
                  No active telemetry alerts
                </div>
              ) : (
                alerts.slice(0, 5).map(alert => (
                  <div
                    key={alert.id || alert.notificationId}
                    onClick={() => {
                      if (alert.actionUrl) {
                        navigate(alert.actionUrl);
                      } else if (alert.machineId && alert.machineId !== 'SYSTEM') {
                        navigate(`/machines/${alert.machineId}`);
                      } else {
                        navigate('/machines');
                      }
                    }}
                    className={`p-2.5 rounded-md border transition-all cursor-pointer text-xs ${
                      alert.severity === 'Critical'
                        ? 'bg-[#FEF2F2] border-[#FCA5A5] hover:border-[#F87171]'
                        : alert.severity === 'Warning'
                        ? 'bg-[#FFFBEB] border-[#FDE68A] hover:border-[#FCD34D]'
                        : 'bg-[#F5F6F2] border-[#DFE4DD] hover:border-[#C2CDC0]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#68736C] mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold font-mono text-[#202925]">{alert.machineId}</span>
                        {alert.severity && alert.severity !== 'Info' && (
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                              alert.severity === 'Critical' ? 'bg-[#EF4444] text-white' : 'bg-[#F59E0B] text-white'
                            }`}
                          >
                            {alert.severity.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[10px]">{alert.timestamp}</span>
                    </div>
                    <p className="text-[11px] text-[#202925] line-clamp-1">{alert.message || alert.title}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* FULL FLEET STATUS TABLE */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#E7ECE5]">
            <span className="text-xs font-semibold text-[#202925]">
              Asset Health & Priority Ranking
            </span>
            <button
              onClick={() => navigate('/machines')}
              className="text-xs text-[#246B52] hover:underline font-medium"
            >
              View Full Fleet
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7ECE5] text-[#68736C] text-[11px] font-medium">
                  <th className="py-2.5 px-3">Asset ID</th>
                  <th className="py-2.5 px-3">Machine</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Health</th>
                  <th className="py-2.5 px-3 text-center">Risk</th>
                  <th className="py-2.5 px-3 text-center">Priority</th>
                  <th className="py-2.5 px-3">Predicted RUL</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECE5]">
                {rankedMachines.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => {
                      if (m.isSimulated) {
                        navigate('/sensor-simulator');
                      } else {
                        navigate(`/machines/${m.id}`);
                      }
                    }}
                    className="hover:bg-[#F5F6F2] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-mono font-semibold text-[#202925] flex items-center gap-1.5">
                      {m.id}
                      {m.isSimulated && (
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#246B52]/10 text-[#246B52] border border-[#246B52]/20 font-semibold">
                          IOT
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-[#202925]">{m.name}</td>
                    <td className="py-2.5 px-3 text-[#68736C]">{m.line}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium">
                      <span className={m.healthScore >= 70 ? 'text-[#368363]' : m.healthScore >= 40 ? 'text-[#B98232]' : 'text-[#B74747]'}>
                        {m.healthScore}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-medium">
                      <span className={m.riskScore >= 60 ? 'text-[#B74747]' : m.riskScore >= 35 ? 'text-[#B98232]' : 'text-[#368363]'}>
                        {m.riskScore}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-[#202925]">
                      {m.calculated.score}
                    </td>
                    <td className="py-2.5 px-3 text-[#68736C] font-mono">
                      <span className="text-[#202925] font-medium">{m.predictedRul}</span> {m.rulUnit}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (m.isSimulated) {
                            navigate('/sensor-simulator');
                          } else {
                            navigate(`/machines/${m.id}`);
                          }
                        }}
                        className="px-2 py-1 rounded bg-[#F5F6F2] hover:bg-[#E8F0EA] border border-[#DFE4DD] text-[#202925] text-[11px] font-medium cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <WorkOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        preselectedMachine={selectedMachineForOrder}
      />
    </Layout>
  );
}
