# Build the frontend, then run the backend (which serves the built frontend,
# the API and Socket.IO) as a non-root user.
FROM node:22-alpine AS builder

WORKDIR /app

# Public, build-time frontend settings (never put secrets here).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BACKEND_URL
ARG VITE_SUPPORT_EMAIL
ARG VITE_LEGAL_SELLER_NAME
ARG VITE_LEGAL_REGISTRY_CODE
ARG VITE_LEGAL_VAT_NUMBER
ARG VITE_LEGAL_ADDRESS
ARG RAILWAY_GIT_COMMIT_SHA
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY \
    VITE_BACKEND_URL=$VITE_BACKEND_URL \
    VITE_SUPPORT_EMAIL=$VITE_SUPPORT_EMAIL \
    VITE_LEGAL_SELLER_NAME=$VITE_LEGAL_SELLER_NAME \
    VITE_LEGAL_REGISTRY_CODE=$VITE_LEGAL_REGISTRY_CODE \
    VITE_LEGAL_VAT_NUMBER=$VITE_LEGAL_VAT_NUMBER \
    VITE_LEGAL_ADDRESS=$VITE_LEGAL_ADDRESS \
    VITE_RELEASE=$RAILWAY_GIT_COMMIT_SHA

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY frontend ./frontend
RUN cd frontend && npm run build

FROM node:22-alpine AS runner

ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/server.js ./
COPY backend/src ./src
COPY backend/db ./db
COPY backend/scripts ./scripts
COPY --from=builder /app/frontend/dist /app/frontend/dist

USER node
EXPOSE 5000
# Run node directly so SIGTERM reaches the app for graceful shutdown.
CMD ["node", "server.js"]
