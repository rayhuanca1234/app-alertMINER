# ============================================================
# MinerAlert — Dockerfile ÚNICO (Frontend + Backend 100% Cloudflare D1 + R2)
# ============================================================
# Stage 1: Compilar el frontend (Vite/React)
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --legacy-peer-deps

COPY frontend/ ./

ARG VITE_VAPID_PUBLIC_KEY=BEgHCjGYvKVFYHA9tCHbc2HPKRVsW5E9mYazSQlVmGSP62XDpP0Pw6ZZK2bwODKEamy6kh1z94dLiYpOZNtCglE
ENV VITE_VAPID_PUBLIC_KEY=$VITE_VAPID_PUBLIC_KEY
ENV VITE_BACKEND_URL=""

RUN npm run build

# ============================================================
# Stage 2: Backend Node.js (Cloudflare D1 + R2 + Google OAuth 2.0)
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

COPY backend/src/ ./src/
COPY --from=frontend-builder /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/server.js"]
