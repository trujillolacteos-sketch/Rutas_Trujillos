FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/public ./public
COPY --from=builder /app/data_store.json ./data_store.json
COPY --from=builder /app/data_store.backup.json ./data_store.backup.json
COPY --from=builder /app/backup_live_state.json ./backup_live_state.json
COPY --from=builder /app/firebase-applet-config.json ./firebase-applet-config.json

EXPOSE 8080

CMD ["node", "dist/server.cjs"]
