import { Callout, Divider, Grid, H1, H2, H3, Stack, Stat, Table, Text } from "cursor/canvas";

export default function QegpmoRollupLogicCanvas() {
  return (
    <Stack gap={20}>
      <H1>QEGPMO Aggregation and Roll-up Logic</H1>
      <Text>
        Deterministic rules for consolidating delivery, financial, and governance metrics from Project to Program, Program to Portfolio, and Portfolio to Enterprise.
      </Text>

      <Grid columns={4} gap={12}>
        <Stat label="Roll-up levels" value="4" />
        <Stat label="Determinism" value="100%" tone="success" />
        <Stat label="RAG dimensions" value="3" />
        <Stat label="Dashboard-ready" value="Yes" tone="success" />
      </Grid>

      <Callout tone="info" title="Determinism Rules (Always Applied)">
        Use fixed formulas, fixed weights, fixed thresholds, and fixed tie-break precedence. For the same snapshot timestamp and same inputs, outputs are always identical.
      </Callout>

      <Divider />
      <H2>A) Common Definitions Used at All Levels</H2>
      <Table
        headers={["Term", "Definition", "Rule"]}
        rows={[
          ["Data cut-off", "Snapshot timestamp for roll-up", "Only records with value_date <= cut_off are included."],
          ["Late data", "No status/actuals submitted by expected date", "Entity flagged stale after defined SLA (example: 5 business days)."],
          ["Missing data", "No required data exists for period", "Metric set to Unknown and penalized per missing-data rule."],
          ["Weight basis", "Importance of child item in parent roll-up", "Default weight = approved_budget; fallback = baseline_cost; fallback = equal weight."],
          ["RAG precedence", "How mixed statuses resolve", "Red dominates Amber dominates Green; Unknown never improves status."],
          ["Minimum coverage", "Required child reporting completeness", "If coverage < threshold (example: 80%), parent cannot be Green."],
        ]}
      />

      <Divider />
      <H2>B) Project - Base Metric Calculations</H2>
      <Text>Project metrics are first calculated at project level, then rolled upward.</Text>
      <Table
        headers={["Metric", "Input fields", "Deterministic calculation", "Output"]}
        rows={[
          [
            "Progress %",
            "WBS planned value, WBS earned value (or milestone weights)",
            "Progress = sum(earned_value) / sum(planned_value) * 100, capped 0..100.",
            "Numeric percent",
          ],
          [
            "Schedule variance %",
            "Baseline finish, forecast finish",
            "SV% = (forecast_duration - baseline_duration) / baseline_duration * 100.",
            "Numeric variance",
          ],
          [
            "Cost variance %",
            "Budget at completion, estimate at completion or forecast cost",
            "CV% = (forecast_cost - approved_budget) / approved_budget * 100.",
            "Numeric variance",
          ],
          [
            "Risk exposure",
            "Open risks (probability, impact)",
            "Project risk score = sum(probability * impact * severity_factor) for open risks.",
            "Numeric score",
          ],
          [
            "Issue pressure",
            "Open issues by severity + aging",
            "Issue score = weighted open issues + aging penalty.",
            "Numeric score",
          ],
        ]}
      />

      <H3>Project RAG Thresholds (Reference Standard)</H3>
      <Table
        headers={["Dimension", "Green", "Amber", "Red", "Unknown"]}
        rows={[
          ["Schedule", "SV% <= 5%", "SV% > 5% and <= 10%", "SV% > 10%", "No current schedule update"],
          ["Cost", "CV% <= 5%", "CV% > 5% and <= 10%", "CV% > 10%", "No current forecast/actuals"],
          ["Progress", "On track vs planned curve", "Lag > 5% and <= 10%", "Lag > 10%", "No progress submission"],
        ]}
      />

      <Divider />
      <H2>C) Project to Program Roll-up</H2>
      <Table
        headers={["Roll-up area", "Logic", "Deterministic tie-breaks", "Output"]}
        rows={[
          [
            "Progress %",
            "Program progress = weighted avg(Project progress %, project weight).",
            "Weights fixed by policy; if missing weight use fallback hierarchy.",
            "Program progress %",
          ],
          [
            "Schedule RAG",
            "Compute weighted program SV% from child projects, then map to thresholds.",
            "If any project is Red and project weight >= critical threshold, program at least Amber; multiple critical Reds -> Red.",
            "Program schedule RAG",
          ],
          [
            "Cost RAG",
            "Compute weighted program CV% from project forecasts and budgets.",
            "If data coverage below minimum, max status = Amber even if CV% is Green.",
            "Program cost RAG",
          ],
          [
            "Risk roll-up",
            "Program risk score = sum(child risk scores) + dependency risk adjustment.",
            "Severity bucket counts are additive and never averaged.",
            "Program risk score + severity profile",
          ],
          [
            "Issue roll-up",
            "Open issues grouped by severity; weighted score aggregated from projects.",
            "Critical issue count > threshold forces program overall at least Amber.",
            "Program issue score + counts",
          ],
          [
            "Overall health",
            "Program health score = w1*schedule_score + w2*cost_score + w3*risk_score + w4*issue_score + w5*progress_score.",
            "Fixed weights, fixed scoring map; final RAG by threshold bands.",
            "Program overall health RAG",
          ],
        ]}
      />

      <H3>Risk and Issue Severity Consolidation</H3>
      <Table
        headers={["Severity", "Risk weight", "Issue weight", "Roll-up treatment"]}
        rows={[
          ["Critical", "10", "10", "Counts and weights summed directly at parent."],
          ["High", "6", "6", "Counts and weights summed directly at parent."],
          ["Medium", "3", "3", "Counts and weights summed directly at parent."],
          ["Low", "1", "1", "Counts and weights summed directly at parent."],
        ]}
      />

      <Divider />
      <H2>D) Program to Portfolio Roll-up</H2>
      <Table
        headers={["Roll-up area", "Logic", "Controls", "Output"]}
        rows={[
          [
            "Progress %",
            "Portfolio progress = weighted avg(Program progress %, program weight).",
            "Include direct projects (no program) as pseudo-program nodes.",
            "Portfolio progress %",
          ],
          [
            "Schedule RAG",
            "Portfolio SV% from program-level baseline vs forecast totals.",
            "Any strategic program in Red sets floor at Amber; two or more strategic Reds -> Red.",
            "Portfolio schedule RAG",
          ],
          [
            "Cost RAG",
            "Portfolio CV% from aggregated approved budgets vs aggregated forecasts/actuals.",
            "Budget overrun at portfolio level always Red if above red threshold regardless of child mix.",
            "Portfolio cost RAG",
          ],
          [
            "Risk/Issue",
            "Sum weighted severity counts and scores across programs.",
            "Dependency risks across programs included once using unique dependency key.",
            "Portfolio risk/issue heat",
          ],
          [
            "Overall health",
            "Weighted composite from schedule, cost, progress, risk, issue plus strategic-benefit realization component.",
            "Benefit realization can only improve health within fixed cap (cannot offset Red risk/cost).",
            "Portfolio overall health RAG",
          ],
        ]}
      />

      <Divider />
      <H2>E) Portfolio to Enterprise Roll-up</H2>
      <Table
        headers={["Roll-up area", "Logic", "Executive interpretation", "Output"]}
        rows={[
          [
            "Progress %",
            "Enterprise progress = weighted avg(Portfolio progress %, portfolio investment weight).",
            "Represents investment delivery progress.",
            "Enterprise progress %",
          ],
          [
            "Schedule and Cost RAG",
            "Aggregate SV% and CV% across all portfolios; map to enterprise thresholds.",
            "Shows delivery predictability and fiscal control posture.",
            "Enterprise schedule RAG, cost RAG",
          ],
          [
            "Risk and Issue posture",
            "Consolidate severity-weighted counts enterprise-wide with exposure score trend.",
            "Highlights concentration of critical threats.",
            "Enterprise risk/issue index",
          ],
          [
            "Overall enterprise health",
            "Enterprise health score from fixed weighted dimensions and policy gates.",
            "Used for board/executive dashboard and escalation routing.",
            "Enterprise overall RAG",
          ],
        ]}
      />

      <Divider />
      <H2>F) Missing or Late Data Handling (Mandatory Governance Rules)</H2>
      <Table
        headers={["Condition", "Rule", "Parent impact", "Why deterministic"]}
        rows={[
          [
            "Project missing status report for current period",
            "Project status = Unknown and stale_flag = true.",
            "Parent status cannot be Green if Unknown weight exceeds tolerance.",
            "Same cut-off + same tolerance always same result.",
          ],
          [
            "Project cost forecast not updated by SLA",
            "Reuse last approved forecast; apply stale penalty to cost confidence.",
            "Parent cost can degrade one band (Green->Amber, Amber->Red) when stale coverage threshold exceeded.",
            "Penalty and threshold values are fixed.",
          ],
          [
            "No progress actuals for open project",
            "Progress frozen at last valid value; project marked data_late.",
            "Parent progress coverage ratio decreases; low coverage blocks Green.",
            "Coverage math is deterministic.",
          ],
          [
            "Child entity closed",
            "Closed child excluded from forward-looking variance but included in realized actuals.",
            "Prevents distortion in active pipeline metrics.",
            "Inclusion/exclusion rule is explicit and fixed.",
          ],
          [
            "Conflicting duplicate import rows",
            "Resolve by strict precedence: latest approved import job > manual edit > previous import.",
            "Only one canonical value used in roll-up snapshot.",
            "Fixed precedence order.",
          ],
        ]}
      />

      <Divider />
      <H2>G) Overall Health Scoring Standard</H2>
      <Text>Use one scoring model across all levels to ensure comparability.</Text>
      <Table
        headers={["Dimension", "Normalized score range", "Default weight", "Notes"]}
        rows={[
          ["Schedule", "0..100", "25%", "Derived from SV% and schedule RAG band."],
          ["Cost", "0..100", "25%", "Derived from CV% and cost RAG band."],
          ["Progress performance", "0..100", "20%", "Compares actual progress vs planned trajectory."],
          ["Risk posture", "0..100", "15%", "Inverse of weighted risk exposure."],
          ["Issue posture", "0..100", "10%", "Inverse of weighted issue backlog and aging."],
          ["Data quality/completeness", "0..100", "5%", "Penalizes missing/late reporting."],
        ]}
      />
      <Table
        headers={["Final score", "RAG"]}
        rows={[
          [">= 80", "Green"],
          [">= 60 and < 80", "Amber"],
          ["< 60", "Red"],
        ]}
      />

      <Divider />
      <H2>H) Executive Dashboard Consolidation Outputs</H2>
      <Table
        headers={["Output metric", "Source", "Refresh rule", "Use"]}
        rows={[
          ["Progress roll-up by level", "RollupSnapshot", "Per reporting cut-off", "Delivery tracking"],
          ["Schedule and cost RAG by level", "Computed status facts", "Per reporting cut-off", "Control and escalation"],
          ["Top risks/issues by severity", "Risk/Issue aggregates", "Daily or per cut-off", "Executive focus list"],
          ["Data quality coverage", "Submission and stale flags", "Per cut-off", "Confidence indicator"],
          ["Trend views (period-over-period)", "Historical RollupSnapshot", "Periodic", "Trajectory and predictability"],
        ]}
      />

      <Callout tone="success" title="Result">
        This roll-up framework is deterministic, auditable, and dashboard-ready: identical inputs and cut-off timestamp always produce identical consolidated outputs across Project, Program, Portfolio, and Enterprise.
      </Callout>
    </Stack>
  );
}
