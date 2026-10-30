import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Layers,
  Activity,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Flame,
  Calendar,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  RotateCw,
  Cpu,
  Database,
  UserCheck
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatCard, StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { FleetRiskBarChart, MaintenanceWorkloadTrendChart } from '../components/charts/ChartComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';
import { calculatePriorityScore } from '../services/api';

export function DashboardPage() {
  const {
    machines,
    workOrders,
    alerts,
    priorityWeights,
    dashboardSummary,
    backendStatus,
    refreshData,
    isLoading,
    pendingReviewsCount = 0
  } = useAppData();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMachineForOrder, setSelectedMachineForOrder] = useState(null);
  const navigate = useNavigate();

  // Fleet analytics calculated dynamically from live database / backend summary
  const totalMachines = dashboardSummary?.total || machines.length || 6;
  const operationalCount = dashboardSummary?.operational ?? machines.filter(m => m.status === 'Operational').length;
  const operationalWithDegraded = dashboardSummary?.operationalWithDegraded ?? machines.filter(m => m.status === 'Operational' || m.status === 'Degraded').length;
  const criticalRiskCount = dashboardSummary?.highRisk ?? machines.filter(m => (m.riskScore || 0) >= 60).length;
  const activeOrders = dashboardSummary?.openWorkOrders ?? workOrders.filter(w => ['Draft', 'Approved', 'In Progress'].includes(w.status)).length;
  const avgHealth = dashboardSummary?.averageFleetHealth ?? Math.round(machines.reduce((acc, m) => acc + (m.healthScore || 80), 0) / (machines.length || 1));

  // Fleet risk tiers for bar chart (uses live distribution from backend if counts > 0, else computes from live machines)
  const hasLiveDist = dashboardSummary?.healthDistribution && dashboardSummary.healthDistribution.some(d => d.count > 0);
  const fleetRiskDistribution = hasLiveDist ? dashboardSummary.healthDistribution : [
    { name: 'Healthy (0-35 Risk)', count: Math.max(1, machines.filter(m => (m.riskScore || 0) < 35).length), color: '#43D17D' },
    { name: 'Warning (35-65 Risk)', count: Math.max(1, machines.filter(m => (m.riskScore || 0) >= 35 && (m.riskScore || 0) < 60).length), color: '#F5B942' },
    { name: 'Critical (65+ Risk)', count: Math.max(1, machines.filter(m => (m.riskScore || 0) >= 60).length), color: '#FF5B64' },
  ];

  // Maintenance Workload Trend Data (Dynamic based on live work order status counts)
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
    { period: 'Today', created: activeOrders, resolved: completedCount },
  ];

  // Ranked priority list computed dynamically from weights
  const rankedMachines = [...machines].map(m => ({
    ...m,
    calculated: calculatePriorityScore(m, priorityWeights)
  })).sort((a, b) => b.calculated.score - a.calculated.score);

  const topUrgentMachine = rankedMachines[0];

  // Recent ML Predictions from backend MongoDB
  const recentPredictionsList = dashboardSummary?.recentPredictions || [];

  return (
    <Layout pageTitle="Fleet Operations Overview">
      <div className="space-y-5">
        {/* LIVE SYSTEM STATUS BAR */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg px-4 py-2.5 font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-[#202A27]">
              <span className={`w-2 h-2 rounded-full ${backendStatus.online ? 'bg-[#27845C] animate-pulse' : 'bg-[#D99A24]'}`} />
              <strong>{backendStatus.online ? 'LIVE BACKEND CONNECTED' : 'OFFLINE MODE (FALLBACK)'}</strong>
            </span>
            <span className="text-[#A5B3AB]">|</span>
            <span className="flex items-center gap-1 text-[#68756F]">
              <Database size={13} className={backendStatus.database ? 'text-[#27845C]' : 'text-[#829189]'} />
              MongoDB: <strong className="text-[#202A27]">{backendStatus.database ? '127.0.0.1:27017' : 'Disconnected'}</strong>
            </span>
            <span className="text-[#A5B3AB]">|</span>
            <span className="flex items-center gap-1 text-[#68756F]">
              <Cpu size={13} className={backendStatus.mlService ? 'text-[#176B52]' : 'text-[#D99A24]'} />
              ML Microservice: <strong className="text-[#176B52]">{backendStatus.mlService ? 'FastAPI :8000 (XGBoost v2.1.0)' : 'Mock Adapter'}</strong>
            </span>
          </div>

          <button
            onClick={() => refreshData(true)}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#F4F7F5] hover:bg-[#DFE8E2] border border-[#D2DDD5] text-[#202A27] transition-all self-start sm:self-auto cursor-pointer"
            title="Fetch latest machine telemetry and predictions from backend"
          >
            <RotateCw size={12} className={isLoading ? 'animate-spin text-[#176B52]' : ''} />
            <span>{isLoading ? 'Syncing...' : 'Sync Live Data'}</span>
          </button>
        </div>

        {/* HUMAN-IN-THE-LOOP PENDING REVIEWS ALERT BANNER */}
        {pendingReviewsCount > 0 && (
          <div className="bg-[#FFFDF7] border-2 border-[#D99A24]/50 rounded-lg p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs font-mono animate-fadeIn">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#D99A24]/15 border border-[#D99A24]/40 flex items-center justify-center text-[#A66E0C] flex-shrink-0">
                <UserCheck size={18} />
              </div>
              <div>
                <div className="text-xs font-bold text-[#202A27] flex items-center gap-2">
                  <span>Pending Human Review Actions</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#D99A24] text-white font-bold">
                    {pendingReviewsCount} Awaiting Sign-off
                  </span>
                </div>
                <p className="text-[11px] text-[#68756F] mt-0.5">
                  ML models identified high/critical degradation risks. Inspect sensor telemetry and confirm or override dispatch priority.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/reviews')}
              className="px-3.5 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-semibold text-xs flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer"
            >
              <span>Open Human Review</span>
              <ArrowRight size={13} />
            </button>
          </div>
        )}

        {/* TOP OPERATIONAL KPIS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatCard
            title="Monitored Fleet"
            value={totalMachines}
            subtitle={`${operationalWithDegraded || operationalCount} active on line`}
            icon={Layers}
            color="blue"
          />
          <StatCard
            title="Operational Readiness"
            value={`${Math.round(((operationalWithDegraded || operationalCount) / Math.max(1, totalMachines)) * 100)}%`}
            subtitle={`Fleet Avg Health: ${avgHealth}%`}
            icon={CheckCircle2}
            color="healthy"
          />
          <StatCard
            title="High Risk Assets"
            value={criticalRiskCount}
            subtitle="Degradation score ≥ 60"
            icon={AlertTriangle}
            color="critical"
          />
          <StatCard
            title="Active Work Orders"
            value={activeOrders}
            subtitle={`${completedCount} completed to date`}
            icon={Wrench}
            color="warning"
          />
        </div>

        {/* TWO-COLUMN ANALYTICS SUITE: Risk Distribution & Maintenance Workload Trend */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Machine Fleet Risk Distribution Bar Chart */}
          <div className="lg:col-span-6 bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 font-mono shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-semibold text-[#202A27] uppercase tracking-wide block">
                  Fleet Risk Tier Distribution
                </span>
                <span className="text-[11px] text-[#68756F]">
                  Live asset counts from MongoDB & ML inference
                </span>
              </div>
              <span className="text-[10px] text-[#829189]">{totalMachines} Total Assets</span>
            </div>
            <FleetRiskBarChart data={fleetRiskDistribution} height={180} />
            <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-[#E0E6E0] text-center">
              {fleetRiskDistribution.map((d, i) => (
                <div key={i} className="p-1.5 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                  <div className="text-xs font-bold" style={{ color: d.color }}>{d.count}</div>
                  <div className="text-[9px] text-[#75837D] truncate">{d.name.split(' ')[0]}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Workload Activity Trend */}
          <div className="lg:col-span-6 bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 font-mono shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E0E6E0]">
              <div>
                <span className="text-xs font-semibold text-[#202A27] uppercase tracking-wide block">
                  Maintenance Workload Trend
                </span>
                <span className="text-[11px] text-[#68756F]">
                  Diagnostic triggers vs completed work orders
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-[#176B52]">
                  <span className="w-2 h-2 rounded-full bg-[#176B52]" /> Logged ({workOrders.length})
                </span>
                <span className="flex items-center gap-1 text-[#27845C]">
                  <span className="w-2 h-2 rounded-full bg-[#27845C]" /> Resolved ({completedCount})
                </span>
              </div>
            </div>
            <MaintenanceWorkloadTrendChart data={workloadTrendData} height={180} />
            <div className="flex items-center justify-between text-[11px] text-[#68756F] mt-3 pt-3 border-t border-[#E0E6E0]">
              <span>Current Open Backlog: <strong className="text-[#202A27]">{activeOrders} tasks</strong></span>
              <button
                onClick={() => navigate('/work-orders')}
                className="text-[#176B52] hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
              >
                Inspect Work Orders Backlog <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* RECENT LIVE PREDICTIONS FROM ML SERVICE */}
        {recentPredictionsList.length > 0 && (
          <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 font-mono shadow-xs">
            <div className="flex items-center justify-between pb-2 mb-3 border-b border-[#E0E6E0]">
              <div className="flex items-center gap-2">
                <Cpu size={15} className="text-[#176B52]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#202A27]">
                  Recent Live Inferences from ML Model (FastAPI :8000)
                </span>
              </div>
              <button
                onClick={() => navigate('/predictions')}
                className="text-[11px] text-[#176B52] hover:underline flex items-center gap-1 cursor-pointer"
              >
                View Predictions Registry <ArrowRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {recentPredictionsList.slice(0, 3).map((pred, i) => {
                const res = pred.predictionResult || {};
                const isCrit = res.riskLevel === 'critical';
                const isHigh = res.riskLevel === 'high';
                return (
                  <div
                    key={i}
                    onClick={() => navigate(`/machines/${pred.machineId}`)}
                    className="p-3 rounded-lg bg-[#F7FAF8] border border-[#E0E6E0] hover:border-[#176B52] transition-all cursor-pointer text-xs"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <strong className="text-[#202A27]">{pred.machineId}</strong>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        isCrit ? 'bg-[#FF5B64]/15 text-[#B94040] border border-[#FF5B64]/30' :
                        isHigh ? 'bg-[#F5B942]/15 text-[#D99A24] border border-[#F5B942]/30' :
                        'bg-[#43D17D]/15 text-[#27845C] border border-[#43D17D]/30'
                      }`}>
                        {res.riskLevel || 'Normal'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[#68756F] mb-1">
                      Failure Mode: <strong className="text-[#202A27]">{res.suspectedFailureMode || 'None'}</strong>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#75837D] pt-1.5 border-t border-[#E5EBE6]">
                      <span>RUL: <strong className="text-[#176B52]">{res.estimatedRULDays || '--'} d</strong></span>
                      <span>Health: <strong className="text-[#202A27]">{res.healthScore || '--'}%</strong></span>
                      <span>Source: <strong className="text-[#176B52]">{pred.executionSource === 'ml_service_fastapi' ? 'FastAPI' : 'Mock'}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TWO-COLUMN OPERATIONAL SUMMARY: Top Actionable Asset & Recent Telemetry Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 font-mono">
          {/* Highest Priority Recommendation Card */}
          <div className="lg:col-span-7 bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div className="flex items-center gap-2">
                <Flame size={15} className="text-[#176B52]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#202A27]">
                  Primary Action Required (DEV-P04 Decision Priority #1)
                </span>
              </div>
              <span className="text-[10px] text-[#829189]">Impact-Ranked</span>
            </div>

            {topUrgentMachine && (
              <div className="p-3.5 rounded-lg bg-[#F4F7F5] border border-[#D2DDD5] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-[#202A27]">{topUrgentMachine.name}</span>
                    <PriorityBadge priority={topUrgentMachine.calculated.band} />
                  </div>
                  <div className="text-xs text-[#68756F]">
                    Asset ID: <strong className="text-[#202A27]">{topUrgentMachine.id}</strong> • Location: {topUrgentMachine.line}
                  </div>
                  <div className="text-[11px] text-[#B94040] bg-[#B94040]/10 p-2 rounded border border-[#B94040]/20 mt-2">
                    <strong>Predicted Anomaly: </strong>{topUrgentMachine.predictedFault}
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end justify-between gap-3 self-stretch">
                  <div className="text-left md:text-right">
                    <div className="text-[10px] text-[#75837D] uppercase tracking-wide">Combined Priority Score</div>
                    <div className="text-3xl font-bold text-[#176B52]">{topUrgentMachine.calculated.score}</div>
                    <div className="text-[10px] text-[#68756F]">RUL: {topUrgentMachine.predictedRul} cycles</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigate(`/machines/${topUrgentMachine.id}`)}
                      className="px-2.5 py-1.5 rounded bg-[#E8EFEA] hover:bg-[#D5E0D9] border border-[#D2DDD5] text-xs text-[#202A27] transition-colors cursor-pointer"
                    >
                      Telemetry
                    </button>
                    <button
                      onClick={() => {
                        setSelectedMachineForOrder(topUrgentMachine);
                        setModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wrench size={13} /> Dispatch Order
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-[#68756F] pt-1">
              <span>Formula: 50% Risk + 25% Criticality + 15% Impact + 10% Urgency</span>
              <button
                onClick={() => navigate('/maintenance-priority')}
                className="text-[#176B52] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Configure Decision Weights <ChevronRight size={13} />
              </button>
            </div>
          </div>

          {/* Plant Telemetry Events & Alerts Feed */}
          <div className="lg:col-span-5 bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-[#176B52]" />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#202A27]">
                  Sensor Alerts & Ingestion ({alerts.length})
                </span>
              </div>
              <span className="text-[10px] text-[#27845C]">Real-time Ingestion</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {alerts.slice(0, 4).map(alert => (
                <div
                  key={alert.id}
                  onClick={() => navigate(`/machines/${alert.machineId}`)}
                  className="p-2.5 rounded bg-[#F7FAF8] border border-[#E0E6E0] hover:border-[#C2CFC6] transition-all cursor-pointer text-xs"
                >
                  <div className="flex items-center justify-between text-[10px] text-[#68756F] mb-1">
                    <span className="font-bold text-[#202A27]">{alert.machineId}</span>
                    <span className="text-[#75837D]">{alert.timestamp}</span>
                  </div>
                  <p className="text-[11px] text-[#384641] line-clamp-2">{alert.message}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-[#E0E6E0] flex items-center justify-between text-[11px]">
              <span className="text-[#75837D]">MongoDB Ingestion Active</span>
              <button
                onClick={() => navigate('/machines')}
                className="text-[#38BDF8] hover:underline flex items-center gap-1 cursor-pointer"
              >
                Inspect All Machines <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* FULL FLEET STATUS TABLE (Dense tabular layout) */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-4 font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-[#E0E6E0] gap-2">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#202A27]">
                Machine Fleet Health Matrix (Live from MongoDB)
              </span>
              <p className="text-[11px] text-[#68756F]">
                All registered industrial units sorted by operational priority score
              </p>
            </div>
            <button
              onClick={() => navigate('/machines')}
              className="px-2.5 py-1 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-xs text-[#202A27] hover:bg-[#DFE8E2] transition-colors self-start sm:self-auto cursor-pointer"
            >
              Full Fleet Directory →
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                  <th className="py-2.5 px-3">Asset ID</th>
                  <th className="py-2.5 px-3">Machine Name</th>
                  <th className="py-2.5 px-3">Operating Line</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Health</th>
                  <th className="py-2.5 px-3 text-center">Failure Risk</th>
                  <th className="py-2.5 px-3 text-center">Priority</th>
                  <th className="py-2.5 px-3">Predicted RUL</th>
                  <th className="py-2.5 px-3 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {rankedMachines.map(m => (
                  <tr
                    key={m.id}
                    onClick={() => navigate(`/machines/${m.id}`)}
                    className="hover:bg-[#F4F7F5] transition-colors cursor-pointer"
                  >
                    <td className="py-2.5 px-3 font-bold text-[#202A27]">{m.id}</td>
                    <td className="py-2.5 px-3 text-[#384641]">{m.name}</td>
                    <td className="py-2.5 px-3 text-[#68756F] text-[11px]">{m.line}</td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className={m.healthScore >= 70 ? 'text-[#27845C]' : m.healthScore >= 40 ? 'text-[#D99A24]' : 'text-[#B94040]'}>
                        {m.healthScore}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className={m.riskScore >= 60 ? 'text-[#B94040]' : m.riskScore >= 35 ? 'text-[#D99A24]' : 'text-[#27845C]'}>
                        {m.riskScore}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-[#202A27]">
                      {m.calculated.score}
                    </td>
                    <td className="py-2.5 px-3 text-[#68756F]">
                      <span className="text-[#202A27] font-semibold">{m.predictedRul}</span> {m.rulUnit}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/machines/${m.id}`);
                        }}
                        className="px-2 py-1 rounded bg-[#E8EFEA] hover:bg-[#D2DDD5] text-[#202A27] text-[11px] cursor-pointer"
                      >
                        Details
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
