# Production SaaS Starter

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Redis-DC382D?logo=redis&logoColor=white" alt="Redis" />
  <img src="https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <img src="https://img.shields.io/badge/Stripe-635BFF?logo=stripe&logoColor=white" alt="Stripe" />
  <img src="https://img.shields.io/badge/AWS-232F3E?logo=amazon-aws&logoColor=white" alt="AWS" />
</p>

<p align="center">
  A production-ready SaaS boilerplate featuring multi-tenancy, role-based access control, Stripe billing, and team collaboration — built for engineers who ship fast and scale faster.
</p>

---

## Architecture Overview

```
+------------------------------------------------------------------+
|                        Monorepo                                   |
|                   (pnpm workspaces)                               |
+-----------------------+------------------------------------------+
|     apps/web           |            apps/api                      |
|   React 19 + Vite      |    Node.js + Express + TypeScript        |
|   Tailwind CSS         |    Prisma ORM                          |
|   shadcn/ui            |    PostgreSQL + Redis                  |
|   React Query          |    Stripe SDK                          |
|   React Router         |    JWT Auth + RBAC                     |
+-----------------------+------------------------------------------+
          |                            |
          +------------+---------------+
                       |
        +--------------+--------------+---------------+
        v              v              v               v
   PostgreSQL      Redis        Stripe          AWS S3
   (Multi-tenancy)  (Cache)     (Billing)       (Files)
```

## Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Multi-Tenancy** | Row-level isolation with automatic tenant resolution via subdomain or header | Ready |
| **RBAC** | Role-based access control with granular permissions | Ready |
| **Authentication** | OAuth2 (Google, GitHub) + email/password with JWT refresh tokens | Ready |
| **Stripe Billing** | Subscription management, usage-based billing, invoice history | Ready |
| **Team Collaboration** | Invite members, assign roles, organization-based resource isolation | Ready |
| **Admin Dashboard** | System metrics, user management, audit logs | Ready |
| **API Keys** | Programmatic access with scoped permissions | Ready |
| **Webhooks** | Extensible webhook system with Stripe and custom events | Ready |
| **Email Notifications** | Transactional emails with templates (SendGrid/Mailgun/SES) | Ready |
| **File Uploads** | Secure file storage with S3 integration and signed URLs | Ready |
| **Full-Text Search** | PostgreSQL-powered search across tenant data | Ready |

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 19 + TypeScript | UI framework |
| Styling | Tailwind CSS + shadcn/ui | Utility-first CSS, accessible components |
| State | React Query (TanStack Query) | Server state management |
| Routing | React Router v7 | Client-side routing |
| Backend | Node.js + Express | API server |
| ORM | Prisma | Type-safe database access |
| Database | PostgreSQL 16 | Primary data store |
| Cache | Redis | Session cache, rate limiting |
| Payments | Stripe | Subscription billing |
| Auth | JWT + OAuth2 | Authentication & authorization |
| Email | Nodemailer + SendGrid | Transactional emails |
| Storage | AWS S3 | File uploads |
| DevOps | Docker + Docker Compose | Local development |

## Getting Started

### Prerequisites

- **Docker** & **Docker Compose**
- **Node.js 20+**
- **pnpm** (or npm/yarn)

### Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/rajeshwarrao1253/production-saas-starter.git
cd production-saas-starter

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp apps/api/.env.example apps/api/.env
# Edit .env with your Stripe keys, OAuth credentials, etc.

# 4. Start all services
docker-compose up -d

# 5. Run database migrations
pnpm --filter api prisma migrate dev

# 6. Seed initial data
pnpm --filter api prisma db seed

# 7. Start development servers
pnpm dev
```

All services will be available:

| Service | URL | Description |
|---------|-----|-------------|
| Web App | http://localhost:5173 | React frontend |
| API | http://localhost:4000 | Express API |
| PostgreSQL | localhost:5432 | Database |
| Redis | localhost:6379 | Cache |
| MailHog | http://localhost:8025 | Email testing |

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://saas_user:saas_pass@localhost:5432/saas_db
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=another-super-secret-key
OAUTH_GOOGLE_CLIENT_ID=
OAUTH_GOOGLE_CLIENT_SECRET=
OAUTH_GITHUB_CLIENT_ID=
OAUTH_GITHUB_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_TEAM=price_...

# Email
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@example.com

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=

# App
API_PORT=4000
FRONTEND_URL=http://localhost:5173
NODE_ENV=development
```

## Project Structure

```
production-saas-starter/
├── apps/
│   ├── web/                       # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── layout/       # DashboardLayout, Sidebar, Topbar
│   │   │   │   └── ui/           # shadcn/ui components
│   │   │   ├── pages/
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   ├── Billing.tsx
│   │   │   │   ├── Team.tsx
│   │   │   │   └── Settings.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts    # Authentication state
│   │   │   │   └── useTenant.ts  # Multi-tenancy context
│   │   │   ├── lib/
│   │   │   │   ├── api.ts        # HTTP client with interceptors
│   │   │   │   └── utils.ts
│   │   │   └── main.tsx          # Entry point
│   │   ├── public/
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.js
│   │   └── tsconfig.json
│   └── api/                       # Express backend
│       ├── src/
│       │   ├── config/
│       │   │   └── env.ts         # Environment validation (zod)
│       │   ├── middleware/
│       │   │   ├── auth.ts        # JWT verification
│       │   │   ├── tenant.ts      # Tenant resolution
│       │   │   ├── rbac.ts        # Permission checking
│       │   │   └── error-handler.ts
│       │   ├── routes/
│       │   │   ├── auth.ts        # Auth endpoints
│       │   │   ├── billing.ts     # Stripe integration
│       │   │   ├── team.ts        # Member management
│       │   │   └── api-keys.ts    # API key management
│       │   ├── services/
│       │   │   ├── stripe.ts      # Stripe customer/subscription logic
│       │   │   └── email.ts       # Email templates & sending
│       │   ├── types/
│       │   ├── utils/
│       │   └── index.ts           # Server entry
│       ├── prisma/
│       │   └── schema.prisma      # Database schema
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── docs/
│   ├── MULTI_TENANCY.md           # Multi-tenancy architecture
│   ├── BILLING.md                 # Stripe integration guide
│   └── DEPLOYMENT.md              # Deployment guide
├── docker-compose.yml
├── package.json                   # Workspace root
└── README.md
```

## Documentation

- **[Multi-Tenancy Architecture](docs/MULTI_TENANCY.md)** — Row-level isolation, tenant resolution strategies, data segregation
- **[Billing Integration](docs/BILLING.md)** — Stripe setup, subscription lifecycle, webhook handling
- **[Deployment Guide](docs/DEPLOYMENT.md)** — Docker, Kubernetes, CI/CD, SSL, monitoring

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on code style, testing, and pull request procedures.

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  Built by <a href="https://github.com/rajeshwarrao1253">rajeshwarrao1253</a>
</p>
