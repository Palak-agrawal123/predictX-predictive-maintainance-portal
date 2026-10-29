# NASA C-MAPSS Multi-Regime Optimization (FD002 & FD004)
**Target Directory:** `archive/FD0024/`  
**Focus:** Resolving Generalization Gaps and Flight Condition Noise in Complex Multi-Regime Turbofan Degradation

---

## 1. Problem Diagnosis & Motivation

In previous iterations, the models on **FD002 and FD004** achieved:
- **Baseline Test RMSE:** $\approx 30.8 - 31.9$ cycles
- **Baseline Test $R^2$:** $\approx 0.65 - 0.67$
- **NASA Score:** $\approx 9,400 - 19,600$

### Generalization Gap Diagnostic
A training RMSE of $\approx 17.6 - 18.7$ expanding to a test RMSE of $\approx 30.8 - 31.9$ is a **generalization gap (moderate overfitting combined with insufficient regime handling)**, rather than pure underfitting. While published FD001 RMSEs typically range from $11$ to $16$ cycles depending on methodology, published state-of-the-art on multi-regime FD002/FD004 ranges from approximately **$13$ to $23$ cycles**. An RMSE of $31 - 32$ was substantially off-pace.

---

## 2. The 5 Core Fixes Implemented

### Fix 1: Operating-Regime Normalization (Highest Impact)
- Turbofans in FD002 and FD004 transition across **6 distinct flight regimes** (varying altitude from 0 to 42,000 ft, Mach 0.0 to 0.84, and throttle 60 to 100).
- When global scaling is used, altitude changes create massive sensor shifts (thousands of psia/Rankine degrees) that completely overwhelm the subtle degradation signals.
- **Solution:** We fit a `KMeans(k=6)` cluster model **strictly on training operational settings**. Each sensor is standardized within its operating cluster:
  $$s_{\text{norm}} = \frac{s - \mu_{\text{regime}}}{\sigma_{\text{regime}}}$$
  This strips away flight-condition noise and isolates pure mechanical wear.

### Fix 2: Capped Piecewise-Linear Target RUL
- In early cycles, an engine operates with zero detectable wear. Forcing a model to distinguish between cycle 300 and cycle 250 injects pure noise.
- Target RUL is capped at **$R_{\text{clip}} = 125$ cycles**, standard in NASA PHM benchmark literature.

### Fix 3: Feature Selection & EMA Noise Suppression
- After regime normalization, sensors `s_1`, `s_5`, `s_18`, and `s_19` exhibit near-zero variance ($\sigma < 0.05$). These flat sensors are removed, leaving **17 active informative sensors**.
- High-frequency sensor noise is filtered using an **Exponential Moving Average (EMA, span=5)** grouped strictly by engine unit.

### Fix 4: Attention-CNN-BiLSTM Architecture & Regularization
- **1D-CNN Layer:** 64 filters, kernel size 3, with BatchNorm and Dropout to extract local transition patterns.
- **Bidirectional LSTM:** 2 layers, 64 hidden units (128 bidirectional), allowing the model to look forward and backward across a **30-cycle temporal window**.
- **Self-Attention Pooling:** Dynamically weights critical degradation points rather than treating all cycles equally.
- **Regularization:** AdamW with Weight Decay ($10^{-4}$), Dropout (0.25), and Cosine Annealing Learning Rate scheduling to eliminate overfitting.
- **Loss Function:** Smooth L1 (Huber) loss to guard against extreme gradient spikes.

### Fix 5: NASA Standard Evaluation Protocol
- As specified by NASA PHM guidelines, testing is conducted **strictly on the last window of each test engine** (one prediction per engine).
- Evaluates **RMSE, MAE, $R^2$**, and the **asymmetric NASA Prognostics Score** ($e^{d/10}$ vs $e^{-d/13}$).
- Scalers and cluster models are fit **strictly on training data** with zero leakage.

---

## 3. Directory Layout (`FD0024/`)

```
archive/FD0024/
├── README.md                           # Technical documentation and benchmarks
├── regime_normalizer.py                # KMeans(k=6) regime clustering and cluster-wise standardizer
├── model_architectures.py              # PyTorch Attention-CNN-BiLSTM neural network
├── train_and_evaluate_fd0024.py        # Master automated training and benchmarking pipeline
├── models/                             # Serialized models and normalizers
│   ├── regime_normalizer_FD002.joblib
│   ├── best_attention_cnn_bilstm_FD002.pt
│   ├── xgb_regime_FD002.joblib
│   ├── regime_normalizer_FD004.joblib
│   ├── best_attention_cnn_bilstm_FD004.pt
│   └── xgb_regime_FD004.joblib
└── benchmarks/                         # Benchmark comparison results
    ├── final_test_benchmark_FD0024.json
    └── final_test_benchmark_FD0024.csv
```

---

## 4. How to Reproduce

Execute the master pipeline from the project root:
```powershell
python FD0024/train_and_evaluate_fd0024.py
```
