# ============================================================
# MinerAlert — Dockerfile ÚNICO (Frontend + Backend juntos)
# ============================================================
# Stage 1: Compilar el frontend (Vite/React)
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./

# Variables de Supabase — se inyectan en el build de Vite
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
# Backend está en el mismo servidor → usamos la URL del propio Cloud Run
ENV VITE_BACKEND_URL=""

RUN npm run build

# ============================================================
# Stage 2: Backend Node.js sirve el frontend compilado
# ============================================================
FROM node:20-alpine AS production

WORKDIR /app

# Instalar solo dependencias de producción del backend
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# Copiar código del backend
COPY backend/src/ ./src/

# Copiar el frontend compilado al backend (se sirve como estáticos)
COPY --from=frontend-builder /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/server.js"]

