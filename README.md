# PredictX — Industrial Predictive Maintenance Portal (DEV-P04)

**PredictX** is an end-to-end industrial IoT and machine health monitoring decision-support portal designed for manufacturing maintenance teams and plant supervisors. Inspired by the **NASA C-MAPSS** turbofan degradation benchmark, PredictX combines real-time sensor telemetry simulation and ingestion, a 5-stage automated data validation and cleaning pipeline, machine learning failure risk estimation (XGBoost, Random Forest, SOTA **Attention-CNN-BiLSTM** deep learning), multi-factor operational priority ranking, and full work order lifecycle dispatch.

---

## 🏗️ Architecture Overview

```
predictX-predictive-maintainance-portal/
├── backend/                                   # Node.js + Express + MongoDB Backend API (Port 5000)
│   ├── src/
│   │   ├── controllers/                       # Machine, prediction, priority, simulation controllers
│   │   ├── models/                            # Mongoose schemas: Machine, Prediction, SensorLog, Notification
│   │   ├── routes/                            # API routes (including /api/simulation & /api/telemetry)
│   │   ├── services/                          # MLService, SimulationService, NotificationService
│   │   └── server.js & app.js
│   ├── scripts/seed.js                        # Database seeder with realistic machines & telemetry
│   ├── tests/                                 # Automated unit & integration tests
│   └── README.md
├── frontend/                                  # React 18 + Vite Frontend Portal (Port 5173)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── SensorSimulatorPage.jsx        # ★ Dedicated Live Sensor Simulation & Pipeline Dashboard
│   │   │   ├── DashboardPage.jsx              # Fleet Overview
│   │   │   ├── MachinesPage.jsx               # Machine Fleet Management
│   │   │   ├── MaintenancePriorityPage.jsx    # Priority Decision Matrix
│   │   │   ├── HumanReviewPage.jsx            # Human-in-the-Loop review & overrides
│   │   │   ├── PredictionsPage.jsx            # Model evaluations & benchmarks
│   │   │   └── WorkOrdersPage.jsx             # Work order dispatch & lifecycle
│   │   ├── components/layout/Layout.jsx       # Navigation with live simulator link & badges
│   │   ├── services/api.js                    # Unified API layer & SSE stream consumer
│   │   └── context/AppDataContext.jsx
├── ml_service/                                # Python FastAPI ML Microservice (Port 8000)
│   ├── simulator/                             # ★ Live Industrial Sensor Simulation Engine
│   │   ├── schemas.py                         # Pydantic schemas for telemetry, configurations & metrics
│   │   ├── sensor_profiles.py                 # NASA C-MAPSS sensor physical specs & nominal baselines
│   │   ├── sensor_adapters.py                 # Adapters: CMAPSSSensorAdapter & IndustrialWorkshopAdapter
│   │   ├── scenario_generator.py              # Modes A, B, C, D deterministic trajectory synthesis
│   │   ├── sensor_simulator.py                # Multi-machine concurrent state manager
│   │   └── simulation_manager.py              # Background orchestration, SSE queue dispatcher
│   ├── preprocessing/                         # ★ 5-Stage Data Cleaning & Preprocessing Pipeline
│   │   ├── data_validator.py                  # Stage 1: Schema, bounds & type validation
│   │   ├── noise_filter.py                    # Stage 2: Exponential Moving Average (EMA) smoothing
│   │   ├── outlier_detector.py                # Stage 3: Rolling IQR & Z-score spike clamping
│   │   ├── missing_value_handler.py           # Stage 4: Forward-fill, interpolation & quarantine
│   │   ├── feature_engineering.py             # Stage 5: Rolling means (rm5/15), std (rstd10), drift
│   │   ├── model_transformer.py               # Stage 6: Formatter for FD001 (78 feats) & FD002 (30x17 tensor)
│   │   └── pipeline.py                        # Unified DataCleaningPipeline orchestrator
│   ├── models/                                # Trained production model artifacts
│   │   ├── xgb_regressor_FD001.joblib         # FD001 XGBoost Regressor
│   │   ├── rf_regressor_FD001.joblib          # FD001 Random Forest Regressor
│   │   ├── best_attention_cnn_bilstm_FD002.pt # FD002 SOTA Attention-CNN-BiLSTM (PyTorch)
│   │   ├── regime_normalizer_FD002.joblib     # FD002 KMeans(k=6) RegimeNormalizer
│   │   ├── xgb_regime_FD002.joblib            # FD002 XGBoost with Regime Normalization
│   │   ├── xgb_regressor_FD003.joblib         # FD003 XGBoost Regressor
│   │   ├── best_attention_cnn_bilstm_FD004.pt # FD004 SOTA Attention-CNN-BiLSTM (PyTorch)
│   │   ├── regime_normalizer_FD004.joblib     # FD004 KMeans(k=6) RegimeNormalizer
│   │   └── xgb_regime_FD004.joblib            # FD004 XGBoost with Regime Normalization
│   ├── tests/
│   │   ├── test_simulation_pipeline.py        # Automated test suite (13 comprehensive tests)
│   │   └── validate_demo_flow.py              # End-to-end 3-engine demo verification script
│   ├── predictor.py                           # Multi-subset inference engine & root-cause diagnostics
│   └── server.py                              # FastAPI microservice REST & SSE streaming endpoints
├── rag_service/                               # Python FastAPI RAG Knowledge Retrieval Copilot (Port 8001)
├── FD0024/                                    # SOTA Multi-Regime Deep Learning Package (FD002 & FD004)
├── CMaps/                                     # NASA C-MAPSS Raw Benchmark Datasets
├── Updated_Models/                            # Master Production Model Artifacts & Benchmarks
├── run.py                                     # Master single-command launcher
├── start_all.bat & start_all.ps1              # Windows 1-click launchers for all microservices
└── README.md
```

