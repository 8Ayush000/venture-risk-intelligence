# 🚀 Startup Risk Intelligence AI

An advanced AI-powered system to analyze startups and predict failure risk using financial, market, and social indicators.

This project aims to help investors, founders, and incubators make data-driven decisions.

---

## 📊 Key Features

- 📈 Startup Failure Prediction (ML Models)
- ⏳ Time-to-Failure Forecasting
- 🧠 Explainable AI (SHAP, LIME)
- 🌐 FastAPI Backend
- 📊 Interactive Dashboard (Streamlit)
- 🔍 Multi-Source Data Integration

---

## 🛠️ Tech Stack

- Python
- Pandas, NumPy
- Scikit-learn, XGBoost
- NLP (NLTK, Transformers)
- FastAPI
- Streamlit
- SHAP
- PostgreSQL

---

## 📁 Project Structure
Startup-Risk-Intelligence-AI/
│
├── data/
│ ├── raw/
│ └── processed/
│
├── notebooks/
│ └── 01_eda.ipynb
│
├── src/
│ ├── preprocessing.py
│ ├── feature_engineering.py
│ └── train_model.py
│
├── models/
│
├── api/
│ └── main.py
│
├── dashboard/
│ └── app.py
│
├── reports/
│
└── README.md

---

## 🖥️ Frontend — Startup Vitals Monitor

A self-contained diagnostics dashboard for exploring failure risk, built as a single HTML file with live charts.

![Startup Vitals Monitor preview](frontend/assets/vitals-monitor-preview.png)

**Features**
- Intake form covering the same features used in `data/raw/startup_failure_prediction.csv`
- Overall risk gauge with a confidence score
- "Why This Score" breakdown showing each factor's weighted contribution
- Risk profile radar chart, 24-month cash runway projection, and a benchmark chart vs. the dataset average
- Reliability check that flags any input outside the ranges seen in training data

**Run it locally**
```bash
open frontend/index.html   # or just double-click the file
```

Risk scores currently come from a transparent local heuristic (`estimateRisk()` inside `frontend/index.html`), since the FastAPI backend (`api/main.py`) isn't built yet. Once it exists, swap that function for a `fetch('/predict')` call using the same input shape — the contract is documented in a comment right above the function.

---

## 🎯 Project Objectives

- Predict startup failure probability
- Identify key risk factors
- Forecast financial growth
- Provide actionable recommendations

---

## 🚀 Future Scope

- Real-time data integration
- Deep Learning models
- Investor recommendation engine
- Cloud deployment

