# Next Steps on New Computer

After Google Drive syncs, open the project from:

**`G:\My Drive\block70project`**  
(or wherever you chose — e.g. if Google Drive is under a different letter, use that path.)

## 1. Open the project

- In Cursor/VS Code: **File → Open Folder** → select `block70project`.
- Or from terminal: `cd "G:\My Drive\block70project"`.

## 2. Install dependencies

**Backend (API)**  
```powershell
cd apps\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

**Frontend (Web)**  
```powershell
cd apps\web
npm install
```

(If `apps\api` has no `requirements.txt`, use whatever you use for Python deps, e.g. `pip install -e .` or the repo’s install instructions.)

## 3. Environment variables

- Copy `.env.example` to `.env` in the API and/or web app if you use env files.
- Set at least:
  - `NEXT_PUBLIC_API_BASE_URL` (e.g. `http://localhost:8000`) for the web app.
  - Any DB URL, API keys, etc., the API needs.

## 4. Database (if applicable)

- If the API uses a local DB, create it and run migrations (e.g. Alembic or `create_all`) on the new machine.
- Or point `.env` to a shared/cloud DB you already use.

## 5. Run the app

**Terminal 1 – API**  
```powershell
cd "G:\My Drive\block70project\apps\api"
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

**Terminal 2 – Web**  
```powershell
cd "G:\My Drive\block70project\apps\web"
npm run dev
```

Then open the URL shown (e.g. http://localhost:3000).

## 6. Optional: exclude heavy folders from sync

To speed up Google Drive sync, you can exclude:

- `apps\web\node_modules`
- `apps\api\.venv` (or `venv`)
- `__pycache__` folders

After pulling on the new computer, run `npm install` and create a new venv + `pip install` as in step 2 so those folders are recreated locally.

---

**Summary:** Open project from Drive → install backend + frontend deps → set env → run API + web dev servers.
