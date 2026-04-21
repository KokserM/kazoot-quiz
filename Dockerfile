FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
COPY backend/package*.json ./backend/
COPY package*.json ./

RUN cd frontend && npm ci
RUN cd backend && npm ci
RUN npm ci

COPY . .

RUN cd frontend && npm run build

FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY --from=builder /app/backend ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

EXPOSE 5000

WORKDIR /app/backend
CMD ["node", "server.js"]