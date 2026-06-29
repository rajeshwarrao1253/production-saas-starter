/**
 * Dockerfile — Web Frontend
 *
 * Multi-stage build:
 * 1. Dependencies — install npm packages
 * 2. Build — compile React + Vite
 * 3. Production — serve with Nginx
 */

# ──────────────────────────────────────────────
# Stage 1: Dependencies
# ──────────────────────────────────────────────
FROM node:20-alpine AS dependencies
WORKDIR /app

COPY package.json ./
RUN npm install --production=false

# ──────────────────────────────────────────────
# Stage 2: Build
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json

# Copy source files
COPY index.html ./
COPY vite.config.ts ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY tailwind.config.js ./
COPY postcss.config.js ./
COPY src ./src
COPY public ./public

# Build the app
RUN npm run build

# ──────────────────────────────────────────────
# Stage 3: Production (Nginx)
# ──────────────────────────────────────────────
FROM nginx:alpine AS production

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx config for SPA routing
RUN echo 'server { \
    listen 80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    gzip on; \
    gzip_types text/plain text/css application/javascript application/json; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /assets/ { \
        expires 1y; \
        add_header Cache-Control "public, immutable"; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ──────────────────────────────────────────────
# Stage 4: Development
# ──────────────────────────────────────────────
FROM dependencies AS development
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 5173
CMD ["npm", "run", "dev"]
