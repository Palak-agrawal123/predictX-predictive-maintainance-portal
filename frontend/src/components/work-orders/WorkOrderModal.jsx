import React, { useState } from 'react';
import { X, Calendar, Wrench, AlertTriangle, UserCheck } from 'lucide-react';
import { useAppData } from '../../context/AppDataContext';

export function WorkOrderModal({ isOpen, onClose, preselectedMachine = null }) {
  const { machines, addWorkOrder } = useAppData();

  const [machineId, setMachineId] = useState(preselectedMachine?.id || machines[0]?.id || '');
  const [priority, setPriority] = useState(preselectedMachine?.riskScore >= 65 ? 'Urgent' : 'High');
  const [suspectedIssue, setSuspectedIssue] = useState(
    preselectedMachine?.predictedFault || 'Anomaly detected during sensor routine check'
  );
  const [suggestedInspection, setSuggestedInspection] = useState(
    'Inspect primary bearings, check thermal sensors, calibrate telemetry readings and verify lubrication levels.'
  );
  const [technician, setTechnician] = useState('Alex Rivera (Lead Mechatronics)');
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0]
  );
  const [estimatedHours, setEstimatedHours] = useState('4.0');
  const [notes, setNotes] = useState('Drafted from PredictX machine alert queue.');

  if (!isOpen) return null;

  const currentMachine = machines.find(m => m.id === machineId) || preselectedMachine;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!machineId || !suspectedIssue) return;

    addWorkOrder({
      machineId,
      machineName: currentMachine?.name || machineId,
      priority,
      status: 'Draft',
      suspectedIssue,
      suggestedInspection,
      technician,
      scheduledDate,
      estimatedHours: parseFloat(estimatedHours) || 2.0,
      resolutionNotes: notes,
      source: 'Operator Manual Dispatch'
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg max-w-xl w-full p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#E0E6E0]">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-accent/10 border border-accent/30 text-accent">
              <Wrench size={16} />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-text-main uppercase tracking-wider">
                Create Maintenance Work Order
              </h2>
              <p className="text-[11px] font-mono text-text-muted">
                Turn predictive risk insight into a trackable field work order
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text-main hover:bg-[#F7FAF8]">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs font-mono">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
                Target Asset / Machine *
              </label>
              <select
                value={machineId}
                onChange={(e) => {
                  const mId = e.target.value;
                  setMachineId(mId);
                  const sel = machines.find(m => m.id === mId);
                  if (sel?.predictedFault) setSuspectedIssue(sel.predictedFault);
                }}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              >
                {machines.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.id} — {m.name} ({m.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
                Priority Tier *
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              >
                <option value="Low">Low (Routine)</option>
                <option value="Medium">Medium (Scheduled)</option>
                <option value="High">High (Impending Failure)</option>
                <option value="Urgent">Urgent (Immediate Lockout)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
              Suspected Issue / Fault Hypothesis *
            </label>
            <input
              type="text"
              required
              value={suspectedIssue}
              onChange={(e) => setSuspectedIssue(e.target.value)}
              className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              placeholder="e.g. Bearing race micro-spalling in Axis 3"
            />
          </div>

          <div>
            <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
              Suggested Inspection & Procedures
            </label>
            <textarea
              rows={3}
              value={suggestedInspection}
              onChange={(e) => setSuggestedInspection(e.target.value)}
              className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              placeholder="Recommended maintenance action steps..."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
                Assigned Technician
              </label>
              <select
                value={technician}
                onChange={(e) => setTechnician(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              >
                <option value="Alex Rivera (Lead Mechatronics)">Alex Rivera (Lead Mechatronics)</option>
                <option value="Sarah Chen (Turbomachinery Specialist)">Sarah Chen (Turbomachinery Specialist)</option>
                <option value="Elena Rostova (CNC Systems)">Elena Rostova (CNC Systems)</option>
                <option value="Devon Brooks (Hydraulics & Rigging)">Devon Brooks (Hydraulics & Rigging)</option>
                <option value="Marcus Vance (Field Instrumentation)">Marcus Vance (Field Instrumentation)</option>
              </select>
            </div>

            <div>
              <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
                Scheduled Execution Date
              </label>
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
                Est. Downtime Hours
              </label>
              <input
                type="number"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
                Initial Workflow Status
              </label>
              <div className="p-2 rounded bg-[#F7FAF8] border border-[#E0E6E0] text-text-muted flex items-center justify-between">
                <span>DRAFT (Reviewable)</span>
                <span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-text-muted mb-1 text-[11px] uppercase tracking-wider">
              Notes & Dispatch Context
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-3 py-2 text-text-main focus:border-accent focus:outline-none"
              placeholder="e.g. Safety lockout required at shift change"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E0E6E0]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-[#F7FAF8] hover:bg-[#E0E6E0] text-text-muted hover:text-text-main transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-accent hover:bg-accent-hover text-black font-semibold transition-colors flex items-center gap-1.5"
            >
              Create Draft Work Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
