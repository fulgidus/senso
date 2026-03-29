## Stage 1: build
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.32.0 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# VITE_BACKEND_URL must be set as a build ARG (Vite bakes env vars at build time)
ARG VITE_BACKEND_URL=http://localhost:8000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL

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
