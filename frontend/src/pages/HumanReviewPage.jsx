import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Search,
  Filter,
  ShieldAlert,
  ArrowRight,
  Clock,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  History,
  Check,
  X,
  SlidersHorizontal,
  Info,
  Wrench,
  AlertCircle,
  TrendingUp,
  Activity
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { PriorityBadge, StatusBadge } from '../components/common/UIComponents';
import { api } from '../services/api';

export function HumanReviewPage() {
  const { machines, confirmReview, overrideReview, addToast, refreshData } = useAppData();
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [metrics, setMetrics] = useState({
    totalReviews: 0,
    pendingCount: 0,
    reviewedCount: 0,
    overriddenCount: 0,
    confirmedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING'); // PENDING, REVIEWED, ALL
  const [riskFilter, setRiskFilter] = useState('ALL'); // ALL, HIGH, MEDIUM, LOW
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected prediction for drawer/modal review
  const [selectedReview, setSelectedReview] = useState(null);
  const [inspectAuditHistory, setInspectAuditHistory] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // Override Form state
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [activePrediction, setActivePrediction] = useState(null);
  const [newPriority, setNewPriority] = useState('MEDIUM');
  const [reviewReason, setReviewReason] = useState('');
  const [reviewerName, setReviewerName] = useState('Chief Maintenance Engineer');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick confirm state
  const [isConfirmingId, setIsConfirmingId] = useState(null);

  // Fetch reviews from API
  const fetchReviewsData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAllReviews({
        reviewStatus: statusFilter,
        predictedRisk: riskFilter,
        limit: 100
      });

      if (res && res.data) {
        setReviews(res.data);
        if (res.metrics) {
          setMetrics(res.metrics);
        }
      }
    } catch (err) {
      console.warn('[HumanReviewPage] Error fetching reviews:', err.message);
      addToast(`Failed to load reviews: ${err.message}`, 'warning');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, riskFilter, addToast]);

  useEffect(() => {
    fetchReviewsData();
  }, [fetchReviewsData]);

  // Load audit history when a prediction is selected for inspection
  const handleSelectReview = async (review) => {
    setSelectedReview(review);
    setLoadingAudit(true);
    try {
      const detail = await api.getReviewById(review.predictionId);
      if (detail && detail.auditHistory) {
        setInspectAuditHistory(detail.auditHistory);
      } else {
        setInspectAuditHistory(review.reviewHistory || []);
      }
    } catch {
      setInspectAuditHistory(review.reviewHistory || []);
    } finally {
      setLoadingAudit(false);
    }
  };

  // Handle Quick Confirm
  const handleQuickConfirm = async (e, review) => {
    e.stopPropagation();
    setIsConfirmingId(review.predictionId);
    try {
      await confirmReview(review.predictionId, {
        reviewedBy: reviewerName,
        reason: 'Operator verified telemetry baseline. Concurs with ML risk tier.'
      });
      await fetchReviewsData();
      if (selectedReview?.predictionId === review.predictionId) {
        handleSelectReview(review);
      }
    } catch (err) {
      addToast(`Confirmation error: ${err.message}`, 'warning');
    } finally {
      setIsConfirmingId(null);
    }
  };

  // Open Override Modal
  const handleOpenOverride = (e, review) => {
    e.stopPropagation();
    setActivePrediction(review);
    // Default override priority to a different reasonable priority
    const current = (review.maintenancePriority || review.predictedRisk || 'HIGH').toUpperCase();
    setNewPriority(current === 'HIGH' ? 'MEDIUM' : current === 'MEDIUM' ? 'LOW' : 'HIGH');
    setReviewReason('');
    setFormError('');
    setOverrideModalOpen(true);
  };

  // Submit Override with validation
  const handleSubmitOverride = async (e) => {
    e.preventDefault();
    if (!reviewReason.trim()) {
      setFormError('Mandatory requirement: Please provide a specific justification reason for overriding the ML recommendation.');
      return;
    }
    if (!['LOW', 'MEDIUM', 'HIGH'].includes(newPriority)) {
      setFormError('Please select a valid maintenance priority tier (HIGH, MEDIUM, or LOW).');
      return;
    }

    setIsSubmitting(true);
    setFormError('');
    try {
      await overrideReview(activePrediction.predictionId, {
        newPriority,
        reason: reviewReason.trim(),
        reviewedBy: reviewerName.trim() || 'Senior Maintenance Reviewer'
      });
      setOverrideModalOpen(false);
      setActivePrediction(null);
      await fetchReviewsData();
      if (selectedReview?.predictionId === activePrediction.predictionId) {
        handleSelectReview({
          ...activePrediction,
          maintenancePriority: newPriority,
          isOverridden: true,
          reviewStatus: 'REVIEWED'
        });
      }
    } catch (err) {
      setFormError(err.message || 'Failed to submit override.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter list by search query (machine ID or name or prediction ID)
  const filteredReviews = reviews.filter(r => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.predictionId?.toLowerCase().includes(q) ||
      r.machineId?.toLowerCase().includes(q) ||
      r.machineDetails?.name?.toLowerCase().includes(q) ||
      r.predictionResult?.suspectedFailureMode?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout pageTitle="Human-in-the-Loop Review & Priority Override">
      <div className="space-y-4 font-mono">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> HUMAN-IN-THE-LOOP PREDICTION REVIEW
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              Inspect ML prognostics, review sensor evidence, verify or override operational maintenance priority.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReviewsData}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-[#F7FAF8] hover:bg-[#DFE8E2] border border-[#E0E6E0] text-[#202A27] text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw size={13} className={loading ? 'animate-spin text-[#176B52]' : ''} />
              <span>Refresh Reviews</span>
            </button>
          </div>
        </div>

        {/* METRICS & AUDIT KPI BANNER */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3 rounded-lg bg-white border border-[#E0E6E0] shadow-xs">
            <span className="text-[10px] text-[#75837D] uppercase font-bold block">Total Predictions</span>
            <div className="text-xl font-bold text-[#202A27] mt-1">{metrics.totalReviews}</div>
            <span className="text-[10px] text-[#68756F]">All recorded ML inferences</span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-[#E0E6E0] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#A66E0C] uppercase font-bold block">Pending Review</span>
              {metrics.pendingCount > 0 && (
                <span className="w-2 h-2 rounded-full bg-[#D99A24] animate-ping" />
              )}
            </div>
            <div className="text-xl font-bold text-[#D99A24] mt-1">{metrics.pendingCount}</div>
            <span className="text-[10px] text-[#68756F]">Awaiting engineer sign-off</span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-[#E0E6E0] shadow-xs">
            <span className="text-[10px] text-[#27845C] uppercase font-bold block">Human Confirmed</span>
            <div className="text-xl font-bold text-[#27845C] mt-1">{metrics.confirmedCount}</div>
            <span className="text-[10px] text-[#68756F]">ML priority accepted</span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-[#E0E6E0] shadow-xs">
            <span className="text-[10px] text-[#1E7598] uppercase font-bold block">Human Overridden</span>
            <div className="text-xl font-bold text-[#1E7598] mt-1">{metrics.overriddenCount}</div>
            <span className="text-[10px] text-[#68756F]">Operational adjustments</span>
          </div>

          <div className="p-3 rounded-lg bg-white border border-[#E0E6E0] shadow-xs col-span-2 lg:col-span-1">
            <span className="text-[10px] text-[#176B52] uppercase font-bold block">Review Compliance</span>
            <div className="text-xl font-bold text-[#176B52] mt-1">
              {metrics.totalReviews > 0 ? Math.round((metrics.reviewedCount / metrics.totalReviews) * 100) : 100}%
            </div>
            <span className="text-[10px] text-[#68756F]">{metrics.reviewedCount} of {metrics.totalReviews} reviewed</span>
          </div>
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3 shadow-xs space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Review Status Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[#75837D] text-[11px] font-semibold mr-1">STATUS:</span>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-[#D99A24]/15 border-[#D99A24] text-[#A66E0C] font-bold'
                    : 'bg-[#F7FAF8] border-[#E0E6E0] text-[#68756F] hover:text-[#202A27]'
                }`}
              >
                <Clock size={12} />
                <span>Pending Review ({metrics.pendingCount})</span>
              </button>

              <button
                onClick={() => setStatusFilter('REVIEWED')}
                className={`px-3 py-1.5 rounded border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'REVIEWED'
                    ? 'bg-[#27845C]/15 border-[#27845C] text-[#27845C] font-bold'
                    : 'bg-[#F7FAF8] border-[#E0E6E0] text-[#68756F] hover:text-[#202A27]'
                }`}
              >
                <CheckCircle2 size={12} />
                <span>Reviewed & Approved ({metrics.reviewedCount})</span>
              </button>

              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded border transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-[#176B52]/15 border-[#176B52] text-[#176B52] font-bold'
                    : 'bg-[#F7FAF8] border-[#E0E6E0] text-[#68756F] hover:text-[#202A27]'
                }`}
              >
                <span>All ({metrics.totalReviews})</span>
              </button>
            </div>

            {/* Risk Tier & Search Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-[11px]">
                <span className="text-[#75837D] font-semibold">ML RISK:</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-[#F7FAF8] border border-[#E0E6E0] text-xs text-[#202A27] px-2.5 py-1.5 rounded focus:border-[#176B52] focus:outline-none"
                >
                  <option value="ALL">All Risk Tiers</option>
                  <option value="HIGH">High Risk Only</option>
                  <option value="MEDIUM">Medium Risk Only</option>
                  <option value="LOW">Low Risk Only</option>
                </select>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[#75837D]" />
                <input
                  type="text"
                  placeholder="Filter by Machine / ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#F7FAF8] border border-[#E0E6E0] text-xs text-[#202A27] rounded placeholder:text-[#829189] focus:border-[#176B52] focus:outline-none w-48"
                />
              </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE LAYOUT: Reviews Master Table + Inspection & Audit Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Predictions Table */}
          <div className={`${selectedReview ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-[#E0E6E0] rounded-lg overflow-hidden shadow-xs`}>
            <div className="p-3 border-b border-[#E0E6E0] bg-[#FAFCFA] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-[#176B52]" />
                <span className="font-bold text-[#202A27] uppercase tracking-wide">
                  Prediction Inferences ({filteredReviews.length})
                </span>
              </div>
              <span className="text-[10px] text-[#75837D]">Click any row to inspect sensor evidence</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#68756F]">
                <RotateCw size={18} className="animate-spin text-[#176B52] mx-auto mb-2" />
                Loading review telemetry records...
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#68756F]">
                <AlertCircle size={22} className="text-[#829189] mx-auto mb-2" />
                No predictions match the active filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                      <th className="py-2.5 px-3">Equipment</th>
                      <th className="py-2.5 px-3 text-center">Original ML Risk</th>
                      <th className="py-2.5 px-3 text-center">Maintenance Priority</th>
                      <th className="py-2.5 px-3">Review Status</th>
                      <th className="py-2.5 px-3">Telemetry Evidence</th>
                      <th className="py-2.5 px-3 text-right">Human Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EBE6]">
                    {filteredReviews.map(review => {
                      const isPending = review.reviewStatus === 'PENDING';
                      const isOverridden = review.isOverridden;
                      const isSelected = selectedReview?.predictionId === review.predictionId;
                      const machine = review.machineDetails || machines.find(m => m.id === review.machineId);
                      const features = review.inputFeatures || {};

                      return (
                        <tr
                          key={review.predictionId}
                          onClick={() => handleSelectReview(review)}
                          className={`transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#E8EFEA] border-l-4 border-[#176B52]'
                              : isPending
                              ? 'hover:bg-[#FFFDF7]'
                              : 'hover:bg-[#F4F7F5]'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-bold text-[#202A27]">{review.machineId}</div>
                            <div className="text-[11px] text-[#75837D] truncate max-w-[130px]">
                              {machine?.name || review.machineId}
                            </div>
                            <div className="text-[9px] text-[#829189] mt-0.5">
                              {review.predictionId}
                            </div>
                          </td>

                          {/* ML Risk Badge */}
                          <td className="py-3 px-3 text-center">
                            <PriorityBadge priority={review.predictedRisk || review.predictionResult?.riskLevel} />
                            <div className="text-[9px] text-[#75837D] mt-0.5">
                              {Math.round((review.predictionResult?.riskProbability || 0.1) * 100)}% risk
                            </div>
                          </td>

                          {/* Human Approved Maintenance Priority */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <PriorityBadge priority={review.maintenancePriority || review.predictedRisk} />
                              {isOverridden ? (
                                <span className="text-[9px] font-bold text-[#1E7598] bg-[#1E7598]/10 px-1.5 py-0.2 rounded mt-0.5 border border-[#1E7598]/30">
                                  OVERRIDDEN
                                </span>
                              ) : isPending ? (
                                <span className="text-[9px] text-[#A66E0C] mt-0.5 font-semibold">
                                  Pending Review
                                </span>
                              ) : (
                                <span className="text-[9px] text-[#27845C] mt-0.5 font-semibold">
                                  Confirmed
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Review Status Tag */}
                          <td className="py-3 px-3">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#D99A24]/10 text-[#A66E0C] border border-[#D99A24]/30 font-bold">
                                <Clock size={10} /> PENDING
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[#27845C]/10 text-[#27845C] border border-[#27845C]/30 font-bold">
                                <Check size={10} /> REVIEWED
                              </span>
                            )}
                            <div className="text-[9px] text-[#75837D] mt-1">
                              {new Date(review.predictionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          {/* Key Sensor Snapshot */}
                          <td className="py-3 px-3">
                            <div className="text-[11px] text-[#384641] space-y-0.5">
                              <div>Vib: <strong>{features.vibration ? `${features.vibration} mm/s` : '2.1 mm/s'}</strong></div>
                              <div>Wear: <strong>{features.toolWear ? `${features.toolWear} min` : '45 min'}</strong></div>
                              <div className="text-[10px] text-[#68756F] truncate max-w-[140px]" title={review.predictionResult?.suspectedFailureMode}>
                                {review.predictionResult?.suspectedFailureMode || 'Nominal'}
                              </div>
                            </div>
                          </td>

                          {/* Quick Action Buttons */}
                          <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                            {isPending && (
                              <button
                                onClick={(e) => handleQuickConfirm(e, review)}
                                disabled={isConfirmingId === review.predictionId}
                                className="px-2 py-1 bg-[#27845C] hover:bg-[#1C6647] text-white rounded text-[11px] font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                                title="Confirm ML suggested priority as operational priority"
                              >
                                {isConfirmingId === review.predictionId ? 'Saving...' : 'Confirm'}
                              </button>
                            )}
                            <button
                              onClick={(e) => handleOpenOverride(e, review)}
                              className="px-2 py-1 bg-[#F4F7F5] hover:bg-[#176B52] hover:text-white border border-[#D2DDD5] text-[#202A27] rounded text-[11px] font-semibold transition-colors cursor-pointer"
                              title="Override priority with human justification"
                            >
                              Override
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* RIGHT: Selected Prediction Inspection & Sensor Evidence Drawer */}
          {selectedReview && (
            <div className="lg:col-span-5 bg-white border border-[#E0E6E0] rounded-lg p-4 font-mono shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#E0E6E0]">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#202A27] block">
                    Prediction Evidence & Audit
                  </span>
                  <span className="text-[10px] text-[#75837D]">{selectedReview.predictionId}</span>
                </div>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-1 text-[#68756F] hover:text-[#202A27] rounded hover:bg-[#F4F7F5]"
                >
                  <X size={15} />
                </button>
              </div>

              {/* MACHINE & MODEL CARD */}
              <div className="p-3 bg-[#F7FAF8] rounded-lg border border-[#E0E6E0] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-bold text-sm text-[#202A27]">{selectedReview.machineId}</div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    selectedReview.reviewStatus === 'PENDING'
                      ? 'bg-[#D99A24]/10 text-[#A66E0C] border-[#D99A24]/30'
                      : 'bg-[#27845C]/10 text-[#27845C] border-[#27845C]/30'
                  }`}>
                    {selectedReview.reviewStatus}
                  </span>
                </div>

                <div className="text-[11px] text-[#68756F]">
                  Asset Name: <strong className="text-[#202A27]">{selectedReview.machineDetails?.name || selectedReview.machineId}</strong>
                </div>

                {/* DUAL PRIORITY COMPARISON BANNER */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E0E6E0]">
                  <div className="p-2 bg-white rounded border border-[#E0E6E0] text-center">
                    <span className="text-[9px] text-[#75837D] uppercase block font-semibold">1. Original ML Risk</span>
                    <div className="mt-1">
                      <PriorityBadge priority={selectedReview.predictedRisk} />
                    </div>
                    <span className="text-[9px] text-[#68756F] block mt-0.5">Strictly immutable</span>
                  </div>

                  <div className="p-2 bg-white rounded border border-[#E0E6E0] text-center">
                    <span className="text-[9px] text-[#75837D] uppercase block font-semibold">2. Approved Priority</span>
                    <div className="mt-1">
                      <PriorityBadge priority={selectedReview.maintenancePriority} />
                    </div>
                    <span className="text-[9px] text-[#1E7598] font-bold block mt-0.5">
                      {selectedReview.isOverridden ? 'Human Overridden' : 'Operational Priority'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SENSOR EVIDENCE BREAKDOWN */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <Activity size={13} className="text-[#176B52]" /> Telemetry Evidence Ingested
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                    <span className="text-[9px] text-[#75837D] block">Vibration Amplitude</span>
                    <strong className="text-[#202A27]">{selectedReview.inputFeatures?.vibration ?? 2.1} mm/s</strong>
                  </div>
                  <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                    <span className="text-[9px] text-[#75837D] block">Tool Wear</span>
                    <strong className="text-[#202A27]">{selectedReview.inputFeatures?.toolWear ?? 45} min</strong>
                  </div>
                  <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                    <span className="text-[9px] text-[#75837D] block">Spindle Torque</span>
                    <strong className="text-[#202A27]">{selectedReview.inputFeatures?.torque ?? 42.5} Nm</strong>
                  </div>
                  <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                    <span className="text-[9px] text-[#75837D] block">Air Temperature</span>
                    <strong className="text-[#202A27]">{selectedReview.inputFeatures?.airTemperature ?? 298.5} K</strong>
                  </div>
                  <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                    <span className="text-[9px] text-[#75837D] block">Process Temp</span>
                    <strong className="text-[#202A27]">{selectedReview.inputFeatures?.processTemperature ?? 308.7} K</strong>
                  </div>
                  <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0]">
                    <span className="text-[9px] text-[#75837D] block">Spindle Speed</span>
                    <strong className="text-[#202A27]">{selectedReview.inputFeatures?.rotationalSpeed ?? 1540} RPM</strong>
                  </div>
                </div>

                {/* DIAGNOSTIC REASONING */}
                <div className="p-2.5 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-xs space-y-1">
                  <div>
                    <span className="text-[#68756F]">Suspected Fault: </span>
                    <strong className="text-[#202A27]">
                      {selectedReview.predictionResult?.suspectedFailureMode || 'Nominal operation parameters'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#68756F]">ML Recommendation: </span>
                    <span className="text-[#384641]">
                      {selectedReview.predictionResult?.recommendedAction || 'Routine monitoring'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS IN DRAWER */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#E0E6E0]">
                {selectedReview.reviewStatus === 'PENDING' && (
                  <button
                    onClick={(e) => handleQuickConfirm(e, selectedReview)}
                    disabled={isConfirmingId === selectedReview.predictionId}
                    className="flex-1 py-2 px-3 rounded bg-[#27845C] hover:bg-[#1C6647] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Confirm Priority ({selectedReview.predictedRisk})</span>
                  </button>
                )}

                <button
                  onClick={(e) => handleOpenOverride(e, selectedReview)}
                  className="flex-1 py-2 px-3 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal size={14} />
                  <span>Override Priority</span>
                </button>
              </div>

              {/* AUDIT HISTORY & DECISION TIMELINE */}
              <div className="pt-2 border-t border-[#E0E6E0] space-y-2">
                <span className="text-[11px] font-bold text-[#202A27] uppercase flex items-center gap-1.5">
                  <History size={13} className="text-[#176B52]" /> Review Audit Log ({inspectAuditHistory.length})
                </span>

                {loadingAudit ? (
                  <div className="text-center py-4 text-[11px] text-[#75837D]">
                    Loading audit trail...
                  </div>
                ) : inspectAuditHistory.length === 0 ? (
                  <div className="text-[11px] text-[#75837D] p-2 bg-[#F7FAF8] rounded border border-[#E0E6E0]">
                    No human reviews recorded yet. Currently in initial ML default state.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {inspectAuditHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded border text-[11px] space-y-1 ${
                          item.action === 'OVERRIDDEN'
                            ? 'bg-[#1E7598]/5 border-[#1E7598]/25'
                            : 'bg-[#27845C]/5 border-[#27845C]/25'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-bold px-1.5 py-0.2 rounded uppercase ${
                            item.action === 'OVERRIDDEN'
                              ? 'bg-[#1E7598]/15 text-[#1E7598]'
                              : 'bg-[#27845C]/15 text-[#27845C]'
                          }`}>
                            {item.action}: {item.previousPriority || selectedReview.predictedRisk} → {item.newPriority}
                          </span>
                          <span className="text-[#75837D]">
                            {item.reviewedAt ? new Date(item.reviewedAt).toLocaleString() : 'Just now'}
                          </span>
                        </div>
                        <div className="text-[#202A27]">
                          <strong>Reviewer:</strong> {item.reviewedBy || 'Senior Maintenance Engineer'}
                        </div>
                        {item.reason && (
                          <div className="text-[#384641] bg-white p-1.5 rounded border border-[#E0E6E0]/60 italic">
                            "{item.reason}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* OVERRIDE PRIORITY MODAL */}
        {overrideModalOpen && activePrediction && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn font-mono">
            <div className="bg-white border border-[#D2DDD5] rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#E0E6E0]">
                <div>
                  <h3 className="text-sm font-bold text-[#202A27] uppercase tracking-wide flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-[#176B52]" />
                    Human Priority Override Console
                  </h3>
                  <span className="text-[11px] text-[#68756F]">
                    Asset {activePrediction.machineId} • ML Suggested: <strong>{activePrediction.predictedRisk}</strong>
                  </span>
                </div>
                <button
                  onClick={() => setOverrideModalOpen(false)}
                  className="p-1 rounded text-[#68756F] hover:text-[#202A27]"
                >
                  <X size={16} />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded bg-[#B94040]/10 border border-[#B94040]/30 text-xs text-[#B94040] flex items-start gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitOverride} className="space-y-3.5 text-xs">
                {/* Notice regarding ML model preservation */}
                <div className="p-2.5 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-[11px] text-[#68756F] space-y-1">
                  <strong className="text-[#202A27]">System Safety Guarantee: </strong>
                  The original ML prediction output ({activePrediction.predictedRisk}) is permanently retained for model benchmarking. Your operational override directly informs plant dispatch without corrupting model weights.
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="block text-[11px] font-bold text-[#202A27] uppercase mb-1">
                    New Maintenance Priority Tier <span className="text-[#B94040]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setNewPriority(p)}
                        className={`py-2 px-3 rounded border text-xs font-bold transition-all cursor-pointer ${
                          newPriority === p
                            ? p === 'HIGH'
                              ? 'bg-[#B94040]/15 border-[#B94040] text-[#B94040] ring-1 ring-[#B94040]'
                              : p === 'MEDIUM'
                              ? 'bg-[#D99A24]/15 border-[#D99A24] text-[#A66E0C] ring-1 ring-[#D99A24]'
                              : 'bg-[#27845C]/15 border-[#27845C] text-[#27845C] ring-1 ring-[#27845C]'
                            : 'bg-[#F7FAF8] border-[#E0E6E0] text-[#68756F] hover:text-[#202A27]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mandatory Override Reason */}
                <div>
                  <label className="block text-[11px] font-bold text-[#202A27] uppercase mb-1">
                    Mandatory Justification Reason <span className="text-[#B94040]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="E.g., Vibration survey confirmed transducer sensor drift only; physical bearings checked nominal without spalling or overheat."
                    className="w-full p-2.5 bg-[#F7FAF8] border border-[#E0E6E0] rounded text-xs text-[#202A27] placeholder:text-[#829189] focus:border-[#176B52] focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-[#75837D]">
                    This reason is recorded in the permanent audit trail.
                  </span>
                </div>

                {/* Reviewer Identity */}
                <div>
                  <label className="block text-[11px] font-bold text-[#202A27] uppercase mb-1">
                    Reviewer Name & Role
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Chief Reliability Engineer"
                    className="w-full p-2 bg-[#F7FAF8] border border-[#E0E6E0] rounded text-xs text-[#202A27] focus:border-[#176B52] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E0E6E0]">
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="px-3 py-1.5 rounded bg-[#F4F7F5] border border-[#D2DDD5] text-xs text-[#68756F] hover:text-[#202A27]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white font-bold text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? <RotateCw size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>{isSubmitting ? 'Submitting Override...' : 'Confirm Priority Override'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

