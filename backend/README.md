# Predictive Maintenance Portal (DEV-P04) - Backend API

Production-grade Express & MongoDB backend for the Predictive Maintenance Portal. Enables maintenance engineering teams to monitor industrial machines, ingest sensor telemetry, evaluate failure risk via an XGBoost ML service (with physics-based fallback), rank machine maintenance priorities, and manage maintenance work order lifecycles.

---

## 🛠 Tech Stack

- **Runtime**: Node.js (v20+ / v22 LTS tested)
- **Framework**: Express.js 4 (ES Modules)
- **Database**: MongoDB with Mongoose ODM (Tested on MongoDB 8.0)
- **ML Microservice**: Python FastAPI (XGBoost model trained on AI4I 2020 Industrial Predictive Maintenance dataset)
- **Testing**: Node.js Native Test Runner (`node:test`) + Supertest

---

## 📁 Repository Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── db.js                 # Mongoose connection & disconnect management
│   │   └── env.js                # Centralized environment variable schema
│   ├── controllers/
│   │   ├── machineController.js   # Machine inventory & sensor telemetry
│   │   ├── predictionController.js# ML prediction trigger & history
│   │   ├── priorityController.js  # Multi-factor machine priority ranking
│   │   ├── workOrderController.js # Work order drafting & lifecycle state machine
│   │   └── dashboardController.js # Fleet KPI summaries & model evaluations
│   ├── middleware/
│   │   ├── errorHandler.js       # Centralized error handler & status codes
│   │   ├── requestLogger.js      # Structured HTTP request logger
│   │   └── validate.js           # Generic validator middleware
│   ├── models/
│   │   ├── Machine.js            # Machine inventory model
│   │   ├── Prediction.js         # Predictions log model (with isMock flag)
│   │   ├── WorkOrder.js          # Maintenance work order model
│   │   ├── SensorLog.js          # Time-series telemetry points
│   │   └── ModelEvaluation.js    # Validated ML benchmark metrics
│   ├── routes/
│   │   ├── healthRoutes.js       # GET /api/health
│   │   ├── machineRoutes.js      # /api/machines
│   │   ├── predictionRoutes.js   # /api/predict, /api/predictions
│   │   ├── priorityRoutes.js     # /api/machine-priorities
│   │   ├── workOrderRoutes.js    # /api/work-orders
│   │   ├── dashboardRoutes.js    # /api/dashboard/summary
│   │   └── modelMetricsRoutes.js # /api/model-metrics
│   ├── services/
│   │   ├── mlService.js          # FastAPI HTTP client + Physics Fallback Adapter
│   │   └── priorityService.js    # Heuristic business priority scoring engine
│   ├── validators/
│   │   ├── machineValidator.js
│   │   ├── predictionValidator.js
│   │   └── workOrderValidator.js
│   ├── app.js                    # Express application configuration
│   └── server.js                 # HTTP server bootstrap with graceful shutdown
├── scripts/
│   └── seed.js                   # Realistic industrial machines & telemetry seeder
├── tests/
│   ├── health.test.js
│   ├── machine.test.js
│   ├── prediction.test.js
│   ├── priority.test.js
│   └── workOrder.test.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## ⚙️ Environment Variables

