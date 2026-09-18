# Startup Risk Intelligence AI

Startup Risk Intelligence AI is a research project for exploring startup failure risk using financial, operational, market, and business information.

The repository includes an exploratory notebook and a browser-based dashboard called **Startup Vitals Monitor**.

## Current Status

### Available

- Exploratory data-analysis notebook
- Local startup-risk dataset
- Saved model artifact for local experimentation
- Interactive browser dashboard
- Transparent heuristic risk estimate with charts

### Planned

- Reproducible model training and evaluation
- FastAPI prediction service
- Frontend connection to the trained model
- Model explainability and deployment support

## Dashboard

The dashboard provides:

- Startup information intake
- Risk score and risk category
- Input reliability indicator
- Factor contribution breakdown
- Risk profile radar chart
- Cash runway projection
- Dataset benchmark comparison
- Warnings for values outside observed ranges

![Startup Vitals Monitor preview](frontend/assets/vitals-monitor-preview.png)

### Run locally

Open [frontend/index.html](frontend/index.html) directly in a browser.

For a local development server, run this command from the repository root:

```bash
python -m http.server 8000 --directory frontend
```

Then visit <http://localhost:8000>.

The dashboard uses [frontend/script.js](frontend/script.js) for its local estimator and [frontend/style.css](frontend/style.css) for styling. The current estimator is not yet connected to a backend API.

## Data And Model

The project uses a local CSV dataset and a local model artifact for experimentation. These files may contain valuable project data and should not be committed, published, or copied into documentation without review.

The dataset contains fields related to:

- Startup age and founder information
- Industry and business model
- Employees and financial metrics
- Market size and marketing activity
- Product uniqueness and customer retention
- Startup status for supervised learning

The model artifact is not served through an API yet. Treat local model files as untrusted binary artifacts and do not load unknown files.

## Analysis

The main exploratory notebook is [notebooks/01_eda.ipynb](notebooks/01_eda.ipynb).

Use the notebook to inspect data quality, feature distributions, target labels, and class balance before training or evaluating a model.

## Repository Structure

```text
Startup-Risk-Intelligence-AI/
├── data/
│   └── raw/                  # Local data; do not publish without review
├── frontend/
│   ├── assets/
│   │   └── vitals-monitor-preview.png
│   ├── index.html
│   ├── script.js
│   └── style.css
├── models/                   # Local model artifacts; do not publish without review
├── notebooks/
│   └── 01_eda.ipynb
└── README.md
```

## Technology

- Python and Jupyter Notebook
- Pandas, NumPy, and scikit-learn
- HTML, CSS, and JavaScript
- Chart.js for dashboard visualizations

## Recommended Development Order

1. Verify the dataset schema, labels, and class balance.
2. Create a reproducible preprocessing and training pipeline.
3. Evaluate the model on held-out data.
4. Add input validation and a FastAPI `/predict` endpoint.
5. Connect the dashboard to the API.
6. Add tests, explainability, and deployment configuration.

## Security Notes

- Do not commit raw datasets, model binaries, credentials, tokens, or `.env` files.
- Review `git status` and `git diff` before every commit.
- Keep sensitive data outside public repositories.
- Do not claim model accuracy until evaluation has been completed on held-out data.
