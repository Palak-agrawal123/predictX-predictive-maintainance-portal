import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronRight } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { PriorityBadge } from '../components/common/UIComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';

export function MachinesPage() {
  const { machines, updateMachineStatus } = useAppData();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [criticalityFilter, setCriticalityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('risk-desc');
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMachineForOrder, setSelectedMachineForOrder] = useState(null);

  // Filter machines
  const filteredMachines = machines.filter(m => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.id.toLowerCase().includes(search.toLowerCase()) ||
      m.type.toLowerCase().includes(search.toLowerCase()) ||
      m.line.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || m.status.toLowerCase() === statusFilter.toLowerCase();
    const matchesCrit = criticalityFilter === 'ALL' || m.criticality.toLowerCase() === criticalityFilter.toLowerCase();
    const matchesType = typeFilter === 'ALL' || m.type === typeFilter;

    return matchesSearch && matchesStatus && matchesCrit && matchesType;
  });

  // Sort machines
  const sortedMachines = [...filteredMachines].sort((a, b) => {
    if (sortBy === 'risk-desc') return b.riskScore - a.riskScore;
    if (sortBy === 'risk-asc') return a.riskScore - b.riskScore;
    if (sortBy === 'health-desc') return b.healthScore - a.healthScore;
    if (sortBy === 'health-asc') return a.healthScore - b.healthScore;
    if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
    return 0;
  });

  const machineTypes = Array.from(new Set(machines.map(m => m.type)));

  return (
    <Layout pageTitle="Machine Fleet">
      <div className="space-y-4">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#DFE4DD] gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#202925]">Equipment Registry</h2>
            <p className="text-xs text-[#68736C] mt-0.5">
              Operating assets, real-time health scores, and degradation estimates.
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedMachineForOrder(machines[0]);
              setModalOpen(true);
            }}
            className="px-3 py-1.5 rounded-md bg-[#246B52] hover:bg-[#1B5440] text-white text-xs font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-xs"
          >
            <Plus size={14} /> Create Work Order
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg p-3 space-y-2.5 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            {/* Search Box */}
            <div className="md:col-span-4 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#68736C]" />
              <input
                type="text"
                placeholder="Search by ID, name, or location..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md pl-8 pr-3 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none placeholder:text-[#85918A]"
              />
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md px-2.5 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Statuses</option>
                <option value="Operational">Operational</option>
                <option value="Degraded">Degraded</option>
                <option value="Under Maintenance">Under Maint.</option>
              </select>
            </div>

            {/* Criticality Filter */}
            <div className="md:col-span-2">
              <select
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md px-2.5 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none"
              >
                <option value="ALL">All Criticalities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            {/* Machine Type Filter */}
            <div className="md:col-span-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md px-2.5 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none truncate"
              >
                <option value="ALL">All Types</option>
                {machineTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Sorting */}
            <div className="md:col-span-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full bg-[#F5F6F2] border border-[#DFE4DD] rounded-md px-2.5 py-1.5 text-[#202925] focus:border-[#246B52] focus:bg-white focus:outline-none"
              >
                <option value="risk-desc">Risk: High to Low</option>
                <option value="risk-asc">Risk: Low to High</option>
                <option value="health-asc">Health: Low to High</option>
                <option value="health-desc">Health: High to Low</option>
                <option value="name-asc">Name: A to Z</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#68736C] pt-1">
            <span>Showing {sortedMachines.length} of {machines.length} assets</span>
            {(search || statusFilter !== 'ALL' || criticalityFilter !== 'ALL' || typeFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setCriticalityFilter('ALL');
                  setTypeFilter('ALL');
                }}
                className="text-[#246B52] hover:underline font-medium cursor-pointer"
              >
                Reset filters
              </button>
            )}
          </div>
        </div>

        {/* INVENTORY TABLE */}
        <div className="bg-white border border-[#DFE4DD] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E7ECE5] text-[#68736C] text-[11px] font-medium bg-[#FAFCFA]">
                  <th className="py-2.5 px-3">Asset ID</th>
                  <th className="py-2.5 px-3">Machine & Bay</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-center">Criticality</th>
                  <th className="py-2.5 px-3 text-center">Health</th>
                  <th className="py-2.5 px-3 text-center">Risk Score</th>
                  <th className="py-2.5 px-3">Predicted RUL</th>
                  <th className="py-2.5 px-3">Last Serviced</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E7ECE5]">
                {sortedMachines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[#68736C]">
                      No machines match the selected filters.
                    </td>
                  </tr>
                ) : (
                  sortedMachines.map(machine => (
                    <tr
                      key={machine.id}
                      onClick={() => navigate(`/machines/${machine.id}`)}
                      className="hover:bg-[#F5F6F2] transition-colors cursor-pointer group"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-[#202925] group-hover:text-[#246B52] transition-colors">
                        {machine.id}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-[#202925]">{machine.name}</div>
                        <div className="text-[11px] text-[#68736C]">{machine.line}</div>
                      </td>
                      <td className="py-2.5 px-3 text-[#68736C]">{machine.type}</td>
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={machine.status}
                          onChange={(e) => updateMachineStatus(machine.id, e.target.value)}
                          className="bg-[#F5F6F2] hover:bg-[#E8F0EA] border border-[#DFE4DD] rounded px-2 py-0.5 text-[11px] font-medium text-[#202925] focus:border-[#246B52] focus:outline-none cursor-pointer"
                        >
                          <option value="Operational">Operational</option>
                          <option value="Degraded">Degraded</option>
                          <option value="Under Maintenance">Under Maint.</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <PriorityBadge priority={machine.criticality} />
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium">
                        <span className={machine.healthScore >= 70 ? 'text-[#368363]' : machine.healthScore >= 40 ? 'text-[#B98232]' : 'text-[#B74747]'}>
                          {machine.healthScore}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-medium">
                        <span className={machine.riskScore >= 65 ? 'text-[#B74747]' : machine.riskScore >= 35 ? 'text-[#B98232]' : 'text-[#368363]'}>
                          {machine.riskScore}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[#68736C] font-mono">
                        <span className="text-[#202925] font-medium">{machine.predictedRul}</span> {machine.rulUnit}
                      </td>
                      <td className="py-2.5 px-3 text-[#68736C] font-mono text-[11px]">{machine.lastMaintenance}</td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedMachineForOrder(machine);
                              setModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-[#F5F6F2] hover:bg-[#E8F0EA] hover:text-[#246B52] border border-[#DFE4DD] text-[#202925] transition-colors text-[11px] font-medium"
                          >
                            Order
                          </button>
                          <button
                            onClick={() => navigate(`/machines/${machine.id}`)}
                            className="p-1 rounded hover:bg-[#E8F0EA] text-[#68736C] hover:text-[#202925]"
                          >
                            <ChevronRight size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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
