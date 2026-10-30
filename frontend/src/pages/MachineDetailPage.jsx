import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Activity,
  Wrench,
  Sparkles,
  ChevronRight
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
        const updatedHistory = await api.getSensorHistory(machineId, selectedRange);
        setSensorData(updatedHistory);
      }
    } catch (err) {
      addToast(`Inference error: ${err.message}`, 'warning');
    } finally {
      setIsInferring(false);
    }
  };

  const enrichedSensorData = useMemo(() => {
    if (!sensorData || sensorData.length === 0) return [];
    return sensorData.map((d, index) => {
      const cycleProgress = sensorData.length > 1 ? index / (sensorData.length - 1) : 0;
      const isHighRisk = (machine?.riskScore || 0) > 50;

      const airTemp = +(298.15 + (d.temperature ? (d.temperature - 640) * 0.05 : 0) + Math.sin(index * 0.5) * 0.4).toFixed(1);
      const procTemp = +(airTemp + 10.2 + (isHighRisk ? cycleProgress * 4.5 : cycleProgress * 1.0) + Math.cos(index * 0.4) * 0.3).toFixed(1);
      const rotSpeed = d.rpm || d.s8_nf || Math.round(1500 + Math.sin(index * 0.8) * 35);
      const vib = typeof d.vibration === 'number' ? d.vibration : +(2.4 + cycleProgress * 1.5).toFixed(2);
      const baseTorque = isHighRisk ? 48.0 + cycleProgress * 16.5 : 40.0 + cycleProgress * 4.0;
      const torque = +(baseTorque + Math.sin(index * 0.9) * 2.2).toFixed(1);
      const initialWear = Math.max(0, (machine?.currentCycle || 100) - sensorData.length);
      const toolWear = Math.round(initialWear + index * 4.2 + (isHighRisk ? cycleProgress * 45 : 0));
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
      <Layout pageTitle="Machine Telemetry">
        <div className="py-24 text-center text-xs text-[#68736C]">
          Loading telemetry stream...
        </div>
      </Layout>
    );
  }

  if (!machine) {
    return (
      <Layout pageTitle="Asset Not Found">
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-8 text-center max-w-lg mx-auto">
          <AlertTriangle size={28} className="text-[#B74747] mx-auto mb-2" />
          <h2 className="text-sm font-semibold text-[#202925] mb-1">Asset Not Found</h2>
          <p className="text-xs text-[#68736C] mb-4">
            Machine ID <span className="font-mono text-[#246B52] font-semibold">{machineId}</span> does not exist in the registry.
          </p>
          <button
            onClick={() => navigate('/machines')}
            className="px-3 py-1.5 rounded-md bg-[#F5F6F2] hover:bg-[#E8F0EA] border border-[#DFE4DD] text-[#202925] text-xs font-medium"
          >
            Return to Fleet
          </button>
        </div>
      </Layout>
    );
  }

  const relatedWorkOrders = workOrders.filter(w => w.machineId === machine.id);

  const sensorConfigs = {
    s2_t24: { label: 'LPC Outlet Temp (°C)', color: '#246B52' },
    s4_t50: { label: 'LPT Outlet Temp (°C)', color: '#B74747' },
    s7_p30: { label: 'HPC Outlet Pressure (kPa)', color: '#2B6E8A' },
    s8_nf: { label: 'Fan Speed (RPM)', color: '#B98232' },
    s9_nc: { label: 'Core Speed (RPM)', color: '#368363' },
    s11_ps30: { label: 'HPC Static Pressure (psia)', color: '#246B52' },
    vibration: { label: 'Vibration (mm/s)', color: '#B74747' },
  };

  return (
    <Layout pageTitle={`Asset: ${machine.id}`}>
      <div className="space-y-5">
        {/* HEADER CONTROLS */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DFE4DD] gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/machines')}
              className="p-1.5 rounded-md bg-white hover:bg-[#F5F6F2] border border-[#DFE4DD] text-[#68736C] hover:text-[#202925] transition-colors"
              aria-label="Back to machine list"
            >
              <ArrowLeft size={16} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-semibold text-[#202925]">{machine.name}</h1>
                <select
                  value={machine.status}
                  onChange={(e) => {
                    const newStatus = e.target.value;
                    setMachine(prev => ({ ...prev, status: newStatus }));
                    updateMachineStatus(machine.id, newStatus);
                  }}
                  className="bg-white border border-[#DFE4DD] rounded px-2 py-0.5 text-xs font-medium text-[#202925] focus:border-[#246B52] focus:outline-none cursor-pointer"
                >
                  <option value="Operational">Operational</option>
                  <option value="Degraded">Degraded</option>
                  <option value="Under Maintenance">Under Maintenance</option>
                  <option value="Critical">Critical</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#68736C] mt-0.5">
                <span className="font-mono text-[#202925]">{machine.id}</span>
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
              className="px-3 py-1.5 rounded-md bg-white hover:bg-[#F5F6F2] border border-[#DFE4DD] text-xs font-medium text-[#202925] flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Sparkles size={13} className="text-[#246B52]" />
              <span>{isInferring ? 'Evaluating...' : 'Run Inference'}</span>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="px-3.5 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Wrench size={13} /> Dispatch Order
            </button>
          </div>
        </div>

        {/* 5-BOX OPERATIONAL MATRIX */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="bg-white border border-[#DFE4DD] rounded-lg p-3">
            <span className="text-xs font-medium text-[#68736C] block">Health Score</span>
            <div className="text-2xl font-semibold font-mono mt-1 text-[#202925]">{machine.healthScore}%</div>
            <span className="text-[11px] text-[#85918A]">Operating baseline</span>
          </div>

          <div className="bg-white border border-[#DFE4DD] rounded-lg p-3">
            <span className="text-xs font-medium text-[#68736C] block">Degradation Risk</span>
            <div className={`text-2xl font-semibold font-mono mt-1 ${machine.riskScore >= 65 ? 'text-[#B74747]' : machine.riskScore >= 35 ? 'text-[#B98232]' : 'text-[#368363]'}`}>
              {machine.riskScore}
            </div>
            <span className="text-[11px] text-[#85918A]">{machine.riskLevel} tier</span>
          </div>

          <div className="bg-white border border-[#DFE4DD] rounded-lg p-3">
            <span className="text-xs font-medium text-[#68736C] block">Predicted RUL</span>
            <div className="text-2xl font-semibold font-mono mt-1 text-[#246B52]">{machine.predictedRul}</div>
            <span className="text-[11px] text-[#85918A]">{machine.rulUnit} to limit</span>
          </div>

          <div className="bg-white border border-[#DFE4DD] rounded-lg p-3 flex flex-col justify-between">
            <div>
              <span className="text-xs font-medium text-[#68736C] block">Criticality</span>
              <div className="mt-1.5">
                <PriorityBadge priority={machine.criticality} />
              </div>
            </div>
            <span className="text-[11px] text-[#85918A] block mt-1 font-mono">${machine.downtimeCostPerHour?.toLocaleString()}/hr downtime</span>
          </div>

          <div className="bg-white border border-[#DFE4DD] rounded-lg p-3">
            <span className="text-xs font-medium text-[#68736C] block">Current Cycle</span>
            <div className="text-2xl font-semibold font-mono mt-1 text-[#202925]">#{machine.currentCycle}</div>
            <span className="text-[11px] text-[#85918A] font-mono">{machine.operatingHours} hrs</span>
          </div>
        </div>

        {/* PRIMARY SENSOR TREND CHART */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-[#E7ECE5] gap-2">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-[#246B52]" />
              <span className="text-xs font-semibold text-[#202925]">
                Telemetry Stream History
              </span>
            </div>

            {/* Sensor selector & cycle window */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedSensor}
                onChange={(e) => setSelectedSensor(e.target.value)}
                className="bg-[#F5F6F2] border border-[#DFE4DD] text-xs text-[#202925] px-2.5 py-1 rounded focus:border-[#246B52] focus:bg-white focus:outline-none"
              >
                <option value="s2_t24">LPC Outlet Temp (°C)</option>
                <option value="s4_t50">LPT Outlet Temp (°C)</option>
                <option value="s7_p30">HPC Outlet Pressure (kPa)</option>
                <option value="s8_nf">Fan Speed (RPM)</option>
                <option value="s9_nc">Core Speed (RPM)</option>
                <option value="s11_ps30">HPC Static Pressure (psia)</option>
                <option value="vibration">Vibration Amplitude (mm/s)</option>
              </select>

              <div className="flex items-center border border-[#DFE4DD] rounded overflow-hidden text-xs">
                {[20, 35, 50].map(cnt => (
                  <button
                    key={cnt}
                    onClick={() => setSelectedRange(cnt)}
                    className={`px-2 py-1 font-mono text-[11px] ${selectedRange === cnt ? 'bg-[#E8F0EA] text-[#246B52] font-semibold' : 'bg-white text-[#68736C] hover:text-[#202925]'}`}
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
            height={240}
          />
        </div>

        {/* MULTI-SENSOR TELEMETRY CARDS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Temperature Profile */}
          <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">Temperature Gradient</span>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-[#246B52]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#246B52]" /> Air (K)
                </span>
                <span className="flex items-center gap-1 text-[#B74747]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#B74747]" /> Process (K)
                </span>
              </div>
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'airTemperature', label: 'Air Temp (K)', color: '#246B52' },
                { key: 'processTemperature', label: 'Process Temp (K)', color: '#B74747' }
              ]}
              height={180}
            />
          </div>

          {/* Rotational Speed */}
          <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">Spindle & Core Velocity</span>
              <span className="text-[11px] font-mono text-[#68736C]">RPM</span>
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'rotationalSpeed', label: 'Rotational Speed', color: '#B98232' }
              ]}
              height={180}
            />
          </div>

          {/* Mechanical Vibration */}
          <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">Vibration Amplitude</span>
              <span className="text-[11px] font-mono text-[#68736C]">mm/s</span>
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'vibration', label: 'Vibration', color: '#B74747' }
              ]}
              height={180}
            />
          </div>

          {/* Operating Pressure */}
          <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">Manifold Pressure</span>
              <span className="text-[11px] font-mono text-[#68736C]">bar</span>
            </div>
            <MultiSensorTrendChart
              data={enrichedSensorData}
              series={[
                { key: 'pressureBar', label: 'Pressure (bar)', color: '#2B6E8A' }
              ]}
              height={180}
            />
          </div>
        </div>

        {/* TWO-COLUMN DIAGNOSTICS & ACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Anomaly Hypothesis & Degradation Factors */}
          <div className="lg:col-span-6 bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-3">
            <div className="pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">
                Diagnostic Evidence & Signals
              </span>
            </div>

            <div>
              <span className="text-xs text-[#68736C] block mb-1">Suspected Fault Mode:</span>
              <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD] text-[#202925] text-xs font-medium">
                {machine.predictedFault}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-[#68736C] block">Contributing Telemetry Factors:</span>
              {machine.topFactors.map((f, i) => (
                <div key={i} className="p-2 rounded-md bg-[#F5F6F2] border border-[#DFE4DD] flex items-center justify-between text-xs">
                  <span className="text-[#202925]">{f.name}</span>
                  <span className="font-mono font-semibold text-[#246B52]">{f.value}%</span>
                </div>
              ))}
            </div>

            <div className="p-2.5 rounded-md bg-[#E8F0EA] border border-[#D1E1D5] text-xs text-[#246B52]">
              <strong>Recommended Action: </strong>{machine.recommendedAction}
            </div>
          </div>

          {/* Machine Work Orders */}
          <div className="lg:col-span-6 bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
              <span className="text-xs font-semibold text-[#202925]">
                Associated Work Orders ({relatedWorkOrders.length})
              </span>
              <button
                onClick={() => setModalOpen(true)}
                className="text-xs text-[#246B52] hover:underline font-medium cursor-pointer"
              >
                + New Order
              </button>
            </div>

            {relatedWorkOrders.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#68736C]">
                No active work orders dispatched for this machine.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {relatedWorkOrders.map(wo => (
                  <div key={wo.id} className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD] text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-[#202925]">{wo.id}</span>
                      <StatusBadge status={wo.status} />
                    </div>
                    <p className="text-[#68736C] text-xs">{wo.suspectedIssue || wo.title}</p>
                    <div className="flex items-center justify-between text-[11px] text-[#85918A] pt-1 border-t border-[#DFE4DD]">
                      <span>Assigned: {wo.technician}</span>
                      <span className="font-mono">{wo.scheduledDate}</span>
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
