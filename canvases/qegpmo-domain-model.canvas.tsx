import { Callout, Divider, Grid, H1, H2, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoDomainModelCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Complete Domain Model</H1>
      <Text>
        Enterprise Project, Program, Portfolio, and Enterprise governance model for a multi-tenant PPM platform with strong auditability and roll-up controls.
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Core entities" value="47" />
        <Stat label="Relationship definitions" value="58" />
        <Stat label="Audit requirement" value="100%" tone="success" />
        <Stat label="Excel I/O readiness" value="All list entities" tone="success" />
      </Grid>

      <Callout tone="info" title="Field Type Legend">
        U = User-entered, S = System-calculated, A = Aggregated roll-up from child entities.
      </Callout>

      <Divider />
      <H2>1) Enterprise and Governance Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "Tenant",
            "Top-level customer isolation boundary",
            "tenant_id(S), name(U), code(U), status(U), data_residency(U), timezone(U), fiscal_calendar_id(U), created_at(S)",
            "All other entities inherit tenant_id",
          ],
          [
            "BusinessUnit",
            "Enterprise segment for planning and roll-up",
            "bu_id(S), tenant_id(S), name(U), parent_bu_id(U), manager_resource_id(U), strategic_weight(U), active_flag(U)",
            "Supports hierarchical BU roll-up",
          ],
          [
            "OrganizationalUnit",
            "Department/cost center structure",
            "org_unit_id(S), tenant_id(S), code(U), name(U), parent_org_unit_id(U), cost_center_code(U), owner_resource_id(U)",
            "Used for financial and resource slicing",
          ],
          [
            "StrategyTheme",
            "Strategic objective bucket",
            "theme_id(S), tenant_id(S), name(U), description(U), owner_resource_id(U), target_value(U), current_value(A), progress_percent(A)",
            "Rolls up initiative outcomes",
          ],
          [
            "Portfolio",
            "Collection of programs/projects for investment governance",
            "portfolio_id(S), tenant_id(S), name(U), sponsor_resource_id(U), planned_budget(U), approved_budget(U), forecast_cost(A), actual_cost(A), schedule_health(A), risk_score(A)",
            "Parent of programs and direct projects",
          ],
          [
            "Program",
            "Group of related projects under coordinated governance",
            "program_id(S), tenant_id(S), portfolio_id(U), name(U), program_manager_id(U), baseline_start(U), baseline_end(U), actual_start(U), actual_end(S), percent_complete(A), total_risk_exposure(A)",
            "Rolls up project performance",
          ],
          [
            "Project",
            "Execution unit delivering outcomes",
            "project_id(S), tenant_id(S), program_id(U), portfolio_id(U), name(U), project_type(U), lifecycle_stage(U), priority(U), health_rag(U), baseline_cost(U), forecast_cost(S), actual_cost(A), completion_percent(S), spi(S), cpi(S)",
            "Core work management object",
          ],
          [
            "LifecycleGate",
            "Stage-gate definition",
            "gate_id(S), tenant_id(S), level(U), name(U), sequence(U), required_artifacts(U), approval_rule_id(U)",
            "Used by projects/programs",
          ],
          [
            "GateReview",
            "Record of gate assessment and outcome",
            "gate_review_id(S), tenant_id(S), gate_id(U), object_type(U), object_id(U), decision(U), review_date(U), reviewer_id(U), conditions(U), next_due_date(U)",
            "Decision contributes to governance health",
          ],
          [
            "GovernancePolicy",
            "Configurable compliance and control rules",
            "policy_id(S), tenant_id(S), policy_type(U), name(U), scope(U), rule_expression(U), severity(U), is_active(U)",
            "Feeds compliance checks",
          ],
        ]}
      />

      <Divider />
      <H2>2) Planning, Scope, Schedule, and Dependency Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "WorkBreakdownItem",
            "Deliverable/task hierarchy",
            "wbs_id(S), tenant_id(S), project_id(U), parent_wbs_id(U), name(U), type(U), planned_start(U), planned_finish(U), actual_start(U), actual_finish(S), percent_complete(U), earned_value(S)",
            "Can map to milestones and activities",
          ],
          [
            "Milestone",
            "Major checkpoint",
            "milestone_id(S), tenant_id(S), project_id(U), name(U), baseline_date(U), forecast_date(S), actual_date(U), status(U), critical_flag(S)",
            "Schedule variance rolls upward",
          ],
          [
            "Dependency",
            "Logical relationship between scope elements",
            "dependency_id(S), tenant_id(S), predecessor_type(U), predecessor_id(U), successor_type(U), successor_id(U), dependency_type(U), lag_days(U), criticality_score(S)",
            "Cross-project/program dependency supported",
          ],
          [
            "ScheduleBaseline",
            "Frozen approved schedule snapshot",
            "schedule_baseline_id(S), tenant_id(S), object_type(U), object_id(U), baseline_version(S), baseline_date(S), approved_by(U), approval_date(U)",
            "Supports variance analytics",
          ],
          [
            "ScopeChangeRequest",
            "Controlled scope/schedule/cost change",
            "scr_id(S), tenant_id(S), object_type(U), object_id(U), title(U), reason(U), impact_cost(U), impact_schedule_days(U), impact_benefits(U), decision(U), decision_date(U)",
            "Lifecycle includes approve/reject/defer",
          ],
          [
            "Assumption",
            "Tracked planning assumption",
            "assumption_id(S), tenant_id(S), object_type(U), object_id(U), description(U), owner_id(U), due_date(U), validation_status(U), breach_flag(S)",
            "Breach can auto-trigger risk",
          ],
          [
            "Constraint",
            "Tracked planning constraint",
            "constraint_id(S), tenant_id(S), object_type(U), object_id(U), category(U), description(U), owner_id(U), impact(U), resolution_plan(U)",
            "Used in readiness scoring",
          ],
          [
            "DecisionLog",
            "Architectural and governance decisions",
            "decision_id(S), tenant_id(S), object_type(U), object_id(U), title(U), options_considered(U), final_decision(U), rationale(U), approver_id(U), decision_date(U)",
            "Provides traceability for audits",
          ],
        ]}
      />

      <Divider />
      <H2>3) Financial and Benefit Management Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "FundingSource",
            "Budget origin",
            "funding_source_id(S), tenant_id(S), name(U), source_type(U), fiscal_year(U), restrictions(U), available_amount(U)",
            "Linked to budget lines",
          ],
          [
            "Budget",
            "Approved financial envelope",
            "budget_id(S), tenant_id(S), object_type(U), object_id(U), fiscal_year(U), version(S), total_budget(U), contingency(U), approved_amount(U), consumed_amount(A), remaining_amount(S)",
            "Project/program/portfolio supported",
          ],
          [
            "BudgetLine",
            "Detailed cost planning line",
            "budget_line_id(S), tenant_id(S), budget_id(U), cost_category(U), capex_opex(U), planned_amount(U), approved_amount(U), committed_amount(A), actual_amount(A), variance(S)",
            "Import/export friendly list entity",
          ],
          [
            "Forecast",
            "Reforecasted cost/revenue/budget position",
            "forecast_id(S), tenant_id(S), object_type(U), object_id(U), forecast_period(U), forecast_amount(U), forecast_confidence(U), based_on_version(U), generated_at(S)",
            "Supports scenario analytics",
          ],
          [
            "ActualCost",
            "Booked cost transaction",
            "actual_cost_id(S), tenant_id(S), object_type(U), object_id(U), posting_date(U), amount(U), currency(U), source_system(U), source_reference(U)",
            "Can be ERP-sourced",
          ],
          [
            "Commitment",
            "Obligated spend not yet invoiced",
            "commitment_id(S), tenant_id(S), object_type(U), object_id(U), vendor_id(U), amount(U), expected_invoice_date(U), status(U)",
            "Used in EAC calculations",
          ],
          [
            "FinancialBaseline",
            "Approved cost baseline snapshot",
            "financial_baseline_id(S), tenant_id(S), object_type(U), object_id(U), baseline_cost(U), approved_by(U), approved_date(U), baseline_version(S)",
            "Variance calculated against actual/forecast",
          ],
          [
            "BenefitCategory",
            "Standardized benefit taxonomy",
            "benefit_category_id(S), tenant_id(S), name(U), type(U), measurement_unit(U), valuation_rule(U)",
            "Supports portfolio comparability",
          ],
          [
            "BenefitPlan",
            "Expected benefit plan by period",
            "benefit_plan_id(S), tenant_id(S), object_type(U), object_id(U), benefit_category_id(U), planned_value(U), planned_realization_date(U), owner_id(U)",
            "Rolls to strategic themes",
          ],
          [
            "BenefitRealization",
            "Actual realized benefit",
            "benefit_realization_id(S), tenant_id(S), benefit_plan_id(U), period(U), realized_value(U), realization_confidence(U), evidence_ref(U), variance(S)",
            "Input to value tracking KPIs",
          ],
        ]}
      />

      <Divider />
      <H2>4) Resource, Capacity, and Time Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "Resource",
            "Person or non-human resource",
            "resource_id(S), tenant_id(S), resource_type(U), employee_code(U), full_name(U), org_unit_id(U), manager_id(U), location(U), standard_rate(U), status(U)",
            "Master record for assignments",
          ],
          [
            "Role",
            "Reusable capability role",
            "role_id(S), tenant_id(S), name(U), role_family(U), default_rate(U), competency_level(U)",
            "Used for demand planning",
          ],
          [
            "Skill",
            "Skill taxonomy item",
            "skill_id(S), tenant_id(S), name(U), category(U), criticality(U)",
            "Maps to resources and demand",
          ],
          [
            "ResourceSkill",
            "Resource-to-skill proficiency mapping",
            "resource_skill_id(S), tenant_id(S), resource_id(U), skill_id(U), proficiency(U), validated_on(U), expires_on(U)",
            "Supports allocation quality",
          ],
          [
            "CapacityPlan",
            "Planned available capacity per period",
            "capacity_plan_id(S), tenant_id(S), resource_or_role_type(U), resource_or_role_id(U), period(U), available_hours(U), reserved_hours(A), utilization_percent(S)",
            "Supports portfolio balancing",
          ],
          [
            "DemandRequest",
            "Requested resourcing demand",
            "demand_id(S), tenant_id(S), object_type(U), object_id(U), role_id(U), required_skills(U), requested_hours(U), start_date(U), end_date(U), priority(U), status(U)",
            "Feeds assignment pipeline",
          ],
          [
            "Assignment",
            "Resource allocation to work",
            "assignment_id(S), tenant_id(S), resource_id(U), object_type(U), object_id(U), role_id(U), allocation_percent(U), start_date(U), end_date(U), planned_hours(S), actual_hours(A)",
            "Impacts cost and utilization roll-ups",
          ],
          [
            "Timesheet",
            "Period time entry header",
            "timesheet_id(S), tenant_id(S), resource_id(U), period_start(U), period_end(U), status(U), submitted_at(S), approved_at(U), approver_id(U)",
            "Parent of timesheet lines",
          ],
          [
            "TimesheetLine",
            "Detailed booked effort",
            "timesheet_line_id(S), tenant_id(S), timesheet_id(U), project_id(U), wbs_id(U), date(U), hours(U), overtime_hours(U), billing_type(U), cost_amount(S)",
            "Feeds actual cost and EV",
          ],
          [
            "Calendar",
            "Working day and holiday definition",
            "calendar_id(S), tenant_id(S), name(U), timezone(U), workweek_pattern(U), holiday_set(U)",
            "Used in schedule computations",
          ],
        ]}
      />

      <Divider />
      <H2>5) Delivery, Quality, and Governance Control Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "Risk",
            "Potential uncertain event affecting objectives",
            "risk_id(S), tenant_id(S), object_type(U), object_id(U), title(U), category(U), probability(U), impact(U), exposure_score(S), owner_id(U), response_strategy(U), status(U), due_date(U)",
            "Rolls to program/portfolio risk heat",
          ],
          [
            "Issue",
            "Current realized problem needing resolution",
            "issue_id(S), tenant_id(S), object_type(U), object_id(U), title(U), severity(U), priority(U), root_cause(U), owner_id(U), target_resolution_date(U), aging_days(S), status(U)",
            "Aging and backlog are roll-up KPIs",
          ],
          [
            "ActionItem",
            "Follow-up task from risk/issue/meeting",
            "action_item_id(S), tenant_id(S), source_type(U), source_id(U), description(U), owner_id(U), due_date(U), completion_date(U), status(U), overdue_flag(S)",
            "Cross-cutting control entity",
          ],
          [
            "QualityCheck",
            "Defined quality gate/checkpoint",
            "quality_check_id(S), tenant_id(S), object_type(U), object_id(U), checklist_name(U), score(U), pass_fail(S), assessed_by(U), assessed_on(U)",
            "Feeds quality health",
          ],
          [
            "ComplianceCheck",
            "Rule-based policy conformance result",
            "compliance_check_id(S), tenant_id(S), policy_id(U), object_type(U), object_id(U), check_date(S), result(S), violation_count(S), details(S)",
            "System-generated or scheduled",
          ],
          [
            "DependencyRisk",
            "Risk specific to dependency chain",
            "dependency_risk_id(S), tenant_id(S), dependency_id(U), probability(U), impact(U), exposure_score(S), mitigation_plan(U), owner_id(U)",
            "Improves integrated planning control",
          ],
          [
            "RAIDLog",
            "Consolidated view for Risks, Assumptions, Issues, Dependencies",
            "raid_log_id(S), tenant_id(S), object_type(U), object_id(U), reporting_period(U), open_risks(A), open_issues(A), unresolved_dependencies(A), key_assumption_breaches(A)",
            "Generated summary entity",
          ],
          [
            "StatusReport",
            "Periodic performance and narrative report",
            "status_report_id(S), tenant_id(S), object_type(U), object_id(U), period(U), submitted_by(U), overall_rag(U), schedule_rag(S), cost_rag(S), scope_rag(U), accomplishments(U), next_steps(U), blockers(U)",
            "Core governance deliverable",
          ],
          [
            "KPI",
            "Metric definition for tracking",
            "kpi_id(S), tenant_id(S), name(U), scope(U), formula(U), target(U), threshold_red(U), threshold_amber(U), threshold_green(U)",
            "Reusable across levels",
          ],
          [
            "KPIResult",
            "Metric value instance by period/object",
            "kpi_result_id(S), tenant_id(S), kpi_id(U), object_type(U), object_id(U), period(U), value(S), trend(S), rag_status(S), comments(U)",
            "Mostly calculated with optional commentary",
          ],
        ]}
      />

      <Divider />
      <H2>6) Communication, Collaboration, and Artifact Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "Meeting",
            "Governance cadence event",
            "meeting_id(S), tenant_id(S), object_type(U), object_id(U), title(U), meeting_type(U), scheduled_at(U), chair_id(U), minutes(U)",
            "Source for actions/decisions",
          ],
          [
            "MeetingAttendance",
            "Attendance record for governance events",
            "meeting_attendance_id(S), tenant_id(S), meeting_id(U), resource_id(U), attendance_status(U), comments(U)",
            "Supports compliance evidence",
          ],
          [
            "Comment",
            "Threaded collaboration note",
            "comment_id(S), tenant_id(S), object_type(U), object_id(U), parent_comment_id(U), author_id(U), body(U), created_at(S), edited_at(S)",
            "Auditable discussion trail",
          ],
          [
            "Attachment",
            "Linked supporting artifact",
            "attachment_id(S), tenant_id(S), object_type(U), object_id(U), file_name(U), mime_type(U), storage_uri(S), uploaded_by(U), uploaded_at(S), checksum(S)",
            "Immutable binary metadata",
          ],
          [
            "Document",
            "Structured managed document record",
            "document_id(S), tenant_id(S), object_type(U), object_id(U), doc_type(U), title(U), version(S), owner_id(U), approval_status(U), effective_date(U)",
            "Supports controlled templates",
          ],
          [
            "Notification",
            "System/user-triggered alert",
            "notification_id(S), tenant_id(S), recipient_id(U), channel(U), template_id(U), subject(S), body(S), sent_at(S), read_at(U), status(S)",
            "Derived from workflow events",
          ],
        ]}
      />

      <Divider />
      <H2>7) Security, Access, Workflow, and Data Governance Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "UserAccount",
            "Application user identity",
            "user_id(S), tenant_id(S), username(U), email(U), display_name(U), status(U), auth_provider(U), last_login_at(S)",
            "May map to multiple resources",
          ],
          [
            "RoleDefinition",
            "Permission role blueprint",
            "role_def_id(S), tenant_id(S), name(U), role_scope(U), description(U), is_system(S)",
            "RBAC core",
          ],
          [
            "Permission",
            "Atomic system capability",
            "permission_id(S), tenant_id(S), code(U), name(U), module(U), action(U)",
            "Mapped through role-permission",
          ],
          [
            "UserRoleAssignment",
            "User-to-role assignment",
            "user_role_assignment_id(S), tenant_id(S), user_id(U), role_def_id(U), scope_type(U), scope_id(U), granted_by(U), granted_at(S), revoked_at(U)",
            "Supports fine-grained scope",
          ],
          [
            "WorkflowDefinition",
            "Approval/process state machine",
            "workflow_def_id(S), tenant_id(S), name(U), object_type(U), trigger_event(U), version(S), active_flag(U)",
            "Reusable process template",
          ],
          [
            "WorkflowInstance",
            "Runtime workflow execution",
            "workflow_instance_id(S), tenant_id(S), workflow_def_id(U), object_type(U), object_id(U), current_state(S), started_at(S), completed_at(S), status(S)",
            "Records governance flow",
          ],
          [
            "Approval",
            "Formal approval decision record",
            "approval_id(S), tenant_id(S), workflow_instance_id(U), approver_id(U), decision(U), decision_at(U), comments(U), sla_breach_flag(S)",
            "Used across gates/changes/funding",
          ],
          [
            "DataImportJob",
            "Excel import transaction metadata",
            "import_job_id(S), tenant_id(S), entity_name(U), source_file_name(U), mapping_profile_id(U), started_at(S), completed_at(S), status(S), inserted_count(S), updated_count(S), rejected_count(S)",
            "Required for all list entities",
          ],
          [
            "DataExportJob",
            "Excel export transaction metadata",
            "export_job_id(S), tenant_id(S), entity_name(U), filter_json(U), started_at(S), completed_at(S), status(S), exported_count(S), file_uri(S)",
            "Supports regulated evidence extracts",
          ],
          [
            "MappingProfile",
            "Saved import/export field mapping",
            "mapping_profile_id(S), tenant_id(S), entity_name(U), profile_name(U), column_mapping_json(U), validation_rules_json(U), active_flag(U)",
            "Enforces data consistency",
          ],
        ]}
      />

      <Divider />
      <H2>8) Universal Audit, Versioning, and Roll-up Entities</H2>
      <Table
        headers={["Entity", "Purpose", "Key fields (with type marker)", "Notes"]}
        rows={[
          [
            "AuditEvent",
            "Immutable change journal for every entity",
            "audit_event_id(S), tenant_id(S), entity_name(S), entity_id(S), operation(S), changed_by(S), changed_at(S), before_json(S), after_json(S), source_channel(S), correlation_id(S)",
            "Mandatory for all entities",
          ],
          [
            "EntityVersion",
            "Version snapshot pointer",
            "entity_version_id(S), tenant_id(S), entity_name(S), entity_id(S), version_no(S), snapshot_json(S), created_at(S), created_by(S)",
            "Supports historical reconstruction",
          ],
          [
            "RollupSnapshot",
            "Periodic aggregate facts by level",
            "rollup_snapshot_id(S), tenant_id(S), level(U), level_entity_id(U), period(U), schedule_index(A), cost_index(A), risk_exposure(A), issue_backlog(A), benefit_realization(A), generated_at(S)",
            "Enterprise/program/portfolio analytics store",
          ],
          [
            "DataQualityRule",
            "Validation rule definition",
            "dq_rule_id(S), tenant_id(S), entity_name(U), rule_name(U), rule_expression(U), severity(U), active_flag(U)",
            "Applied on import and edit",
          ],
          [
            "DataQualityResult",
            "Rule execution outcomes",
            "dq_result_id(S), tenant_id(S), dq_rule_id(U), entity_name(U), entity_id(U), run_at(S), result(S), message(S)",
            "Supports governance scorecards",
          ],
        ]}
      />

      <Divider />
      <H2>9) Relationship Model (Cardinality and Dependencies)</H2>
      <Table
        headers={["From", "Relationship", "To", "Type", "Roll-up impact"]}
        rows={[
          ["Tenant", "1..*", "All business entities", "Ownership", "Tenant isolation boundary"],
          ["BusinessUnit", "1..*", "Portfolio / Program / Project", "Hierarchy", "BU-level KPI aggregation"],
          ["Portfolio", "1..*", "Program", "Parent-child", "Cost/schedule/risk roll-up"],
          ["Portfolio", "1..*", "Project", "Parent-child (direct)", "Direct project contribution"],
          ["Program", "1..*", "Project", "Parent-child", "Program-level consolidation"],
          ["Project", "1..*", "WorkBreakdownItem / Milestone", "Parent-child", "Execution progress aggregation"],
          ["WorkBreakdownItem", "0..*", "Dependency", "Dependency endpoint", "Critical path impact"],
          ["Project/Program/Portfolio", "1..*", "Risk / Issue / ActionItem / StatusReport", "Associated records", "Governance roll-up"],
          ["Project/Program/Portfolio", "1..*", "Budget / BudgetLine / Forecast / ActualCost", "Financial linkage", "Financial roll-up"],
          ["Budget", "1..*", "BudgetLine", "Composition", "Category variance roll-up"],
          ["BenefitPlan", "1..*", "BenefitRealization", "Composition", "Value realization trend"],
          ["Resource", "1..*", "Assignment / Timesheet", "Allocation/actuals", "Capacity and cost roll-up"],
          ["Timesheet", "1..*", "TimesheetLine", "Composition", "Actual effort aggregation"],
          ["LifecycleGate", "1..*", "GateReview", "Governance process", "Compliance and readiness indicators"],
          ["GovernancePolicy", "1..*", "ComplianceCheck", "Rule execution", "Policy adherence KPI"],
          ["WorkflowDefinition", "1..*", "WorkflowInstance", "Runtime instantiation", "SLA and throughput metrics"],
          ["WorkflowInstance", "1..*", "Approval", "Approval step trail", "Decision-cycle analytics"],
          ["Any auditable entity", "1..*", "AuditEvent / EntityVersion", "Audit journaling", "Full forensic traceability"],
          ["List-capable entities", "1..*", "DataImportJob / DataExportJob / MappingProfile", "Data operations", "Import/export governance"],
          ["Project/Program/Portfolio", "1..*", "RollupSnapshot", "Periodic aggregate", "Enterprise dashboard source"],
        ]}
      />

      <Divider />
      <H2>10) Cross-Entity Field Standards (Mandatory)</H2>
      <Table
        headers={["Field", "Classification", "Meaning", "Applies to"]}
        rows={[
          ["tenant_id", "S", "Tenant partition key", "All entities"],
          ["id (entity key)", "S", "System-generated immutable ID", "All entities"],
          ["created_at, created_by", "S", "Creation audit metadata", "All entities"],
          ["updated_at, updated_by", "S", "Latest update metadata", "All mutable entities"],
          ["record_status", "U", "Business state (active/inactive/etc.)", "Most master/transaction entities"],
          ["version_no", "S", "Optimistic locking and history", "All mutable entities"],
          ["source_system", "U/S", "Origin of data", "Import-integrated entities"],
          ["effective_from, effective_to", "U", "Temporal validity", "Policies, assignments, rates, org structures"],
          ["is_deleted", "S", "Soft-delete indicator", "All entities with retention controls"],
          ["rollup_level", "S", "Project/program/portfolio/enterprise tagging", "Aggregated fact entities"],
        ]}
      />

      <Callout tone="success" title="Compliance with your constraints">
        Every entity is modeled as auditable through AuditEvent and EntityVersion. Every list-oriented entity is Excel-ready through DataImportJob, DataExportJob, and MappingProfile with governed column mappings and validations.
      </Callout>
    </Stack>
  );
}
