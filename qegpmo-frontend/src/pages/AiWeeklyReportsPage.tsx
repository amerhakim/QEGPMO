import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from "@mui/material";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import { ErrorState } from "../components/ErrorState";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "../context/AuthContext";
import type { AiWeeklyReport, AiWeeklyReportVersion, ProjectSummary } from "../types";

export const AiWeeklyReportsPage = () => {
  const { user } = useAuth();
  const [reports, setReports] = useState<AiWeeklyReport[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [versions, setVersions] = useState<AiWeeklyReportVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");

  const selectedReport = useMemo(
    () => reports.find((r) => r.reportId === selectedReportId) ?? null,
    [reports, selectedReportId]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reportsRes, projectsRes] = await Promise.all([
        apiClient.get<AiWeeklyReport[]>(endpoints.aiWeeklyReports),
        apiClient.get<ProjectSummary[]>(endpoints.projects)
      ]);
      const reportRows = reportsRes.data ?? [];
      setReports(reportRows);
      setProjects(projectsRes.data ?? []);
      const targetId = selectedReportId || reportRows[0]?.reportId || "";
      setSelectedReportId(targetId);
      const selected = reportRows.find((r) => r.reportId === targetId);
      setDraftContent(selected?.content ?? "");
      if (targetId) {
        const versionsRes = await apiClient.get<AiWeeklyReportVersion[]>(endpoints.aiWeeklyReportVersions(targetId));
        setVersions(versionsRes.data ?? []);
      } else {
        setVersions([]);
      }
    } catch {
      setError("Unable to load AI weekly reports.");
    } finally {
      setLoading(false);
    }
  }, [selectedReportId]);

  useEffect(() => {
    load();
  }, [load]);

  const generateReport = async () => {
    setActionError(null);
    try {
      await apiClient.post(endpoints.aiWeeklyReportGenerate, {
        tenantId: user?.tenantId,
        projectId: projectId || undefined
      });
      await load();
    } catch {
      setActionError("Unable to trigger weekly report generation.");
    }
  };

  const saveDraft = async () => {
    if (!selectedReport) return;
    setActionError(null);
    try {
      await apiClient.patch(endpoints.aiWeeklyReportById(selectedReport.reportId), {
        content: draftContent
      });
      await load();
    } catch {
      setActionError("Unable to save report text.");
    }
  };

  const publishReport = async () => {
    if (!selectedReport) return;
    setActionError(null);
    try {
      await apiClient.post(endpoints.aiWeeklyReportPublish(selectedReport.reportId));
      await load();
    } catch {
      setActionError("Unable to publish report.");
    }
  };

  const exportReport = async (type: "excel" | "pdf" | "ppt") => {
    if (!selectedReport) return;
    setActionError(null);
    try {
      const endpoint =
        type === "excel"
          ? endpoints.aiWeeklyReportExportExcel(selectedReport.reportId)
          : type === "pdf"
            ? endpoints.aiWeeklyReportExportPdf(selectedReport.reportId)
            : endpoints.aiWeeklyReportExportPpt(selectedReport.reportId);
      await apiClient.post(endpoint);
    } catch {
      setActionError(`Unable to trigger ${type.toUpperCase()} export.`);
    }
  };

  if (loading) return <LoadingState message="Loading AI weekly reports..." />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <Stack spacing={2}>
      <Typography variant="h4" fontWeight={700}>
        AI Weekly Status Reports
      </Typography>
      {actionError ? <Alert severity="error">{actionError}</Alert> : null}
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField
              select
              label="Project Scope"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="">All Projects</MenuItem>
              {projects.map((project) => (
                <MenuItem key={project.projectId} value={project.projectId}>
                  {project.projectCode} - {project.name}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="contained" onClick={generateReport}>
              Generate Weekly Report
            </Button>
            <Button variant="outlined" onClick={load}>
              Refresh
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6">Reports</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Period</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Generated At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => (
                <TableRow
                  key={report.reportId}
                  hover
                  selected={report.reportId === selectedReportId}
                  sx={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedReportId(report.reportId);
                    setDraftContent(report.content);
                  }}
                >
                  <TableCell>{report.title}</TableCell>
                  <TableCell>{report.periodStart} - {report.periodEnd}</TableCell>
                  <TableCell>{report.status}</TableCell>
                  <TableCell>{report.generatedAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedReport ? (
        <Card>
          <CardContent>
            <Typography variant="h6">Editable Report View</Typography>
            <Divider sx={{ my: 1.5 }} />
            <Stack spacing={1.5}>
              <TextField
                multiline
                minRows={10}
                label="Report Text"
                value={draftContent}
                onChange={(e) => setDraftContent(e.target.value)}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" onClick={saveDraft}>
                  Save Draft
                </Button>
                <Button variant="outlined" color="success" onClick={publishReport}>
                  Publish
                </Button>
                <Button variant="outlined" onClick={() => exportReport("excel")}>
                  Export Excel
                </Button>
                <Button variant="outlined" onClick={() => exportReport("pdf")}>
                  Export PDF
                </Button>
                <Button variant="outlined" onClick={() => exportReport("ppt")}>
                  Export PPT
                </Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent>
          <Typography variant="h6">Version History</Typography>
          <Divider sx={{ my: 1.5 }} />
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Version</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created At</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.versionId}>
                  <TableCell>v{version.versionNumber}</TableCell>
                  <TableCell>{version.createdBy}</TableCell>
                  <TableCell>{version.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Stack>
  );
};
