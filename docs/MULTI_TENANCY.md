# Multi-Tenancy Architecture

This document describes the multi-tenancy strategy used in Production SaaS Starter.

## Overview

We use **row-level isolation** (also known as the shared database, shared schema approach). All tenants share the same PostgreSQL database and schema, with each tenant-scoped row containing an `organizationId` column that acts as the tenant discriminator.

```
+--------------------------------------------------+
|               PostgreSQL Database                 |
|                                                  |
|  organizations (tenants)                         |
|    |                                             |
|    +-- members (users in tenant)                 |
|    +-- api_keys (keys scoped to tenant)          |
|    +-- audit_logs (events scoped to tenant)      |
|    +-- invitations (invites to tenant)           |
+--------------------------------------------------+
```

## Why Row-Level Isolation?

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| Row-level (this) | Simple, cost-effective, easy cross-tenant analytics | Data in same DB | Small to large SaaS |
| Schema per tenant | Better data isolation | Complex migrations | Multi-tenant with strict isolation |
| Database per tenant | Strongest isolation | High infrastructure cost | Enterprise with compliance |

## Tenant Resolution

The current tenant is resolved on every authenticated request using these strategies (in order):

### 1. X-Tenant-ID Header (Primary)

The frontend sets `X-Tenant-ID: <org-id>` on every API call via the Axios interceptor managed by `useTenant` hook.

```http
GET /billing/subscription
Authorization: Bearer <token>
X-Tenant-ID: org_abc123
```

### 2. Subdomain Resolution

For API calls without the header, the system extracts the subdomain:

```
acme.example.com    → looks up Organization where slug = "acme"
app.example.com     → no subdomain match, falls back
```

### 3. Default Organization

If no tenant is resolved, the API falls back to the user's first organization membership.

## Data Segregation

### Row-Level Filters

Every Prisma query **must** include the `organizationId` filter:

```typescript
// Correct — scoped to tenant
const members = await prisma.member.findMany({
  where: { organizationId: tenant.id },
});

// WRONG — unscoped query returns data from all tenants!
const members = await prisma.member.findMany();
```

### Middleware Enforcement

The `resolveTenant` middleware in `apps/api/src/middleware/tenant.ts`:

1. Extracts tenant from header/subdomain
2. Verifies the authenticated user is a member
3. Attaches `req.tenant` for downstream use
4. Validates subscription status for paid plans

## RBAC Integration

Tenant membership uses a role hierarchy:

```
OWNER  (level 3) — Full control, billing, member management
ADMIN  (level 2) — Settings, member management, read/write
MEMBER (level 1) — Read/write resources, view billing
VIEWER (level 0) — Read-only access
```

The RBAC middleware (`apps/api/src/middleware/rbac.ts`) enforces minimum role requirements:

```typescript
router.post("/invite", requireAdmin, inviteHandler);
router.delete("/members/:id", requireAdmin, removeHandler);
```

## Subscription Validation

Paid tenants must have an active subscription. The tenant middleware checks:

```typescript
if (tenant.plan !== "FREE" && !isSubscriptionActive) {
  return 403 SUBSCRIPTION_INACTIVE;
}
```

## Implementation Checklist

- [x] Organization model with unique slug
- [x] Member model with role enum
- [x] Tenant resolution middleware (header + subdomain)
- [x] RBAC middleware with role hierarchy
- [x] Subscription status validation
- [x] All queries scoped by `organizationId`
- [ ] Subdomain routing in production DNS
- [ ] Row-level security (RLS) policies as extra safety net
- [ ] Cross-tenant query detection in CI/CD

## Scaling Considerations

| Concern | Mitigation |
|---------|-----------|
| Single DB bottleneck | Use read replicas, connection pooling (PgBouncer) |
| Tenant data volume | Partition large tables by `organizationId` |
| Noisy neighbor | Resource quotas per tenant (rate limits) |
| Compliance | Encrypt sensitive tenant data at application layer |

## References

- [Prisma: Multi-tenancy Guide](https://www.prisma.io/docs/guides/performance-and-optimization/prisma-client-transactions)
- [PostgreSQL: Row-Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
