import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Layers,
  ArrowLeft,
  Calendar,
  AlertTriangle,
  Activity,
  Wrench,
  Clock,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Sliders,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { SensorTrendChart, MultiSensorTrendChart } from '../components/charts/ChartComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';
import { api } from '../services/api';

export function MachineDetailPage() {
  const { machineId } = useParams();
  const navigate = useNavigate();
  const { machines, workOrders, addToast, runMachinePrediction, updateMachineStatus } = useAppData();

  const [machine, setMachine] = useState(null);
  const [sensorData, setSensorData] = useState([]);
  const [selectedSensor, setSelectedSensor] = useState('s2_t24');
  const [selectedRange, setSelectedRange] = useState(35);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isInferring, setIsInferring] = useState(false);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const found = machines.find(m => m.id === machineId);
      if (found) {
        setMachine(found);
        const history = await api.getSensorHistory(found.id, selectedRange);
        setSensorData(history);
      }
      setLoading(false);
    }
    loadData();
  }, [machineId, machines, selectedRange]);

  const handleSimulateInference = async () => {
    setIsInferring(true);
    try {
      const pred = await runMachinePrediction(machineId, machine?.operatingParameters);
      if (pred) {
        setMachine(prev => ({
          ...prev,
          healthScore: pred.healthScore ?? prev.healthScore,
          riskScore: pred.riskScore ?? prev.riskScore,
          riskLevel: pred.riskBand ?? prev.riskLevel,
          predictedRul: pred.predictedRul ?? prev.predictedRul,
          predictedFault: pred.suspectedFailureMode || prev.predictedFault,
          recommendedAction: pred.recommendedAction || prev.recommendedAction
        }));
        // Reload sensor history as new point was saved to MongoDB
        const updatedHistory = await api.getSensorHistory(machineId, selectedRange);
        setSensorData(updatedHistory);
      }
    } catch (err) {
      addToast(`Inference error: ${err.message}`, 'warning');
    } finally {
      setIsInferring(false);
    }
  };

  // Compute five standard sensor signals, reusing telemetry and augmenting simulated fields:
  // 1. Temperature: airTemperature & processTemperature (Kelvin)
  // 2. Rotational Speed: rotationalSpeed (RPM)
  // 3. Vibration: vibration (mm/s)
  // 4. Torque and Tool Wear: torque (Nm) & toolWear (min)
  // 5. Pressure: pressureBar (bar)
  const enrichedSensorData = useMemo(() => {
    if (!sensorData || sensorData.length === 0) return [];
    return sensorData.map((d, index) => {
      const cycleProgress = sensorData.length > 1 ? index / (sensorData.length - 1) : 0;
      const isHighRisk = (machine?.riskScore || 0) > 50;

      // airTemperature: baseline ~298K (approx 25°C ambient) with slight drift
      const airTemp = +(298.15 + (d.temperature ? (d.temperature - 640) * 0.05 : 0) + Math.sin(index * 0.5) * 0.4).toFixed(1);
      // processTemperature: baseline ~308K with operational thermal load
      const procTemp = +(airTemp + 10.2 + (isHighRisk ? cycleProgress * 4.5 : cycleProgress * 1.0) + Math.cos(index * 0.4) * 0.3).toFixed(1);

      // rotationalSpeed: reuse rpm / s8_nf (approx 1400 - 2400 RPM)
      const rotSpeed = d.rpm || d.s8_nf || Math.round(1500 + Math.sin(index * 0.8) * 35);

      // vibration: reuse vibration amplitude (mm/s)
      const vib = typeof d.vibration === 'number' ? d.vibration : +(2.4 + cycleProgress * 1.5).toFixed(2);

      // torque (Nm) & toolWear (min)
      // Torque typically 35-65 Nm with degradation variance; tool wear accumulates over operating window
      const baseTorque = isHighRisk ? 48.0 + cycleProgress * 16.5 : 40.0 + cycleProgress * 4.0;
      const torque = +(baseTorque + Math.sin(index * 0.9) * 2.2).toFixed(1);
      const initialWear = Math.max(0, (machine?.currentCycle || 100) - sensorData.length);
      const toolWear = Math.round(initialWear + index * 4.2 + (isHighRisk ? cycleProgress * 45 : 0));

      // pressureBar: convert HPC pressure kPa (e.g. ~540-560 kPa = ~5.4-5.6 bar)
      const pressureBar = d.s7_p30 ? +(d.s7_p30 / 100).toFixed(2) : +(5.5 - (isHighRisk ? cycleProgress * 0.35 : 0.05)).toFixed(2);

      return {
        ...d,
        airTemperature: airTemp,
        processTemperature: procTemp,
        rotationalSpeed: rotSpeed,
        vibration: vib,
        torque,
        toolWear,
        pressureBar
      };
    });
  }, [sensorData, machine]);

  if (loading) {
    return (
      <Layout pageTitle="Machine Diagnostic Deep Dive">
        <div className="py-24 text-center font-mono text-xs text-[#68756F]">
          Loading machine telemetry stream & sensor history...
        </div>
      </Layout>
    );
  }

  if (!machine) {
    return (
      <Layout pageTitle="Asset Not Found">
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-8 text-center max-w-lg mx-auto font-mono">
          <AlertTriangle size={32} className="text-[#B94040] mx-auto mb-3" />
          <h2 className="text-sm font-bold text-[#202A27] uppercase mb-1">Asset Not Found</h2>
          <p className="text-xs text-[#68756F] mb-4">
            Machine ID <span className="text-[#176B52]">{machineId}</span> does not exist in the registered telemetry pool.
          </p>
          <button
            onClick={() => navigate('/machines')}
            className="px-3 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] border border-[#D2DDD5] text-[#202A27] text-xs"
          >
            Return to Fleet Inventory
          </button>
        </div>
      </Layout>
    );
  }

  const relatedWorkOrders = workOrders.filter(w => w.machineId === machine.id);

  const sensorConfigs = {
    s2_t24: { label: 's2: T24 LPC Outlet Temp (°C)', color: '#176B52' },
    s4_t50: { label: 's4: T50 LPT Outlet Temp (°C)', color: '#B94040' },
    s7_p30: { label: 's7: P30 HPC Outlet Pressure (kPa)', color: '#38BDF8' },
    s8_nf: { label: 's8: Nf Physical Fan Speed (RPM)', color: '#D99A24' },
    s9_nc: { label: 's9: Nc Physical Core Speed (RPM)', color: '#A78BFA' },
    s11_ps30: { label: 's11: Ps30 HPC Static Pressure (psia)', color: '#27845C' },
    vibration: { label: 'Vibration Amplitude (mm/s)', color: '#E879F9' },
  };

  return (
    <Layout pageTitle={`Diagnostic: ${machine.id}`}>
      <div className="space-y-4 font-mono">
        {/* HEADER CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/machines')}
              className="p-1.5 rounded bg-[#F4F7F5] hover:bg-[#E8EFEA] border border-[#E0E6E0] text-[#68756F] hover:text-[#202A27] transition-colors"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-[#202A27]">{machine.name}</h1>
                <select
                  value={machine.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setMachine(prev => ({ ...prev, status: newStatus }));
                    updateMachineStatus(machine.id, newStatus);
                  }}
                  className="bg-[#F7FAF8] hover:bg-[#E8EFEA] border border-[#E0E6E0] rounded px-2.5 py-1 text-xs font-semibold text-[#202A27] focus:border-[#176B52] focus:outline-none cursor-pointer"
                  title="Change machine operating status in MongoDB"
                >
                  <option value="Operational">Operational</option>
                  <option value="Degraded">Degraded</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#68756F] mt-0.5">
                <span>{machine.id}</span>
                <span>•</span>
                <span>{machine.line}</span>
                <span>•</span>
                <span>{machine.type}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/ai-assistant?machineId=${machine?.id}`)}
              className="px-3 py-1.5 rounded bg-[#176B52]/10 hover:bg-[#176B52]/20 border border-[#176B52]/30 text-xs text-[#176B52] flex items-center gap-1.5 transition-colors font-medium cursor-pointer"
              title="Open AI Maintenance Assistant with this machine's telemetry context"
            >
              <Sparkles size={13} className="text-[#176B52]" />
              <span>Ask AI Copilot</span>
            </button>

            <button
              onClick={handleSimulateInference}
              disabled={isInferring}
              className="px-3 py-1.5 rounded bg-[#F4F7F5] hover:bg-[#E8EFEA] border border-[#E0E6E0] text-xs text-[#202A27] flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles size={13} className="text-[#176B52]" />
              <span>{isInferring ? 'Recomputing...' : 'Run Prediction API'}</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Wrench size={14} /> Create Work Order
            </button>
          </div>
        </div>

        {/* 5-BOX OPERATIONAL SPECIFICATION MATRIX */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3">
            <span className="text-[10px] text-[#68756F] uppercase tracking-wider block">Health Index</span>
            <div className="text-2xl font-bold mt-1 text-[#202A27]">{machine.healthScore}%</div>
            <span className="text-[10px] text-[#829189]">Operating performance</span>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3">
            <span className="text-[10px] text-[#68756F] uppercase tracking-wider block">Degradation Risk</span>
            <div className={`text-2xl font-bold mt-1 ${machine.riskScore >= 65 ? 'text-[#B94040]' : machine.riskScore >= 35 ? 'text-[#D99A24]' : 'text-[#27845C]'}`}>
              {machine.riskScore} <span className="text-xs text-[#829189]">/ 100</span>
            </div>
            <span className="text-[10px] text-[#829189]">{machine.riskLevel} classification</span>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3">
            <span className="text-[10px] text-[#68756F] uppercase tracking-wider block">Predicted RUL</span>
            <div className="text-2xl font-bold mt-1 text-[#176B52]">{machine.predictedRul}</div>
            <span className="text-[10px] text-[#829189]">{machine.rulUnit} to service limit</span>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3 flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-[#68756F] uppercase tracking-wider block">Asset Criticality</span>
              <div className="mt-1.5">
                <PriorityBadge priority={machine.criticality} />
              </div>
            </div>
            <span className="text-[10px] text-[#829189] block mt-2">Production Impact: {machine.productionImpact}%</span>
          </div>

          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3">
            <span className="text-[10px] text-[#68756F] uppercase tracking-wider block">Service Cycle</span>
            <div className="text-lg font-bold mt-1 text-[#202A27]">Cycle #{machine.currentCycle}</div>
            <span className="text-[10px] text-[#829189]">{machine.operatingHours} cumulative hrs</span>
          </div>
        </div>

        {/* TIME-SERIES SENSOR DEGRADATION VISUALIZATION */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#E0E6E0] gap-2">
            <div>
              <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider flex items-center gap-2">
                <Activity size={14} className="text-[#176B52]" /> Sensor Telemetry Historical Trajectory
              </span>
              <p className="text-[11px] text-[#68756F]">
                Observed multi-channel sensor dynamics over consecutive run-to-failure cycles
              </p>
            </div>

            {/* Sensor selector & cycle window */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className="bg-[#F7FAF8] border border-[#E0E6E0] text-xs text-[#202A27] px-2.5 py-1 rounded focus:border-[#176B52] focus:outline-none"
              >
                <option value="s2_t24">s2: T24 LPC Outlet Temp (°C)</option>
                <option value="s4_t50">s4: T50 LPT Outlet Temp (°C)</option>
                <option value="s7_p30">s7: P30 HPC Outlet Pressure (kPa)</option>
                <option value="s8_nf">s8: Nf Fan Speed (RPM)</option>
                <option value="s9_nc">s9: Nc Core Speed (RPM)</option>
                <option value="s11_ps30">s11: Ps30 Static Pressure HPC (psia)</option>
                <option value="vibration">Vibration Amplitude (mm/s)</option>
              </select>

              <div className="flex items-center border border-[#E0E6E0] rounded overflow-hidden text-xs">
                {[20, 35, 50].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => setSelectedRange(cnt)}
                    className={`px-2 py-1 ${selectedRange === cnt ? 'bg-[#DFE8E2] text-[#202A27]' : 'bg-[#F4F7F5] text-[#68756F] hover:text-[#202A27]'}`}
                  >
                    {cnt} cyc
                  </button>
                ))}
              </div>
            </div>
          </div>

          <SensorTrendChart
            data={sensorData}
            selectedSensor={selectedSensor}
            sensorLabel={sensorConfigs[selectedSensor].label}
            color={sensorConfigs[selectedSensor].color}
            height={260}
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-2 border-t border-[#E0E6E0] text-[11px] text-[#68756F] gap-2">
            <span>Telemetric Source: {machine.dataSource}</span>
            <span className="flex items-center gap-1.5 text-[#27845C]">
              <ShieldCheck size={13} /> {machine.dataQuality}
            </span>
          </div>
        </div>

        {/* ADDITIONAL SPECIALIZED SENSOR TELEMETRY GRAPHS (4 ADDITIONAL GRAPHS) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Graph 1: Temperature (airTemperature and processTemperature) */}
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-[#176B52]" /> Temperature Profile
                </span>
                <p className="text-[11px] text-[#68756F]">
                  Thermal tracking: Air Temperature &amp; Process Temperature (K)
                </p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8EFEA] border border-[#D2DDD5] text-[#27845C]">
                Replay Stream
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-[#176B52]">
                <span className="w-2 h-2 rounded-full bg-[#176B52]" /> airTemperature (K)
              </span>
              <span className="flex items-center gap-1.5 text-[#B94040]">
                <span className="w-2 h-2 rounded-full bg-[#B94040]" /> processTemperature (K)
              </span>
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'airTemperature', label: 'Air Temperature (K)', color: '#176B52' },
                { key: 'processTemperature', label: 'Process Temperature (K)', color: '#B94040' }
              ]}
              height={200}
            />
            <div className="pt-2 border-t border-[#E0E6E0] flex items-center justify-between text-[11px] text-[#68756F]">
              <span>Differential gradient tracked across cycles</span>
              <span className="text-[#829189]">Unit: Kelvin (K)</span>
            </div>
          </div>

          {/* Graph 2: Rotational Speed */}
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-[#D99A24]" /> Rotational Speed
                </span>
                <p className="text-[11px] text-[#68756F]">
                  Shaft &amp; Spindle Velocity over operating window
                </p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8EFEA] border border-[#D2DDD5] text-[#27845C]">
                Replay Stream
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#D99A24]">
              <span className="w-2 h-2 rounded-full bg-[#D99A24]" /> rotationalSpeed (RPM)
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'rotationalSpeed', label: 'Rotational Speed (RPM)', color: '#D99A24' }
              ]}
              height={200}
            />
            <div className="pt-2 border-t border-[#E0E6E0] flex items-center justify-between text-[11px] text-[#68756F]">
              <span>Synchronized with C-MAPSS fan/core velocity</span>
              <span className="text-[#829189]">Unit: RPM</span>
            </div>
          </div>

          {/* Graph 3: Vibration */}
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-[#E879F9]" /> Mechanical Vibration
                </span>
                <p className="text-[11px] text-[#68756F]">
                  Tri-axial vibration velocity amplitude &amp; harmonic resonance
                </p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8EFEA] border border-[#D2DDD5] text-[#27845C]">
                Replay Stream
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#E879F9]">
              <span className="w-2 h-2 rounded-full bg-[#E879F9]" /> vibration (mm/s)
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'vibration', label: 'Vibration Amplitude (mm/s)', color: '#E879F9' }
              ]}
              height={200}
            />
            <div className="pt-2 border-t border-[#E0E6E0] flex items-center justify-between text-[11px] text-[#68756F]">
              <span>ISO 10816 vibration severity monitoring</span>
              <span className="text-[#829189]">Unit: mm/s</span>
            </div>
          </div>

          {/* Graph 4: Torque and Tool Wear */}
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-[#38BDF8]" /> Torque &amp; Tool Wear
                </span>
                <p className="text-[11px] text-[#68756F]">
                  Drive load resistance &amp; cumulative mechanical wear
                </p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8EFEA] border border-[#D2DDD5] text-[#D99A24]">
                Simulated Demo History
              </span>
            </div>
            <div className="flex items-center gap-4 text-[11px]">
              <span className="flex items-center gap-1.5 text-[#38BDF8]">
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]" /> torque (Nm) [Left Axis]
              </span>
              <span className="flex items-center gap-1.5 text-[#A78BFA]">
                <span className="w-2 h-2 rounded-full bg-[#A78BFA]" /> toolWear (min) [Right Axis]
              </span>
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'torque', label: 'Torque (Nm)', color: '#38BDF8', yAxisId: 'left' },
                { key: 'toolWear', label: 'Tool Wear (min)', color: '#A78BFA', yAxisId: 'right' }
              ]}
              yAxes={[
                { id: 'left', orientation: 'left' },
                { id: 'right', orientation: 'right' }
              ]}
              height={200}
            />
            <div className="pt-2 border-t border-[#E0E6E0] flex items-center justify-between text-[11px] text-[#68756F]">
              <span className="text-[#D99A24]/90">Simulated demo history: dual-axis wear projection</span>
              <span className="text-[#829189]">Nm / min</span>
            </div>
          </div>

          {/* Graph 5: Pressure */}
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3 lg:col-span-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider flex items-center gap-2">
                  <Activity size={14} className="text-[#27845C]" /> Operating Pressure
                </span>
                <p className="text-[11px] text-[#68756F]">
                  System pneumatic / hydraulic manifold pressure
                </p>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#E8EFEA] border border-[#D2DDD5] text-[#27845C]">
                Replay Stream
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#27845C]">
              <span className="w-2 h-2 rounded-full bg-[#27845C]" /> pressureBar (bar)
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'pressureBar', label: 'Operating Pressure (bar)', color: '#27845C' }
              ]}
              height={200}
            />
            <div className="pt-2 border-t border-[#E0E6E0] flex items-center justify-between text-[11px] text-[#68756F]">
              <span>Converted static pressure telemetry baseline</span>
              <span className="text-[#829189]">Unit: bar</span>
            </div>
          </div>
        </div>

        {/* TWO-COLUMN DIAGNOSTICS & ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Explainability & Suspected Component Card */}
          <div className="lg:col-span-6 bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#202A27] flex items-center gap-2">
                <Sparkles size={14} className="text-[#176B52]" /> Diagnostic Evidence & Contributing Signals
              </span>
              <span className="text-[10px] text-[#829189]">Explainable AI</span>
            </div>

            <div>
              <span className="text-[11px] text-[#68756F] block mb-1">Suspected Anomaly Hypothesis:</span>
              <div className="p-2.5 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-[#202A27] text-xs">
                {machine.predictedFault}
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] text-[#68756F] block">Top Ranked Degradation Factors:</span>
              {machine.topFactors.map((f, i) => (
                <div key={i} className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex items-center justify-between text-xs">
                  <span className="text-[#384641]">{f.name}</span>
                  <span className="font-bold text-[#176B52]">{f.value}%</span>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded bg-[#F4F7F5]/60 border border-[#E0E6E0] text-[11px] text-[#68756F] leading-relaxed">
              <strong className="text-[#202A27]">Operator Advisory: </strong>
              C-MAPSS models highlight influential telemetric channels. Field engineers must visually inspect physical clearances before disassembling assemblies.
            </div>
          </div>

          {/* Machine Work Orders & Historical Interventions */}
          <div className="lg:col-span-6 bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <span className="text-xs font-bold uppercase tracking-wider text-[#202A27] flex items-center gap-2">
                <Wrench size={14} className="text-[#38BDF8]" /> Machine Maintenance Tasks ({relatedWorkOrders.length})
              </span>
              <button
                onClick={() => setModalOpen(true)}
                className="text-[11px] text-[#176B52] hover:underline"
              >
                + Dispatch Order
              </button>
            </div>

            {relatedWorkOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#68756F] border border-dashed border-[#E0E6E0] rounded">
                No active work orders dispatched for this machine.
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {relatedWorkOrders.map(wo => (
                  <div key={wo.id} className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0] text-xs space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#202A27]">{wo.id}</span>
                      <StatusBadge status={wo.status} />
                    </div>
                    <p className="text-[#68756F] text-[11px] line-clamp-2">{wo.suspectedIssue}</p>
                    <div className="flex items-center justify-between text-[10px] text-[#75837D] pt-1 border-t border-[#E0E6E0]">
                      <span>Tech: {wo.technician.split(' ')[0]}</span>
                      <span>Scheduled: {wo.scheduledDate}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <WorkOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        preselectedMachine={machine}
      />
    </Layout>
  );
}
