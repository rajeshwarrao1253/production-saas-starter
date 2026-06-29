/**
 * Dockerfile — API Server
 *
 * Multi-stage build for optimized production image:
 * 1. Dependencies — install npm packages
 * 2. Builder — compile TypeScript
 * 3. Production — minimal runtime image
 */

# ──────────────────────────────────────────────
# Stage 1: Dependencies
# ──────────────────────────────────────────────
FROM node:20-alpine AS dependencies
WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install --production=false

# ──────────────────────────────────────────────
# Stage 2: Builder
# ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from stage 1
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/package.json ./package.json

# Copy source and Prisma schema
COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma client and build
RUN npx prisma generate
RUN npm run build

# ──────────────────────────────────────────────
# Stage 3: Production
# ──────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package.json ./
RUN npm install --production && npm cache clean --force

# Copy compiled output and Prisma schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma

# Run migrations and start
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

# ──────────────────────────────────────────────
# Stage 4: Development (target for docker-compose)
# ──────────────────────────────────────────────
FROM builder AS development
WORKDIR /app
ENV NODE_ENV=development
EXPOSE 4000
CMD ["npm", "run", "dev"]
