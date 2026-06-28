# Decision Persona Web App

Full-stack scaffold for the chess decision persona dashboard.

## Stack

- `frontend/`: React + Vite
- `backend/`: FastAPI
- `data source`: existing files in `C:\cc MISTAKES\analysis-output-decision-full`

## What it does

- serves the existing decision dataset over an API
- browses decisions with player and intent-family filters
- shows a chessboard for before / after chosen / after engine move
- saves manual intent overrides in `backend/data/intent_overrides.json`

## Run locally

### 1. Backend

```powershell
cd "C:\cc MISTAKES\persona-webapp\backend"
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Backend runs on `http://127.0.0.1:8000`.

### 2. Frontend

```powershell
cd "C:\cc MISTAKES\persona-webapp\frontend"
npm install
npm run dev
```

Frontend runs on `http://127.0.0.1:5173`.

## Production direction

- keep FastAPI as the analysis and data layer
- keep React as the review UI
- later add:
  - PGN upload
  - queued batch analysis
  - SQLite for saved runs
  - auth if multiple users need separate projects

## Current limitation

`POST /api/analyze` is a placeholder. It is ready for wiring into the existing Python analysis pipeline, but this scaffold currently serves the existing dataset first.

