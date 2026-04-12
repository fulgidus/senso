## Stage 1: build
FROM node:25.9-alpine3.23 AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.0 --activate
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
COPY . .
RUN pnpm build
RUN sh -c '\
  BUILT_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ") && \
  SRC_HASH=$(find src -type f | sort | xargs cat | sha256sum | cut -c1-12) && \
  BUNDLE=$(basename /app/dist/assets/index-*.js) && \
  printf "{\"src_hash\":\"%s\",\"bundle\":\"%s\",\"built_at\":\"%s\"}\n" \
    "$SRC_HASH" "$BUNDLE" "$BUILT_AT" > /app/dist/version.json'

## Stage 2: serve
FROM nginx:1.27-alpine AS runner
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
COPY --from=builder /app/dist /usr/share/nginx/html
CMD ["nginx", "-g", "daemon off;"]
