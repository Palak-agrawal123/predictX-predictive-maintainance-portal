import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Wrench,
  Zap,
  Eye,
  ShieldCheck,
  Code,
  FileText,
  Copy,
  Check,
  Radio
} from 'lucide-react';
import { Layout } from '../components/layout/Layout';
import { predictiveMaintenanceApi } from '../services/api';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';
import {
  buildComparisonTableIndustrial,
  buildComparisonTableTurbofan,
  generateLivePacket,
  generateDemonstrationFleetData,
  INITIAL_FLEET_DATA
} from '../services/simulationDataService';

// -----------------------------------------------------------------------------
// Sub-Component: Health Score Radial Gauge (0-100%)
// -----------------------------------------------------------------------------
function HealthGauge({ score = 100, size = 68, strokeWidth = 6.0 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(score ?? 100)));
  const offset = circumference - (clamped / 100) * circumference;

  const strokeColor =
    clamped >= 80 ? '#246B52' : clamped >= 50 ? '#B98232' : '#B74747';

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5EAE3"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="none"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-xs tracking-tight text-[#151D19]">
          {clamped}%
        </span>
        <span className="text-[9px] uppercase font-semibold text-[#68736C]">
          Health
        </span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Component: RUL / Life Progress Bar
// -----------------------------------------------------------------------------
function LifeProgressBar({ value = 100, maxVal = 150, isCritical = false }) {
  const clamped = Math.max(0, Math.min(maxVal, value ?? 0));
  const pct = Math.min(100, Math.max(4, (clamped / maxVal) * 100));

  const barColor = isCritical
    ? 'bg-[#B74747]'
    : pct <= 35
    ? 'bg-[#B98232]'
    : 'bg-[#246B52]';

  return (
    <div className="w-full bg-[#E5EAE3] h-1.5 rounded-full overflow-hidden mt-1.5">
      <div
        className={`h-full ${barColor} rounded-full transition-all duration-500 ease-out`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sub-Component: Dual-Line Telemetry Waveform Chart (Raw vs Cleaned)
// -----------------------------------------------------------------------------
function DualLineTelemetryChart({
  history = [],
  sensorKey = 'vibration',
  unit = 'mm/s',
  label = 'Vibration Velocity'
}) {
  const points = useMemo(() => {
    if (!history || !Array.isArray(history) || history.length === 0) return [];
    return history.slice(-30).map((h, idx) => {
      const raw = h?.raw_sensors?.[sensorKey] ?? h?.cleaned_sensors?.[sensorKey] ?? 0;
      const clean = h?.cleaned_sensors?.[sensorKey] ?? raw;
      return {
        idx,
        cycle: h?.cycle || idx + 1,
        timestamp: h?.timestamp ? new Date(h.timestamp).toLocaleTimeString() : `#${h?.cycle || idx + 1}`,
        raw: typeof raw === 'number' && !isNaN(raw) ? raw : (Number(raw) || 0),
        clean: typeof clean === 'number' && !isNaN(clean) ? clean : (Number(clean) || 0)
      };
    });
  }, [history, sensorKey]);

  // Safe fallback to guarantee chart is always visually populated and active
  const chartPoints = useMemo(() => {
    if (points && points.length >= 2) return points;
    if (points && points.length === 1) return [points[0], { ...points[0], idx: 1 }];
    return Array.from({ length: 20 }, (_, i) => ({
      idx: i,
      cycle: i + 1,
      timestamp: `#${i + 1}`,
      raw: +(1.38 + Math.sin(i * 0.4) * 0.08 + (i % 6 === 0 ? 0.75 : 0)).toFixed(2),
      clean: +(1.38 + Math.sin(i * 0.4) * 0.04).toFixed(2)
    }));
  }, [points]);

  // Calculate dynamic min / max bounds safely
  const allVals = (chartPoints || []).flatMap(p => [p?.raw, p?.clean]).filter(v => typeof v === 'number' && !isNaN(v));
  const minVal = allVals.length > 0 && isFinite(Math.min(...allVals)) ? Math.min(...allVals) : 0;
  const maxVal = allVals.length > 0 && isFinite(Math.max(...allVals)) ? Math.max(...allVals) : 10;
  const padding = Math.max(0.05, (maxVal - minVal) * 0.15);
  const yMin = Math.max(0, minVal - padding);
  const yMax = maxVal + padding;
  const yRange = (yMax - yMin) || 1;

  const width = 800;
  const height = 230;
  const padLeft = 55;
  const padRight = 20;
  const padTop = 20;
  const padBottom = 30;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const getX = idx => padLeft + (idx / Math.max(1, chartPoints.length - 1)) * chartW;
  const getY = val => {
    const num = typeof val === 'number' && !isNaN(val) ? val : 0;
    return padTop + chartH - ((num - yMin) / yRange) * chartH;
  };

  const rawPath = chartPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p?.raw).toFixed(1)}`)
    .join(' ');

  const cleanPath = chartPoints
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx).toFixed(1)} ${getY(p?.clean).toFixed(1)}`)
    .join(' ');

  const areaPath = `${cleanPath} L ${getX(chartPoints.length - 1)} ${padTop + chartH} L ${getX(0)} ${padTop + chartH} Z`;

  const latest = (chartPoints && chartPoints.length > 0) ? chartPoints[chartPoints.length - 1] : { clean: 1.4, raw: 1.4 };
  const cleanVal = typeof latest?.clean === 'number' ? latest.clean : (Number(latest?.clean) || 0);
  const rawVal = typeof latest?.raw === 'number' ? latest.raw : (Number(latest?.raw) || cleanVal);

  return (
    <div className="relative w-full bg-white rounded-xl border border-[#DFE4DD] p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#246B52] animate-ping" />
          <span className="text-xs font-semibold uppercase tracking-wider text-[#151D19]">
            {label} ({unit})
          </span>
          <span className="text-xs text-[#68736C] font-mono">
            Latest: <strong className="text-[#151D19]">{cleanVal.toFixed(2)}</strong> {unit}
            {Math.abs(rawVal - cleanVal) > 0.02 && (
              <span className="ml-2 text-[11px] text-[#B98232] font-semibold">
                (Raw spike: {rawVal.toFixed(2)})
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#D97706] inline-block rounded-full" />
            <span className="text-[#68736C]">Raw Unfiltered (Noise/Spikes)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-[#246B52] inline-block rounded-full" />
            <span className="text-[#151D19] font-semibold">Post-Pipeline Cleaned (EMA)</span>
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-56 overflow-visible">
        <defs>
          <linearGradient id="cleanAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#246B52" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#246B52" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1.0].map((frac, i) => {
          const y = padTop + chartH * (1 - frac);
          const v = yMin + frac * yRange;
          return (
            <g key={i}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="#EEF2ED"
                strokeWidth="1"
                strokeDasharray={i === 0 || i === 4 ? '' : '3 3'}
              />
              <text
                x={padLeft - 8}
                y={y + 3.5}
                fontSize="10"
                fill="#8A968E"
                textAnchor="end"
                className="font-mono font-medium"
              >
                {v.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Cleaned Area Gradient */}
        <path d={areaPath} fill="url(#cleanAreaGrad)" />

        {/* Raw Line (with jitter & spikes) */}
        <path
          d={rawPath}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="1.5"
          strokeDasharray="4 2"
          strokeOpacity="0.85"
        />

        {/* Cleaned Signal Line */}
        <path
          d={cleanPath}
          fill="none"
          stroke="#246B52"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {chartPoints.map((p, idx) => {
          const isSpike = Math.abs((p?.raw ?? 0) - (p?.clean ?? 0)) > 0.05;
          if (!isSpike && idx !== chartPoints.length - 1) return null;
          return (
            <g key={idx}>
              {isSpike && (
                <circle
                  cx={getX(idx)}
                  cy={getY(p?.raw)}
                  r="3.5"
                  fill="#DC2626"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                />
              )}
              <circle
                cx={getX(idx)}
                cy={getY(p?.clean)}
                r="3.5"
                fill="#246B52"
                stroke="#FFFFFF"
                strokeWidth="1.5"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN PAGE: Live IoT Sensor Monitoring & Predictive Maintenance System
// -----------------------------------------------------------------------------
export function SensorSimulatorPage() {
  const navigate = useNavigate();

  // Fleet Mode: 'industrial' (7 sensors: Motors/Pumps) vs 'turbofan' (21 sensors: C-MAPSS)
  const [fleetMode, setFleetMode] = useState('industrial');
  const [activeMachineId, setActiveMachineId] = useState('MOTOR-001');

  // Simulation Execution State
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('streaming');
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [tickIntervalSec, setTickIntervalSec] = useState(10.0);
  const [selectedInterval, setSelectedInterval] = useState('10s');
  const [injectAnomalies, setInjectAnomalies] = useState(true);
  const [totalSimulatedCycles, setTotalSimulatedCycles] = useState(0);

  // Raw Data Inspector Tab: 'comparison', 'raw_json', 'raw_log'
  const [inspectorTab, setInspectorTab] = useState('comparison');
  const [copiedJson, setCopiedJson] = useState(false);

  // Pre-seeded telemetry history and frames
  const [telemetryHistory, setTelemetryHistory] = useState(() => INITIAL_FLEET_DATA.history);
  const [latestFrames, setLatestFrames] = useState(() => INITIAL_FLEET_DATA.latestFrames);
  const [selectedSensorKey, setSelectedSensorKey] = useState('vibration');

  const [pipelineMetrics, setPipelineMetrics] = useState({
    total_raw_readings: 60,
    valid_readings: 58,
    rejected_readings: 0,
    noise_filtered_readings: 24,
    outliers_detected: 4,
    missing_values_handled: 2,
    cleaning_success_rate: 99.8,
    average_latency_ms: 1.2
  });

  // Work Order Creation Modal Integration
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [workOrderMachine, setWorkOrderMachine] = useState(null);

  const eventSourceRef = useRef(null);
  const pollTimerRef = useRef(null);
  const singleTickRef = useRef(null);

  // ---------------------------------------------------------------------------
  // Default Machines Baseline Fleet Configuration
  // ---------------------------------------------------------------------------
  const defaultIndustrialFleet = useMemo(
    () => [
      {
        id: 'MOTOR-001',
        name: 'Centrifugal Water Pump Motor',
        type: 'PUMP_MOTOR',
        subsystem: 'Cooling Loop Primary Feed',
        scenario: 'healthy',
        defaultRisk: 'low',
        defaultHealth: 98,
        defaultMetrics: { vib: 1.4, temp: 46.5, rpm: 1485, press: 4.2 }
      },
      {
        id: 'MOTOR-002',
        name: 'CNC Extruder Spindle Motor',
        type: 'SPINDLE_MOTOR',
        subsystem: 'Extrusion Line 4 Spindle',
        scenario: 'gradual_degradation',
        defaultRisk: 'medium',
        defaultHealth: 68,
        defaultMetrics: { vib: 3.8, temp: 63.5, rpm: 1750, press: 5.2 }
      },
      {
        id: 'MOTOR-003',
        name: 'Gas Booster Compressor Motor',
        type: 'COMPRESSOR_MOTOR',
        subsystem: 'Main Gas Turbine Booster',
        scenario: 'critical_degradation',
        defaultRisk: 'critical',
        defaultHealth: 24,
        defaultMetrics: { vib: 7.4, temp: 88.5, rpm: 2940, press: 8.2 }
      }
    ],
    []
  );

  const defaultTurbofanFleet = useMemo(
    () => [
      {
        id: 'Engine-001',
        name: 'Turbofan Engine 001',
        type: 'TURBINE',
        subsystem: 'Sub-dataset FD001 (Single Regime)',
        scenario: 'healthy',
        defaultRisk: 'low',
        defaultHealth: 98,
        defaultRul: 120,
        modelName: 'XGBoost Regressor (FD001)'
      },
      {
        id: 'Engine-002',
        name: 'Turbofan Engine 002',
        type: 'TURBINE',
        subsystem: 'Sub-dataset FD001 (Progressive Wear)',
        scenario: 'gradual_degradation',
        defaultRisk: 'medium',
        defaultHealth: 68,
        defaultRul: 62,
        modelName: 'XGBoost Regressor (FD001)'
      },
      {
        id: 'Engine-003',
        name: 'Turbofan Engine 003',
        type: 'TURBINE',
        subsystem: 'Sub-dataset FD002 (Multi-Regime)',
        scenario: 'critical_degradation',
        defaultRisk: 'critical',
        defaultHealth: 24,
        defaultRul: 22,
        modelName: 'Attention-CNN-BiLSTM (FD002)'
      }
    ],
    []
  );

  const activeFleetList = fleetMode === 'industrial' ? defaultIndustrialFleet : defaultTurbofanFleet;

  // ---------------------------------------------------------------------------
  // Sensor Options for Dynamic Dropdown
  // ---------------------------------------------------------------------------
  const sensorOptions = useMemo(() => {
    if (fleetMode === 'industrial') {
      return [
        { key: 'vibration', label: 'Vibration Amplitude', unit: 'mm/s' },
        { key: 'temperature', label: 'Machine Temperature', unit: '°C' },
        { key: 'rpm', label: 'Rotational Speed', unit: 'RPM' },
        { key: 'pressure', label: 'Operating Pressure', unit: 'bar' },
        { key: 'current', label: 'Motor Current', unit: 'A' },
        { key: 'voltage', label: 'Supply Voltage', unit: 'V' },
        { key: 'torque', label: 'Drive Torque', unit: 'Nm' }
      ];
    } else {
      return [
        { key: 's_4', label: 'T50 LPT Coolant Temp', unit: '°R' },
        { key: 's_7', label: 'P30 HPC Pressure', unit: 'psia' },
        { key: 's_3', label: 'T30 HPC Outlet Temp', unit: '°R' },
        { key: 's_2', label: 'T24 LPC Outlet Temp', unit: '°R' },
        { key: 's_11', label: 'Ps30 HPC Static Pressure', unit: 'psia' },
        { key: 's_12', label: 'Phi Fan Ratio', unit: 'ratio' },
        { key: 's_14', label: 'NRc Core Speed', unit: 'rpm' },
        { key: 's_15', label: 'BPR Bypass Ratio', unit: 'ratio' }
      ];
    }
  }, [fleetMode]);

  // ---------------------------------------------------------------------------
  // Ingest Incoming Telemetry Packet into State & Sync with MongoDB
  // ---------------------------------------------------------------------------
  const handleIncomingPacket = packet => {
    if (!packet || !packet.machine_id) return;
    const mid = packet.machine_id;

    setTotalSimulatedCycles(prev => prev + 1);

    setLatestFrames(prev => {
      const nextLatest = {
        ...prev,
        [mid]: packet
      };
      try {
        localStorage.setItem('predictx_simulation_frames_all', JSON.stringify(nextLatest));
        localStorage.setItem('predictx_simulation_latest_frame', JSON.stringify(packet));
        window.dispatchEvent(new CustomEvent('predictx_simulation_tick', { detail: packet }));
      } catch {}
      return nextLatest;
    });

    setTelemetryHistory(prev => {
      const existing = prev[mid] || [];
      if (existing.length > 0 && existing[existing.length - 1].cycle === packet.cycle) {
        return prev;
      }
      const updated = [...existing, packet].slice(-60);
      return { ...prev, [mid]: updated };
    });

    if (packet.pipeline_metrics) {
      setPipelineMetrics(packet.pipeline_metrics);
    }

    if (packet.prediction) {
      predictiveMaintenanceApi
        .syncSimulationPrediction({
          machineId: mid,
          subset: packet.subset || (fleetMode === 'industrial' ? 'INDUSTRIAL_IOT' : 'FD001'),
          cycle: packet.cycle || 1,
          prediction: packet.prediction,
          modelMetadata: packet.model_metadata || {},
          cleanedSensors: packet.cleaned_sensors || {}
        })
        .catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // Continuous Real-Time Simulation Progression Tick
  // ---------------------------------------------------------------------------
  const performSimulationTick = () => {
    const isIndustrial = fleetMode === 'industrial';
    const currentList = isIndustrial ? defaultIndustrialFleet : defaultTurbofanFleet;

    currentList.forEach(m => {
      const mid = m.id;
      setTelemetryHistory(prev => {
        const hist = prev[mid] || [];
        const lastPkt = hist.length > 0 ? hist[hist.length - 1] : null;
        const lastCycle = lastPkt?.cycle || (mid.endsWith('001') ? 45 : mid.endsWith('002') ? 110 : 185);
        const nextCycle = lastCycle + 1;

        const nextPacket = generateLivePacket(mid, nextCycle, {
          injectAnomalies,
          fleetMode
        });

        const updated = [...hist, nextPacket].slice(-50);

        setLatestFrames(lPrev => {
          const nextLatest = {
            ...lPrev,
            [mid]: nextPacket
          };
          try {
            localStorage.setItem('predictx_simulation_frames_all', JSON.stringify(nextLatest));
            localStorage.setItem('predictx_simulation_latest_frame', JSON.stringify(nextPacket));
            window.dispatchEvent(new CustomEvent('predictx_simulation_tick', { detail: nextPacket }));
          } catch {}
          return nextLatest;
        });

        if (mid === activeMachineId) {
          predictiveMaintenanceApi
            .syncSimulationPrediction({
              machineId: mid,
              subset: isIndustrial ? 'INDUSTRIAL_IOT' : 'FD001',
              cycle: nextCycle,
              prediction: nextPacket.prediction,
              modelMetadata: nextPacket.model_metadata || {},
              cleanedSensors: nextPacket.cleaned_sensors || {}
            })
            .catch(() => {});
        }

        return { ...prev, [mid]: updated };
      });
    });

    setPipelineMetrics(prev => {
      const newTotal = prev.total_raw_readings + currentList.length;
      const spikeOccurred = injectAnomalies && (Math.random() > 0.4);
      return {
        ...prev,
        total_raw_readings: newTotal,
        valid_readings: prev.valid_readings + currentList.length,
        outliers_detected: spikeOccurred ? prev.outliers_detected + 1 : prev.outliers_detected,
        cleaning_success_rate: 99.8,
        average_latency_ms: +(1.1 + Math.random() * 0.3).toFixed(1)
      };
    });

    setTotalSimulatedCycles(prev => prev + 1);
  };

  singleTickRef.current = performSimulationTick;

  // Active progression interval when running
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const intervalMs =
      selectedInterval === '5s'
        ? 5000
        : selectedInterval === '10s'
        ? 10000
        : selectedInterval === '30s'
        ? 30000
        : 2000;

    const timer = setInterval(() => {
      if (singleTickRef.current) singleTickRef.current();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isRunning, isPaused, selectedInterval, fleetMode, injectAnomalies, activeMachineId]);

  // ---------------------------------------------------------------------------
  // Connect SSE Live Telemetry Stream with Polling Fallback
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let isSubscribed = true;

    const setupSSE = () => {
      try {
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
        }

        const streamUrl = 'http://localhost:5000/api/simulation/stream';
        const sse = new EventSource(streamUrl);
        eventSourceRef.current = sse;

        sse.addEventListener('open', () => {
          if (isSubscribed) setConnectionStatus('streaming');
        });

        sse.addEventListener('telemetry', event => {
          try {
            const packet = JSON.parse(event.data);
            if (isSubscribed) {
              handleIncomingPacket(packet);
              setConnectionStatus('streaming');
            }
          } catch (e) {
            console.error('SSE packet parse error:', e);
          }
        });

        sse.onerror = () => {
          if (isSubscribed) {
            setConnectionStatus('polling');
          }
        };
      } catch (err) {
        if (isSubscribed) setConnectionStatus('polling');
      }
    };

    setupSSE();

    // Background status sync
    pollTimerRef.current = setInterval(async () => {
      if (!isSubscribed) return;
      try {
        const res = await predictiveMaintenanceApi.getSimulationStatus().catch(() => null);
        if (res?.data && isSubscribed) {
          if (res.data.is_running !== undefined) setIsRunning(Boolean(res.data.is_running));
          if (res.data.is_paused !== undefined) setIsPaused(Boolean(res.data.is_paused));
        }
      } catch {
        // offline fallback
      }
    }, 4000);

    return () => {
      isSubscribed = false;
      if (eventSourceRef.current) eventSourceRef.current.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Simulator Control Handlers
  // ---------------------------------------------------------------------------
  const handleStartSimulation = async () => {
    setIsRunning(true);
    setIsPaused(false);

    // Immediate progression tick at t=0 so user sees dynamic change instantly
    if (singleTickRef.current) singleTickRef.current();

    try {
      const cfg = {
        simulation_source: fleetMode === 'industrial' ? 'iot_simulator' : 'cmapss_synthetic',
        tick_interval_seconds: tickIntervalSec,
        speed_multiplier: speedMultiplier,
        auto_predict: true,
        selected_machine_id: activeMachineId
      };
      await predictiveMaintenanceApi.startSimulation(cfg);
    } catch (err) {
      console.warn('Backend start note:', err);
    }
  };

  const handlePauseSimulation = async () => {
    setIsPaused(true);
    try {
      await predictiveMaintenanceApi.pauseSimulation();
    } catch (err) {
      console.warn('Backend pause note:', err);
    }
  };

  const handleResumeSimulation = async () => {
    setIsPaused(false);
    try {
      await predictiveMaintenanceApi.resumeSimulation();
    } catch (err) {
      console.warn('Backend resume note:', err);
    }
  };

  const handleStopSimulation = async () => {
    setIsRunning(false);
    setIsPaused(false);
    try {
      await predictiveMaintenanceApi.stopSimulation();
    } catch (err) {
      console.warn('Backend stop note:', err);
    }
  };

  const handleResetSimulation = async () => {
    setIsRunning(false);
    setIsPaused(false);
    setTotalSimulatedCycles(0);

    const fresh = generateDemonstrationFleetData();
    setTelemetryHistory(fresh.history);
    setLatestFrames(fresh.latestFrames);
    setPipelineMetrics({
      total_raw_readings: 60,
      valid_readings: 58,
      rejected_readings: 0,
      noise_filtered_readings: 24,
      outliers_detected: 4,
      missing_values_handled: 2,
      cleaning_success_rate: 99.8,
      average_latency_ms: 1.2
    });

    try {
      await predictiveMaintenanceApi.resetSimulation();
    } catch (err) {
      console.warn('Backend reset note:', err);
    }
  };

  const handleIntervalSelect = (intervalLabel, seconds) => {
    setSelectedInterval(intervalLabel);
    setTickIntervalSec(seconds);

    const effectiveTick = seconds >= 3600 ? 1.5 : seconds;
    const speed = seconds === 5 ? 2.0 : seconds === 10 ? 1.0 : seconds === 30 ? 0.33 : 1.0;
    setSpeedMultiplier(speed);

    if (isRunning) {
      predictiveMaintenanceApi
        .startSimulation({
          simulation_source: fleetMode === 'industrial' ? 'iot_simulator' : 'cmapss_synthetic',
          tick_interval_seconds: effectiveTick,
          speed_multiplier: speed,
          auto_predict: true
        })
        .catch(() => {});
    }
  };

  const handleCopyJson = text => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const handleFleetSwitch = async mode => {
    setFleetMode(mode);
    const newDefaultId = mode === 'industrial' ? 'MOTOR-001' : 'Engine-001';
    setActiveMachineId(newDefaultId);
    setSelectedSensorKey(mode === 'industrial' ? 'vibration' : 's_4');

    try {
      await predictiveMaintenanceApi.switchFleet(mode);
    } catch (err) {
      console.warn('Fleet switch note:', err);
    }
  };

  const handleOpenWorkOrder = (e, targetMachineId) => {
    e.stopPropagation();
    const frame = latestFrames?.[targetMachineId];
    setWorkOrderMachine({
      machineId: targetMachineId,
      name: frame?.machine_name || targetMachineId,
      status: 'critical',
      criticality: 'critical',
      predictedFault: frame?.prediction?.suspectedFailureMode || 'Critical Degradation'
    });
    setWorkOrderModalOpen(true);
  };

  // ---------------------------------------------------------------------------
  // Active Machine Details Resolution
  // ---------------------------------------------------------------------------
  const activeFrame = latestFrames?.[activeMachineId] || {};
  const activeHistory = Array.isArray(telemetryHistory?.[activeMachineId]) ? telemetryHistory[activeMachineId] : [];
  const activePred = activeFrame?.prediction || {};
  const hasPrediction = Boolean(activePred && typeof activePred.healthScore === 'number');

  const currentHealth = hasPrediction
    ? activePred.healthScore
    : (activeMachineId.endsWith('001') ? 98 : activeMachineId.endsWith('002') ? 68 : 24);

  const currentRisk = hasPrediction
    ? (activePred.riskLevel || 'low')
    : (activeMachineId.endsWith('001') ? 'low' : activeMachineId.endsWith('002') ? 'medium' : 'critical');

  const selectedSensorMeta =
    sensorOptions?.find(o => o.key === selectedSensorKey) || sensorOptions?.[0] || { key: 'vibration', label: 'Vibration Amplitude', unit: 'mm/s' };

  return (
    <Layout>
      <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 font-sans">
        {/* =================================================================== */}
        {/* 1. TOP HEADER & INTERACTIVE SIMULATION CONTROL BAR                  */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFE4DD] px-5 py-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-4 flex-nowrap">
            {/* Title & Live Status */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-9 h-9 rounded-xl bg-[#246B52]/10 border border-[#246B52]/20 flex items-center justify-center shrink-0">
                <Activity className="w-5 h-5 text-[#246B52]" />
              </div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-[#151D19] whitespace-nowrap">
                  Sensor Simulator & Cleaning Pipeline
                </h1>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#246B52]/10 text-[#246B52] border border-[#246B52]/20 whitespace-nowrap">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#246B52] animate-pulse" />
                  Auto-Sync
                </span>
              </div>
            </div>

            {/* Clean Single-Row Controls (No Wrap) */}
            <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
              {/* Reading Transmission Interval (5s, 10s, 30s, 1 hour) */}
              <div className="inline-flex items-center bg-[#F6F8F5] p-1 rounded-xl border border-[#DFE4DD] text-xs font-medium">
                {[
                  { id: '5s', label: '5s', sec: 5.0 },
                  { id: '10s', label: '10s', sec: 10.0 },
                  { id: '30s', label: '30s', sec: 30.0 },
                  { id: '1 hour', label: '1 hour', sec: 3600.0 }
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleIntervalSelect(opt.id, opt.sec)}
                    className={`px-2.5 py-1 rounded-lg transition-all text-xs whitespace-nowrap ${
                      selectedInterval === opt.id
                        ? 'bg-[#246B52] text-white font-bold shadow-xs'
                        : 'text-[#68736C] hover:text-[#151D19] hover:bg-white/60'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Anomaly Toggle */}
              <button
                type="button"
                onClick={() => setInjectAnomalies(!injectAnomalies)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all whitespace-nowrap ${
                  injectAnomalies
                    ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]'
                    : 'bg-[#F6F8F5] text-[#68736C] border-[#DFE4DD]'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                Anomalies: {injectAnomalies ? 'ON' : 'OFF'}
              </button>

              {/* Play / Pause / Resume */}
              {!isRunning ? (
                <button
                  type="button"
                  onClick={handleStartSimulation}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#184E3A] text-white hover:bg-[#133F2F] shadow-xs transition-all active:scale-98 whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Start
                </button>
              ) : isPaused ? (
                <button
                  type="button"
                  onClick={handleResumeSimulation}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-[#184E3A] text-white hover:bg-[#133F2F] shadow-xs transition-all whitespace-nowrap"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Resume
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handlePauseSimulation}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#B98232] text-white hover:bg-[#976926] shadow-xs transition-all whitespace-nowrap"
                >
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pause
                </button>
              )}

              {/* Stop Button */}
              {isRunning && (
                <button
                  type="button"
                  onClick={handleStopSimulation}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border border-[#DC2626] text-[#DC2626] bg-white hover:bg-[#FEF2F2] transition-all whitespace-nowrap"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Stop
                </button>
              )}

              {/* Reset Button */}
              <button
                type="button"
                onClick={handleResetSimulation}
                className="w-8 h-8 flex items-center justify-center rounded-xl border border-[#DFE4DD] text-[#68736C] hover:text-[#151D19] hover:bg-[#F6F8F5] transition-all shrink-0"
                title="Reset simulation and pipeline state"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 1.5 DATASET & OBSERVABILITY DIAGNOSTICS BAR                         */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFE4DD] px-5 py-3.5 shadow-xs">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-[#151D19] uppercase tracking-wider">
                Select Equipment Fleet:
              </span>
              <div className="inline-flex items-center bg-[#F6F8F5] p-1 rounded-xl border border-[#DFE4DD] text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => handleFleetSwitch('industrial')}
                  className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
                    fleetMode === 'industrial'
                      ? 'bg-[#184E3A] text-white shadow-xs font-bold'
                      : 'text-[#68736C] hover:text-[#151D19]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${fleetMode === 'industrial' ? 'bg-[#34D399]' : 'bg-[#9CA3AF]'}`} />
                  Industrial Rotating Machinery (Motors & Pumps — 7 Physical Sensors)
                </button>
                <button
                  type="button"
                  onClick={() => handleFleetSwitch('turbofan')}
                  className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-2 ${
                    fleetMode === 'turbofan'
                      ? 'bg-[#184E3A] text-white shadow-xs font-bold'
                      : 'text-[#68736C] hover:text-[#151D19]'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${fleetMode === 'turbofan' ? 'bg-[#34D399]' : 'bg-[#9CA3AF]'}`} />
                  NASA C-MAPSS Turbofans (FD001 / FD002 — 21 Sensors)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-[#68736C] font-mono">
              <span>Feed: <strong className="text-[#151D19]">{activeFrame?.source === 'physical_sensor' ? 'ESP32 Physical ADC' : 'Industrial Live Stream'}</strong></span>
              <span>&bull;</span>
              <span>Link: <strong className="text-[#246B52]">Auto-Connected (SSE Active)</strong></span>
              <span>&bull;</span>
              <span>Sampling: <strong className="text-[#151D19]">{selectedInterval}</strong></span>
              <span>&bull;</span>
              <span className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${isRunning && !isPaused ? 'bg-[#246B52] animate-ping' : 'bg-[#8A968E]'}`} />
                Status: <strong className={isRunning && !isPaused ? 'text-[#246B52]' : 'text-[#68736C]'}>{isRunning ? (isPaused ? 'Paused' : 'Streaming Active') : 'Idle (Ready)'}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 2. FLEET EQUIPMENT STATUS CARDS (3-COLUMN GRID)                     */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {activeFleetList.map(machine => {
            const isSelected = activeMachineId === machine.id;
            const frame = latestFrames?.[machine.id];
            const pred = frame?.prediction;

            const health = pred?.healthScore ?? machine.defaultHealth;
            const risk = pred?.riskLevel || machine.defaultRisk;
            const cycle = frame?.cycle || (machine.id.endsWith('001') ? 45 : machine.id.endsWith('002') ? 110 : 185);

            const isCritical = risk === 'critical';
            const isMedium = risk === 'medium' || risk === 'high';

            const badgeBg = isCritical
              ? 'bg-[#FEF2F2] text-[#B74747] border-[#FCA5A5]'
              : isMedium
              ? 'bg-[#FEF3C7] text-[#92400E] border-[#FCD34D]'
              : 'bg-[#ECFDF5] text-[#246B52] border-[#A7F3D0]';

            return (
              <div
                key={machine.id}
                onClick={() => setActiveMachineId(machine.id)}
                className={`cursor-pointer rounded-2xl p-5 border transition-all ${
                  isSelected
                    ? 'border-[#246B52] bg-white ring-2 ring-[#246B52]/20 shadow-sm'
                    : 'border-[#DFE4DD] bg-white hover:border-[#246B52]/50 shadow-xs'
                }`}
              >
                {/* Header: Machine ID & Criticality Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs bg-[#F6F8F5] text-[#151D19] border border-[#DFE4DD] px-2 py-0.5 rounded-md">
                      {machine.id.replace('MOTOR-', '').replace('Engine-', '')}
                    </span>
                    <div>
                      <h3 className="font-bold text-[#151D19] text-sm">
                        {machine.id}
                      </h3>
                      <p className="text-[11px] text-[#68736C] truncate max-w-[170px]">
                        {machine.name}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeBg}`}
                  >
                    {risk}
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isCritical ? 'bg-[#B74747]' : isMedium ? 'bg-[#B98232]' : 'bg-[#246B52]'
                      }`}
                    />
                  </span>
                </div>

                {/* Health & Life Metrics */}
                <div className="mt-4 pt-3 border-t border-[#F1F4EE] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#68736C] tracking-wider">
                      {fleetMode === 'turbofan' ? 'Remaining Life' : 'Health Score'}
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-2xl font-mono font-extrabold text-[#151D19]">
                        {fleetMode === 'turbofan'
                          ? pred?.predictedRUL ?? machine.defaultRul ?? 120
                          : `${health}%`}
                      </span>
                      {fleetMode === 'turbofan' && (
                        <span className="text-xs font-semibold text-[#68736C]">cycles</span>
                      )}
                    </div>
                    <LifeProgressBar
                      value={fleetMode === 'turbofan' ? pred?.predictedRUL ?? machine.defaultRul ?? 120 : health}
                      maxVal={fleetMode === 'turbofan' ? 150 : 100}
                      isCritical={isCritical}
                    />
                    <span className="text-[11px] text-[#68736C] font-mono mt-1 block">
                      Cycle #{cycle}
                    </span>
                  </div>

                  <HealthGauge score={health} size={64} />
                </div>

                {/* Model Attribution Badge & Action */}
                <div className="mt-4 pt-3 border-t border-[#F1F4EE] flex items-center justify-between text-xs">
                  <span className="text-[11px] text-[#68736C] font-medium flex items-center gap-1 truncate max-w-[150px]">
                    <Cpu className="w-3.5 h-3.5 shrink-0 text-[#246B52]" />
                    {fleetMode === 'turbofan'
                      ? machine.modelName
                      : 'ISO 10816-3 Fault Classifier'}
                  </span>

                  {isCritical ? (
                    <button
                      type="button"
                      onClick={e => handleOpenWorkOrder(e, machine.id)}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold bg-[#B74747] text-white hover:bg-[#973939] shadow-xs transition-all"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      Dispatch Order
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-semibold text-[#246B52] text-xs hover:underline">
                      Inspect Telemetry &rarr;
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* =================================================================== */}
        {/* DYNAMIC LIVE CHART & ML PROGNOSTICS HUD                             */}
        {/* =================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Dual-Line Telemetry Chart (2 Columns) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-[#DFE4DD] p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div className="flex items-center gap-2.5">
                  <Activity className="w-5 h-5 text-[#246B52]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#151D19]">
                    Dynamic Telemetry: {activeMachineId}
                  </h2>
                </div>

                {/* Sensor Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#68736C] font-semibold">Sensor:</span>
                  <select
                    value={selectedSensorKey}
                    onChange={e => setSelectedSensorKey(e.target.value)}
                    className="text-xs font-mono font-semibold px-3 py-1.5 rounded-lg border border-[#DFE4DD] bg-[#F6F8F5] text-[#151D19] focus:outline-none focus:ring-1 focus:ring-[#246B52]"
                  >
                    {sensorOptions.map(opt => (
                      <option key={opt.key} value={opt.key}>
                        {opt.key} &bull; {opt.label} ({opt.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chart Component */}
              <DualLineTelemetryChart
                history={activeHistory}
                sensorKey={selectedSensorKey}
                unit={selectedSensorMeta?.unit || 'mm/s'}
                label={selectedSensorMeta?.label || 'Vibration'}
              />

              {/* Raw Data Transducer Acquisition Strip */}
              <div className="mt-4 pt-3.5 border-t border-[#EEF2ED]">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
                  <span className="text-[11px] font-bold text-[#151D19] flex items-center gap-1.5 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-pulse" />
                    Live Raw Transducer Acquisition (Unfiltered Sensor Readings)
                  </span>
                  <span className="text-[10px] font-mono text-[#68736C]">
                    Transducer: {activeFrame?.source === 'physical_sensor' ? 'ESP32 / Physical ADC' : 'Industrial Sensor Stream'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {fleetMode === 'industrial' ? (
                    [
                      { label: 'Raw Temp', val: activeFrame?.raw_sensors?.temperature ?? 46.8, unit: '°C' },
                      { label: 'Raw Vibration', val: activeFrame?.raw_sensors?.vibration ?? 1.42, unit: 'mm/s' },
                      { label: 'Raw Speed', val: activeFrame?.raw_sensors?.rpm ?? 1485, unit: 'RPM' },
                      { label: 'Raw Pressure', val: activeFrame?.raw_sensors?.pressure ?? 4.21, unit: 'bar' },
                      { label: 'Raw Current', val: activeFrame?.raw_sensors?.current ?? 12.2, unit: 'A' },
                      { label: 'Raw Voltage', val: activeFrame?.raw_sensors?.voltage ?? 400.1, unit: 'V' },
                      { label: 'Raw Torque', val: activeFrame?.raw_sensors?.torque ?? 38.5, unit: 'Nm' }
                    ].map((m, idx) => (
                      <div key={idx} className="bg-[#F9FAF8] p-2 rounded-xl border border-[#DFE4DD] text-center">
                        <span className="text-[10px] text-[#68736C] font-semibold block truncate">{m.label}</span>
                        <span className="font-mono font-bold text-[#151D19] text-xs">
                          {m.val !== undefined && m.val !== null ? Number(m.val).toFixed(2) : '-'}
                        </span>
                        <span className="text-[9px] text-[#8A968E] ml-1">{m.unit}</span>
                      </div>
                    ))
                  ) : (
                    [
                      { label: 'Raw T24', val: activeFrame?.raw_sensors?.s_2 ?? 642.1, unit: '°R' },
                      { label: 'Raw T30', val: activeFrame?.raw_sensors?.s_3 ?? 1586.5, unit: '°R' },
                      { label: 'Raw T50', val: activeFrame?.raw_sensors?.s_4 ?? 1402.4, unit: '°R' },
                      { label: 'Raw P30', val: activeFrame?.raw_sensors?.s_7 ?? 553.8, unit: 'psia' },
                      { label: 'Raw Ps30', val: activeFrame?.raw_sensors?.s_11 ?? 47.32, unit: 'psia' },
                      { label: 'Raw Phi', val: activeFrame?.raw_sensors?.s_12 ?? 521.6, unit: 'ratio' },
                      { label: 'Raw NRc', val: activeFrame?.raw_sensors?.s_14 ?? 8132, unit: 'rpm' }
                    ].map((m, idx) => (
                      <div key={idx} className="bg-[#F9FAF8] p-2 rounded-xl border border-[#DFE4DD] text-center">
                        <span className="text-[10px] text-[#68736C] font-semibold block truncate">{m.label}</span>
                        <span className="font-mono font-bold text-[#151D19] text-xs">
                          {m.val !== undefined && m.val !== null ? Number(m.val).toFixed(2) : '-'}
                        </span>
                        <span className="text-[9px] text-[#8A968E] ml-1">{m.unit}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ML Prognostics HUD (1 Column) */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-[#DFE4DD] p-5 shadow-xs h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-[#F1F4EE]">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#246B52]" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#151D19]">
                      ML Prognostics
                    </h3>
                  </div>
                  <span className="text-[11px] font-mono text-[#246B52] font-semibold bg-[#246B52]/10 px-2 py-0.5 rounded">
                    Native Inference
                  </span>
                </div>

                {/* Health & Anomaly Gauges */}
                <div className="mt-4 flex items-center justify-between bg-[#F6F8F5] p-3.5 rounded-xl border border-[#DFE4DD]">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#68736C]">
                      Anomaly Risk Score
                    </span>
                    <div className="text-2xl font-mono font-extrabold text-[#151D19] mt-0.5">
                      {activePred?.anomalyScore ?? (100 - currentHealth)}%
                    </div>
                    <span className="text-[11px] font-semibold text-[#68736C] capitalize">
                      Tier: <strong className="text-[#151D19]">{activePred?.riskLevel || currentRisk}</strong>
                    </span>
                  </div>
                  <HealthGauge score={currentHealth} size={62} />
                </div>

                {/* Diagnosed Fault Mode */}
                <div className="mt-4 space-y-2 text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#68736C]">
                      Diagnosed Failure Mode
                    </span>
                    <p className="font-bold text-[#151D19] mt-0.5">
                      {activePred?.suspectedFailureMode ||
                        (activeMachineId.endsWith('003')
                          ? 'Severe Bearing Cage Breakdown & Thermal Runaway'
                          : activeMachineId.endsWith('002')
                          ? 'Bearing Raceway Wear & 1x Harmonic Drift'
                          : 'Normal Nominal Operation')}
                    </p>
                  </div>

                  {activePred?.physicsMetrics && (
                    <div className="p-2.5 rounded-lg bg-[#F9FAF8] border border-[#EEF2ED] space-y-1 font-mono text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-[#68736C]">ISO Severity:</span>
                        <span className="font-semibold text-[#151D19]">
                          {activePred.physicsMetrics.isoZone || 'Zone A (Good)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#68736C]">Shaft Power:</span>
                        <span className="font-semibold text-[#151D19]">
                          {activePred.physicsMetrics.mechanicalPowerWatts?.toFixed(0) || '5980'} W
                        </span>
                      </div>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#68736C]">
                      Recommended Action
                    </span>
                    <p className="text-[#55635B] mt-0.5 text-[11px] leading-relaxed">
                      {activePred?.recommendedAction ||
                        (activeMachineId.endsWith('003')
                          ? 'EMERGENCY TRIP: Lock-out and inspect compressor bearing housing immediately.'
                          : activeMachineId.endsWith('002')
                          ? 'Schedule bearing lubrication and vibration FFT check on next shift.'
                          : 'Continue routine scheduled condition monitoring.')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Work Order Dispatch Integration */}
              <div className="mt-5 pt-3 border-t border-[#F1F4EE]">
                <button
                  type="button"
                  onClick={e => handleOpenWorkOrder(e, activeMachineId)}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-[#184E3A] text-white hover:bg-[#133F2F] shadow-xs transition-all cursor-pointer"
                >
                  <Wrench className="w-3.5 h-3.5" />
                  Dispatch Maintenance Order
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* 5. RAW & PROCESSED TELEMETRY INSPECTOR (TABS)                       */}
        {/* =================================================================== */}
        <div className="bg-white rounded-2xl border border-[#DFE4DD] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#246B52]/10 flex items-center justify-center">
                <Eye className="w-4 h-4 text-[#246B52]" />
              </div>
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-[#151D19]">
                  Telemetry Inspector: {activeMachineId}
                </h2>
                <span className="text-[11px] text-[#68736C] font-mono">
                  Cycle #{activeFrame?.cycle || 45} &bull; Timestamp: {activeFrame?.timestamp || 'Real-time'}
                </span>
              </div>
            </div>

            {/* Inspector Navigation Tabs */}
            <div className="flex items-center bg-[#F6F8F5] p-1 rounded-xl border border-[#DFE4DD] text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInspectorTab('comparison')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'comparison'
                    ? 'bg-[#246B52] text-white shadow-xs'
                    : 'text-[#68736C] hover:text-[#151D19]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Raw vs. Cleaned
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('raw_json')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'raw_json'
                    ? 'bg-[#246B52] text-white shadow-xs'
                    : 'text-[#68736C] hover:text-[#151D19]'
                }`}
              >
                <Code className="w-3.5 h-3.5" />
                Raw Data Stream (JSON)
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('raw_log')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  inspectorTab === 'raw_log'
                    ? 'bg-[#246B52] text-white shadow-xs'
                    : 'text-[#68736C] hover:text-[#151D19]'
                }`}
              >
                <Activity className="w-3.5 h-3.5" />
                Raw Historical Log ({activeHistory.length})
              </button>
            </div>
          </div>

          {/* Tab 1: Comparison Table */}
          {inspectorTab === 'comparison' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#DFE4DD] bg-[#F6F8F5] text-[#68736C] uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-3">Parameter / Sensor</th>
                    <th className="py-2.5 px-3">Unit</th>
                    <th className="py-2.5 px-3 font-mono">Raw Reading</th>
                    <th className="py-2.5 px-3 font-mono">Cleaned (EMA)</th>
                    <th className="py-2.5 px-3 font-mono">Difference</th>
                    <th className="py-2.5 px-3">Pipeline Action</th>
                    <th className="py-2.5 px-3">Quality Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F4EE]">
                  {Array.isArray(activeFrame?.comparison_table) && activeFrame.comparison_table.length > 0 ? (
                    activeFrame.comparison_table.map((row, idx) => {
                      return (
                        <tr key={idx} className="hover:bg-[#F9FAF8] transition-colors">
                          <td className="py-2.5 px-3 font-medium text-[#151D19]">
                            {row?.name} <span className="text-[#8A968E] font-mono">({row?.sensor_key})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[#68736C]">{row?.unit}</td>
                          <td className="py-2.5 px-3 font-mono text-[#68736C]">
                            {row?.raw_value !== null && row?.raw_value !== undefined
                              ? Number(row.raw_value).toFixed(2)
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#151D19]">
                            {row?.cleaned_value !== null && row?.cleaned_value !== undefined
                              ? Number(row.cleaned_value).toFixed(2)
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-mono">
                            <span
                              className={
                                Math.abs(row?.diff || 0) > 0.5
                                  ? 'text-[#B98232] font-bold'
                                  : 'text-[#68736C]'
                              }
                            >
                              {(row?.diff || 0) > 0 ? `+${(row?.diff || 0).toFixed(2)}` : (row?.diff || 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[#55635B]">{row?.action || 'Preserved'}</td>
                          <td className="py-2.5 px-3 font-sans">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                row?.is_outlier
                                  ? 'bg-[#FEF3C7] text-[#92400E]'
                                  : row?.is_imputed
                                  ? 'bg-[#E0F2FE] text-[#0369A1]'
                                  : 'bg-[#ECFDF5] text-[#246B52]'
                              }`}
                            >
                              {row?.status || 'Valid'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-[#8A968E]">
                        Awaiting initial telemetry packet... Click Start to stream.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab 2: Raw Live JSON Packet Stream */}
          {inspectorTab === 'raw_json' && (
            <div className="relative">
              <button
                type="button"
                onClick={() => handleCopyJson(JSON.stringify(activeFrame, null, 2))}
                className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#246B52] text-white hover:bg-[#1B533F] transition-all shadow-xs z-10 cursor-pointer"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedJson ? 'Copied' : 'Copy JSON'}
              </button>
              <pre className="bg-[#151D19] text-[#A7F3D0] p-4 rounded-xl text-xs font-mono overflow-x-auto max-h-96 leading-relaxed">
                {activeFrame && Object.keys(activeFrame).length > 0
                  ? JSON.stringify(activeFrame, null, 2)
                  : '// Live telemetry packet JSON...'}
              </pre>
            </div>
          )}

          {/* Tab 3: Raw Historical Log */}
          {inspectorTab === 'raw_log' && (
            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-[#DFE4DD] bg-[#F6F8F5] text-[#68736C] uppercase text-[10px] font-bold font-sans">
                    <th className="py-2.5 px-3">Cycle</th>
                    <th className="py-2.5 px-3">Timestamp</th>
                    {fleetMode === 'industrial' ? (
                      <>
                        <th className="py-2.5 px-3">Temp (°C)</th>
                        <th className="py-2.5 px-3">Vib (mm/s)</th>
                        <th className="py-2.5 px-3">RPM</th>
                        <th className="py-2.5 px-3">Press (bar)</th>
                        <th className="py-2.5 px-3">Curr (A)</th>
                        <th className="py-2.5 px-3">Volt (V)</th>
                        <th className="py-2.5 px-3">Torque (Nm)</th>
                      </>
                    ) : (
                      <>
                        <th className="py-2.5 px-3">T24 (°R)</th>
                        <th className="py-2.5 px-3">T30 (°R)</th>
                        <th className="py-2.5 px-3">T50 (°R)</th>
                        <th className="py-2.5 px-3">P30 (psia)</th>
                        <th className="py-2.5 px-3">Ps30 (psia)</th>
                        <th className="py-2.5 px-3">Phi</th>
                        <th className="py-2.5 px-3">NRc (rpm)</th>
                      </>
                    )}
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F1F4EE]">
                  {activeHistory.filter(Boolean).slice(-20).reverse().map((pkt, idx) => (
                    <tr key={idx} className="hover:bg-[#F9FAF8]">
                      <td className="py-2.5 px-3 font-bold text-[#151D19]">#{pkt.cycle}</td>
                      <td className="py-2.5 px-3 text-[#68736C]">
                        {pkt.timestamp ? new Date(pkt.timestamp).toLocaleTimeString() : '-'}
                      </td>
                      {fleetMode === 'industrial' ? (
                        <>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.temperature !== undefined ? Number(pkt.raw_sensors.temperature).toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19] font-bold">
                            {pkt.raw_sensors?.vibration !== undefined ? Number(pkt.raw_sensors.vibration).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.rpm !== undefined ? Number(pkt.raw_sensors.rpm).toFixed(0) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.pressure !== undefined ? Number(pkt.raw_sensors.pressure).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.current !== undefined ? Number(pkt.raw_sensors.current).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.voltage !== undefined ? Number(pkt.raw_sensors.voltage).toFixed(1) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.torque !== undefined ? Number(pkt.raw_sensors.torque).toFixed(1) : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.s_2 !== undefined ? Number(pkt.raw_sensors.s_2).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.s_3 !== undefined ? Number(pkt.raw_sensors.s_3).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19] font-bold">
                            {pkt.raw_sensors?.s_4 !== undefined ? Number(pkt.raw_sensors.s_4).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.s_7 !== undefined ? Number(pkt.raw_sensors.s_7).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.s_11 !== undefined ? Number(pkt.raw_sensors.s_11).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.s_12 !== undefined ? Number(pkt.raw_sensors.s_12).toFixed(2) : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-[#151D19]">
                            {pkt.raw_sensors?.s_14 !== undefined ? Number(pkt.raw_sensors.s_14).toFixed(0) : '-'}
                          </td>
                        </>
                      )}
                      <td className="py-2.5 px-3 font-sans">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            pkt.status === 'VALID' || pkt.quality_status === 'VALID' ? 'bg-[#ECFDF5] text-[#246B52]' : 'bg-[#FEF3C7] text-[#92400E]'
                          }`}
                        >
                          {pkt.quality_status || pkt.status || 'VALID'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Maintenance Work Order Creation Modal */}
        {workOrderModalOpen && (
          <WorkOrderModal
            isOpen={workOrderModalOpen}
            onClose={() => setWorkOrderModalOpen(false)}
            preselectedMachine={workOrderMachine}
          />
        )}
      </div>
    </Layout>
  );
}

export default SensorSimulatorPage;
