import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Search,
  Clock,
  Cpu,
  History,
  Check,
  X,
  SlidersHorizontal,
  Wrench,
  AlertCircle,
  Activity
} from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { PriorityBadge, StatusBadge, StatCard } from '../components/common/UIComponents';
import { api } from '../services/api';

export function HumanReviewPage() {
  const { machines, confirmReview, overrideReview, addToast } = useAppData();
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

  const complianceRate = metrics.totalReviews > 0 ? Math.round((metrics.reviewedCount / metrics.totalReviews) * 100) : 100;

  return (
    <Layout pageTitle="Prediction Reviews">
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DFE4DD] gap-3">
          <div>
            <h1 className="text-base font-semibold text-[#202925]">
              Human Review & Priority Override
            </h1>
            <p className="text-xs text-[#68736C] mt-0.5">
              Inspect ML prognostics, review sensor evidence, verify or override operational maintenance priority.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchReviewsData}
              disabled={loading}
              className="px-3 py-1.5 rounded-md bg-white hover:bg-[#F0F2ED] border border-[#DFE4DD] text-[#202925] text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw size={13} className={loading ? 'animate-spin text-[#246B52]' : ''} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* METRICS & AUDIT KPI BANNER */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <StatCard
            title="Total Predictions"
            value={metrics.totalReviews}
            icon={Cpu}
          />
          <StatCard
            title="Pending Review"
            value={metrics.pendingCount}
            icon={Clock}
          />
          <StatCard
            title="Human Confirmed"
            value={metrics.confirmedCount}
            icon={CheckCircle2}
          />
          <StatCard
            title="Human Overridden"
            value={metrics.overriddenCount}
            icon={SlidersHorizontal}
          />
          <StatCard
            title="Review Compliance"
            value={`${complianceRate}%`}
            subtitle={`${metrics.reviewedCount} of ${metrics.totalReviews} reviewed`}
            icon={UserCheck}
          />
        </div>

        {/* CONTROLS & FILTER BAR */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            {/* Review Status Tabs */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'PENDING'
                    ? 'bg-[#B98232]/10 border-[#B98232]/30 text-[#B98232]'
                    : 'bg-white border-[#DFE4DD] text-[#68736C] hover:text-[#202925]'
                }`}
              >
                <Clock size={12} />
                <span>Pending ({metrics.pendingCount})</span>
              </button>

              <button
                onClick={() => setStatusFilter('REVIEWED')}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === 'REVIEWED'
                    ? 'bg-[#368363]/10 border-[#368363]/30 text-[#368363]'
                    : 'bg-white border-[#DFE4DD] text-[#68736C] hover:text-[#202925]'
                }`}
              >
                <CheckCircle2 size={12} />
                <span>Reviewed ({metrics.reviewedCount})</span>
              </button>

              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-[#246B52] border-[#246B52] text-white'
                    : 'bg-white border-[#DFE4DD] text-[#68736C] hover:text-[#202925]'
                }`}
              >
                <span>All ({metrics.totalReviews})</span>
              </button>
            </div>

            {/* Risk Tier & Search Filter */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-[#FAFBF9] border border-[#DFE4DD] text-xs text-[#202925] px-3 py-1.5 rounded-md focus:border-[#246B52] focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Risk Tiers</option>
                <option value="HIGH">High Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="LOW">Low Risk</option>
              </select>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-[#68736C]" />
                <input
                  type="text"
                  placeholder="Filter by machine ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-[#FAFBF9] border border-[#DFE4DD] text-xs text-[#202925] rounded-md placeholder:text-[#68736C]/60 focus:border-[#246B52] focus:outline-none w-48"
                />
              </div>
            </div>
          </div>
        </div>

        {/* WORKSPACE LAYOUT: Reviews Master Table + Inspection & Audit Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* LEFT: Predictions Table */}
          <div className={`${selectedReview ? 'lg:col-span-7' : 'lg:col-span-12'} bg-white border border-[#DFE4DD] rounded-lg overflow-hidden`}>
            <div className="p-3 border-b border-[#DFE4DD] bg-[#FAFBF9] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={14} className="text-[#246B52]" />
                <span className="font-semibold text-[#202925]">
                  Prediction Queue ({filteredReviews.length})
                </span>
              </div>
              <span className="text-[11px] text-[#68736C]">Select row to inspect telemetry</span>
            </div>

            {loading ? (
              <div className="p-12 text-center text-xs text-[#68736C]">
                <RotateCw size={18} className="animate-spin text-[#246B52] mx-auto mb-2" />
                Loading review records...
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-12 text-center text-xs text-[#68736C]">
                <AlertCircle size={22} className="text-[#68736C]/40 mx-auto mb-2" />
                No predictions match the active filter criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAFBF9] border-b border-[#DFE4DD] text-[#68736C] text-[11px] font-medium">
                      <th className="py-2.5 px-3">Equipment</th>
                      <th className="py-2.5 px-3 text-center">ML Risk</th>
                      <th className="py-2.5 px-3 text-center">Approved Priority</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Evidence</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E7ECE5]">
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
                              ? 'bg-[#E8F0EA] border-l-3 border-[#246B52]'
                              : isPending
                              ? 'hover:bg-[#FAFBF9]'
                              : 'hover:bg-[#FAFBF9]'
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-mono font-medium text-[#202925]">{review.machineId}</div>
                            <div className="text-[11px] text-[#68736C] truncate max-w-[130px]">
                              {machine?.name || review.machineId}
                            </div>
                            <div className="font-mono text-[10px] text-[#68736C]/70 mt-0.5">
                              {review.predictionId}
                            </div>
                          </td>

                          {/* ML Risk Badge */}
                          <td className="py-3 px-3 text-center">
                            <PriorityBadge priority={review.predictedRisk || review.predictionResult?.riskLevel} />
                            <div className="font-mono text-[10px] text-[#68736C] mt-0.5">
                              {Math.round((review.predictionResult?.riskProbability || 0.1) * 100)}%
                            </div>
                          </td>

                          {/* Human Approved Maintenance Priority */}
                          <td className="py-3 px-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <PriorityBadge priority={review.maintenancePriority || review.predictedRisk} />
                              {isOverridden ? (
                                <span className="text-[10px] font-medium text-[#246B52] bg-[#E8F0EA] px-1.5 py-0.2 rounded mt-0.5">
                                  Overridden
                                </span>
                              ) : isPending ? (
                                <span className="text-[10px] text-[#B98232] mt-0.5 font-medium">
                                  Pending
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#368363] mt-0.5 font-medium">
                                  Confirmed
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Review Status Tag */}
                          <td className="py-3 px-3">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#B98232]/10 text-[#B98232] border border-[#B98232]/25 font-medium">
                                <Clock size={10} />
                                <span>Pending</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#368363]/10 text-[#368363] border border-[#368363]/25 font-medium">
                                <Check size={10} />
                                <span>Reviewed</span>
                              </span>
                            )}
                            <div className="font-mono text-[10px] text-[#68736C] mt-1">
                              {new Date(review.predictionTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>

                          {/* Key Sensor Snapshot */}
                          <td className="py-3 px-3">
                            <div className="text-[11px] text-[#202925] space-y-0.5">
                              <div>Vib: <span className="font-mono">{features.vibration ? `${features.vibration} mm/s` : '2.1 mm/s'}</span></div>
                              <div>Wear: <span className="font-mono">{features.toolWear ? `${features.toolWear} min` : '45 min'}</span></div>
                              <div className="text-[10px] text-[#68736C] truncate max-w-[140px]" title={review.predictionResult?.suspectedFailureMode}>
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
                                className="px-2.5 py-1 bg-[#246B52] hover:bg-[#1B5440] text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer"
                                title="Confirm ML priority"
                              >
                                {isConfirmingId === review.predictionId ? 'Saving...' : 'Confirm'}
                              </button>
                            )}
                            <button
                              onClick={(e) => handleOpenOverride(e, review)}
                              className="px-2.5 py-1 bg-white hover:bg-[#F0F2ED] border border-[#DFE4DD] text-[#202925] rounded-md text-xs font-medium transition-colors cursor-pointer"
                              title="Override priority"
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
            <div className="lg:col-span-5 bg-white border border-[#DFE4DD] rounded-lg p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#DFE4DD]">
                <div>
                  <span className="text-xs font-semibold text-[#202925] block">
                    Prediction Evidence & Audit
                  </span>
                  <span className="font-mono text-[10px] text-[#68736C]">{selectedReview.predictionId}</span>
                </div>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-1 text-[#68736C] hover:text-[#202925] rounded-md hover:bg-[#F0F2ED] cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* MACHINE & MODEL CARD */}
              <div className="p-3 bg-[#FAFBF9] rounded-lg border border-[#DFE4DD] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="font-mono font-semibold text-sm text-[#202925]">{selectedReview.machineId}</div>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                    selectedReview.reviewStatus === 'PENDING'
                      ? 'bg-[#B98232]/10 text-[#B98232] border-[#B98232]/25'
                      : 'bg-[#368363]/10 text-[#368363] border-[#368363]/25'
                  }`}>
                    {selectedReview.reviewStatus}
                  </span>
                </div>

                <div className="text-[11px] text-[#68736C]">
                  Asset: <span className="font-medium text-[#202925]">{selectedReview.machineDetails?.name || selectedReview.machineId}</span>
                </div>

                {/* DUAL PRIORITY COMPARISON BANNER */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#DFE4DD]">
                  <div className="p-2.5 bg-white rounded-md border border-[#DFE4DD] text-center">
                    <span className="text-[10px] text-[#68736C] block font-medium">Original ML Risk</span>
                    <div className="mt-1">
                      <PriorityBadge priority={selectedReview.predictedRisk} />
                    </div>
                    <span className="text-[10px] text-[#68736C] block mt-0.5">Model output</span>
                  </div>

                  <div className="p-2.5 bg-white rounded-md border border-[#DFE4DD] text-center">
                    <span className="text-[10px] text-[#68736C] block font-medium">Approved Priority</span>
                    <div className="mt-1">
                      <PriorityBadge priority={selectedReview.maintenancePriority} />
                    </div>
                    <span className="text-[10px] text-[#246B52] font-medium block mt-0.5">
                      {selectedReview.isOverridden ? 'Human Overridden' : 'Operational Priority'}
                    </span>
                  </div>
                </div>
              </div>

              {/* SENSOR EVIDENCE BREAKDOWN */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#202925] flex items-center gap-1.5">
                  <Activity size={13} className="text-[#246B52]" />
                  <span>Telemetry Evidence</span>
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <div className="p-2 rounded-md bg-[#FAFBF9] border border-[#DFE4DD]">
                    <span className="text-[10px] text-[#68736C] block">Vibration</span>
                    <span className="font-mono font-medium text-[#202925]">{selectedReview.inputFeatures?.vibration ?? 2.1} mm/s</span>
                  </div>
                  <div className="p-2 rounded-md bg-[#FAFBF9] border border-[#DFE4DD]">
                    <span className="text-[10px] text-[#68736C] block">Tool Wear</span>
                    <span className="font-mono font-medium text-[#202925]">{selectedReview.inputFeatures?.toolWear ?? 45} min</span>
                  </div>
                  <div className="p-2 rounded-md bg-[#FAFBF9] border border-[#DFE4DD]">
                    <span className="text-[10px] text-[#68736C] block">Spindle Torque</span>
                    <span className="font-mono font-medium text-[#202925]">{selectedReview.inputFeatures?.torque ?? 42.5} Nm</span>
                  </div>
                  <div className="p-2 rounded-md bg-[#FAFBF9] border border-[#DFE4DD]">
                    <span className="text-[10px] text-[#68736C] block">Air Temp</span>
                    <span className="font-mono font-medium text-[#202925]">{selectedReview.inputFeatures?.airTemperature ?? 298.5} K</span>
                  </div>
                  <div className="p-2 rounded-md bg-[#FAFBF9] border border-[#DFE4DD]">
                    <span className="text-[10px] text-[#68736C] block">Process Temp</span>
                    <span className="font-mono font-medium text-[#202925]">{selectedReview.inputFeatures?.processTemperature ?? 308.7} K</span>
                  </div>
                  <div className="p-2 rounded-md bg-[#FAFBF9] border border-[#DFE4DD]">
                    <span className="text-[10px] text-[#68736C] block">Spindle Speed</span>
                    <span className="font-mono font-medium text-[#202925]">{selectedReview.inputFeatures?.rotationalSpeed ?? 1540} RPM</span>
                  </div>
                </div>

                {/* DIAGNOSTIC REASONING */}
                <div className="p-2.5 rounded-md bg-[#FAFBF9] border border-[#DFE4DD] text-xs space-y-1">
                  <div>
                    <span className="text-[#68736C]">Suspected Fault: </span>
                    <span className="font-medium text-[#202925]">
                      {selectedReview.predictionResult?.suspectedFailureMode || 'Nominal operation parameters'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#68736C]">Recommendation: </span>
                    <span className="text-[#202925]">
                      {selectedReview.predictionResult?.recommendedAction || 'Routine monitoring'}
                    </span>
                  </div>
                </div>
              </div>

              {/* ACTION BUTTONS IN DRAWER */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#DFE4DD]">
                {selectedReview.reviewStatus === 'PENDING' && (
                  <button
                    onClick={(e) => handleQuickConfirm(e, selectedReview)}
                    disabled={isConfirmingId === selectedReview.predictionId}
                    className="flex-1 py-2 px-3 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white font-medium text-xs flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>Confirm ({selectedReview.predictedRisk})</span>
                  </button>
                )}

                <button
                  onClick={(e) => handleOpenOverride(e, selectedReview)}
                  className="flex-1 py-2 px-3 rounded-md bg-white hover:bg-[#F0F2ED] border border-[#DFE4DD] text-[#202925] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal size={14} />
                  <span>Override Priority</span>
                </button>
              </div>

              {/* AUDIT HISTORY & DECISION TIMELINE */}
              <div className="pt-2 border-t border-[#DFE4DD] space-y-2">
                <span className="text-xs font-semibold text-[#202925] flex items-center gap-1.5">
                  <History size={13} className="text-[#246B52]" />
                  <span>Review Audit Log ({inspectAuditHistory.length})</span>
                </span>

                {loadingAudit ? (
                  <div className="text-center py-4 text-[11px] text-[#68736C]">
                    Loading audit trail...
                  </div>
                ) : inspectAuditHistory.length === 0 ? (
                  <div className="text-[11px] text-[#68736C] p-2.5 bg-[#FAFBF9] rounded-md border border-[#DFE4DD]">
                    No human reviews recorded yet. Currently in initial ML default state.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {inspectAuditHistory.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-md border border-[#DFE4DD] bg-[#FAFBF9] text-[11px] space-y-1"
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className={`font-medium px-1.5 py-0.2 rounded ${
                            item.action === 'OVERRIDDEN'
                              ? 'bg-[#246B52]/10 text-[#246B52]'
                              : 'bg-[#368363]/10 text-[#368363]'
                          }`}>
                            {item.action}: {item.previousPriority || selectedReview.predictedRisk} → {item.newPriority}
                          </span>
                          <span className="font-mono text-[#68736C]">
                            {item.reviewedAt ? new Date(item.reviewedAt).toLocaleDateString() : 'Recent'}
                          </span>
                        </div>
                        <div className="text-[#202925]">
                          <span className="text-[#68736C]">Reviewer:</span> {item.reviewedBy || 'Senior Maintenance Engineer'}
                        </div>
                        {item.reason && (
                          <div className="text-[#202925] bg-white p-2 rounded border border-[#DFE4DD] text-xs">
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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white border border-[#DFE4DD] rounded-xl max-w-lg w-full p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#DFE4DD]">
                <div>
                  <h3 className="text-sm font-semibold text-[#202925] flex items-center gap-2">
                    <SlidersHorizontal size={15} className="text-[#246B52]" />
                    <span>Human Priority Override</span>
                  </h3>
                  <span className="font-mono text-[11px] text-[#68736C]">
                    Machine {activePrediction.machineId} • ML Risk: {activePrediction.predictedRisk}
                  </span>
                </div>
                <button
                  onClick={() => setOverrideModalOpen(false)}
                  className="p-1 rounded-md text-[#68736C] hover:text-[#202925] hover:bg-[#F0F2ED] cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {formError && (
                <div className="p-2.5 rounded-md bg-[#B74747]/10 border border-[#B74747]/20 text-xs text-[#B74747] flex items-start gap-2">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSubmitOverride} className="space-y-3.5 text-xs">
                {/* Priority Selection */}
                <div>
                  <label className="block text-[11px] font-medium text-[#202925] mb-1.5">
                    New Maintenance Priority Tier <span className="text-[#B74747]">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['HIGH', 'MEDIUM', 'LOW'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setNewPriority(p)}
                        className={`py-2 px-3 rounded-md border text-xs font-medium transition-all cursor-pointer ${
                          newPriority === p
                            ? p === 'HIGH'
                              ? 'bg-[#B74747]/10 border-[#B74747] text-[#B74747]'
                              : p === 'MEDIUM'
                              ? 'bg-[#B98232]/10 border-[#B98232] text-[#B98232]'
                              : 'bg-[#368363]/10 border-[#368363] text-[#368363]'
                            : 'bg-white border-[#DFE4DD] text-[#68736C] hover:text-[#202925]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mandatory Override Reason */}
                <div>
                  <label className="block text-[11px] font-medium text-[#202925] mb-1">
                    Justification Reason <span className="text-[#B74747]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="E.g., Vibration survey confirmed transducer sensor drift only; physical bearings checked nominal without spalling or overheat."
                    className="w-full p-2.5 bg-[#FAFBF9] border border-[#DFE4DD] rounded-md text-xs text-[#202925] placeholder:text-[#68736C]/60 focus:border-[#246B52] focus:outline-none"
                    required
                  />
                </div>

                {/* Reviewer Identity */}
                <div>
                  <label className="block text-[11px] font-medium text-[#202925] mb-1">
                    Reviewer Name & Role
                  </label>
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    placeholder="Chief Reliability Engineer"
                    className="w-full p-2 bg-[#FAFBF9] border border-[#DFE4DD] rounded-md text-xs text-[#202925] focus:border-[#246B52] focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#DFE4DD]">
                  <button
                    type="button"
                    onClick={() => setOverrideModalOpen(false)}
                    className="px-3 py-1.5 rounded-md bg-white border border-[#DFE4DD] text-xs font-medium text-[#68736C] hover:text-[#202925] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white font-medium text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting ? <RotateCw size={12} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    <span>{isSubmitting ? 'Saving...' : 'Confirm Override'}</span>
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
