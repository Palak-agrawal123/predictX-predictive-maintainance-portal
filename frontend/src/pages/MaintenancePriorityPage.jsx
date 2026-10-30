import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SlidersHorizontal, RotateCcw, Clock, Wrench } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { PriorityBadge } from '../components/common/UIComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';
import { calculatePriorityScore } from '../services/api';

export function MaintenancePriorityPage() {
  const { machines, priorityWeights, setPriorityWeights, pendingReviewsCount = 0 } = useAppData();
  const navigate = useNavigate();

  const [weights, setWeights] = useState(priorityWeights);
  const [tierFilter, setTierFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);

  // Re-calculate list when weights or machines change
  const scoredMachines = machines.map(m => {
    const calc = calculatePriorityScore(m, weights);
    return {
      ...m,
      calc
    };
  }).sort((a, b) => b.calc.score - a.calc.score);

  const filtered = scoredMachines.filter(m => {
    if (tierFilter === 'ALL') return true;
    return m.calc.band.toLowerCase() === tierFilter.toLowerCase();
  });

  const handleWeightChange = (key, val) => {
    const newWeights = { ...weights, [key]: parseFloat(val) };
    setWeights(newWeights);
    setPriorityWeights(newWeights);
  };

  const resetWeights = () => {
    const defaultWeights = { risk: 0.50, criticality: 0.25, impact: 0.15, urgency: 0.10 };
    setWeights(defaultWeights);
    setPriorityWeights(defaultWeights);
  };

  return (
    <Layout pageTitle="Priority Decision">
      <div className="space-y-4">
        {/* HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DFE4DD] gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#202925]">Maintenance Priority Matrix</h2>
            <p className="text-xs text-[#68736C] mt-0.5">
              Multi-factor operational ranking factoring failure risk, asset criticality, production impact, and review decisions.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {pendingReviewsCount > 0 && (
              <button
                onClick={() => navigate('/reviews')}
                className="px-2.5 py-1.5 rounded-md bg-[#FAF3E7] hover:bg-[#F3E0BD] border border-[#F3E0BD] text-[#B98232] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <Clock size={12} />
                <span>{pendingReviewsCount} Pending Reviews</span>
              </button>
            )}
            <button
              onClick={resetWeights}
              className="px-2.5 py-1.5 rounded-md bg-white hover:bg-[#F5F6F2] border border-[#DFE4DD] text-[#68736C] hover:text-[#202925] text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={12} /> Reset Weights
            </button>
          </div>
        </div>

        {/* DECISION WEIGHT CONTROLS */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#E7ECE5]">
            <div className="flex items-center gap-2">
              <SlidersHorizontal size={14} className="text-[#246B52]" />
              <span className="text-xs font-semibold text-[#202925]">
                Decision Weight Configuration
              </span>
            </div>
            <span className="font-mono text-[11px] text-[#68736C]">
              Score = ({weights.risk.toFixed(2)} × Risk) + ({weights.criticality.toFixed(2)} × Crit) + ({weights.impact.toFixed(2)} × Cost) + ({weights.urgency.toFixed(2)} × Urgency)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD]">
              <div className="flex justify-between mb-1.5">
                <span className="text-[#68736C]">ML Risk Weight</span>
                <span className="font-mono font-semibold text-[#246B52]">{(weights.risk * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="0.8"
                step="0.05"
                value={weights.risk}
                onChange={(e) => handleWeightChange('risk', e.target.value)}
                className="w-full accent-[#246B52] cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD]">
              <div className="flex justify-between mb-1.5">
                <span className="text-[#68736C]">Asset Criticality</span>
                <span className="font-mono font-semibold text-[#2B6E8A]">{(weights.criticality * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.6"
                step="0.05"
                value={weights.criticality}
                onChange={(e) => handleWeightChange('criticality', e.target.value)}
                className="w-full accent-[#2B6E8A] cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD]">
              <div className="flex justify-between mb-1.5">
                <span className="text-[#68736C]">Downtime Impact</span>
                <span className="font-mono font-semibold text-[#B98232]">{(weights.impact * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={weights.impact}
                onChange={(e) => handleWeightChange('impact', e.target.value)}
                className="w-full accent-[#B98232] cursor-pointer"
              />
            </div>

            <div className="p-2.5 rounded-md bg-[#F5F6F2] border border-[#DFE4DD]">
              <div className="flex justify-between mb-1.5">
                <span className="text-[#68736C]">Maintenance Urgency</span>
                <span className="font-mono font-semibold text-[#368363]">{(weights.urgency * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.05"
                value={weights.urgency}
                onChange={(e) => handleWeightChange('urgency', e.target.value)}
                className="w-full accent-[#368363] cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* TIER TABS */}
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1">
          {['ALL', 'Critical', 'High', 'Medium', 'Low'].map(t => (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer ${
                tierFilter === t
                  ? 'bg-[#E8F0EA] border-[#D1E1D5] text-[#246B52] font-semibold'
                  : 'bg-white border-[#DFE4DD] text-[#68736C] hover:text-[#202925]'
              }`}
            >
              {t === 'ALL' ? 'All Tiers' : `${t} Priority`}
            </button>
          ))}
        </div>

        {/* RANKED LIST TABLE */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7ECE5] text-[#68736C] text-[11px] font-medium bg-[#FAFCFA]">
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Equipment</th>
                  <th className="py-2.5 px-3 text-center">ML Risk</th>
                  <th className="py-2.5 px-3 text-center">Approved Priority</th>
                  <th className="py-2.5 px-3">Review Status</th>
                  <th className="py-2.5 px-3 text-center">Priority Score</th>
                  <th className="py-2.5 px-3">Priority Tier</th>
                  <th className="py-2.5 px-3">Operational Recommendation</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECE5]">
                {filtered.map((item, idx) => {
                  const isPending = item.reviewStatus === 'PENDING';
                  const isOverridden = item.isOverridden;
                  const originalRisk = item.predictedRisk || 'MEDIUM';
                  const operationalPriority = item.maintenancePriority || item.calc.band;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/machines/${item.id}`)}
                      className="hover:bg-[#F5F6F2] transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#246B52]">#{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#202925]">{item.name}</div>
                        <div className="text-[11px] font-mono text-[#68736C]">{item.id}</div>
                      </td>

                      {/* Original ML Risk Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <PriorityBadge priority={originalRisk} />
                      </td>

                      {/* Approved Operational Priority Badge */}
                      <td className="py-2.5 px-3 text-center">
                        <PriorityBadge priority={operationalPriority} />
                      </td>

                      {/* Review State Tag */}
                      <td className="py-2.5 px-3">
                        {isOverridden ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#EBF3F6] text-[#2B6E8A] border border-[#CFE2EA] font-medium">
                            Overridden
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#FAF3E7] text-[#B98232] border border-[#F3E0BD] font-medium">
                            Pending Review
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-[#EBF5F0] text-[#368363] border-[#CCE6DA] font-medium">
                            Confirmed
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-center font-mono font-semibold text-sm text-[#202925]">
                        {item.calc.score}
                      </td>

                      <td className="py-2.5 px-3">
                        <PriorityBadge priority={item.calc.band} />
                      </td>

                      <td className="py-2.5 px-3 text-[#68736C] max-w-[220px] truncate" title={item.reviewReason || item.calc.action}>
                        {isOverridden && item.reviewReason ? `[Override] ${item.reviewReason}` : item.calc.action}
                      </td>

                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/reviews');
                          }}
                          className="px-2 py-1 rounded bg-[#F5F6F2] hover:bg-[#E8F0EA] border border-[#DFE4DD] text-[#246B52] transition-colors text-[11px] font-medium cursor-pointer"
                        >
                          Review
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMachine(item);
                            setModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded bg-[#246B52] hover:bg-[#1B5440] text-white transition-colors text-[11px] font-medium cursor-pointer"
                        >
                          Order
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <WorkOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        preselectedMachine={selectedMachine}
      />
    </Layout>
  );
}
