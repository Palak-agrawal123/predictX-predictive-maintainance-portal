import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppDataProvider } from './context/AppDataContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';

// Pages strictly aligned with DEV-P04 Hackathon requirements
import { DashboardPage } from './pages/DashboardPage';
import { MachinesPage } from './pages/MachinesPage';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { MaintenancePriorityPage } from './pages/MaintenancePriorityPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { WorkAuditsPage } from './pages/WorkAuditsPage';
import { PredictionsPage } from './pages/PredictionsPage';
import { HumanReviewPage } from './pages/HumanReviewPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { SensorSimulatorPage } from './pages/SensorSimulatorPage';

export function App() {
  return (
    <ErrorBoundary>
      <AppDataProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sensor-simulator" element={<SensorSimulatorPage />} />
            <Route path="/machines" element={<MachinesPage />} />
            <Route path="/machines/:machineId" element={<MachineDetailPage />} />
            <Route path="/maintenance-priority" element={<MaintenancePriorityPage />} />
            <Route path="/reviews" element={<HumanReviewPage />} />
            <Route path="/human-review" element={<Navigate to="/reviews" replace />} />
            <Route path="/prediction-reviews" element={<Navigate to="/reviews" replace />} />
            <Route path="/work-orders" element={<WorkOrdersPage />} />
            <Route path="/work-audits" element={<WorkAuditsPage />} />
            <Route path="/predictions" element={<PredictionsPage />} />
            <Route path="/ai-assistant" element={<AIAssistantPage />} />
            
            {/* Legacy redirects */}
            <Route path="/welcome" element={<Navigate to="/dashboard" replace />} />
            <Route path="/planning" element={<Navigate to="/work-orders" replace />} />
            <Route path="/maintenance-history" element={<Navigate to="/work-audits" replace />} />
            
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AppDataProvider>
    </ErrorBoundary>
  );
}

export default App;
