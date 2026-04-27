# 🚀 Guía de Deployment — Google Cloud Run

## Pre-requisitos

1. Tener [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) instalado
2. Tener un proyecto en Google Cloud Platform (GCP)
3. Tener Docker instalado (solo para pruebas locales)

---

## Paso 1 — Configurar Google Cloud

```bash
# Autenticarse
gcloud auth login

# Seleccionar tu proyecto (reemplaza YOUR_PROJECT_ID)
gcloud config set project YOUR_PROJECT_ID

# Habilitar los servicios necesarios
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable artifactregistry.googleapis.com
```

---

## Paso 2 — Configurar Artifact Registry (donde van las imágenes Docker)

```bash
# Crear repositorio en Artifact Registry (solo una vez)
gcloud artifacts repositories create mineralert \
  --repository-format=docker \
  --location=us-central1 \
  --description="MinerAlert Docker images"

# Configurar Docker para usar GCP
gcloud auth configure-docker us-central1-docker.pkg.dev
```

---

## Paso 3 — Deploy del BACKEND

### 3a. Build y push de la imagen

```bash
cd backend

gcloud builds submit \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/mineralert/backend:latest \
  .
```

### 3b. Deploy en Cloud Run

```bash
gcloud run deploy mineralert-backend \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/mineralert/backend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars "SUPABASE_URL=https://xveiqaryuqjpodzdwjsw.supabase.co" \
  --set-env-vars "SUPABASE_SERVICE_ROLE_KEY=TU_SERVICE_ROLE_KEY_AQUI" \
  --set-env-vars "NODE_ENV=production"
```

> ⚠️ Después del deploy, Cloud Run te dará una URL tipo:
> `https://mineralert-backend-XXXX-uc.a.run.app`
> **Guarda esa URL** — la necesitas para el frontend.

### 3c. Actualizar CORS del backend

Una vez tengas la URL del frontend (paso 4), actualiza la variable:
```bash
gcloud run services update mineralert-backend \
  --region us-central1 \
  --set-env-vars "FRONTEND_URL=https://mineralert-frontend-XXXX-uc.a.run.app"
```

---

## Paso 4 — Deploy del FRONTEND

### 4a. Build y push con variables de entorno de Supabase

```bash
cd frontend

gcloud builds submit \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/mineralert/frontend:latest \
  --build-arg VITE_SUPABASE_URL=https://xveiqaryuqjpodzdwjsw.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=sb_publishable_LErTul8Nqcf05YhoP-e-Hw_EBtHrwOR \
  --build-arg VITE_BACKEND_URL=https://mineralert-backend-XXXX-uc.a.run.app \
  .
```

### 4b. Deploy en Cloud Run

```bash
gcloud run deploy mineralert-frontend \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/mineralert/frontend:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

---

## Paso 5 — Configurar Supabase para producción

En el dashboard de Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://mineralert-frontend-XXXX-uc.a.run.app`
- **Redirect URLs:** Agregar `https://mineralert-frontend-XXXX-uc.a.run.app/**`

---

## Paso 6 — Verificar deployment

```bash
# Ver servicios activos
gcloud run services list --region us-central1

# Ver logs del backend
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mineralert-backend" --limit 50

# Ver logs del frontend
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=mineralert-frontend" --limit 50
```

---

## 📋 Resumen de URLs

| Servicio | URL |
|---|---|
| Frontend | `https://mineralert-frontend-XXXX-uc.a.run.app` |
| Backend | `https://mineralert-backend-XXXX-uc.a.run.app` |
| Supabase | `https://xveiqaryuqjpodzdwjsw.supabase.co` |

---

## 🔄 Re-deployar tras cambios

```bash
# Solo frontend
cd frontend
gcloud builds submit --tag ... .
gcloud run deploy mineralert-frontend --image ... --region us-central1

# Solo backend
cd backend
gcloud builds submit --tag ... .
gcloud run deploy mineralert-backend --image ... --region us-central1
```
