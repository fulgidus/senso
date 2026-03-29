## Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

# Copy lockfile first for a best-effort cache hit on pnpm install
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY . .

RUN pnpm build

# Stamp version info computed at build time — no external args needed.
# src_hash = SHA-256 of all source files, detects stale layer cache.
RUN sh -c '\
  BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && \
  SRC_HASH=$(find src -type f | sort | xargs cat | sha256sum | cut -c1-12) && \
  BUNDLE=$(basename /app/dist/assets/index-*.js) && \
  printf "{\"src_hash\":\"%s\",\"bundle\":\"%s\",\"built_at\":\"%s\"}\n" \
    "$SRC_HASH" "$BUNDLE" "$BUILT_AT" > /app/dist/version.json'

## Stage 2: serve with nginx
FROM nginx:1.27-alpine

WORKDIR /app

RUN apk add --no-cache nodejs npm && npm install -g pnpm@10.32.0

COPY --from=builder /app /app

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes return index.html; /version.json served directly
RUN printf 'server {\n\
    listen 3001;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location = /version.json {\n\
        add_header Cache-Control "no-cache, no-store, must-revalidate";\n\
        add_header Content-Type application/json;\n\
    }\n\
    location /health {\n\
        access_log off;\n\
        return 200 "ok";\n\
        add_header Content-Type text/plain;\n\
    }\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 3001

CMD ["nginx", "-g", "daemon off;"]
