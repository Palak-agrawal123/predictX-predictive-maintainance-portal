# PredictX — Industrial Predictive Maintenance Portal (DEV-P04)

**PredictX** is an end-to-end industrial IoT and machine health monitoring decision-support portal designed for manufacturing maintenance teams and plant supervisors. Inspired by the **NASA C-MAPSS** turbofan degradation benchmark, PredictX combines real-time sensor telemetry ingestion, machine learning failure risk estimation (XGBoost, Random Forest, PyTorch sequential deep learning), multi-factor operational priority ranking, and full work order lifecycle dispatch.

---

## 🏗️ Architecture Overview

```
predictX-predictive-maintainance-portal/
├── backend/                                   # Node.js + Express + MongoDB Backend API
│   ├── src/                                   # Express controllers, models, routes, services
│   ├── scripts/seed.js                        # Database seeder with realistic machines & telemetry
│   ├── tests/                                 # Automated unit & integration tests
│   └── README.md                              # In-depth API documentation & specifications
├── ml_service/                                # Python FastAPI ML Microservice (Port 8000)
│   ├── src/                                   # Data loader, model definitions, failure diagnostics
│   ├── models/                                # Benchmark metadata and performance summaries
│   ├── predictor.py                           # Real-time inference pipeline & telemetry mapping
│   ├── server.py                              # FastAPI microservice REST endpoints
│   └── requirements.txt                       # Python dependencies
├── src/                                       # React 18 + Vite Frontend Portal
│   ├── components/                            # UI cards, charts, badges, layout, modals
│   ├── pages/                                 # Dashboard, Machines, Priority, Work Orders, Predictions
│   ├── context/                               # AppDataContext for real-time synchronization
│   └── services/api.js                        # API abstraction and ML service connector
├── C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb # Interactive Jupyter Notebook (Audit, Cleaning, Modeling)
├── pipeline_base_model.py                     # Cleanliness audit, feature engineering & baseline modeling
├── train_all_updated_models.py                # Multi-dataset training pipeline (FD001-FD004)
├── test_model_with_matrices.py                # Evaluation matrices, confusion matrix & reports
├── start_ml_service.bat                       # Launcher for Python FastAPI ML Microservice
├── package.json                               # Frontend dependencies and Vite configuration
└── README.md
```

---

## 🚀 Key Highlights & Capabilities

1. **Machine Learning Prognostics & Held-Out Benchmarks**:
   - NASA C-MAPSS Turbofan degradation modeling across single-regime (FD001, FD003) and multi-regime profiles (FD002, FD004).
   - Models: **XGBoost Regressor**, **Random Forest**, and **PyTorch LSTM / 1D CNN-LSTM Hybrid**.
   - Physics-informed feature engineering: piece-wise linear RUL clipping ($RUL \le 125$), initial healthy baseline drift, rolling statistics (`rm5`, `rm15`, `rstd10`), and `StandardScaler` normalization.
   - Comprehensive metrics: RMSE, MAE, $R^2$, and official **NASA PHM Prognostics Score** (asymmetric exponential penalty).

2. **Interactive Jupyter Notebook**:
   - [`C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb`](./C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb) covers data hygiene audits, zero-variance sensor detection, feature normalization, tree model training, and sequential deep learning architectures.

3. **Multi-Factor Operational Priority (DEV-P04)**:
   - Evaluates:
     $$\text{Priority Score} = 0.50 \times \text{Risk} + 0.25 \times \text{Criticality} + 0.15 \times \text{Production Impact} + 0.10 \times \text{Urgency}$$
   - Sensitivity Simulation: Plant supervisors can model scenarios in real time.

4. **Persistent End-to-End Workflow**:
   - **Predict → Explain → Decide → Schedule → Learn**.
   - Full lifecycle management for machine maintenance work orders (Draft, Approved, In Progress, Completed).

---

## ⚡ Quick Start

### 1. Python ML Microservice & Training Pipeline
```bash
# Install dependencies
pip install -r ml_service/requirements.txt

# Run interactive Jupyter Notebook
jupyter notebook C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb

# Or launch the FastAPI microservice on http://localhost:8000
python ml_service/server.py
# (or double-click start_ml_service.bat on Windows)
```

### 2. Node.js Backend API (Port 5000)
```bash
cd backend
npm install
npm run seed     # Populate realistic machines & telemetry
npm test         # Verify automated test suite
npm run dev      # Runs API at http://localhost:5000
```

### 3. Frontend Portal (Port 5173)
```bash
npm install
npm run dev      # Launches Vite dev server at http://localhost:5173
```
