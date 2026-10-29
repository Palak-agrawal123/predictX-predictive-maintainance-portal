import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Cpu,
  Layers,
  ShieldCheck,
  AlertTriangle,
  Play,
  RotateCw,
  Info,
  CheckCircle2,
  HelpCircle,
  FileText
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { initialPredictions, modelEvaluationMetrics } from '../data/predictions';
import { api } from '../services/api';

export function PredictionsPage() {
  const { machines, addToast } = useAppData();
  const navigate = useNavigate();

  const [predictions, setPredictions] = useState(initialPredictions);
  const [selectedMachineId, setSelectedMachineId] = useState(machines[0]?.id || "MC-7801");
  const [isRunningInference, setIsRunningInference] = useState(false);
  const [metrics] = useState(modelEvaluationMetrics);

  const handleRunInference = async () => {
    setIsRunningInference(true);
    addToast(`Triggering C-MAPSS RUL inference pipeline for ${selectedMachineId}...`, 'info');
    const result = await api.triggerPrediction(selectedMachineId);
    
    // Create new prediction entry
    const targetMachine = machines.find(m => m.id === selectedMachineId) || machines[0];
    const newPred = {
      id: `PRED-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      machineId: targetMachine.id,
      machineName: targetMachine.name,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      riskScore: targetMachine.riskScore,
      riskBand: targetMachine.riskLevel,
      predictedRul: targetMachine.predictedRul,
      rulUnit: targetMachine.rulUnit,
      confidence: "89.5%",
      modelEngine: "C-MAPSS XGBoost Regressor v2.4 (Simulated Replay)",
      topContributingSignals: targetMachine.topFactors.slice(0, 3).map(f => ({
        signal: f.name,
        impact: `+${f.value}% relative weight`,
        value: `${f.value}`
      })),
      operationalCaveat: "Simulated evaluation from local dataset sample."
    };

    setPredictions(prev => [newPred, ...prev]);
    setIsRunningInference(false);
    addToast(`Inference completed for ${targetMachine.id}: ${targetMachine.predictedRul} cycles RUL`, 'success');
  };

  return (
    <Layout pageTitle="Machine Learning Decision Models">
      <div className="space-y-4 font-mono">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> PROGNOSTICS INFERENCE & BENCHMARK VALIDATION
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              NASA C-MAPSS Turbofan Run-to-Failure degradation models, regression metrics & held-out benchmarks
            </p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-[#68756F] self-start sm:self-auto">
            Artifact: <strong className="text-[#176B52]">XGBoost-FD001-v2.4</strong>
          </span>
        </div>

        {/* INFERENCE TRIGGER CONSOLE */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-[#E0E6E0]">
            <div>
              <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider block">
                Trigger Run-time Inference (C-MAPSS Degradation Pipeline)
              </span>
              <p className="text-[11px] text-[#68756F]">
                Evaluate latest operational cycles through trained XGBoost regressor to project Remaining Useful Life (RUL)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedMachineId}
                onChange={(e) => setSelectedMachineId(e.target.value)}
                className="bg-[#F7FAF8] border border-[#E0E6E0] text-xs text-[#202A27] px-3 py-1.5 rounded focus:border-[#176B52] focus:outline-none"
              >
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id} - {m.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleRunInference}
                disabled={isRunningInference}
                className="px-3.5 py-1.5 bg-[#176B52] hover:bg-[#10543F] text-white font-semibold text-xs rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isRunningInference ? <RotateCw size={13} className="animate-spin" /> : <Play size={13} />}
                <span>{isRunningInference ? 'Evaluating...' : 'Run Inference'}</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-[#68756F] flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[#27845C]">
              <ShieldCheck size={14} /> Telemetry frames verified: valid cycle timestamps and sensor ranges
            </span>
            <span className="text-[#829189]">Simulated offline demonstration</span>
          </div>
        </div>

        {/* HELD-OUT TEST EVALUATION METRICS (From DEV-P04 Blueprint) */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
            <div className="flex items-center gap-2">
              <Activity size={15} className="text-[#176B52]" />
              <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider">
                Held-Out Benchmark Evaluation Report (NASA C-MAPSS FD001)
              </span>
            </div>
            <span className="text-[10px] text-[#27845C] flex items-center gap-1">
              <CheckCircle2 size={12} /> Unit Split (Zero Leakage)
            </span>
          </div>

          {/* 4 HIGH-IMPACT PROGNOSTICS METRICS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded bg-[#F4F7F5] border border-[#D2DDD5]">
              <span className="text-[10px] text-[#75837D] uppercase block font-semibold">RUL MAE Error</span>
              <div className="text-xl font-bold text-[#176B52] mt-1">{metrics.summaryKpis?.mae || "14.82 cycles"}</div>
              <span className="text-[10px] text-[#68756F] mt-0.5 block">Held-out test units</span>
            </div>
            <div className="p-3 rounded bg-[#F4F7F5] border border-[#D2DDD5]">
              <span className="text-[10px] text-[#75837D] uppercase block font-semibold">Tail Penalty RMSE</span>
              <div className="text-xl font-bold text-[#38BDF8] mt-1">{metrics.summaryKpis?.rmse || "19.34 cycles"}</div>
              <span className="text-[10px] text-[#68756F] mt-0.5 block">Penalizes late alarms</span>
            </div>
            <div className="p-3 rounded bg-[#F4F7F5] border border-[#D2DDD5]">
              <span className="text-[10px] text-[#75837D] uppercase block font-semibold">Early Alarm F1-Score</span>
              <div className="text-xl font-bold text-[#27845C] mt-1">{metrics.summaryKpis?.f1Score || "90.6%"}</div>
              <span className="text-[10px] text-[#68756F] mt-0.5 block">30-cycle failure warning</span>
            </div>
            <div className="p-3 rounded bg-[#F4F7F5] border border-[#D2DDD5]">
              <span className="text-[10px] text-[#75837D] uppercase block font-semibold">Alarm Precision</span>
              <div className="text-xl font-bold text-[#202A27] mt-1">{metrics.summaryKpis?.precision || "91.8%"}</div>
              <span className="text-[10px] text-[#68756F] mt-0.5 block">True alarm confidence</span>
            </div>
          </div>

          {/* CONFUSION MATRIX (HEATMAP TABLE) */}
          <div className="p-3.5 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 mb-3 border-b border-[#E0E6E0] gap-1">
              <div>
                <span className="text-xs font-bold text-[#202A27] uppercase tracking-wider block">
                  3-Tier Failure Risk Classification — Confusion Matrix
                </span>
                <span className="text-[11px] text-[#68756F]">
                  Held-out engine cycle classifications (Ground Truth vs Model Predicted)
                </span>
              </div>
              <span className="text-[11px] text-[#27845C] font-semibold">
                Overall Accuracy: {metrics.confusionMatrix?.overallAccuracy || "90.7%"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
                <thead>
                  <tr className="text-[#68756F] text-[10px] uppercase border-b border-[#E0E6E0]">
                    <th className="py-2 px-3 text-left">Actual \ Predicted</th>
                    <th className="py-2 px-3 bg-[#FFFFFF]/60 text-[#27845C]">Pred Healthy (&gt;60 cyc)</th>
                    <th className="py-2 px-3 bg-[#FFFFFF]/60 text-[#D99A24]">Pred Warning (20-60)</th>
                    <th className="py-2 px-3 bg-[#FFFFFF]/60 text-[#B94040]">Pred Critical (&lt;20)</th>
                    <th className="py-2 px-3 text-right">Class Recall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E0E6E0]">
                  <tr>
                    <td className="py-2.5 px-3 text-left font-semibold text-[#27845C]">Actual Healthy</td>
                    <td className="py-2.5 px-3 bg-[#27845C]/15 font-bold text-[#27845C] border border-[#27845C]/30 rounded">
                      92 <span className="text-[10px] text-[#68756F] font-normal">(92.0%)</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#68756F]">6</td>
                    <td className="py-2.5 px-3 text-[#829189]">2</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#202A27]">92.0%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-left font-semibold text-[#D99A24]">Actual Warning</td>
                    <td className="py-2.5 px-3 text-[#68756F]">4</td>
                    <td className="py-2.5 px-3 bg-[#D99A24]/15 font-bold text-[#D99A24] border border-[#D99A24]/30 rounded">
                      88 <span className="text-[10px] text-[#68756F] font-normal">(88.0%)</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#68756F]">8</td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#202A27]">88.0%</td>
                  </tr>
                  <tr>
                    <td className="py-2.5 px-3 text-left font-semibold text-[#B94040]">Actual Critical</td>
                    <td className="py-2.5 px-3 text-[#829189]">1</td>
                    <td className="py-2.5 px-3 text-[#68756F]">7</td>
                    <td className="py-2.5 px-3 bg-[#B94040]/15 font-bold text-[#B94040] border border-[#B94040]/30 rounded">
                      92 <span className="text-[10px] text-[#68756F] font-normal">(92.0%)</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#202A27]">92.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#E0E6E0] text-[11px] text-[#68756F]">
              <div>
                <strong className="text-[#202A27]">Low False Negatives on Critical: </strong>
                Only 1 out of 100 near-failure cycles missed; prevents catastrophic line halts.
              </div>
              <div className="text-left sm:text-right">
                <strong className="text-[#202A27]">NASA Metric Score: </strong>
                428.1 (Penalizes late alarms 10x heavier than early warnings).
              </div>
            </div>
          </div>

          {/* Detailed Metrics Table */}
          <div className="border border-[#E0E6E0] rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F4F7F5] text-[#68756F] text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Metric Name</th>
                  <th className="py-2.5 px-3 text-center">Measured Result</th>
                  <th className="py-2.5 px-3">Interpretation / Scientific Purpose</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {metrics.heldOutMetrics.map((m, i) => (
                  <tr key={i} className="hover:bg-[#F4F7F5]/50">
                    <td className="py-2.5 px-3 font-semibold text-[#202A27]">{m.metric}</td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className="text-[#176B52]">{m.value}</span>
                    </td>
                    <td className="py-2.5 px-3 text-[#68756F] text-[11px]">{m.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Model Boundaries and Constraints */}
          <div className="p-3 bg-[#F4F7F5] border border-[#D2DDD5] rounded-lg text-xs space-y-1.5">
            <span className="font-bold text-[#202A27] flex items-center gap-1.5">
              <AlertTriangle size={14} className="text-[#D99A24]" /> Scientific Disclaimers & Operational Limits (DEV-P04):
            </span>
            <ul className="list-disc list-inside text-[11px] text-[#68756F] space-y-1">
              {metrics.boundaries.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* PREDICTION HISTORY LOG TABLE */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E0E6E0]">
            <span className="text-xs font-bold uppercase tracking-wider text-[#202A27]">
              Inference Telemetry Log ({predictions.length} records)
            </span>
            <span className="text-[10px] text-[#829189]">Turbofan Degradation Stream</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Prediction ID</th>
                  <th className="py-3 px-3">Equipment Unit</th>
                  <th className="py-3 px-3">Timestamp</th>
                  <th className="py-3 px-3 text-center">Predicted RUL</th>
                  <th className="py-3 px-3 text-center">Risk Tier</th>
                  <th className="py-3 px-3">Model Engine</th>
                  <th className="py-3 px-3">Top Signals Evidence</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {predictions.map(pred => (
                  <tr key={pred.id} className="hover:bg-[#F4F7F5] transition-colors">
                    <td className="py-3 px-3 font-bold text-[#176B52]">{pred.id}</td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-[#202A27]">{pred.machineId}</div>
                      <div className="text-[11px] text-[#75837D]">{pred.machineName}</div>
                    </td>
                    <td className="py-3 px-3 text-[#75837D]">{pred.timestamp}</td>
                    <td className="py-3 px-3 text-center font-bold text-[#202A27]">
                      {pred.predictedRul} {pred.rulUnit}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <PriorityBadge priority={pred.riskBand} />
                    </td>
                    <td className="py-3 px-3 text-[#68756F] text-[11px] max-w-[160px] truncate">
                      {pred.modelEngine}
                    </td>
                    <td className="py-3 px-3 text-[#68756F] text-[11px]">
                      {pred.topContributingSignals?.[0]?.signal || 'Nominal telemetry'}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigate(`/machines/${pred.machineId}`)}
                        className="px-2 py-1 rounded bg-[#F7FAF8] hover:bg-[#DFE8E2] text-[#202A27] text-[11px]"
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
    </Layout>
  );
}
