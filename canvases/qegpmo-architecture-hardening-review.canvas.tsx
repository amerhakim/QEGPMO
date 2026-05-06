import { Callout, Divider, Grid, H1, H2, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoArchitectureHardeningReviewCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Architecture Review and Hardening</H1>
      <Text>
        Final pre-production guidance for enterprise operation at high scale, covering performance, security, scaling, and deployment readiness across platform, workflow, roll-up, dashboards, AI, and Excel/MS Project integration.
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Target concurrency" value="Thousands of users" />
        <Stat label="Portfolio scale" value="1K+ projects per tenant" />
        <Stat label="Hardening posture" value="Defense in depth" tone="success" />
        <Stat label="Deployment baseline" value="Multi-AZ HA + DR" tone="success" />
      </Grid>

      <Callout tone="warning" title="Evidence note">
        Current workspace contains architecture canvases and BRD documents but no executable backend/frontend code repository. Recommendations are therefore architecture-level and should be validated against implementation before go-live.
      </Callout>

      <Divider />
      <H2>1) Performance Optimizations</H2>
      <Table
        headers={["Area", "Priority optimizations", "Expected outcome"]}
        rows={[
          [
            "Backend API",
            "Use API gateway + stateless service pods, enforce request budgets, add Redis for hot reference data and permission cache, adopt cursor pagination everywhere, and idempotency keys for writes.",
            "Stable p95 latency under burst load and safe retries without duplicate mutations.",
          ],
          [
            "Roll-up and aggregation",
            "Move from on-demand deep recompute to incremental roll-up snapshots using event-driven updates plus scheduled reconciliation jobs.",
            "Predictable dashboard reads and no large synchronous compute spikes.",
          ],
          [
            "Dashboard responsiveness",
            "Precompute executive KPI tiles and trend series per reporting cut-off, serve from read-optimized store/materialized views, and use async widget loading.",
            "Fast first paint and smooth drill-down for large portfolios.",
          ],
          [
            "Workflow and approvals",
            "Persist workflow state transitions in append-only events, use queue-backed SLA evaluators, and isolate step decision writes from notification side effects.",
            "Low decision latency and resilient SLA/escalation processing.",
          ],
          [
            "AI processing",
            "Use async inference queue, model routing by complexity tier, response caching for repeated prompts, and retrieval pre-filtering by tenant/project scope.",
            "Lower AI cost and controlled response time under concurrent demand.",
          ],
        ]}
      />

      <Table
        headers={["Performance SLO", "Target", "Enforcement"]}
        rows={[
          ["API read p95", "< 300 ms for standard queries", "Per-endpoint latency SLO and autoscale trigger"],
          ["API write p95", "< 500 ms for non-bulk mutations", "Queue offload for post-commit work"],
          ["Executive dashboard load", "< 2 seconds initial load", "Pre-aggregated read model + CDN for static assets"],
          ["Roll-up completion", "< 15 minutes after period cut-off", "Distributed workers + checkpointed batches"],
          ["AI assisted action", "< 5 seconds for standard prompts", "Async fallback and token budget guardrails"],
        ]}
      />

      <Divider />
      <H2>2) Security Hardening</H2>
      <Table
        headers={["Control domain", "Hardening controls", "Enterprise rationale"]}
        rows={[
          [
            "Authentication",
            "Federate with enterprise IdP (OIDC/SAML), enforce MFA, short-lived access tokens, refresh token rotation, device/session risk controls.",
            "Align with enterprise IAM and reduce account takeover risk.",
          ],
          [
            "Authorization and RBAC",
            "Deny-by-default route guards, centralized permission catalog, scope-aware role assignment (tenant/portfolio/program/project), and policy simulation before publish.",
            "Prevents privilege creep and inconsistent enforcement.",
          ],
          [
            "Tenant data isolation",
            "Mandatory tenant context propagation, DB row-level security or enforced tenant predicates, tenant-aware cache keys, and cross-tenant query detectors.",
            "Prevents data bleed in shared infrastructure.",
          ],
          [
            "Audit and compliance",
            "Immutable append-only audit events with hash-chain integrity checks, tamper alerts, evidence retention policy, and exportable compliance reports.",
            "Supports internal audit and regulated evidence requirements.",
          ],
          [
            "Data protection",
            "Encryption in transit and at rest, KMS-backed key rotation, field-level protection for sensitive columns, and secure secrets manager integration.",
            "Protects confidentiality and meets baseline controls.",
          ],
        ]}
      />

      <Table
        headers={["Security operations", "Minimum implementation"]}
        rows={[
          ["Threat detection", "SIEM integration with correlation_id, tenant_id, actor_id context for every auth and privileged event"],
          ["Vulnerability management", "SAST, dependency scanning, container image scanning, and monthly patch SLA with emergency patch path"],
          ["Privileged access", "Break-glass accounts with just-in-time approval and full session recording"],
          ["Data governance", "PII classification tags and policy-based masking for exports and logs"],
          ["Compliance readiness", "Control matrix mapped to ISO 27001/SOC 2/NIST baseline and tested quarterly"],
        ]}
      />

      <Divider />
      <H2>3) Scaling Strategy</H2>
      <Table
        headers={["Layer", "Horizontal scale strategy", "Vertical scale strategy"]}
        rows={[
          [
            "API and workflow services",
            "Containerized stateless pods with HPA on CPU, memory, and request queue depth.",
            "Increase compute class for specialized heavy endpoints only.",
          ],
          [
            "Background jobs and scheduler",
            "Queue partitioning by job type and tenant band, worker pools per queue, and dead-letter reprocessing workflows.",
            "Scale worker memory/CPU for heavy import and roll-up jobs.",
          ],
          [
            "Database",
            "Read replicas for analytics/dashboard reads, partition large audit and snapshot tables by tenant/time, and connection pooling.",
            "Scale primary storage IOPS and memory based on write throughput.",
          ],
          [
            "Caching and read models",
            "Distributed cache cluster for hot metadata and authorization facts; async cache rebuild pipelines.",
            "Increase node memory for hit-rate stabilization at large tenant count.",
          ],
          [
            "AI services",
            "Inference queue + autoscaled model workers + multi-model routing; isolate expensive workloads in separate pool.",
            "Use larger GPU/CPU tier only for high-complexity tasks.",
          ],
        ]}
      />

      <Callout tone="info" title="Database scaling guidance">
        Keep transactional writes on normalized OLTP schema; serve executive analytics from denormalized roll-up snapshots/materialized views. Avoid ad hoc cross-portfolio joins on live transactional tables during peak hours.
      </Callout>

      <Divider />
      <H2>4) Enterprise Deployment Architecture</H2>
      <Table
        headers={["Architecture domain", "Recommended production pattern", "Why"]}
        rows={[
          [
            "Runtime topology",
            "Multi-AZ Kubernetes or equivalent orchestrator with API gateway, service mesh, and isolated worker node pools.",
            "High availability, controlled traffic, and safer zero-downtime upgrades.",
          ],
          [
            "Environment strategy",
            "Strict separation for dev, test, pre-prod, and prod with separate identities, secrets, data stores, and network boundaries.",
            "Prevents lateral risk and supports audit traceability.",
          ],
          [
            "High availability",
            "Active-active app tier across AZs, managed DB with automatic failover, and redundant cache/queue clusters.",
            "Sustains platform operation through zone-level failures.",
          ],
          [
            "Disaster recovery",
            "Cross-region backups + warm standby stack with tested runbooks; target RPO <= 15 min and RTO <= 60 min.",
            "Ensures continuity for enterprise portfolio operations.",
          ],
          [
            "Observability",
            "OpenTelemetry traces, centralized logs, SLO dashboards, synthetic checks, and alerting on user-impact metrics.",
            "Speeds root-cause analysis and protects SLAs.",
          ],
        ]}
      />

      <Table
        headers={["Go-live gate", "Hard requirement"]}
        rows={[
          ["Load and resilience", "Pass 2x expected peak load with soak test and chaos failover drills"],
          ["Security", "Pen test closed or risk accepted by governance board"],
          ["Data controls", "Tenant isolation tests pass for API, cache, exports, and background jobs"],
          ["Operational readiness", "Runbooks, on-call, alert routing, and rollback playbooks validated"],
          ["Compliance evidence", "Audit, retention, and access review reports generated end-to-end"],
        ]}
      />
    </Stack>
  );
}
