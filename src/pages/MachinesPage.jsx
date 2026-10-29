import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Layers, Plus, ChevronRight, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { useAppData } from '../context/AppDataContext';
import { Layout } from '../components/layout/Layout';
import { StatusBadge, PriorityBadge } from '../components/common/UIComponents';
import { WorkOrderModal } from '../components/work-orders/WorkOrderModal';

export function MachinesPage() {
  const { machines } = useAppData();
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
    <Layout pageTitle="Machine Fleet Registry">
      <div className="space-y-4 font-mono">
        {/* HEADER BAR */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#E0E6E0] gap-3">
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#202A27] flex items-center gap-2">
              <span className="text-[#176B52]">//</span> ASSET INVENTORY & TELEMETRY REGISTRY
            </h1>
            <p className="text-xs text-[#68756F] mt-0.5">
              Online equipment units, operational state, criticality tier and estimated degradation risk
            </p>
          </div>
          <button
            onClick={() => {
              setSelectedMachineForOrder(machines[0]);
              setModalOpen(true);
            }}
            className="px-3.5 py-1.5 rounded bg-[#176B52] hover:bg-[#10543F] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors self-start sm:self-auto"
          >
            <Plus size={14} /> Create Work Order
          </button>
        </div>

        {/* SEARCH & FILTERS BAR */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg p-3 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Box */}
            <div className="md:col-span-4 relative">
              <Search size={14} className="absolute left-2.5 top-2.5 text-[#68756F]" />
              <input
                type="text"
                placeholder="Search machine ID, model, bay..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded pl-8 pr-3 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none placeholder:text-[#829189]"
              />
            </div>

            {/* Status Filter */}
            <div className="md:col-span-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none"
              >
                <option value="ALL">Status: All</option>
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
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none"
              >
                <option value="ALL">Criticality: All</option>
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
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none truncate"
              >
                <option value="ALL">Type: All</option>
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
                className="w-full bg-[#F7FAF8] border border-[#E0E6E0] rounded px-2.5 py-1.5 text-[#202A27] focus:border-[#176B52] focus:outline-none"
              >
                <option value="risk-desc">Sort: Risk High-Low</option>
                <option value="risk-asc">Sort: Risk Low-High</option>
                <option value="health-asc">Sort: Health Low-High</option>
                <option value="health-desc">Sort: Health High-Low</option>
                <option value="name-asc">Sort: Name (A-Z)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-[#68756F] pt-1">
            <span>Displaying {sortedMachines.length} of {machines.length} registered units</span>
            {(search || statusFilter !== 'ALL' || criticalityFilter !== 'ALL' || typeFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setSearch('');
                  setStatusFilter('ALL');
                  setCriticalityFilter('ALL');
                  setTypeFilter('ALL');
                }}
                className="text-[#176B52] hover:underline"
              >
                Clear all active filters
              </button>
            )}
          </div>
        </div>

        {/* INVENTORY TABLE */}
        <div className="bg-[#FFFFFF] border border-[#E0E6E0] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-[#F4F7F5] border-b border-[#E0E6E0] text-[#68756F] uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Machine ID</th>
                  <th className="py-3 px-4">Asset Name & Bay</th>
                  <th className="py-3 px-4">Equipment Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Criticality</th>
                  <th className="py-3 px-4 text-center">Health</th>
                  <th className="py-3 px-4 text-center">Risk Score</th>
                  <th className="py-3 px-4">Predicted RUL</th>
                  <th className="py-3 px-4">Last Serviced</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5EBE6]">
                {sortedMachines.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-[#68756F]">
                      No machines found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  sortedMachines.map(machine => (
                    <tr
                      key={machine.id}
                      onClick={() => navigate(`/machines/${machine.id}`)}
                      className="hover:bg-[#F4F7F5] transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 font-bold text-[#202A27] group-hover:text-[#176B52] transition-colors">
                        {machine.id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-[#202A27]">{machine.name}</div>
                        <div className="text-[11px] text-[#75837D]">{machine.line}</div>
                      </td>
                      <td className="py-3 px-4 text-[#68756F]">{machine.type}</td>
                      <td className="py-3 px-4">
                        <StatusBadge status={machine.status} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <PriorityBadge priority={machine.criticality} />
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={machine.healthScore >= 70 ? 'text-[#27845C]' : machine.healthScore >= 40 ? 'text-[#D99A24]' : 'text-[#B94040]'}>
                          {machine.healthScore}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        <span className={machine.riskScore >= 65 ? 'text-[#B94040]' : machine.riskScore >= 35 ? 'text-[#D99A24]' : 'text-[#27845C]'}>
                          {machine.riskScore}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[#68756F]">
                        <span className="text-[#202A27] font-semibold">{machine.predictedRul}</span> {machine.rulUnit}
                      </td>
                      <td className="py-3 px-4 text-[#75837D] text-[11px]">{machine.lastMaintenance}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setSelectedMachineForOrder(machine);
                              setModalOpen(true);
                            }}
                            className="px-2 py-1 rounded bg-[#F7FAF8] hover:bg-[#176B52] hover:text-white border border-[#E0E6E0] text-[#68756F] transition-colors text-[11px]"
                          >
                            Order
                          </button>
                          <button
                            onClick={() => navigate(`/machines/${machine.id}`)}
                            className="p-1 rounded hover:bg-[#DFE8E2] text-[#68756F] hover:text-[#202A27]"
                          >
                            <ChevronRight size={15} />
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
