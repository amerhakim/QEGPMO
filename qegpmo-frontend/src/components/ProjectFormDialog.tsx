import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField
} from "@mui/material";
import { apiClient } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { ApiValidationError, ProjectFormPayload, ProjectSummary } from "../types";

interface ProjectFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialProject?: ProjectSummary;
  onClose: () => void;
  onSaved: () => void;
}

const defaultPayload: ProjectFormPayload = {
  projectCode: "",
  name: "",
  description: "",
  projectType: "DELIVERY",
  priority: "MEDIUM",
  lifecyclePhase: "INITIATION",
  programId: "",
  portfolioId: "",
  sponsorId: "",
  managerId: "",
  baselineStart: "",
  baselineEnd: "",
  plannedBudget: 0
};

export const ProjectFormDialog = ({ open, mode, initialProject, onClose, onSaved }: ProjectFormDialogProps) => {
  const [payload, setPayload] = useState<ProjectFormPayload>(defaultPayload);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (mode === "edit" && initialProject) {
      setPayload({
        projectCode: initialProject.projectCode,
        name: initialProject.name,
        description: initialProject.description ?? "",
        projectType: initialProject.projectType ?? "DELIVERY",
        priority: initialProject.priority ?? "MEDIUM",
        lifecyclePhase: initialProject.lifecyclePhase ?? "INITIATION",
        programId: initialProject.programId ?? "",
        portfolioId: initialProject.portfolioId ?? "",
        sponsorId: initialProject.sponsorId ?? "",
        managerId: initialProject.managerId ?? "",
        baselineStart: initialProject.baselineStart ?? "",
        baselineEnd: initialProject.baselineEnd ?? "",
        plannedBudget: initialProject.plannedBudget ?? 0
      });
    } else {
      setPayload(defaultPayload);
    }
    setFormError(null);
    setFieldErrors({});
  }, [mode, initialProject, open]);

  const title = useMemo(() => (mode === "create" ? "Create Project" : "Edit Project"), [mode]);

  const setValue = <K extends keyof ProjectFormPayload>(key: K, value: ProjectFormPayload[K]) => {
    setPayload((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setIsSaving(true);
    setFormError(null);
    setFieldErrors({});
    try {
      if (mode === "create") {
        await apiClient.post(endpoints.projects, payload);
      } else if (initialProject?.projectId) {
        await apiClient.patch(endpoints.projectById(initialProject.projectId), payload);
      }
      onSaved();
      onClose();
    } catch (error: unknown) {
      const maybeApi = error as { response?: { data?: { message?: string; errors?: ApiValidationError[] } } };
      const apiMessage = maybeApi.response?.data?.message ?? "Project save failed.";
      const apiErrors = maybeApi.response?.data?.errors ?? [];
      const nextFieldErrors: Record<string, string> = {};
      apiErrors.forEach((item) => {
        nextFieldErrors[item.field] = item.message;
      });
      setFieldErrors(nextFieldErrors);
      setFormError(apiMessage);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {formError ? <Alert severity="error">{formError}</Alert> : null}
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Project Code"
                value={payload.projectCode}
                onChange={(e) => setValue("projectCode", e.target.value)}
                fullWidth
                error={Boolean(fieldErrors.projectCode)}
                helperText={fieldErrors.projectCode}
              />
            </Grid>
            <Grid item xs={12} md={8}>
              <TextField
                label="Project Name"
                value={payload.name}
                onChange={(e) => setValue("name", e.target.value)}
                fullWidth
                error={Boolean(fieldErrors.name)}
                helperText={fieldErrors.name}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Description"
                value={payload.description}
                onChange={(e) => setValue("description", e.target.value)}
                fullWidth
                multiline
                minRows={2}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField select label="Project Type" value={payload.projectType} onChange={(e) => setValue("projectType", e.target.value)} fullWidth>
                <MenuItem value="DELIVERY">Delivery</MenuItem>
                <MenuItem value="TRANSFORMATION">Transformation</MenuItem>
                <MenuItem value="COMPLIANCE">Compliance</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField select label="Priority" value={payload.priority} onChange={(e) => setValue("priority", e.target.value as ProjectFormPayload["priority"])} fullWidth>
                <MenuItem value="LOW">Low</MenuItem>
                <MenuItem value="MEDIUM">Medium</MenuItem>
                <MenuItem value="HIGH">High</MenuItem>
                <MenuItem value="CRITICAL">Critical</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Lifecycle Phase"
                value={payload.lifecyclePhase}
                onChange={(e) => setValue("lifecyclePhase", e.target.value)}
                fullWidth
                error={Boolean(fieldErrors.lifecyclePhase)}
                helperText={fieldErrors.lifecyclePhase}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Portfolio ID" value={payload.portfolioId} onChange={(e) => setValue("portfolioId", e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Program ID" value={payload.programId} onChange={(e) => setValue("programId", e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Manager ID" value={payload.managerId} onChange={(e) => setValue("managerId", e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField label="Sponsor ID" value={payload.sponsorId} onChange={(e) => setValue("sponsorId", e.target.value)} fullWidth />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                type="date"
                label="Baseline Start"
                value={payload.baselineStart}
                onChange={(e) => setValue("baselineStart", e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                type="date"
                label="Baseline End"
                value={payload.baselineEnd}
                onChange={(e) => setValue("baselineEnd", e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                type="number"
                label="Planned Budget"
                value={payload.plannedBudget}
                onChange={(e) => setValue("plannedBudget", Number(e.target.value))}
                fullWidth
                error={Boolean(fieldErrors.plannedBudget)}
                helperText={fieldErrors.plannedBudget}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button variant="contained" onClick={save} disabled={isSaving}>
          {mode === "create" ? "Create Project" : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
