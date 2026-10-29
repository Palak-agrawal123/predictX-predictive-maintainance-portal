# Predictive Maintenance Portal (DEV-P04)

An end-to-end industrial IoT and machine health monitoring portal designed for manufacturing maintenance teams. Combines sensor telemetry ingestion, machine failure probability estimation using Machine Learning (XGBoost), multi-factor operational priority ranking, and full work order lifecycle dispatch.

---

## 🏗 Architecture Overview

```
predictive-maintainance-portal/
├── backend/                  # Node.js + Express + MongoDB Backend API
│   ├── src/                  # Express controllers, models, routes, services
│   ├── scripts/seed.js       # Database seeder with realistic machines & telemetry
│   ├── tests/                # 24 automated unit & integration tests
│   └── README.md             # In-depth API documentation & specifications
└── README.md
```

---

## ⚡ Quick Start

### Start the Node.js Express Backend
The backend is completely self-sufficient and includes an integrated, physics-grounded mock prediction adapter (`MOCK_ML_SERVICE=true` in `backend/.env`).

```powershell
cd backend
npm install
npm run seed     # Populate 6 machines, 150 telemetry points, benchmark metrics
npm test         # Verify all 24 automated tests pass
npm run dev      # Runs API at http://localhost:5000
```

When your teammate's ML service is ready:
1. Update `ML_SERVICE_URL` in [`backend/.env`](file:///c:/Users/dell/OneDrive/Documents/predictive-maintainance-portal/backend/.env) to point to their service URL.
2. Set `MOCK_ML_SERVICE=false` to switch to live model predictions.