---

## ⚡ Live Sensor Data Collection, Cleaning & Predictive Pipeline

PredictX implements a continuous industrial data processing workflow connecting raw machinery telemetry directly to deep learning and tree-based prognostic models:

```
[ Industrial Machinery / Multi-Engine Simulator ]
                   │
                   ▼  (JSON Telemetry over HTTP / SSE)
[ Stage 1: Raw Data Validation ] ──── Range Bounds, Type Check, Sequence Deduplication
                   │
                   ▼
[ Stage 2: Missing Value Imputation ] ── Forward Fill & Rolling Interpolation (Quarantine > 5 Gaps)
                   │
                   ▼
[ Stage 3: Outlier Detection & Clamping ] ── Rolling IQR (1.5x) & Z-Score (>3.0σ) Suppression
                   │
                   ▼
[ Stage 4: Noise Reduction ] ──────────── Exponential Moving Average (EMA, α=0.35) Smoothing
                   │
                   ▼
[ Stage 5: Feature Engineering ] ──────── Drift from Baseline, Rolling rm5/rm15, rstd10
                   │
                   ▼
[ Stage 6: Model Transformation ]
   ├── FD001/FD003 Single-Regime: 78 / 83 Tabular Feature DataFrame
   └── FD002/FD004 Multi-Regime: KMeans(k=6) RegimeNormalizer -> 30-Cycle Windowed Tensor (1, 30, 17)
                   │
                   ▼
[ Production ML Model Inference ]
   ├── XGBoost Regressor (FD001/FD003)
   └── PyTorch Attention-CNN-BiLSTM (FD002/FD004)
                   │
                   ▼
[ Output Generation & Plant Dispatch ]
   ├── Remaining Useful Life (RUL in cycles)
   ├── Risk Tier (LOW / MEDIUM / HIGH / CRITICAL)
   ├── Root-Cause Component Diagnostics
   ├── MongoDB Synchronization & SSE Broadcast
   └── Automatic Maintenance Work Order Dispatch
```

---

## 🚀 Operating Scenarios (Simulation Modes)

The simulator generates physically grounded thermodynamic telemetry for multiple engines operating simultaneously:

