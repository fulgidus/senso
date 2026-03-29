## Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

# Copy lockfile first for a best-effort cache hit on pnpm install
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# CACHEBUST invalidates all layers below when set to a new value (e.g. git SHA).
# VITE_BACKEND_URL must also be declared before COPY to bust cache on value change.
ARG CACHEBUST=1
ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

COPY . .

RUN pnpm build

## Stage 2: serve with nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes return index.html
RUN printf 'server {\n\
    listen 3001;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
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
