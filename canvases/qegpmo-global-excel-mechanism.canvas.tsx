import { Callout, Divider, Grid, H1, H2, H3, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoGlobalExcelMechanismCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Global Excel Import and Export Mechanism</H1>
      <Text>
        One reusable, deterministic framework applied to every list, grid, and register across all modules (Projects, Risks, Issues, Resources, Status Reports, Budgets, Benefits, and others).
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Scope" value="All list entities" tone="success" />
        <Stat label="Import modes" value="4" />
        <Stat label="Validation layers" value="6" />
        <Stat label="Audit coverage" value="100%" tone="success" />
      </Grid>

      <Callout tone="info" title="Design principle">
        Excel operations are metadata-driven (entity schema + mapping profile + policy), not module-specific custom logic. This guarantees consistent behavior everywhere.
      </Callout>

      <Divider />
      <H2>1) Global Reusable Architecture</H2>
      <Table
        headers={["Component", "Purpose", "Reusable rule"]}
        rows={[
          [
            "Export engine",
            "Generate Excel from filtered list view or saved register query",
            "Same engine for every entity; entity metadata defines columns/order/format.",
          ],
          [
            "Template registry",
            "Stores standard templates by entity and version",
            "Each list entity has a default template and optional profile variants.",
          ],
          [
            "Import parser",
            "Reads workbook and converts rows to canonical records",
            "Strict parser rules shared across all modules.",
          ],
          [
            "Validation pipeline",
            "Runs pre-import and row-level validations",
            "Same validation phases and severity handling for all entities.",
          ],
          [
            "Preview and reconciliation engine",
            "Classifies rows as Insert, Update, Skip, Reject",
            "No write occurs until preview is approved.",
          ],
          [
            "Execution and audit engine",
            "Commits approved rows and writes immutable audit trail",
            "Every import/export produces a job record and line-level evidence.",
          ],
        ]}
      />

      <Divider />
      <H2>2) Standard Excel Template Structure</H2>
      <Text>Every template follows exactly the same workbook structure.</Text>
      <Table
        headers={["Sheet", "Mandatory", "Purpose", "Contents"]}
        rows={[
          [
            "README",
            "Yes",
            "Human instructions and data entry guidance",
            "Entity name, version, required fields, allowed values, examples, import mode notes.",
          ],
          [
            "DATA",
            "Yes",
            "Row payload for import or exported rows",
            "One row per record with standardized column headers and data types.",
          ],
          [
            "LOOKUPS",
            "Yes",
            "Reference values for valid entries",
            "Allowed codes (status, severity, role, currency, etc.) and display labels.",
          ],
          [
            "KEYS",
            "Yes",
            "Identity and upsert guidance",
            "Natural key columns, external IDs, system IDs, uniqueness rules.",
          ],
          [
            "META",
            "Yes",
            "Control metadata",
            "template_version, entity_name, tenant_scope, exported_at, exported_by, filter_hash.",
          ],
          [
            "ERRORS",
            "No (system-generated during failed validation/export)",
            "Machine-readable diagnostics",
            "row_number, field_name, error_code, severity, message, suggested_fix.",
          ],
        ]}
      />

      <H3>DATA Sheet Column Standard</H3>
      <Table
        headers={["Column group", "Examples", "Rule"]}
        rows={[
          ["Identity", "record_id, external_key, natural_key", "At least one key strategy must be present per row."],
          ["Business attributes", "name, status, owner, dates, amounts", "Entity-specific fields from central metadata schema."],
          ["Reference links", "project_code, risk_owner_email, program_code", "Validated against existing master/reference data."],
          ["Control flags", "operation_type, active_flag", "Allowed operation_type values are Insert, Update, Upsert, Deactivate."],
          ["Traceability", "source_system, source_reference", "Optional for manual upload, mandatory for integration uploads."],
        ]}
      />

      <Divider />
      <H2>3) Validation Rules Before Import</H2>
      <Text>Validation runs in fixed phases; if a phase fails at job level, import does not proceed.</Text>
      <Table
        headers={["Phase", "Validation checks", "Failure action"]}
        rows={[
          [
            "Phase 0 - File integrity",
            "File format (.xlsx), malware scan, max file size, sheet presence, template version support",
            "Reject entire file",
          ],
          [
            "Phase 1 - Header/schema",
            "Required columns present, unknown columns policy, data type compatibility, duplicate headers",
            "Reject entire file",
          ],
          [
            "Phase 2 - Key integrity",
            "Missing keys, duplicate keys in file, invalid key structure",
            "Reject invalid rows (or reject file if strict mode)",
          ],
          [
            "Phase 3 - Domain validation",
            "Required fields, enum values, date ranges, numeric precision, currency format, text length limits",
            "Reject invalid rows",
          ],
          [
            "Phase 4 - Referential validation",
            "Foreign key exists (project/program/resource), parent-child consistency, tenant boundary checks",
            "Reject invalid rows",
          ],
          [
            "Phase 5 - Business policy validation",
            "Lifecycle state rules, immutable field checks, governance constraints, approval-required changes",
            "Route row to Reject or Pending Approval bucket",
          ],
        ]}
      />

      <H3>Validation Severity Model</H3>
      <Table
        headers={["Severity", "Meaning", "Import behavior"]}
        rows={[
          ["Error", "Rule violation that can corrupt data/governance", "Row cannot be imported."],
          ["Warning", "Valid but suspicious/incomplete", "Row can import if policy allows warnings."],
          ["Info", "Non-blocking informational notice", "No blocking effect."],
        ]}
      />

      <Divider />
      <H2>4) Error Handling and Preview Behavior</H2>
      <Table
        headers={["Step", "System output", "Deterministic rule"]}
        rows={[
          [
            "Parse and classify",
            "Each row marked Insert, Update, No Change, Reject",
            "Classification based on keys + current DB snapshot at cut-off.",
          ],
          [
            "Preview summary",
            "Counts by action and severity, plus module/entity totals",
            "Same file + same snapshot always gives same counts.",
          ],
          [
            "Field-level diff preview",
            "Old value vs new value for every changed field",
            "No hidden transformations; normalization rules are explicit.",
          ],
          [
            "Error workbook",
            "ERRORS sheet populated for rejected rows",
            "All blocking errors include row, field, code, fix guidance.",
          ],
          [
            "Commit gate",
            "Import only proceeds after explicit approval of preview",
            "No auto-commit directly from upload stage.",
          ],
        ]}
      />

      <Callout tone="warning" title="No silent data loss">
        Rows are never dropped silently. Every skipped or rejected row is explicitly reported with reason codes.
      </Callout>

      <Divider />
      <H2>5) Partial Import Rules (Global Standard)</H2>
      <Table
        headers={["Mode", "When used", "Behavior", "Typical use"]}
        rows={[
          [
            "Strict mode (all-or-nothing)",
            "High governance entities",
            "Any Error causes full rollback; 0 rows committed.",
            "Portfolio baselines, approvals, policy registers",
          ],
          [
            "Standard partial mode",
            "Most operational lists",
            "Valid rows committed; invalid rows rejected with diagnostics.",
            "Risks, issues, actions, resources",
          ],
          [
            "Upsert mode",
            "Master data synchronization",
            "Key match updates existing; no match inserts new.",
            "Resource master, lookup catalogs",
          ],
          [
            "Controlled update-only mode",
            "Protected entities where inserts are forbidden",
            "Rows without existing key are rejected.",
            "Approved project register updates",
          ],
        ]}
      />

      <H3>Partial Import Safeguards</H3>
      <Table
        headers={["Safeguard", "Rule"]}
        rows={[
          ["Transaction chunking", "Commit in deterministic chunks (for example by 500 rows) with per-chunk logs."],
          ["Idempotency key", "Same file hash + mapping profile + entity + tenant prevents duplicate replay commits."],
          ["Conflict resolution", "Latest approved import job precedence, then manual edits by policy timestamp."],
          ["Protected fields", "System-calculated and audit fields are never overwriteable from Excel."],
          ["Cross-row dependency", "Child row imported only if parent key exists in DB or same approved batch."],
        ]}
      />

      <Divider />
      <H2>6) Audit Behavior for Imports and Exports</H2>
      <Table
        headers={["Audit layer", "Captured data", "Retention/traceability purpose"]}
        rows={[
          [
            "Job-level audit",
            "job_id, entity, tenant, file_name, file_hash, template_version, started_at, completed_at, actor, mode, result counts",
            "Regulatory evidence and operational trace.",
          ],
          [
            "Row-level audit",
            "row_number, action_type, key values, status, error/warning codes",
            "Pinpoint validation and import outcomes.",
          ],
          [
            "Field-level audit",
            "before_value, after_value, changed_field, change_reason, source",
            "Forensic reconstruction of every update.",
          ],
          [
            "Export audit",
            "export_job_id, filter criteria, columns, record_count, generated_at, generated_by, checksum",
            "Evidence of what data was extracted and when.",
          ],
          [
            "Lineage correlation",
            "correlation_id linking import job to entity audit events",
            "End-to-end trace from file row to domain entity history.",
          ],
        ]}
      />

      <Divider />
      <H2>7) Global Policy Matrix for All Modules</H2>
      <Table
        headers={["Policy area", "Default enterprise rule", "Overridable per entity?"]}
        rows={[
          ["Template versioning", "Current and previous major versions accepted", "Yes, within governance limit"],
          ["Mandatory keys", "At least one unique key per row", "No"],
          ["Unknown columns", "Warning or Error by policy", "Yes"],
          ["Warning tolerance", "Allowed threshold percentage before blocking", "Yes"],
          ["Import mode default", "Standard partial mode", "Yes"],
          ["Audit requirement", "Always on for import/export jobs", "No"],
          ["Tenant boundary enforcement", "Hard-block cross-tenant references", "No"],
          ["PII/sensitive field handling", "Mask in error/export logs per policy", "Yes"],
        ]}
      />

      <Divider />
      <H2>8) Deterministic End-to-End Flow</H2>
      <Table
        headers={["Step", "Input", "Output"]}
        rows={[
          ["1. Select entity and profile", "Entity metadata + mapping profile", "Resolved template and rule set"],
          ["2. Upload/ingest workbook", "Excel file", "Parsed structured rows"],
          ["3. Validate in phases", "Parsed rows + master/reference data", "Validated row states + diagnostics"],
          ["4. Preview and approve", "Validation result", "Approved execution plan"],
          ["5. Execute import/export", "Approved plan", "Committed changes or generated file"],
          ["6. Persist audit and evidence", "Execution details", "Immutable audit trail + reconciliation report"],
        ]}
      />

      <Callout tone="success" title="Outcome">
        This mechanism is globally reusable across all QEGPMO modules, deterministic for consistent executive reporting, and governance-ready with full auditability for every import and export operation.
      </Callout>
    </Stack>
  );
}
