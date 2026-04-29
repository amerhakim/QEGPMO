import { Callout, Divider, Grid, H1, H2, H3, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoWorkflowApprovalEngineCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Flexible Workflow and Approval Engine</H1>
      <Text>
        Reusable enterprise workflow engine for Project Intake, Phase Gates, Change Requests, and Budget Approvals with configurable steps, SLA and escalation, role-based approvals, and full audit history.
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Workflow use cases" value="4 mandatory" />
        <Stat label="Approval model" value="Configurable step graph" />
        <Stat label="SLA handling" value="Timers and escalations" tone="success" />
        <Stat label="Audit coverage" value="End-to-end immutable" tone="success" />
      </Grid>

      <Callout tone="info" title="Architecture intent">
        One generic engine executes many process types by configuration, not custom code per module. This gives consistency, governance, and lower long-term maintenance.
      </Callout>

      <Divider />
      <H2>1) Workflow Model (Core Domain)</H2>
      <Table
        headers={["Entity", "Key fields", "Purpose"]}
        rows={[
          [
            "WorkflowDefinition",
            "workflow_def_id, tenant_id, code, name, process_type, version, status, effective_from, effective_to",
            "Top-level process template (for example project-intake-v3).",
          ],
          [
            "WorkflowStepDefinition",
            "step_def_id, workflow_def_id, step_code, step_name, step_type, sequence, parallel_group, required_flag",
            "Defines each step and execution order/branching shape.",
          ],
          [
            "StepTransitionRule",
            "transition_id, from_step, to_step, condition_expression, on_approve, on_reject, on_return",
            "Deterministic routing between steps.",
          ],
          [
            "ApproverRule",
            "approver_rule_id, step_def_id, approver_type, role_code, min_approvals, unanimous_flag, delegation_allowed",
            "Who can approve and quorum behavior.",
          ],
          [
            "SlaRule",
            "sla_rule_id, step_def_id, target_duration, warning_at, breach_at, escalation_policy_id, business_calendar_id",
            "Timer and SLA policy per step.",
          ],
          [
            "EscalationPolicy",
            "escalation_policy_id, levels_json, recipients_rule, reassign_rule, auto_action",
            "Escalation path and fallback actions.",
          ],
          [
            "WorkflowInstance",
            "workflow_instance_id, workflow_def_id, process_type, target_entity_type, target_entity_id, status, started_at, completed_at",
            "Runtime instance linked to business object.",
          ],
          [
            "WorkflowStepInstance",
            "step_instance_id, workflow_instance_id, step_def_id, assignee_scope, status, started_at, due_at, completed_at",
            "Runtime state for each step.",
          ],
          [
            "ApprovalDecision",
            "approval_decision_id, step_instance_id, actor_id, actor_role, decision, decision_reason, decided_at",
            "Individual approval record.",
          ],
          [
            "WorkflowEvent",
            "workflow_event_id, workflow_instance_id, event_type, event_time, actor_id, payload_json, correlation_id",
            "Immutable event stream for execution history.",
          ],
          [
            "WorkflowAuditSnapshot",
            "audit_snapshot_id, workflow_instance_id, old_state_json, new_state_json, changed_at, changed_by",
            "Before/after snapshots for state transitions.",
          ],
        ]}
      />

      <H3>Supported Step Types</H3>
      <Table
        headers={["Step type", "Description", "Examples"]}
        rows={[
          ["Submit", "Initiator submits request payload", "Intake request submit, change proposal submit"],
          ["Review", "Human review without final approval authority", "PMO quality review"],
          ["Approve", "Role-based decision step", "Portfolio board approval"],
          ["Conditional", "Route split based on rule expression", "Amount > threshold routes to CFO"],
          ["Parallel Approve", "Multiple approvers in parallel with quorum rule", "Finance and Architecture sign-off"],
          ["System", "Automated integration or data validation", "Budget check against ERP"],
          ["Close", "Finalize process and publish outcome", "Gate passed or request rejected"],
        ]}
      />

      <Divider />
      <H2>2) Approval Logic (Deterministic)</H2>
      <Table
        headers={["Logic area", "Rule", "Outcome"]}
        rows={[
          [
            "Approver resolution",
            "At step start, resolve approvers from role assignment scoped to tenant and target object.",
            "Produces fixed approver set for step instance.",
          ],
          [
            "Decision model",
            "Allowed decisions: Approve, Reject, Return for Rework, Delegate (if allowed).",
            "Standardized decision vocabulary across processes.",
          ],
          [
            "Quorum",
            "Step completes when min_approvals reached and reject rule not triggered.",
            "Supports one-of-many, many-of-many, unanimous.",
          ],
          [
            "Reject precedence",
            "If step policy has reject_on_any = true, first reject closes step as rejected.",
            "Immediate transition to rejection or rework path.",
          ],
          [
            "Rework loop",
            "Return for Rework transitions to configured prior step and increments iteration_count.",
            "Controlled loop with max_iterations guard.",
          ],
          [
            "Delegation",
            "Delegate allowed only if delegation policy and target role constraints are satisfied.",
            "Delegation recorded as decision metadata and audit event.",
          ],
          [
            "Conflict of interest",
            "Requester cannot approve their own request unless policy explicitly permits for low-risk tiers.",
            "Prevents self-approval governance breach.",
          ],
        ]}
      />

      <H3>Role-based Approval Enforcement</H3>
      <Table
        headers={["Control", "Rule"]}
        rows={[
          ["Permission check", "Actor must hold workflow.approve for step process_type and scope."],
          ["Role check", "Actor role must match resolved approver rule for this step instance."],
          ["Scope check", "Actor scope must cover target entity (project/program/portfolio/tenant)."],
          ["State check", "Decisions accepted only when step status is Pending and not expired/closed."],
          ["Replay block", "Same actor cannot submit duplicate final decision for same step revision."],
        ]}
      />

      <Divider />
      <H2>3) SLA Timing and Escalation Model</H2>
      <Table
        headers={["SLA element", "Definition", "Behavior"]}
        rows={[
          [
            "Target duration",
            "Expected completion time per step (for example 48 business hours)",
            "Due_at computed from business calendar and holidays.",
          ],
          [
            "Warning threshold",
            "Time before breach when notification is sent",
            "Triggers reminder events to assignees and watchers.",
          ],
          [
            "Breach threshold",
            "Time when SLA is violated",
            "Marks step as SLA Breached and starts escalation policy.",
          ],
          [
            "Escalation level 1",
            "Notify line manager or role supervisor",
            "Adds escalation event and optional reassignment recommendation.",
          ],
          [
            "Escalation level 2",
            "Escalate to governance owner (for example PMO head)",
            "Can increase priority and require response within reduced SLA window.",
          ],
          [
            "Final escalation action",
            "Auto-reassign, auto-reject, or auto-approve depending on policy and risk tier",
            "Must be explicitly configured; default is no automatic decision.",
          ],
        ]}
      />

      <Callout tone="warning" title="SLA determinism">
        All timers are evaluated against server time plus tenant business calendar. No client-side time logic is used.
      </Callout>

      <Divider />
      <H2>4) Process Blueprints for Required Use Cases</H2>
      <Table
        headers={["Use case", "Typical workflow steps", "Approval notes"]}
        rows={[
          [
            "Project intake",
            "Submit -> PMO Review -> Finance Approval -> Portfolio Approval -> Create Project",
            "Parallel Finance and Architecture review optional by policy.",
          ],
          [
            "Phase gates",
            "Gate Submit -> QA/Delivery Review -> Gate Board Approval -> Gate Decision",
            "Decision options include Pass, Conditional Pass, Fail.",
          ],
          [
            "Change requests",
            "Submit Change -> Impact Analysis -> CAB Approval -> Implement Authorization",
            "Threshold-based routing by cost and schedule impact.",
          ],
          [
            "Budget approvals",
            "Budget Request -> Cost Validation -> Finance Approval -> Executive Approval",
            "Amount tiers drive required approver seniority and quorum.",
          ],
        ]}
      />

      <Divider />
      <H2>5) API Structure (Workflow Platform APIs)</H2>
      <Text>These APIs are generic and reused across all modules; module-specific APIs only invoke them.</Text>
      <Table
        headers={["API", "Method", "Purpose", "Permission"]}
        rows={[
          ["/workflow/definitions", "POST", "Create workflow definition version", "workflow.definition.create"],
          ["/workflow/definitions/{id}", "PATCH", "Update draft definition", "workflow.definition.update"],
          ["/workflow/definitions/{id}/publish", "POST", "Publish version", "workflow.definition.publish"],
          ["/workflow/instances", "POST", "Start workflow for target entity", "workflow.instance.start"],
          ["/workflow/instances/{id}", "GET", "Get workflow state and timeline", "workflow.instance.read"],
          ["/workflow/instances/{id}/steps", "GET", "List step instances and SLA statuses", "workflow.instance.read"],
          ["/workflow/steps/{id}/decide", "POST", "Submit approval decision", "workflow.approve"],
          ["/workflow/steps/{id}/delegate", "POST", "Delegate approval task", "workflow.delegate"],
          ["/workflow/instances/{id}/cancel", "POST", "Cancel workflow instance by policy", "workflow.instance.cancel"],
          ["/workflow/escalations/run", "POST", "Trigger SLA evaluation batch", "workflow.sla.execute"],
          ["/workflow/audit/events", "GET", "Query workflow audit trail", "workflow.audit.read"],
        ]}
      />

      <H3>API Contract Rules</H3>
      <Table
        headers={["Rule", "Description"]}
        rows={[
          ["Idempotent decisions", "Decision endpoint accepts idempotency key to prevent duplicate submissions."],
          ["Optimistic concurrency", "State-changing APIs require step/version token to prevent stale updates."],
          ["Deterministic errors", "409 for state conflict, 403 for authz failure, 422 for policy violation."],
          ["Correlation", "Every response contains correlation_id used in audit and logs."],
        ]}
      />

      <Divider />
      <H2>6) Configuration Approach (No-code by Metadata)</H2>
      <Table
        headers={["Config area", "How configured", "Governance control"]}
        rows={[
          [
            "Step design",
            "Definition editor stores steps, transitions, and process metadata",
            "Versioned drafts with publish approval.",
          ],
          [
            "Approver rules",
            "Role mapping, quorum, delegation, conflict-of-interest policies",
            "Validation blocks invalid approver patterns before publish.",
          ],
          [
            "SLA policy",
            "Target, warning, breach, escalation levels, business calendar",
            "Policy simulation required before activation.",
          ],
          [
            "Conditional routing",
            "Expression library over request fields and calculated values",
            "Whitelisted deterministic operators only.",
          ],
          [
            "Notification hooks",
            "Event-to-template mapping for reminders/escalations",
            "Audit records every notification trigger.",
          ],
          [
            "Module binding",
            "Map process_type to business entities (intake, gates, changes, budget)",
            "Central registry prevents duplicate or conflicting bindings.",
          ],
        ]}
      />

      <Divider />
      <H2>7) Full Audit History Model</H2>
      <Table
        headers={["Audit event type", "Captured fields", "Reason"]}
        rows={[
          [
            "Workflow started",
            "workflow_instance_id, definition_version, target entity, actor, timestamp",
            "Trace initiation context.",
          ],
          [
            "Step status change",
            "old_status, new_status, step_id, actor/system, timestamp",
            "Trace state transitions and lifecycle timing.",
          ],
          [
            "Decision submitted",
            "decision, reason, actor role, assignee context, timestamp",
            "Trace who approved or rejected and why.",
          ],
          [
            "Escalation triggered",
            "sla_rule, escalation_level, recipients, timestamp",
            "Trace SLA governance and intervention path.",
          ],
          [
            "Definition published",
            "definition_id, old_version, new_version, publisher, timestamp",
            "Trace configuration changes affecting runtime behavior.",
          ],
          [
            "Manual override",
            "override action, approver authority, justification, timestamp",
            "Trace exceptional governance actions.",
          ],
        ]}
      />

      <Callout tone="success" title="Outcome">
        This workflow and approval engine is flexible by configuration, consistent across all QEGPMO approval use cases, SLA-aware with escalations, strictly role-based, and fully auditable end-to-end.
      </Callout>
    </Stack>
  );
}
