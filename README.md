# ProofFlow

Production-ready **React + FastAPI + MongoDB** system for managing albums, bulk image uploads, and secure client galleries.

## Repository structure

```
/
  backend/
    app/
      core/              # env/config
      routes/            # API route modules
      services/          # image storage + thumbnails
      utils/             # security + ids helpers
      main.py            # FastAPI app (API + SPA serving)
    requirements.txt
  frontend/
    src/
      app/               # routes
      lib/               # API client, upload, media URL helpers
      pages/             # Admin + Share screens
      styles/            # design tokens + UI rhythm
      ui/                # small design system primitives
    package.json
  Dockerfile             # builds frontend + backend into one image
  docker-compose.yml     # Mongo + app + volumes
  .env.example
```

## Quick start (Docker-first)

1. Create env file:

```bash
cp .env.example .env
```

2. Edit `.env` and set **strong** values for:

- `ADMIN_TOKEN` (Admin API + Admin media access)
- `JWT_SECRET` (share-session JWT signing)

3. Start the stack:

```bash
docker compose up --build
```

4. Open:

- **Admin UI**: `http://localhost:8000/admin`
- **Health**: `http://localhost:8000/healthz`

## How it works

### Image quality / “no pixelation by design”

- **Uploads store originals** unmodified on disk (persistent Docker volume).
- A **512px JPEG thumbnail** is generated server-side for fast grids.
- The Client Gallery uses:
  - thumbnails **only** for the grid
  - originals for the viewer (“Open full” + modal view), preventing pixelation.

### Album + subfolder model (no “Root”)

- **Albums** are top-level.
- **Subfolders** belong to albums.
- “**All**” is a *view scope* that aggregates all subfolders in an album (not a stored “root folder”).

### Secure client links (manual password + share sessions)

- Admin generates a share link and enters a **manual password**.
- Passwords are stored as **bcrypt hashes**.
- Client enters password once to receive a **short-lived JWT** session token.
- Media endpoints validate access with a token via query param (`t=...`) so image tags work reliably.

### Absolute URL generation

- Share links are generated from `PUBLIC_BASE_URL` to avoid mixed/relative URLs when sending to clients.

## UI/UX decisions (Cursor/Linear-like feel)

- **Small design system** built with CSS variables (color tokens, spacing rhythm, radius).
- **Calm hierarchy**: flat panels, restrained contrast, consistent typography.
- **Stable interactions**: subtle transitions, no layout jumps, predictable navigation.
- **Focus states**: soft ring (no harsh borders) and accessible keyboard interaction.

## Local development (optional)

- Frontend (Vite):

```bash
cd frontend && npm install && npm run dev
```

- Backend (FastAPI):

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt
export ADMIN_TOKEN=dev JWT_SECRET=dev PUBLIC_BASE_URL=http://localhost:8000
uvicorn backend.app.main:app --reload --port 8000
```

When running Vite separately, you can set `CORS_ORIGINS` in `.env` if you need cross-origin API calls.
