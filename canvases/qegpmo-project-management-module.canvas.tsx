import { Callout, Divider, Grid, H1, H2, H3, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoProjectManagementModuleCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Project Management Module (NestJS Design)</H1>
      <Text>
        Enterprise-grade project module blueprint including Project CRUD, lifecycle phases and gates, deterministic status calculation, linkage to Programs and Portfolios, full audit logging, and Excel import and export readiness.
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Module scope" value="Project domain core" />
        <Stat label="Lifecycle support" value="Phases and gates" tone="success" />
        <Stat label="Auditability" value="Immutable full trail" tone="success" />
        <Stat label="Excel readiness" value="Import and Export" tone="success" />
      </Grid>

      <Callout tone="info" title="Design principle">
        Project module uses shared platform services for tenant context, RBAC, workflow approvals, audit logging, and Excel job handling. Business logic stays deterministic and policy-driven.
      </Callout>

      <Divider />
      <H2>1) Entity Definitions</H2>
      <Table
        headers={["Entity", "Key fields", "Purpose"]}
        rows={[
          [
            "Project",
            "project_id, tenant_id, project_code, name, description, project_type, priority, status, lifecycle_phase, program_id, portfolio_id, sponsor_id, manager_id, baseline_start, baseline_end, planned_budget, created_at, updated_at, version_no",
            "Primary project record for planning and governance.",
          ],
          [
            "ProjectLifecyclePhase",
            "phase_id, tenant_id, phase_code, phase_name, sequence_no, is_mandatory, entry_criteria_json, exit_criteria_json, active_flag",
            "Configurable lifecycle phase catalog.",
          ],
          [
            "ProjectPhaseInstance",
            "phase_instance_id, project_id, phase_id, status, started_at, completed_at, entered_by, exited_by",
            "Runtime phase progression per project.",
          ],
          [
            "ProjectGateDefinition",
            "gate_def_id, tenant_id, gate_code, gate_name, phase_id, required_artifacts_json, approval_workflow_code, active_flag",
            "Defines governance gates and required checks.",
          ],
          [
            "ProjectGateInstance",
            "gate_instance_id, project_id, gate_def_id, status, due_at, passed_at, failed_at, decision, decision_reason, workflow_instance_id",
            "Runtime gate outcome linked to workflow approvals.",
          ],
          [
            "ProjectStatusSnapshot",
            "status_snapshot_id, project_id, reporting_period, progress_percent, schedule_variance_percent, cost_variance_percent, risk_score, issue_score, overall_health, stale_flag, calculated_at",
            "Deterministic status facts for reporting periods.",
          ],
          [
            "ProjectLink",
            "project_link_id, project_id, linked_entity_type, linked_entity_id, relationship_type, active_flag",
            "Cross-entity links (program, portfolio, benefits, dependencies).",
          ],
          [
            "ProjectImportJob",
            "import_job_id, tenant_id, entity_name, mode, file_name, file_hash, started_at, completed_at, status, inserted_count, updated_count, rejected_count",
            "Excel import tracking for project-related lists.",
          ],
          [
            "ProjectExportJob",
            "export_job_id, tenant_id, entity_name, filter_json, started_at, completed_at, status, record_count, file_uri",
            "Excel export tracking for project-related lists.",
          ],
          [
            "AuditEvent",
            "audit_event_id, tenant_id, actor_id, entity_name, entity_id, operation, old_value_json, new_value_json, occurred_at, correlation_id",
            "Immutable audit evidence for all mutations.",
          ],
        ]}
      />

      <H3>Required Relationships</H3>
      <Table
        headers={["From", "Cardinality", "To", "Rule"]}
        rows={[
          ["Project", "Many to one", "Program", "program_id optional for standalone projects, required for program-managed projects."],
          ["Project", "Many to one", "Portfolio", "portfolio_id required either directly or inherited via program."],
          ["Project", "One to many", "ProjectPhaseInstance", "Lifecycle progression history retained."],
          ["Project", "One to many", "ProjectGateInstance", "Gate progression and decisions retained."],
          ["Project", "One to many", "ProjectStatusSnapshot", "Periodic status history for trends and roll-ups."],
          ["Project and all child entities", "One to many", "AuditEvent", "All mutations audited with before and after values."],
        ]}
      />

      <Divider />
      <H2>2) Services</H2>
      <Table
        headers={["Service", "Responsibilities", "Dependencies"]}
        rows={[
          [
            "ProjectService",
            "Create, read, update, archive projects; enforce lifecycle constraints on edits.",
            "TenantContextService, AuthorizationService, AuditService",
          ],
          [
            "ProjectLifecycleService",
            "Manage phase transitions and validate entry and exit criteria.",
            "WorkflowEngineService, ProjectGateService, AuditService",
          ],
          [
            "ProjectGateService",
            "Open gates, initiate approvals, finalize gate decisions, enforce gate blocking rules.",
            "WorkflowEngineService, AuthorizationService, AuditService",
          ],
          [
            "ProjectStatusService",
            "Calculate project progress, schedule and cost status, overall health and stale flags.",
            "RiskService, IssueService, FinancialService, AuditService",
          ],
          [
            "ProjectLinkageService",
            "Validate and maintain project links to program and portfolio structures.",
            "ProgramService, PortfolioService, AuthorizationService",
          ],
          [
            "ProjectImportExportService",
            "Template retrieval, import validation, preview, commit, export generation.",
            "ExcelEngineService, MappingProfileService, AuditService",
          ],
          [
            "ProjectValidationService",
            "Centralized business validation rules for create/update/import operations.",
            "ReferenceDataService, PolicyService",
          ],
        ]}
      />

      <Divider />
      <H2>3) API Structure</H2>
      <Text>All APIs are tenant-scoped, RBAC-protected, and audited for write operations.</Text>
      <Table
        headers={["API", "Method", "Purpose", "Permission"]}
        rows={[
          ["/projects", "POST", "Create project", "project.create"],
          ["/projects", "GET", "List projects with filters and pagination", "project.read"],
          ["/projects/{projectId}", "GET", "Get project details", "project.read"],
          ["/projects/{projectId}", "PATCH", "Update project", "project.update"],
          ["/projects/{projectId}/archive", "POST", "Archive or deactivate project", "project.archive"],
          ["/projects/{projectId}/phases", "GET", "Get project phase timeline", "project.read"],
          ["/projects/{projectId}/phases/transition", "POST", "Move project to next phase", "project.lifecycle.transition"],
          ["/projects/{projectId}/gates", "GET", "List project gates and statuses", "project.gate.read"],
          ["/projects/{projectId}/gates/{gateId}/start", "POST", "Start gate approval workflow", "project.gate.start"],
          ["/projects/{projectId}/gates/{gateId}/decide", "POST", "Record gate decision", "project.gate.decide"],
          ["/projects/{projectId}/status/recalculate", "POST", "Recompute status snapshot", "project.status.calculate"],
          ["/projects/{projectId}/links", "PUT", "Update program and portfolio links", "project.link.manage"],
          ["/projects/import/template", "GET", "Download Excel template", "project.import.read"],
          ["/projects/import/preview", "POST", "Upload Excel and validate preview", "project.import.preview"],
          ["/projects/import/commit/{jobId}", "POST", "Commit approved import job", "project.import.commit"],
          ["/projects/export", "POST", "Generate Excel export by filters", "project.export"],
        ]}
      />

      <H3>API Contract Standards</H3>
      <Table
        headers={["Standard", "Rule"]}
        rows={[
          ["Idempotency", "POST mutation endpoints accept idempotency key for safe retries."],
          ["Concurrency", "PATCH and gate decision calls require version_no or etag token."],
          ["Deterministic errors", "422 validation errors, 403 permission errors, 409 lifecycle or version conflicts."],
          ["Audit correlation", "All mutation responses return correlation_id."],
          ["Tenant enforcement", "Request tenant context must match token tenant claim."],
        ]}
      />

      <Divider />
      <H2>4) Status Calculation Logic</H2>
      <Table
        headers={["Metric", "Input", "Calculation", "Output"]}
        rows={[
          [
            "Progress percent",
            "WBS earned value and planned value, or weighted milestones",
            "progress_percent = sum(earned_value) / sum(planned_value) * 100 capped 0 to 100",
            "Numeric percent",
          ],
          [
            "Schedule status",
            "Baseline dates and forecast dates",
            "schedule_variance_percent = (forecast_duration - baseline_duration) / baseline_duration * 100",
            "Green, Amber, Red by threshold policy",
          ],
          [
            "Cost status",
            "Approved budget and forecast cost",
            "cost_variance_percent = (forecast_cost - approved_budget) / approved_budget * 100",
            "Green, Amber, Red by threshold policy",
          ],
          [
            "Risk and issue pressure",
            "Open risks and issues by severity and age",
            "weighted score from severity multipliers plus aging penalties",
            "Risk score and issue score",
          ],
          [
            "Overall health",
            "Schedule, cost, progress, risk, issue, data completeness scores",
            "weighted composite with fixed policy weights and deterministic threshold bands",
            "Overall health RAG",
          ],
        ]}
      />

      <Callout tone="warning" title="Missing or late data handling">
        If required reporting data is missing for the period, status is marked stale and overall health cannot be Green. This rule is fixed and deterministic.
      </Callout>

      <Divider />
      <H2>5) Validation Rules</H2>
      <Table
        headers={["Category", "Rule", "Applied on"]}
        rows={[
          ["Identity", "project_code unique within tenant; immutable after approval stage unless override permission.", "Create, update, import"],
          ["Mandatory fields", "name, manager_id, project_type, lifecycle_phase, planned dates, portfolio linkage required by policy.", "Create, import"],
          ["Date consistency", "baseline_start <= baseline_end; actual dates cannot violate completed lifecycle state.", "Create, update, import"],
          ["Link integrity", "program_id must belong to same tenant and linked portfolio if specified.", "Create, update, import"],
          ["Lifecycle rules", "Cannot skip mandatory phases; cannot start next phase when prior gate not passed.", "Phase transition, gate actions"],
          ["Gate controls", "Gate decision allowed only for authorized approver role and active gate instance.", "Gate decision"],
          ["Status protection", "System-calculated status fields are read-only via CRUD and import.", "Update, import"],
          ["Audit requirement", "Any write without successful audit event persistence is rejected.", "All mutations"],
          ["Excel schema", "Template version and required columns must match active mapping profile.", "Import preview"],
          ["Excel row validation", "Invalid enum values, missing foreign keys, and duplicate keys rejected with row errors.", "Import preview"],
        ]}
      />

      <Divider />
      <H2>6) Full Audit Logging Behavior</H2>
      <Table
        headers={["Operation", "Audit payload", "Immutability rule"]}
        rows={[
          ["Project create", "new_value_json plus actor, time, tenant, correlation_id", "Append-only event"],
          ["Project update", "old_value_json and new_value_json field-level changes", "Append-only event"],
          ["Phase transition", "from_phase, to_phase, criteria evaluation result, actor", "Append-only event"],
          ["Gate decision", "gate_id, decision, reason, approver role, workflow reference", "Append-only event"],
          ["Import commit", "job summary plus row-level change events", "Append-only events for each changed record"],
          ["Export action", "filter criteria, columns, record count, requester", "Append-only export audit event"],
        ]}
      />

      <Divider />
      <H2>7) Excel Import and Export Enablement</H2>
      <Table
        headers={["Capability", "Design", "Outcome"]}
        rows={[
          [
            "Template",
            "Standard sheets: README, DATA, LOOKUPS, KEYS, META with Project-specific mappings",
            "Consistent user experience across modules",
          ],
          [
            "Preview",
            "Classifies rows as Insert, Update, No Change, Reject before commit",
            "No silent data changes",
          ],
          [
            "Partial import",
            "Policy-based strict or partial commit modes",
            "Operational flexibility with governance control",
          ],
          [
            "Error workbook",
            "Returns row, field, error code, and suggested fix",
            "Fast correction cycle",
          ],
          [
            "Export",
            "Filter-based export preserving list sort and selected columns",
            "Executive and operational reporting support",
          ],
        ]}
      />

      <Callout tone="success" title="Module outcome">
        This Project Management module design is enterprise-ready: deterministic statusing, governed lifecycle and gates, strong linkage to program and portfolio hierarchy, complete audit trail, and reusable Excel import and export operations.
      </Callout>
    </Stack>
  );
}
