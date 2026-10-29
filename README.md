# PredictX — Industrial Predictive Maintenance Portal

**PredictX** is an AI-powered industrial predictive maintenance decision-support portal designed for plant managers and maintenance engineering teams. Inspired by the **NASA C-MAPSS** turbofan run-to-failure degradation benchmark, PredictX combines machine learning risk estimation with operational criticality, production impact, and maintenance urgency.

---

## 🚀 Key Highlights & Architectural Differentiators

1. **Original Industrial Dark Graphite Visual Identity**:
   - Refined dark graphite workstation interface (`#0C100E` background, `#101412` rail, `#111613` panels, `#232C26` restrained borders, and coral/orange accents `#FF805F`).
   - Custom **Fleet Risk Tier Distribution** bar visualization categorized by degradation score.
   - Dual-series **Maintenance Workload Activity Trend** (AreaChart) comparing 7-day logged diagnostic triggers vs completed tasks.
   - Live UTC station clock, operational telemetry status pills, and alert indicator drawer.

2. **Impact-Aware Maintenance Priority (DEV-P04 Decision Layer)**:
   - Evaluates:
     $$\text{Priority Score} = 0.50 \times \text{Risk} + 0.25 \times \text{Criticality} + 0.15 \times \text{Production Impact} + 0.10 \times \text{Urgency}$$
   - Interactive **What-If Sensitivity Simulation**: Sliders let plant supervisors model varying operational scenarios in real time.

3. **Persistent End-to-End Workflow**:
   - **Predict → Explain → Decide → Schedule → Learn**.
   - Create reviewable draft work orders directly from machine alerts, priority matrices, or asset detail views.
   - Updates persist across views (Dashboard, Asset Inventory, Planning & Scheduling, History) via React Context & LocalStorage caching.

4. **Honest ML Transparency & Held-Out Benchmarks**:
   - Exposes NASA C-MAPSS FD001 benchmark metrics (MAE: 14.82 cycles, RMSE: 19.34 cycles).
   - No fabricated claims: explicitly reports `Metrics unavailable` for unmeasured classifications or industrial field metrics.
   - Features clearly documented simulated replay labels.

5. **Future Backend Integration Boundary (`src/services/api.js`)**:
   - Zero live HTTP requests made during this independent frontend phase.
   - Centralized future mapping layer pre-configured for:
     - `GET /api/dashboard/summary`
     - `GET /api/machines`
     - `GET /api/machines/:machineId`
     - `GET /api/machines/:machineId/sensors?limit=50`
     - `GET /api/machine-priorities`
     - `POST /api/predict`
     - `GET /api/work-orders`
     - `POST /api/work-orders`
     - `PATCH /api/work-orders/:workOrderId/status`
     - `GET /api/model-metrics`

---

## 🛠️ Technology Stack

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Data Visualization**: Recharts
- **Routing**: React Router DOM (v6)

---

## 📂 Project Structure

```
frontend/
├── public/
├── src/
│   ├── components/
│   │   ├── charts/           # FleetRiskBarChart, MaintenanceWorkloadTrendChart, SensorTrendChart
│   │   ├── common/           # StatusBadge, PriorityBadge, StatCard, Toast notifications
│   │   ├── layout/           # Custom rail navigation, top utility bar, mobile navigation drawer
│   │   └── work-orders/      # WorkOrderModal form with full validation
│   ├── context/              # AppDataContext for real-time state synchronization
│   ├── data/                 # Deterministic mock telemetry (machines, work orders, predictions, history)
│   ├── pages/                # All 8 core screens + welcome screen
│   │   ├── WelcomePage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── MachinesPage.jsx
│   │   ├── MachineDetailPage.jsx
│   │   ├── MaintenancePriorityPage.jsx
│   │   ├── WorkOrdersPage.jsx
│   │   ├── PlanningPage.jsx
│   │   ├── MaintenanceHistoryPage.jsx
│   │   └── PredictionsPage.jsx
│   ├── services/
│   │   └── api.js            # Future backend API abstraction layer
│   ├── App.jsx               # Routes setup
│   ├── index.css             # Tailwind base & dark theme tokens
│   └── main.jsx
├── index.html
├── package.json
├── tailwind.config.js
└── vite.config.js
```

---

## ⚡ Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### 3. Build for Production
```bash
npm run build
```
Creates an optimized static bundle in the `dist/` directory.

---

## 🧭 Available Routes

- `/welcome` — Centered welcome portal & entrypoint
- `/dashboard` — Fleet operations overview, KPI summaries, risk distribution & workload trends
- `/machines` — Searchable, filterable machine asset inventory table
- `/machines/:machineId` — Machine deep-dive with time-series sensor graphs & explainability
- `/maintenance-priority` — Ranked impact queue with What-If weight simulation
- `/work-orders` — Work order logistics, status updates & detail reviews
- `/planning` — Planning & scheduling horizon (list & calendar views)
- `/maintenance-history` — Historical service audits and parts replacement records
- `/predictions` — C-MAPSS ML model evaluation report & inference trigger