Create `.env` in `backend/` (or copy from `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | HTTP port for the backend server |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/predictive_maintenance_dev` | MongoDB connection URI |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Allowed frontend origin for CORS |
| `ML_SERVICE_URL` | `http://127.0.0.1:8000` | Base URL of the Python FastAPI ML microservice |
| `ML_SERVICE_TIMEOUT_MS` | `4000` | Request timeout before triggering fallback mock adapter |
| `MOCK_ML_SERVICE` | `false` | When `true`, forces mock adapter without calling FastAPI |
| `PRIORITY_WEIGHT_RISK` | `0.50` | Weight for ML failure risk score in priority ranking |
| `PRIORITY_WEIGHT_CRITICALITY`| `0.25` | Weight for asset criticality |
| `PRIORITY_WEIGHT_COST` | `0.15` | Weight for hourly downtime financial cost |
| `PRIORITY_WEIGHT_RECENCY` | `0.10` | Weight for elapsed days since last maintenance |
| `BENCHMARK_MAX_DOWNTIME_COST`| `10000` | Normalization ceiling for downtime cost ($/hr) |

---

## 🚀 Quickstart Guide

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Seed Database with Realistic Demo Data
Populates 6 industrial machines across multiple sectors, 150 historical telemetry records, benchmark model evaluations, and initial work orders:
```bash
npm run seed
```

### 3. Run Automated Tests
Runs all 24 unit & integration tests:
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
# Or for standard start:
npm start
```
The server will start at `http://localhost:5000`.

---

## 📊 Priority Ranking Engine Formula

The portal calculates a **Business Maintenance Priority Score** ($0 - 100$) for every machine:

$$\text{PriorityScore} = (w_{\text{risk}} \cdot S_{\text{risk}}) + (w_{\text{crit}} \cdot S_{\text{crit}}) + (w_{\text{cost}} \cdot S_{\text{cost}}) + (w_{\text{recency}} \cdot S_{\text{recency}})$$

Where:
- $S_{\text{risk}} \in [0, 1]$: Raw model failure probability or machine default risk.
- $S_{\text{crit}} \in [0, 1]$: Machine criticality (`low`: 0.20, `medium`: 0.45, `high`: 0.75, `critical`: 1.00).
- $S_{\text{cost}} \in [0, 1]$: $\min(1.0, \frac{\text{downtimeCostPerHour}}{\text{BENCHMARK\_MAX\_DOWNTIME\_COST}})$.
- $S_{\text{recency}} \in [0, 1]$: $\min(1.0, \frac{\text{daysSinceLastMaintenance}}{180})$.

> **Important:** The heuristic business priority score is strictly separated from the raw model risk. The API explicitly returns both fields and does not misrepresent priority as a calibrated failure probability.

---

## 🤖 ML Service Integration & Fallback Mock Adapter

- When the Python FastAPI ML service is running at `ML_SERVICE_URL`, inference is executed live by the real XGBoost model, returning `isMock: false` and `executionSource: "ml_service_fastapi"`.
- If the ML service is unreachable, times out (>4000ms), or `MOCK_ML_SERVICE=true` is set, the backend seamlessly engages the **Heuristic Physics Mock Adapter**:
  - Leverages AI4I 2020 domain rules: Heat Dissipation Failure (HDF), Tool Wear Failure (TWF), Power Failure (PWF), and Overstrain Failure (OSF).
  - Explicitly flags responses with `isMock: true`, `executionSource: "heuristic_mock_adapter"`, and an explanatory `fallbackNotice`.
  - **Zero fabricated ML claims.**

---

## 📡 API Reference & Example Requests

### 1. Healthcheck
```bash
GET /api/health
```
**Response:**
```json
{
  "status": "healthy",
  "service": "predictive-maintenance-backend",
  "components": {
    "database": { "status": "connected", "name": "predictive_maintenance_dev" },
    "mlMicroservice": { "status": "offline", "mockFallbackActive": true }
  }
}
```

### 2. Get All Machines
```bash
GET /api/machines
GET /api/machines?status=operational&criticality=critical
```

### 3. Get Single Machine
```bash
GET /api/machines/MCH-CNC-101
```

### 4. Get Machine Sensor Telemetry History
```bash
GET /api/machines/MCH-CNC-101/sensors?limit=50
```

### 5. Run Prediction on Sensor Telemetry
```bash
POST /api/predict
Content-Type: application/json

{
  "machineId": "MCH-CNC-101",
  "sensors": {
    "airTemperature": 298.5,
    "processTemperature": 308.7,
    "rotationalSpeed": 1550,
    "torque": 42.8,
    "toolWear": 45,
    "vibration": 1.8
  }
}
```
**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "predictionId": "PRD-20261025-XXXXX",
    "machineId": "MCH-CNC-101",
    "predictionType": "failure_risk_classification",
    "predictionResult": {
      "riskProbability": 0.05,
      "riskLevel": "low",
      "healthScore": 95,
      "estimatedRULDays": 60,
      "suspectedFailureMode": "None",
      "recommendedAction": "Machine operating within normal parameters. Routine monitoring scheduled.",
      "confidence": 0.85
    },
    "modelVersion": "heuristic-physics-mock-v1.0",
    "isMock": true,
    "executionSource": "heuristic_mock_adapter"
  }
}
```

### 6. Get Machine Priorities
```bash
GET /api/machine-priorities
```
**Response:**
```json
{
  "success": true,
  "count": 6,
  "data": [
    {
      "machineId": "MCH-TUR-303",
      "name": "Industrial Gas Turbine Generator Gen-3",
      "status": "critical",
      "criticality": "critical",
      "downtimeCostPerHour": 8500,
      "rawModelRisk": {
        "riskProbability": 0.895,
        "riskLevel": "critical",
        "suspectedFailureMode": "Tool Wear Failure (TWF) & Overstrain"
      },
      "priorityEvaluation": {
        "priorityScore": 88,
        "priorityTier": "URGENT",
        "reasons": [
          "High failure risk (89.5%) from Live ML model inference contributes 45 pts",
          "Asset operational criticality is rated 'CRITICAL' (+25 pts)",
          "Substantial downtime financial impact of $8,500/hr (+13 pts)",
          "110 days elapsed since last maintenance cycle (+6 pts)"
        ]
      }
    }
  ]
}
```

### 7. Dashboard Fleet Summary
```bash
GET /api/dashboard/summary
```

### 8. Work Order Management
- **Create Draft Work Order**:
  ```bash
  POST /api/work-orders
  Content-Type: application/json

  {
    "machineId": "MCH-TUR-303",
    "predictionId": "PRD-DEMO-001",
    "title": "Immediate Turbine Spindle Inspection",
    "description": "High vibration and elevated risk detected by ML engine.",
    "priority": "urgent",
    "assignedTo": "Vikram Singh"
  }
  ```
- **List Work Orders**: `GET /api/work-orders?status=approved`
- **Transition Status**:
  ```bash
  PATCH /api/work-orders/WO-01001/status
  Content-Type: application/json

  {
    "status": "in_progress",
    "resolutionNotes": "Work crew dispatched to Sector C."
  }
  ```
  *(Enforces state machine: `draft` $\rightarrow$ `approved` $\rightarrow$ `in_progress` $\rightarrow$ `completed` / `cancelled`)*.