| Simulation Mode | Scenario Description | Expected RUL Behavior | Primary Risk Tier | Active Model |
| :--- | :--- | :--- | :--- | :--- |
| **Mode A** | **Healthy Machine** (Engine-001) | Stable nominal cycles, low wear ($w \approx 0.08$), natural sensor fluctuations | **LOW** (RUL $\approx 110-125$ cycles) | XGBoost Regressor (`xgb_regressor_FD001.joblib`) |
| **Mode B** | **Gradual Degradation** (Engine-002) | Progressive wear acceleration ($w \approx 0.45$), subtle thermal drift | **MEDIUM / HIGH** (RUL $\approx 50-70$ cycles) | XGBoost Regressor (`xgb_regressor_FD001.joblib`) |
| **Mode C** | **Critical Degradation** (Engine-003) | Severe wear ($w \ge 0.82$), elevated exhaust temperature ($T_{50}$ / `s_4`), static pressure rise ($Ps_{30}$ / `s_11`) | **CRITICAL** (RUL $\le 25$ cycles) | PyTorch Attention-CNN-BiLSTM (`best_attention_cnn_bilstm_FD002.pt`) |
| **Mode D** | **Custom Simulation** | User-controlled initial wear, wear rate, tick interval, deterministic seed, and demonstration anomaly injection | Dynamically evaluated | Selected model matching dataset |

---

## 📡 Live Simulation API Endpoints

All endpoints are exposed by the Python FastAPI ML microservice (`:8000`) and also proxied through the Node.js Express backend (`:5000`):

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/simulation/start` | Start multi-machine live telemetry generation with custom configs |
| `POST` | `/api/simulation/pause` | Pause simulation ticks |
| `POST` | `/api/simulation/resume` | Resume paused simulation ticks |
| `POST` | `/api/simulation/stop` | Stop simulation and terminate background thread |
| `POST` | `/api/simulation/reset` | Reset fleet cycles, wear index, and telemetry buffers to baseline |
| `GET` | `/api/simulation/status` | Retrieve current simulator state, speed, active machines, and pipeline KPIs |
| `GET` | `/api/simulation/telemetry` | Retrieve recent raw & cleaned telemetry history and comparison tables |
| `POST` | `/api/telemetry/ingest` | Ingest external physical sensor packets or third-party IoT streams |
| `GET` | `/api/simulation/stream` | **Real-Time Server-Sent Events (SSE)** streaming live ticks to UI |
| `POST` | `/api/simulation/sync-prediction` | Sync simulated machine health and dispatch event notifications to backend |

---

## 🧪 Validated Test Results

Run the automated test suite covering all 13 stages of the pipeline:

```bash
python ml_service/tests/test_simulation_pipeline.py
```

Output:
```
[MLPredictor] Loaded newly trained models successfully from ml_service/models
[MLPredictor] Loaded Attention-CNN-BiLSTM and RegimeNormalizer models for: ['FD002', 'FD004']
[MLPredictor] Loaded FD003 models successfully: ['xgb', 'rf']
.............
----------------------------------------------------------------------
Ran 13 tests in 0.719s

