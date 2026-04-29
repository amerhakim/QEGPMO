import { Callout, Divider, Grid, H1, H2, H3, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoCorePlatformFoundationCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Core Platform Foundation (NestJS)</H1>
      <Text>
        Enterprise-scale backend foundation for multi-tenant operation, user management, RBAC with permission enforcement on every API, and immutable global audit logging.
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Architecture style" value="Modular monolith ready for microservices" />
        <Stat label="Tenant model" value="Shared DB, tenant-partitioned rows" />
        <Stat label="API RBAC coverage" value="100%" tone="success" />
        <Stat label="Audit mutability" value="Immutable append-only" tone="success" />
      </Grid>

      <Callout tone="info" title="Core platform guarantees">
        Every request carries tenant context and actor identity, every API endpoint enforces permission checks, and every data mutation writes immutable before/after audit evidence.
      </Callout>

      <Divider />
      <H2>1) Multi-tenant Architecture</H2>
      <Table
        headers={["Area", "Design decision", "Enterprise rationale"]}
        rows={[
          [
            "Tenancy model",
            "Single application cluster, shared database, strict tenant_id partition on all business tables",
            "High scale and lower operational overhead while preserving hard data isolation rules.",
          ],
          [
            "Tenant resolution",
            "Resolve tenant from signed token claim + validated header/domain mapping",
            "Prevents tenant spoofing and supports SSO/multi-domain organizations.",
          ],
          [
            "Request context",
            "Per-request context object: tenant_id, user_id, roles, permissions, correlation_id",
            "Unified context for authz, auditing, logging, and tracing.",
          ],
          [
            "Data access guardrail",
            "Global repository policy auto-injects tenant_id filter on all queries",
            "Eliminates accidental cross-tenant reads and writes.",
          ],
          [
            "Optional premium isolation",
            "Tenant tier can map to dedicated schema/database if contracted",
            "Supports regulated clients without redesigning core services.",
          ],
        ]}
      />

      <H3>Tenant Edge Controls</H3>
      <Table
        headers={["Control", "Rule"]}
        rows={[
          ["Cross-tenant reference block", "Foreign keys must resolve within same tenant unless entity marked global."],
          ["Global master data", "Global tables (for example country codes) are read-only and versioned."],
          ["Tenant lifecycle", "Suspend tenant disables auth and write APIs while preserving audit access."],
          ["Data residency policy", "Tenant metadata carries region policy for storage and backups."],
        ]}
      />

      <Divider />
      <H2>2) Entity Definitions (Core Foundation)</H2>
      <Table
        headers={["Entity", "Key fields", "Purpose"]}
        rows={[
          [
            "Tenant",
            "tenant_id, code, name, status, region, plan_tier, created_at",
            "Isolation boundary and policy container for all modules.",
          ],
          [
            "UserAccount",
            "user_id, tenant_id, username, email, display_name, auth_provider, status, last_login_at",
            "Application identity within a tenant.",
          ],
          [
            "UserProfile",
            "user_profile_id, user_id, locale, timezone, job_title, manager_user_id",
            "Non-auth attributes used by workflow and notifications.",
          ],
          [
            "RoleDefinition",
            "role_id, tenant_id, role_code, role_name, scope_type, is_system",
            "RBAC role model with tenant-scoped definitions.",
          ],
          [
            "PermissionDefinition",
            "permission_id, module, resource, action, permission_key",
            "Atomic permission catalog (for example project.read, risk.update).",
          ],
          [
            "RolePermission",
            "role_permission_id, role_id, permission_id, grant_type",
            "Role to permission mapping.",
          ],
          [
            "UserRoleAssignment",
            "assignment_id, user_id, role_id, scope_entity_type, scope_entity_id, start_at, end_at",
            "Assign roles globally or at bounded scope (portfolio, program, project).",
          ],
          [
            "PolicyRule",
            "policy_rule_id, tenant_id, rule_type, expression, effect, priority, active_flag",
            "Optional ABAC-style conditions layered over RBAC.",
          ],
          [
            "ApiClient",
            "api_client_id, tenant_id, client_name, key_id, secret_hash, status, rate_limit_tier",
            "Machine-to-machine identity and controls.",
          ],
          [
            "SessionToken",
            "session_id, tenant_id, user_id, token_hash, issued_at, expires_at, revoked_at",
            "Session lifecycle and revocation tracking.",
          ],
          [
            "AuditEvent",
            "audit_event_id, tenant_id, actor_id, entity_name, entity_id, operation, old_value_json, new_value_json, occurred_at, correlation_id, hash",
            "Immutable append-only compliance journal.",
          ],
          [
            "AuditChain",
            "audit_chain_id, previous_hash, current_hash, sequence_no, occurred_at",
            "Tamper-evident hash chain for audit integrity.",
          ],
        ]}
      />

      <Callout tone="success" title="Audit immutability rule">
        AuditEvent and AuditChain are append-only. No update and no delete APIs are exposed. Retention and archival are policy-driven, but records are never mutated.
      </Callout>

      <Divider />
      <H2>3) Services and Responsibilities</H2>
      <Table
        headers={["Service", "Primary responsibilities", "Key notes"]}
        rows={[
          [
            "TenantContextService",
            "Resolve and validate tenant context for each request",
            "Fails fast on missing or inconsistent tenant identity.",
          ],
          [
            "IdentityService",
            "User authentication, token issuance, token introspection, session revocation",
            "Supports SSO federation and API clients.",
          ],
          [
            "UserService",
            "User CRUD, profile updates, lifecycle states (active, locked, suspended)",
            "All actions tenant-bounded and audited.",
          ],
          [
            "RoleService",
            "Role creation, role versioning, role-permission mapping",
            "System roles immutable except by platform admin.",
          ],
          [
            "PermissionService",
            "Permission catalog management and lookup",
            "Permission keys are stable contracts used by guards.",
          ],
          [
            "AuthorizationService",
            "Evaluate whether actor has permission for action and scope",
            "RBAC first, policy rules second, deny by default.",
          ],
          [
            "AccessGuard",
            "NestJS global guard enforcing auth and permission metadata on every endpoint",
            "Request blocked before handler if authz fails.",
          ],
          [
            "AuditService",
            "Capture mutation events with before and after payloads and actor context",
            "Called by repository interceptor or domain event pipeline.",
          ],
          [
            "AuditIntegrityService",
            "Generate hash chain, verify chain continuity, provide tamper checks",
            "Supports regulatory audit evidence.",
          ],
          [
            "PolicyService",
            "Evaluate conditional access and governance constraints",
            "Used for context-aware controls beyond static roles.",
          ],
        ]}
      />

      <Divider />
      <H2>4) API Contracts (Foundation Layer)</H2>
      <Text>Contracts are platform APIs consumed by all business modules. Permission key shown per route.</Text>
      <Table
        headers={["API", "Method", "Purpose", "Required permission"]}
        rows={[
          ["/auth/login", "POST", "Authenticate user and issue token/session", "public endpoint with tenant validation"],
          ["/auth/refresh", "POST", "Refresh token/session", "authenticated"],
          ["/auth/logout", "POST", "Revoke session/token", "authenticated"],
          ["/tenants/{id}", "GET", "Read tenant metadata", "tenant.read"],
          ["/users", "GET", "List users in tenant", "user.read"],
          ["/users", "POST", "Create user", "user.create"],
          ["/users/{id}", "PATCH", "Update user/profile status", "user.update"],
          ["/roles", "GET", "List roles", "role.read"],
          ["/roles", "POST", "Create role", "role.create"],
          ["/roles/{id}", "PATCH", "Update role", "role.update"],
          ["/roles/{id}/permissions", "PUT", "Replace role permission set", "role.permission.manage"],
          ["/users/{id}/roles", "PUT", "Assign role with scope", "user.role.assign"],
          ["/permissions", "GET", "List permission catalog", "permission.read"],
          ["/audit/events", "GET", "Search audit events by entity/actor/date", "audit.read"],
          ["/audit/events/{id}", "GET", "Retrieve immutable audit event details", "audit.read"],
          ["/audit/integrity/verify", "POST", "Verify hash chain range", "audit.verify"],
        ]}
      />

      <H3>API Contract Standards</H3>
      <Table
        headers={["Standard", "Rule"]}
        rows={[
          ["Auth headers", "Every protected API requires bearer token and tenant context."],
          ["Permission metadata", "Each route must declare required permission key; no unannotated business route allowed."],
          ["Error model", "403 for denied authorization, 404 for out-of-scope entity, 409 for concurrency conflict."],
          ["Pagination", "Cursor pagination for list APIs to support large enterprise tenants."],
          ["Idempotency", "Mutation APIs accept idempotency key for safe retry."],
          ["Audit correlation", "Response includes correlation_id to trace request and audit records."],
        ]}
      />

      <Divider />
      <H2>5) Permission Enforcement Model</H2>
      <Table
        headers={["Step", "Enforcement logic", "Outcome"]}
        rows={[
          ["1. Authenticate", "Validate token and session status", "Actor identity established"],
          ["2. Resolve tenant", "Match actor tenant and request tenant context", "Tenant scope established"],
          ["3. Resolve permission", "Read route metadata permission key", "Expected capability established"],
          ["4. RBAC check", "Verify role grants permission for requested scope", "Allow or deny"],
          ["5. Policy check", "Evaluate optional conditional policy rules", "Allow or deny"],
          ["6. Data scope check", "Ensure requested entity belongs to actor scope and tenant", "Allow or deny"],
        ]}
      />

      <Callout tone="warning" title="Default deny posture">
        If any enforcement step cannot conclusively allow access, request is denied. Missing metadata, unknown permission, or unresolved scope never defaults to allow.
      </Callout>

      <Divider />
      <H2>6) Global Audit Logging Model</H2>
      <Table
        headers={["Audit field", "Description", "Mandatory"]}
        rows={[
          ["tenant_id", "Tenant owning the operation", "Yes"],
          ["actor_id and actor_type", "Human user or API client initiating change", "Yes"],
          ["operation", "create, update, delete, restore, permission_change", "Yes"],
          ["entity_name and entity_id", "Target business object", "Yes"],
          ["old_value_json", "Entity snapshot before mutation", "Yes for updates/deletes"],
          ["new_value_json", "Entity snapshot after mutation", "Yes for creates/updates"],
          ["occurred_at", "Server-side immutable timestamp", "Yes"],
          ["correlation_id", "Trace linkage across services", "Yes"],
          ["request_metadata", "ip, user_agent, api_version, source", "Yes"],
          ["event_hash and previous_hash", "Tamper-evident chain values", "Yes"],
        ]}
      />

      <Divider />
      <H2>7) Key Edge Cases and Required Behavior</H2>
      <Table
        headers={["Edge case", "Risk", "Required handling"]}
        rows={[
          [
            "User belongs to multiple scoped roles",
            "Ambiguous permission set",
            "Union grants, explicit deny policies override grants, full decision trace logged.",
          ],
          [
            "Role changes during active session",
            "Stale authorization",
            "Permission cache invalidated immediately and re-evaluated per request.",
          ],
          [
            "Tenant header mismatch with token tenant",
            "Cross-tenant data leak attempt",
            "Reject request with 403 and security audit event.",
          ],
          [
            "Soft-deleted entity update attempt",
            "Illegal mutation and audit inconsistency",
            "Reject with 409 unless restore permission exists.",
          ],
          [
            "Concurrent updates on same entity",
            "Lost updates",
            "Optimistic locking with version_no; on conflict return 409 and no partial write.",
          ],
          [
            "Audit store unavailable",
            "Mutation without traceability",
            "Fail closed for regulated entities; optional queued fallback for low-risk entities by policy.",
          ],
          [
            "Permission key removed but route still uses it",
            "Unenforceable endpoint",
            "Startup contract validation fails deployment pipeline.",
          ],
          [
            "Bulk import or batch API mutation",
            "Large-volume audit explosion",
            "Write one job-level event plus row-level child events with shared correlation_id.",
          ],
          [
            "System integration account misuse",
            "Privilege escalation",
            "Use least-privilege machine roles, IP allow-list, and anomaly audit alerts.",
          ],
        ]}
      />

      <Divider />
      <H2>8) Enterprise Scale Readiness</H2>
      <Table
        headers={["Capability", "Design choice"]}
        rows={[
          ["Performance", "Permission caching with short TTL and event-driven invalidation."],
          ["Data volume", "Partition audit events by tenant and time period for query performance."],
          ["Reliability", "Outbox pattern for audit replication and analytics sinks."],
          ["Security", "Secrets managed externally, key rotation, and signed token best practices."],
          ["Observability", "Structured logs with correlation_id and tenant-aware metrics."],
          ["Extensibility", "Module contract standard so every new module inherits authz and audit interceptors."],
        ]}
      />

      <Callout tone="success" title="Foundation result">
        This core foundation gives QEGPMO a consistent enterprise backend contract: tenant-safe data access, mandatory per-API RBAC enforcement, immutable global auditability, and scalability for large multi-tenant workloads.
      </Callout>
    </Stack>
  );
}
