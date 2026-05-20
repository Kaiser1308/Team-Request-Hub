# Team Request Hub

Team Request Hub is a monorepo for the request management platform.

## Tech Stack

- Frontend: Next.js + TypeScript + Tailwind CSS + shadcn/ui
- Backend: FastAPI
- Database/Auth: Supabase PostgreSQL + Supabase Auth

## Project Structure

```text
team-request-hub/
├── apps/
│   ├── api/   # FastAPI backend
│   └── web/   # Next.js frontend
├── docs/      # Architecture, API, database, and permissions notes
```

## Running The Frontend

```bash
cd apps/web
npm install
npm run dev
```

## Running The Backend

```bash
cd apps/api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

## Environment Variables

Environment variables are stored in each app's `.env.example` file. Copy the relevant example file to a local `.env` file before running an app.
