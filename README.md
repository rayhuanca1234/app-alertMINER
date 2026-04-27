# 🚨 MinerAlert — Alerta Comunitaria para Mineros

PWA de seguridad comunitaria en tiempo real para mineros. Permite enviar alertas geolocalizadas, chat grupal y visualización en mapa.

## 🏗️ Arquitectura

```
mineralert/
├── frontend/     → Vite + React + Leaflet + Supabase (PWA)
├── backend/      → Fastify + Socket.IO (notificaciones push)
└── supabase/     → Migrations y SQL
```

**Infraestructura:**
- **Auth + DB + Realtime:** Supabase
- **Frontend:** Google Cloud Run (Docker + nginx)
- **Backend:** Google Cloud Run (Docker + Node.js)

## 🚀 Deployment en Google Cloud Run

Ver [`DEPLOY.md`](./DEPLOY.md) para instrucciones completas.

## 🛠️ Desarrollo local

### Frontend
```bash
cd frontend
cp .env.example .env   # Completar con tus credenciales de Supabase
npm install
npm run dev
```

### Backend
```bash
cd backend
cp .env.example .env   # Completar con tus credenciales
npm install
npm run dev
```

## 🔑 Variables de entorno

### Frontend (`frontend/.env`)
| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave pública anon de Supabase |
| `VITE_BACKEND_URL` | URL del backend (localhost o Cloud Run) |

### Backend (`backend/.env`)
| Variable | Descripción |
|---|---|
| `PORT` | Puerto del servidor (default: 3001) |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secreta) |
| `FRONTEND_URL` | URL del frontend (para CORS) |