OK
```

Run the end-to-end multi-engine demonstration validation script:
```bash
python ml_service/tests/validate_demo_flow.py
```

Output:
```
Total simulated cycles: 21
Pipeline metrics: {'total_raw_readings': 21, 'valid_readings': 21, 'rejected_readings': 0, 'noise_filtered_readings': 21, 'outliers_detected': 4, 'missing_values_handled': 0, 'cleaning_success_rate': 100.0, 'average_latency_ms': 1.79}
Machine: Engine-001 | Sub: FD001 | Cycle:  52 | RUL: 108 | Risk: low      | Model: xgb_regressor_FD001.joblib (XGBoost Regressor)
Machine: Engine-002 | Sub: FD001 | Cycle: 117 | RUL:  65 | Risk: medium   | Model: xgb_regressor_FD001.joblib (XGBoost Regressor)
Machine: Engine-003 | Sub: FD002 | Cycle: 192 | RUL:  22 | Risk: critical | Model: best_attention_cnn_bilstm_FD002.pt (Attention-CNN-BiLSTM (PyTorch))
Simulation stopped cleanly. Validation successful!
```

---

## 🎬 Technical Mentor Demonstration Guide (Step-by-Step)

During a live technical evaluation, present the following sequence:

1. **Navigate to the Sensor Simulator**: In PredictX, click **"Sensor Simulator"** in the left sidebar navigation (marked with the green `LIVE` badge).
2. **Review Fleet Status**: Notice the 3 simulated turbofan engines:
   - **Engine-001**: Nominal baseline (Healthy, low wear).
   - **Engine-002**: Progressive deterioration (Gradual wear).
   - **Engine-003**: Critical degradation running under multi-regime FD002 with Attention-CNN-BiLSTM.
3. **Start Simulation**: Click the green **"Start Simulation"** button. Observe the status change to `"SSE Stream Active"`.
4. **Inspect Pipeline Visualization**: Watch the 5-stage cleaning pipeline metrics update in real-time:
   - Notice valid readings incrementing.
   - Observe the **Spike / Dropout Injection** catching transient noise and clamping outliers using rolling IQR and Z-scores without corrupting physical trends.
5. **Inspect Raw vs. Cleaned Data**: Scroll to the **"Raw vs. Cleaned Telemetry Inspector"** table.
   - Filter by `"Key Features"` or `"Outliers/Imputed"`.
   - Point out parameter `s_4 (T50)` or `s_11 (Ps30)`: show the raw noisy telemetry versus the cleaned EMA filtered output, along with the automated action tag (`EMA Smoothed` / `Clamped (IQR)`).
6. **Live Sensor Response Chart**: View the interactive time-series chart showing the raw dashed line vs. smooth emerald cleaned response over cycles.
7. **Verify Real ML Model Inference**: Review the **ML Predictive Prognostics** card for Engine-003:
   - Point out that predictions are computed directly by the trained PyTorch neural network (`best_attention_cnn_bilstm_FD002.pt`), predicting an RUL $\le 25$ cycles and flagging **CRITICAL RISK**.
   - Note the root cause failure identification: *"High Pressure Compressor (HPC) & Turbine Clearance Degradation"*.
8. **Dispatch Work Order**: Click **"Dispatch Maintenance Work Order"** on the critical card.
   - The work order modal appears pre-filled with Engine-003, Urgent priority, and recommended inspection actions.
   - Submit the order to demonstrate seamless handoff to the plant maintenance queue.
9. **Sync to Fleet Registry**: Click **"Sync Status to Plant Registry"** to propagate the critical alert into the main Fleet Overview, Priority Decision, and notification bell.

---

## 🔌 Switching from Synthetic Simulation to Physical IoT Sensors

The application architecture includes a dedicated adapter abstraction (`SensorAdapterBase` in `ml_service/simulator/sensor_adapters.py`):

1. **Direct C-MAPSS Ingestion (`CMAPSSSensorAdapter`)**: For test cell telemetry matching the C-MAPSS specification ($s_1$ to $s_{21}$ and operating settings). Send a POST request to:
   ```bash
   curl -X POST http://localhost:8000/api/telemetry/ingest \
     -H "Content-Type: application/json" \
     -d '{"machine_id": "TURBOFAN-01", "subset": "FD001", "cycle": 85, "sensors": {"s_2": 642.5, "s_3": 1589.0, "s_4": 1410.2, ...}}'
   ```
2. **Physical Workshop Telemetry (`IndustrialWorkshopAdapter`)**: For workshop machines with generic sensors (accelerometers, thermocouples, power meters). Send raw workshop readings:
   ```bash
   curl -X POST http://localhost:8000/api/telemetry/ingest \
     -H "Content-Type: application/json" \
     -d '{"machine_id": "CNC-SPINDLE-04", "cycle": 150, "airTemperature": 298.5, "processTemperature": 315.0, "rotationalSpeed": 1480, "torque": 48.5, "toolWear": 195.0, "vibration": 4.8}'
   ```
   The adapter validates the measurements and converts physical indicators into model-compatible features via thermodynamic transfer functions.

---

## ⚡ Quick Start

### 1. Launch All Microservices (Recommended)
```bash
python run.py
```
*(Or run `start_all.bat` / `start_all.ps1` on Windows)*

### 2. Manual Startup
**Python ML Service (Port 8000):**
```bash
cd ml_service
pip install -r requirements.txt
python server.py
```

**Node.js Express Backend (Port 5000):**
```bash
cd backend
npm install
npm run seed
npm run dev
```

**React Vite Frontend (Port 5173):**
```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173/sensor-simulator** in your browser.
