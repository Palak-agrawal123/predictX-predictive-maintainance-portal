# PredictX Machine Learning & Research Package (`ml/`)

This directory organizes all machine learning research, data preprocessing, exploratory data analysis (EDA), multi-dataset training pipelines, cross-validation workflows, and benchmark evaluation reporting for the **PredictX Predictive Maintenance Portal**.

---

## 📁 Directory Structure

```
ml/
├── notebooks/                                  # Interactive Jupyter Notebooks & Generators
│   ├── C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb  # Master interactive notebook (EDA, Cleaning, Models)
│   └── create_notebook.py                     # Programmatic script generating the master notebook
├── scripts/                                    # Automated ML Pipelines, Training & Benchmarking
│   ├── train_all_updated_models.py             # Master multi-dataset training pipeline (FD001-FD004)
│   ├── pipeline_base_model.py                  # Telemetry cleanliness audit & baseline modeling
│   ├── benchmark_all_4_datasets.py             # 3-way evaluation across all 4 C-MAPSS subsets
│   ├── evaluate_train_val_test.py              # Side-by-side train vs. validation vs. test metrics
│   ├── test_model_with_matrices.py             # Comprehensive confusion matrices & residual error plots
│   ├── example_validate_model.py               # Leak-free validation dataset verification
│   ├── explore_models.py                       # Serialized model artifact & feature schema inspector
│   ├── make_validation_split.py                # Unit-stratified validation dataset split generator
│   ├── make_kfold_splits.py                    # 5-fold cross-validation split generator
│   └── run_kfold_cv.py                         # 5-fold cross-validation trainer & evaluator
└── reports/                                    # Generated Evaluation Plots & Prediction Exports
    ├── evaluation_matrices.png                 # Confusion matrices, residual error & correlation plots
    ├── test_predictions_matrix.csv             # Engine-by-engine test set prediction details
    └── test_results_matrices.json              # Structured numerical metrics report
```

---

## 🚀 Workflows & Execution

### 1. Model Inspection & Inference Demo
Inspect active feature schemas, dropped sensor columns, hyperparameters, and run live inference scenarios:
```bash
python ml/scripts/explore_models.py
```

### 2. Multi-Subset Benchmarking (FD001 - FD004)
Run 3-way evaluation across training, held-out validation, and official test sets:
```bash
python ml/scripts/benchmark_all_4_datasets.py
```

### 3. Generate Evaluation Matrices & Plots
Generate confusion matrices (binary & risk tiers), residual error distribution plots, and predictions:
```bash
python ml/scripts/test_model_with_matrices.py
```
Outputs are saved directly to `ml/reports/`.

### 4. Interactive Jupyter Notebook
Launch the comprehensive exploratory and modeling notebook:
```bash
jupyter notebook ml/notebooks/C_MAPSS_MultiSubdataset_Clean_and_Model.ipynb
```
*(Or regenerate it cleanly using `python ml/notebooks/create_notebook.py`)*

### 5. Retrain Models
Execute full automated retraining across all 4 subsets:
```bash
python ml/scripts/train_all_updated_models.py
```
*(Models are persisted directly to `Updated_Models/` and copied to `ml_service/models/`)*
