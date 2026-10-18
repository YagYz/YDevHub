# 1. Aşama: Bağımlılıkların Kurulumu ve Derleme (Builder)
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
RUN mkdir -p /app/public
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# 2. Aşama: Hafif Üretim İmajı (Runner)
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DB_DIR="/app/data"
ENV DB_PATH="/app/data/ydevhub.db"

# SQLite veritabanı klasörü oluştur
RUN mkdir -p /app/data /app/public

# Standalone derleme çıktılarını kopyala
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
