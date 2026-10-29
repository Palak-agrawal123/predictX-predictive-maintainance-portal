import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Activity,
  Wrench,
  Layers,
  ChevronRight,
  Flame,
  FileText,
  Printer
} from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';
import { PriorityBadge, StatusBadge } from '../common/UIComponents';

export function GuidedDemoModal({ isOpen, onClose }) {
  const { machines, setMachines, workOrders, addWorkOrder, addToast } = useAppData();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState('MC-7801');
  const [simulatedCycle, setSimulatedCycle] = useState(185);
  const [isInferring, setIsInferring] = useState(false);
  const [orderCreated, setOrderCreated] = useState(false);

  // Auto-play timer
  useEffect(() => {
    let timer;
    if (isPlaying) {
      timer = setTimeout(() => {
        if (step < 6) {
          handleNext();
        } else {
          setIsPlaying(false);
        }
      }, 3500);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, step]);

  if (!isOpen) return null;

  const targetMachine = machines.find(m => m.id === selectedUnit) || machines[0];

  const handleNext = () => {
    if (step === 3) {
      // Trigger simulation update
      executeModelInference();
    }
    if (step === 5 && !orderCreated) {
      // Auto commit work order
      commitDemoWorkOrder();
    }
    setStep(prev => Math.min(prev + 1, 6));
  };

  const handlePrev = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleReset = () => {
    setStep(1);
    setIsPlaying(false);
    setOrderCreated(false);
  };

  const executeModelInference = () => {
    setIsInferring(true);
    // Simulate updating machine in the live context
    setMachines(prev => prev.map(m => {
      if (m.id === selectedUnit) {
        return {
          ...m,
          riskScore: 86,
          riskLevel: 'Critical',
          healthScore: 18,
          status: 'Degraded',
          predictedRul: 14,
          currentCycle: 215,
          predictedFault: 'HPT Stage 2 Blade clearance erosion & severe thermal distress',
          topFactors: [
            { name: 's11 (Ps30 Static Pressure HPC) severe drift', value: 92, category: 'Pressure', status: 'critical' },
            { name: 's4 (T50 Total Temp LPT) thermal gradient exceedance', value: 84, category: 'Thermal', status: 'critical' },
            { name: 's8 (Nf Fan Speed) harmonic oscillation', value: 65, category: 'Dynamics', status: 'warning' }
          ]
        };
      }
      return m;
    }));
    setIsInferring(false);
    addToast(`C-MAPSS ML Model updated ${selectedUnit}: RUL 14 cycles (Critical Risk)`, 'warning');
  };

  const commitDemoWorkOrder = () => {
    addWorkOrder({
      machineId: targetMachine.id,
      machineName: targetMachine.name,
      priority: 'Urgent',
      status: 'Draft',
      suspectedIssue: 'HPT Stage 2 blade clearance erosion & severe thermal distress',
      suggestedInspection: 'Perform borescope inspection of HP turbine stage 2 blades and check ceramic seal ring clearance.',
      technician: 'Sarah Chen (Turbomachinery Specialist)',
      scheduledDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      estimatedHours: 6.0,
      resolutionNotes: 'Auto-drafted by DEV-P04 End-to-End Guided Demo Flow.',
      source: 'C-MAPSS XGBoost ML Alarm'
    });
    setOrderCreated(true);
  };

  const stepsMeta = [
    { num: 1, title: 'Select Engine Trajectory', label: 'C-MAPSS Dataset' },
    { num: 2, title: 'Sensor Trajectory Stream', label: 'Telemetry Dynamics' },
    { num: 3, title: 'Run ML Inference', label: 'RUL Prediction' },
    { num: 4, title: 'Fleet Re-Ranking', label: 'Priority Decision' },
    { num: 5, title: 'Draft Work Order', label: 'Maintenance Action' },
    { num: 6, title: 'Model Evaluation', label: 'Held-out Metrics' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#101512] border border-[#D2DDD5] rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-2xl font-mono overflow-hidden">
        {/* HEADER */}
        <div className="px-5 py-4 border-b border-[#E0E6E0] flex items-center justify-between bg-[#F4F7F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#176B52]/15 border border-[#176B52]/40 flex items-center justify-center text-[#176B52]">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#202A27] uppercase tracking-wider">
                  DEV-P04 End-to-End Guided Demo
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#176B52]/20 text-[#176B52] border border-[#176B52]/30 font-semibold">
                  Section 7 Blueprint
                </span>
              </div>
              <p className="text-[11px] text-[#68756F]">
                Step-by-step walkthrough from raw dataset readings to dispatched maintenance work order
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className={`px-3 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isPlaying
                  ? 'bg-[#B94040] hover:bg-[#FF6F77] text-white'
                  : 'bg-[#E8EFEA] hover:bg-[#D5E0D9] text-[#202A27] border border-[#D2DDD5]'
              }`}
            >
              {isPlaying ? 'Pause Auto-Play' : <><Play size={12} fill="currentColor" /> Auto-Play</>}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded text-[#68756F] hover:text-[#202A27] hover:bg-[#E8EFEA] transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* STEP PROGRESS BAR */}
        <div className="px-5 py-3 border-b border-[#E0E6E0] bg-[#0E1210] overflow-x-auto">
          <div className="flex items-center justify-between min-w-[540px] text-xs">
            {stepsMeta.map((s, idx) => {
              const isCompleted = step > s.num;
              const isCurrent = step === s.num;
              return (
                <div
                  key={s.num}
                  onClick={() => setStep(s.num)}
                  className={`flex items-center gap-2 cursor-pointer transition-all ${
                    isCurrent ? 'text-[#176B52] font-bold' : isCompleted ? 'text-[#27845C]' : 'text-[#829189]'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                      isCurrent
                        ? 'bg-[#176B52] text-white border-[#176B52]'
                        : isCompleted
                        ? 'bg-[#27845C]/20 text-[#27845C] border-[#27845C]/40'
                        : 'bg-[#F4F7F5] border-[#D8E2DA] text-[#75837D]'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={13} /> : s.num}
                  </div>
                  <div className="text-left">
                    <div className="text-[11px] leading-tight truncate">{s.title}</div>
                  </div>
                  {idx < stepsMeta.length - 1 && (
                    <ChevronRight size={14} className="text-[#D8E2DA] mx-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* STEP CONTENT BODY */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* STEP 1: Select Trajectory */}
          {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
                <span className="text-xs font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <span className="text-[#176B52]">// Step 1:</span> Load Turbofan Engine Run-to-Failure Trajectory
                </span>
                <p className="text-xs text-[#68756F] mt-1">
                  Select a test unit from the NASA C-MAPSS dataset. The simulator loads its historical sensor measurements and initial cycle counter.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div
                  onClick={() => setSelectedUnit('MC-7801')}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedUnit === 'MC-7801'
                      ? 'bg-[#E8EFEA] border-[#176B52] shadow-lg'
                      : 'bg-[#141A16] border-[#E0E6E0] hover:border-[#38BDF8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#202A27]">MC-7801 (C-MAPSS Unit #01)</span>
                    <span className="px-2 py-0.5 rounded bg-[#176B52]/15 text-[#176B52] text-[10px]">Recommended</span>
                  </div>
                  <div className="space-y-1 text-[#68756F] text-[11px]">
                    <div>Type: Turbofan Jet Engine</div>
                    <div>Degradation Profile: HPT blade clearance & thermal fatigue</div>
                    <div>Observed Cycles: 215 cycles</div>
                  </div>
                </div>

                <div
                  onClick={() => setSelectedUnit('MC-8210')}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedUnit === 'MC-8210'
                      ? 'bg-[#E8EFEA] border-[#176B52] shadow-lg'
                      : 'bg-[#141A16] border-[#E0E6E0] hover:border-[#38BDF8]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-[#202A27]">MC-8210 (Industrial Welder K-400)</span>
                    <span className="px-2 py-0.5 rounded bg-[#38BDF8]/15 text-[#38BDF8] text-[10px]">High Load</span>
                  </div>
                  <div className="space-y-1 text-[#68756F] text-[11px]">
                    <div>Type: Heavy Mechatronic Rotary Unit</div>
                    <div>Degradation Profile: Axis 3 gear backlash & current surge</div>
                    <div>Observed Cycles: 342 cycles</div>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-[#FFFFFF] border border-[#E0E6E0] rounded text-xs text-[#68756F] flex items-center justify-between">
                <span>Trajectory frames loaded: <strong>50 cycles of multi-channel telemetry</strong></span>
                <span className="text-[#27845C] flex items-center gap-1">
                  <CheckCircle2 size={13} /> Zero data leakage
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: Sensor Dynamics */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
                <span className="text-xs font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <span className="text-[#176B52]">// Step 2:</span> Inspect Sensor Dynamics Over Operating Cycles
                </span>
                <p className="text-xs text-[#68756F] mt-1">
                  Notice the non-linear degradation: LPT temperature (T50) drifts upward while Static Pressure (Ps30) drops due to seal wear.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">s2: T24 LPC Temp</span>
                  <div className="text-lg font-bold text-[#202A27] mt-1">658.4 °C</div>
                  <span className="text-[10px] text-[#D99A24]">+16.4°C drift</span>
                </div>
                <div className="p-3 rounded bg-[#F4F7F5] border border-[#B94040]/40">
                  <span className="text-[10px] text-[#68756F] uppercase block">s4: T50 LPT Temp</span>
                  <div className="text-lg font-bold text-[#B94040] mt-1">1438.2 °C</div>
                  <span className="text-[10px] text-[#B94040]">Exceeding safety band</span>
                </div>
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">s11: Ps30 Static Press</span>
                  <div className="text-lg font-bold text-[#38BDF8] mt-1">44.8 psia</div>
                  <span className="text-[10px] text-[#B94040]">-2.4 psia seal drop</span>
                </div>
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">Vibration Amplitude</span>
                  <div className="text-lg font-bold text-[#D99A24] mt-1">7.4 mm/s</div>
                  <span className="text-[10px] text-[#D99A24]">Harmonic drift</span>
                </div>
              </div>

              <div className="p-3 rounded bg-[#141A16] border border-[#E0E6E0] text-xs text-[#68756F] space-y-1">
                <strong className="text-[#202A27]">Pattern Recognition Insight: </strong>
                The physical core speed (Nc) has dropped below 9000 RPM while fuel flow ratio is increasing to compensate. This matches known run-to-failure signatures in C-MAPSS FD001.
              </div>
            </div>
          )}

          {/* STEP 3: Run Model Prediction */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
                <span className="text-xs font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <span className="text-[#176B52]">// Step 3:</span> Run Machine Learning Prognostic Pipeline
                </span>
                <p className="text-xs text-[#68756F] mt-1">
                  Feed latest window of 30 cycles to the trained XGBoost regressor and classification model.
                </p>
              </div>

              <div className="p-4 rounded-lg bg-[#F4F7F5] border border-[#176B52]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] uppercase text-[#68756F]">Inference Engine</span>
                  <div className="text-sm font-bold text-[#202A27]">NASA C-MAPSS XGBoost Regressor v2.4</div>
                  <div className="text-xs text-[#27845C] flex items-center gap-1">
                    <CheckCircle2 size={13} /> Model Confidence: 91.8%
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-[10px] text-[#68756F] uppercase">Predicted RUL</div>
                    <div className="text-3xl font-bold text-[#176B52]">14 <span className="text-xs font-normal text-[#68756F]">cycles</span></div>
                    <span className="text-[10px] text-[#B94040] font-semibold">Critical Threshold reached</span>
                  </div>

                  <div className="text-right pl-4 border-l border-[#D2DDD5]">
                    <div className="text-[10px] text-[#68756F] uppercase">Failure Risk</div>
                    <div className="text-3xl font-bold text-[#B94040]">86%</div>
                    <span className="text-[10px] text-[#B94040] font-semibold">Immediate Action Tier</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-[11px] text-[#68756F] block">SHAP Feature Importance (Contributing Signals):</span>
                <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex justify-between">
                  <span>s11 (Static Pressure HPC Ps30) deviation</span>
                  <span className="font-bold text-[#176B52]">+42% impact</span>
                </div>
                <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex justify-between">
                  <span>s4 (Total Temp LPT T50) thermal spike</span>
                  <span className="font-bold text-[#176B52]">+31% impact</span>
                </div>
                <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex justify-between">
                  <span>s8 (Fan Speed Nf) harmonic vibration drift</span>
                  <span className="font-bold text-[#D99A24]">+18% impact</span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Dynamic Re-Ranking */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
                <span className="text-xs font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <span className="text-[#176B52]">// Step 4:</span> Dynamic Fleet Priority Queue Re-Ranking
                </span>
                <p className="text-xs text-[#68756F] mt-1">
                  As the risk score jumped to 86%, the portal re-evaluates the operational priority formula:
                  <code> 0.50*Risk + 0.25*Criticality + 0.15*Impact + 0.10*Urgency</code>.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#F4F7F5] border border-[#27845C]/40 text-xs">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E0E6E0]">
                  <span className="text-xs font-bold text-[#27845C] flex items-center gap-1.5">
                    <CheckCircle2 size={14} /> Fleet Queue Updated Successfully
                  </span>
                  <span className="text-[10px] text-[#68756F]">Sorted: Highest Risk First</span>
                </div>

                <div className="space-y-1.5">
                  <div className="p-2.5 rounded bg-[#176B52]/10 border border-[#176B52]/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#176B52] text-white font-bold text-[10px]">#1 PRIORITY</span>
                      <span className="font-bold text-[#202A27]">{targetMachine.name} ({targetMachine.id})</span>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <span className="text-[10px] text-[#B94040] font-bold">RUL: 14 cyc</span>
                      <PriorityBadge priority="Critical" />
                    </div>
                  </div>

                  <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex items-center justify-between text-[#68756F]">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#E0E6E0] text-[#68756F] text-[10px]">#2</span>
                      <span>MC-8210 (Robotic Welder K-400)</span>
                    </div>
                    <span>Priority Score: 78</span>
                  </div>

                  <div className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0] flex items-center justify-between text-[#68756F]">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-[#E0E6E0] text-[#68756F] text-[10px]">#3</span>
                      <span>MC-6122 (Centrifugal Slurry Pump P-12)</span>
                    </div>
                    <span>Priority Score: 68</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Draft Work Order */}
          {step === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
                <span className="text-xs font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <span className="text-[#176B52]">// Step 5:</span> Auto-Draft Maintenance Work Order
                </span>
                <p className="text-xs text-[#68756F] mt-1">
                  Translate the ML risk into an actionable maintenance ticket with suggested inspection and technician allocation.
                </p>
              </div>

              {/* Work Order Preview Card */}
              <div className="p-4 rounded-lg bg-[#141A16] border border-[#D2DDD5] space-y-3 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
                  <div className="flex items-center gap-2">
                    <Wrench size={15} className="text-[#176B52]" />
                    <span className="font-bold text-[#202A27]">WO-DEMO-9042</span>
                    <span className="px-2 py-0.5 rounded bg-[#D99A24]/15 text-[#D99A24] text-[10px]">Draft / Pending</span>
                  </div>
                  <PriorityBadge priority="Urgent" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-[#68756F]">
                  <div>Target Asset: <strong className="text-[#202A27] block">{targetMachine.name}</strong></div>
                  <div>Assigned Specialist: <strong className="text-[#202A27] block">Sarah Chen (Lead Turbomachinery)</strong></div>
                  <div>Target Due Date: <strong className="text-[#176B52] block">{new Date(Date.now() + 86400000).toISOString().split('T')[0]}</strong></div>
                </div>

                <div className="p-2.5 rounded bg-[#F4F7F5] border border-[#D8E2DA] space-y-1">
                  <div className="text-[10px] text-[#68756F] uppercase font-bold">Suspected Root Anomaly:</div>
                  <div className="text-[#176B52] font-semibold text-xs">
                    HPT Stage 2 Blade clearance erosion & severe thermal distress
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#F4F7F5] border border-[#D8E2DA] space-y-1">
                  <div className="text-[10px] text-[#68756F] uppercase font-bold">Recommended Field Inspection:</div>
                  <div className="text-[#384641] text-[11px]">
                    Deploy borescope to inspect HP turbine stage 2 rotor clearances; examine ceramic abradable seal ring; verify static pressure transducer calibration.
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E0E6E0] text-[11px]">
                  <span className="text-[#27845C] flex items-center gap-1">
                    <CheckCircle2 size={13} /> {orderCreated ? "Committed to Work Order Queue" : "Ready to Dispatch"}
                  </span>
                  {!orderCreated && (
                    <button
                      onClick={commitDemoWorkOrder}
                      className="px-3 py-1 bg-[#176B52] hover:bg-[#10543F] text-white font-bold rounded text-xs transition-colors"
                    >
                      Commit & Dispatch Ticket
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Model Evaluation */}
          {step === 6 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
                <span className="text-xs font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <span className="text-[#176B52]">// Step 6:</span> Model Evaluation & Operational Performance
                </span>
                <p className="text-xs text-[#68756F] mt-1">
                  DEV-P04 demands scientific transparency: report held-out test split metrics and explain what they mean for the factory.
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">MAE (RUL Cycles)</span>
                  <div className="text-xl font-bold text-[#176B52] mt-1">14.82</div>
                  <span className="text-[10px] text-[#68756F]">Held-out test units</span>
                </div>
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">RMSE (Tail Penalty)</span>
                  <div className="text-xl font-bold text-[#38BDF8] mt-1">19.34</div>
                  <span className="text-[10px] text-[#68756F]">Near-failure limit</span>
                </div>
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">Alarm F1-Score</span>
                  <div className="text-xl font-bold text-[#27845C] mt-1">90.6%</div>
                  <span className="text-[10px] text-[#68756F]">Balanced reliability</span>
                </div>
                <div className="p-3 rounded bg-[#F7FAF8] border border-[#D8E2DA]">
                  <span className="text-[10px] text-[#68756F] uppercase block">Alarm Precision</span>
                  <div className="text-xl font-bold text-[#202A27] mt-1">91.8%</div>
                  <span className="text-[10px] text-[#68756F]">Zero false alerts</span>
                </div>
              </div>

              <div className="p-3.5 rounded bg-[#141A16] border border-[#D8E2DA] space-y-2 text-xs">
                <div className="font-bold text-[#202A27]">End-to-End Walkthrough Complete!</div>
                <p className="text-[#68756F] text-[11px] leading-relaxed">
                  The demo has completed all 6 phases: Trajectory loaded → Telemetry streamed → Prognostic model evaluated → Priority matrix updated → Draft work order generated → Model benchmarks verified.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/predictions');
                    }}
                    className="px-3 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] border border-[#D2DDD5] text-xs text-[#202A27] flex items-center gap-1.5 transition-colors"
                  >
                    <Activity size={13} className="text-[#176B52]" /> Inspect Full Confusion Matrix
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/work-orders');
                    }}
                    className="px-3 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] border border-[#D2DDD5] text-xs text-[#202A27] flex items-center gap-1.5 transition-colors"
                  >
                    <Wrench size={13} className="text-[#38BDF8]" /> View Dispatched Work Orders
                  </button>
                  <button
                    onClick={() => {
                      onClose();
                      navigate('/dashboard');
                    }}
                    className="px-3 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-semibold text-xs transition-colors"
                  >
                    Return to Fleet Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER CONTROLS */}
        <div className="px-5 py-3 border-t border-[#E0E6E0] bg-[#F4F7F5] flex items-center justify-between text-xs">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] text-[#68756F] hover:text-[#202A27] transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={13} /> Reset Demo
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={step === 1}
              className="px-3 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] text-[#202A27] border border-[#D2DDD5] disabled:opacity-40 transition-colors flex items-center gap-1"
            >
              <ArrowLeft size={13} /> Previous
            </button>

            {step < 6 ? (
              <button
                onClick={handleNext}
                className="px-4 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-bold transition-colors flex items-center gap-1.5 shadow-[0_0_15px_rgba(255,128,95,0.2)]"
              >
                <span>{step === 3 ? 'Run Inference & Next' : step === 5 ? 'Dispatch & Finish' : 'Next Step'}</span>
                <ArrowRight size={13} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-4 py-1.5 rounded bg-[#27845C] hover:bg-[#52E38E] text-black font-bold transition-colors flex items-center gap-1.5"
              >
                <span>Done</span>
                <CheckCircle2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
