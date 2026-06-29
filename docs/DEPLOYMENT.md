# Deployment Guide

This guide covers deploying the Production SaaS Starter to production environments.

## Table of Contents

1. [Docker Compose (Single Server)](#docker-compose)
2. [Kubernetes](#kubernetes)
3. [Environment Variables](#environment-variables)
4. [Database Migrations](#database-migrations)
5. [SSL / HTTPS](#ssl)
6. [Monitoring](#monitoring)

## Docker Compose (Single Server)

The simplest deployment option. Good for small to medium workloads.

### Server Requirements

- Ubuntu 22.04 LTS (or similar)
- Docker 24+ and Docker Compose 2+
- 2 CPU cores, 4GB RAM minimum

### Steps

```bash
# 1. Clone repository
git clone https://github.com/rajeshwarrao1253/production-saas-starter.git
cd production-saas-starter

# 2. Create production environment file
cat > apps/api/.env << 'EOF'
NODE_ENV=production
API_PORT=4000
DATABASE_URL=postgresql://saas_user:STRONG_PASSWORD@db:5432/saas_db
REDIS_URL=redis://redis:6379
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-long!!
JWT_REFRESH_SECRET=another-super-secret-key-min-32-chars!!
FRONTEND_URL=https://app.yourdomain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=SG.xxx
SMTP_FROM=noreply@yourdomain.com
EOF

# 3. Update docker-compose for production
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# 4. Run migrations
docker-compose exec api npx prisma migrate deploy

# 5. Verify
curl https://api.yourdomain.com/health
```

### Production Docker Compose Overrides

Create `docker-compose.prod.yml`:

```yaml
version: "3.8"

services:
  api:
    build:
      target: production
    restart: always
    environment:
      NODE_ENV: production
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  web:
    build:
      target: production
    restart: always
    deploy:
      resources:
        limits:
          cpus: "0.5"
          memory: 128M

  db:
    restart: always
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata_prod:/var/lib/postgresql/data
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 1G

  redis:
    restart: always
    command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          memory: 256M

volumes:
  pgdata_prod:
```

## Kubernetes

For high-availability deployments with auto-scaling.

### Architecture

```
                    [Ingress (nginx)]
                           |
          +----------------+----------------+
          |                                 |
    [Web Service]                    [API Service]
    (static files)              (Express + Prisma)
          |                                 |
          +----------------+----------------+
                           |
                    [PostgreSQL Cluster]
                    [Redis Cluster]
```

### Quick Deploy

```bash
# 1. Create namespace
kubectl create namespace saas

# 2. Apply secrets
kubectl -n saas create secret generic api-secrets \
  --from-literal=DATABASE_URL="postgresql://..." \
  --from-literal=JWT_SECRET="..." \
  --from-literal=STRIPE_SECRET_KEY="..."

# 3. Apply deployments
kubectl apply -f k8s/

# 4. Verify
kubectl -n saas get pods
kubectl -n saas get svc
```

### Key Kubernetes Manifests

| File | Purpose |
|------|---------|
| `k8s/namespace.yaml` | Namespace definition |
| `k8s/postgres.yaml` | PostgreSQL StatefulSet |
| `k8s/redis.yaml` | Redis Deployment |
| `k8s/api-deployment.yaml` | API server Deployment + HPA |
| `k8s/web-deployment.yaml` | Static file serving |
| `k8s/ingress.yaml` | Nginx Ingress with SSL |
| `k8s/monitoring.yaml` | Prometheus + Grafana |

## Environment Variables

### Required (All Environments)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `super-secret-key-here...` |
| `JWT_REFRESH_SECRET` | Refresh token secret (min 32 chars) | `another-secret-key...` |

### Required (Production)

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe live secret key `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint secret |
| `SMTP_HOST` | Email SMTP server |
| `SMTP_PASS` | SMTP password/API key |

### Security Checklist

- [ ] JWT secrets are at least 32 characters, cryptographically random
- [ ] Database password is strong and unique
- [ ] Stripe keys use live keys only in production
- [ ] All secrets stored in Kubernetes secrets or env file with 600 permissions
- [ ] `.env` files are in `.gitignore`

## Database Migrations

### Production Migration Strategy

Always use `prisma migrate deploy` (not `migrate dev`) in production:

```bash
# Before deployment — generate migration files
docker-compose exec api npx prisma migrate dev --name add_feature_flags

# During deployment — apply migrations
docker-compose exec api npx prisma migrate deploy
```

### Zero-Downtime Migrations

1. **Add new columns** as nullable first
2. **Deploy code** that writes to both old and new columns
3. **Backfill data** in batches
4. **Make column required** in a later migration
5. **Remove old column** after confirming stability

## SSL / HTTPS

### Option 1: Let's Encrypt + Certbot

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d api.yourdomain.com -d app.yourdomain.com

# Auto-renewal
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### Option 2: Cloudflare (Recommended)

Use Cloudflare as a reverse proxy for automatic SSL, DDoS protection, and CDN:

1. Point your domain's nameservers to Cloudflare
2. Set SSL/TLS mode to "Full (strict)"
3. Enable "Always Use HTTPS"

### Option 3: Kubernetes with cert-manager

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@yourdomain.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Monitoring

### Application Metrics

The API exposes a `/health` endpoint for health checks:

```bash
curl https://api.yourdomain.com/health
# {"status":"ok","timestamp":"2024-...","uptime":1234}
```

### Logging

Structured JSON logs in production. View with:

```bash
# Docker
docker-compose logs -f api

# Kubernetes
kubectl -n saas logs -f deployment/api
```

### Recommended Monitoring Stack

| Tool | Purpose |
|------|---------|
| Prometheus | Metrics collection |
| Grafana | Dashboards and alerts |
| Loki | Log aggregation |
| Uptime Kuma | External health checks |
| Sentry | Error tracking |

### Key Alerts

- API response time > 500ms (p95)
- Error rate > 1%
- Database connection pool exhaustion
- Disk usage > 80%
- SSL certificate expiry < 7 days

## CI/CD Pipeline

### GitHub Actions Example

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t saas-api ./apps/api
      - run: docker build -t saas-web ./apps/web
      # Push to registry and deploy
```

## Disaster Recovery

### Database Backups

```bash
# Automated daily backups
docker-compose exec db pg_dump -U saas_user saas_db > backup-$(date +%F).sql

# Restore from backup
docker-compose exec -T db psql -U saas_user saas_db < backup-2024-01-01.sql
```

### Recommended RPO/RTO

| Component | RPO | RTO |
|-----------|-----|-----|
| Database | 1 hour | 2 hours |
| API | N/A (stateless) | 5 minutes |
| Static files | N/A (rebuildable) | 10 minutes |
