# PredictX — Industrial Predictive Maintenance Portal (DEV-P04)

**PredictX** is an end-to-end industrial IoT and machine health monitoring decision-support portal designed for manufacturing maintenance teams and plant supervisors. Inspired by the **NASA C-MAPSS** turbofan degradation benchmark, PredictX combines real-time sensor telemetry ingestion, machine learning failure risk estimation (XGBoost, Random Forest, SOTA **Attention-CNN-BiLSTM** deep learning), multi-factor operational priority ranking, and full work order lifecycle dispatch.

---

## 🏗️ Architecture Overview

```
predictX-predictive-maintainance-portal/
├── backend/                                   # Node.js + Express + MongoDB Backend API
│   ├── src/                                   # Express controllers, models, routes, services
│   ├── scripts/seed.js                        # Database seeder with realistic machines & telemetry
│   ├── tests/                                 # Automated unit & integration tests
│   └── README.md                              # In-depth API documentation & specifications
├── FD0024/                                    # SOTA Multi-Regime Deep Learning Package (FD002 & FD004)
│   ├── model_architectures.py                 # PyTorch Attention-CNN-BiLSTM with AttentionPooling
│   ├── regime_normalizer.py                   # KMeans(k=6) regime clustering & sensor standardizer
│   ├── train_and_evaluate_fd0024.py           # Master automated training and benchmarking pipeline
│   ├── evaluate_kfold_train_val_test.py       # 4-way evaluation (train vs val vs test)
│   ├── models/                                # Serialized PyTorch & normalizer artifacts
│   │   ├── best_attention_cnn_bilstm_FD002.pt
│   │   ├── best_attention_cnn_bilstm_FD004.pt
│   │   ├── regime_normalizer_FD002.joblib
│   │   ├── regime_normalizer_FD004.joblib
│   │   ├── xgb_regime_FD002.joblib
│   │   └── xgb_regime_FD004.joblib
│   └── benchmarks/                            # Final held-out test & k-fold benchmark reports
├── validation_data/                           # Unit-Stratified Leak-Free Validation Dataset
│   ├── train_split_FD002.txt & FD004.txt     # 80% complete training engine trajectories
│   ├── val_censored_FD002.txt & FD004.txt    # 20% censored validation engines (mirrors test set)
│   ├── val_full_FD002.csv & FD004.csv        # 20% complete run-to-failure validation trajectories
│   ├── val_RUL_FD002.txt & FD004.txt         # Validation ground truth targets
│   └── val_metadata_FD002.json & FD004.json  # Split statistics & held-out unit IDs
├── kfold_data/                                # 5-Fold Cross-Validation Datasets (FD001-FD004)
├── ml_service/                                # Python FastAPI ML Microservice (Port 8000)
│   ├── src/                                   # Data loader, model definitions, failure diagnostics
│   ├── models/                                # Production models & benchmark summaries
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
├── train_all_updated_models.py                # Multi-dataset master training pipeline (FD001-FD004)
├── test_model_with_matrices.py                # Evaluation matrices, confusion matrix & reports
├── make_validation_split.py                   # Script generating leak-free validation splits
├── make_kfold_splits.py & run_kfold_cv.py     # 5-fold cross-validation generators & runners
├── start_ml_service.bat                       # Launcher for Python FastAPI ML Microservice
├── package.json                               # Frontend dependencies and Vite configuration
└── README.md
```

---

## 🚀 Key Highlights & Machine Learning Capabilities

### 1. Multi-Regime Deep Learning: Attention-CNN-BiLSTM (FD002 & FD004)
Turbofans in FD002 and FD004 transition across **6 distinct flight regimes** (varying altitude from 0 to 42,000 ft, Mach 0.0 to 0.84, throttle 60 to 100), where altitude shifts dwarf subtle mechanical degradation.

We solved this with:
- **Operating-Regime Normalizer (`RegimeNormalizer`)**:
  - `KMeans(k=6)` cluster model fit strictly on training operational settings.
  - Standardizes each sensor relative to its operating flight cluster ($s_{\text{norm}} = \frac{s - \mu_{\text{regime}}}{\sigma_{\text{regime}}}$).
  - Automatically identifies and drops flat zero-variance sensors (`s_1`, `s_5`, `s_18`, `s_19`), isolating **17 active informative sensors**.
  - Exponential Moving Average (EMA, span=5) for sensor flutter suppression.
- **Attention-CNN-BiLSTM Architecture**:
  - **1D-CNN Layer**: 64 filters, kernel size 3, with BatchNorm and Dropout (0.25) to capture local transition patterns.
  - **Bidirectional LSTM**: 2 layers, 64 hidden units (128 bidirectional), capturing bidirectional contextual dependencies over a **30-cycle temporal window**.
  - **Self-Attention Pooling (`AttentionPooling`)**: Dynamically computes importance weights $\alpha_t$ to focus on critical degradation inflection points.
  - **Regularized Head**: AdamW with Weight Decay ($10^{-4}$), Smooth L1 (Huber) loss, and Cosine Annealing learning rate schedule.

### 2. Validated Held-Out Benchmark Performance

| Sub-dataset | Architecture | Test RMSE (cycles) | Test MAE (cycles) | Test $R^2$ | Official NASA Score |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **FD001** | XGBoost Regressor | **12.51** | **9.29** | **0.9093** | **198.1** |
| **FD001** | Random Forest | 13.96 | 10.94 | 0.8863 | 310.2 |
| **FD002** | **Attention-CNN-BiLSTM** | **27.08** | **18.02** | **0.7464** | **8,537.4** |
| **FD002** | XGBoost (Regime-Norm) | 27.34 | 19.01 | 0.7415 | 9,390.8 |
| **FD003** | XGBoost Regressor | **13.96** | **10.94** | **0.8863** | **310.2** |
| **FD004** | **Attention-CNN-BiLSTM** | **25.72** | **18.83** | **0.7775** | **4,170.8** |
| **FD004** | XGBoost (Regime-Norm) | 28.67 | 21.20 | 0.7236 | 5,950.5 |

*(Major improvement on multi-regime datasets: FD002 NASA score dropped from 19,629 to 8,537; FD004 NASA score dropped from 9,476 to 4,170).*

### 3. Leak-Free Unit Validation Dataset (`validation_data/`)
- Contains complete 80/20 train/validation splits performed at the **engine unit level** to prevent temporal leakage.
- Provides both full run-to-failure curves (`val_full_*.csv`) and censored test-like snapshots (`val_censored_*.txt` + `val_RUL_*.txt`).

### 4. Multi-Factor Operational Priority (DEV-P04)
$$\text{Priority Score} = 0.50 \times \text{Risk} + 0.25 \times \text{Criticality} + 0.15 \times \text{Production Impact} + 0.10 \times \text{Urgency}$$

---

## ⚡ Quick Start

### 1. Python ML Microservice & Training Pipeline
```bash
# Install dependencies
pip install -r ml_service/requirements.txt

# Run the SOTA multi-regime pipeline for FD002 & FD004
python FD0024/train_and_evaluate_fd0024.py

# Evaluate 4-way train vs validation vs test benchmarks
python FD0024/evaluate_kfold_train_val_test.py

# Launch the FastAPI microservice on http://localhost:8000
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
