import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';

// Pages strictly aligned with DEV-P04 Hackathon requirements
import { DashboardPage } from './pages/DashboardPage';
import { MachinesPage } from './pages/MachinesPage';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { MaintenancePriorityPage } from './pages/MaintenancePriorityPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { PredictionsPage } from './pages/PredictionsPage';

export function App() {
  return (
    <AppDataProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="/machines/:machineId" element={<MachineDetailPage />} />
          <Route path="/maintenance-priority" element={<MaintenancePriorityPage />} />
          <Route path="/work-orders" element={<WorkOrdersPage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          
          {/* Legacy redirects for removed extra routes */}
          <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />
          <Route path="/planning" element={<Navigate to="/work-orders" replace />} />
          <Route path="/maintenance-history" element={<Navigate to="/work-orders" replace />} />
          
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppDataProvider>
  );
}

export default App;
