# ============================================================
# MinerAlert — Dockerfile ÚNICO (Frontend + Backend juntos)
# ============================================================
# Stage 1: Compilar el frontend (Vite/React)
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./

# Variables de Supabase — valores por defecto para que el build no falle
ARG VITE_SUPABASE_URL=https://xveiqaryuqjpodzdwjsw.supabase.co
ARG VITE_SUPABASE_ANON_KEY=sb_publishable_LErTul8Nqcf05YhoP-e-Hw_EBtHrwOR
# PEGA AQUÍ TU LLAVE PÚBLICA (es seguro porque es pública):
ARG VITE_VAPID_PUBLIC_KEY=BEgHCjGYvKVFYHA9tCHbc2HPKRVsW5E9mYazSQlVmGSP62XDpP0Pw6ZZK2bwODKEamy6kh1z94dLiYpOZNtCglE

ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY

# Backend en el mismo servidor — URL vacía usa path relativo
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

