# QEGPMO Frontend

Enterprise frontend for QEGPMO built with React + TypeScript + MUI + Recharts, consuming REST APIs from NestJS backend.

## Features

- Tenant-aware login and auth context
- RBAC-protected routes and actions
- Executive consolidated dashboard with:
  - Project column KPI matrix
  - Roll-up cards (Enterprise, Portfolio, Program)
  - Overall health visualization
  - Excel export actions for dashboard and drill-down
- Project & delivery screens:
  - Filterable project list
  - Project detail with schedule/financial/risk summary and status history
- Clean loading and error states for API calls

## Tech Stack

- React + TypeScript
- Vite
- Material UI
- Recharts
- Axios
- React Router

## Run Locally

1. Ensure Node.js is installed and `npm` is available on PATH.
2. In this folder, install packages:

   ```bash
   npm install
   ```

3. Configure backend API base URL:
   - Copy `.env.example` to `.env`
   - Adjust value if needed:

   ```env
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. Start frontend dev server:

   ```bash
   npm run dev
   ```

5. Open browser at:
   - `http://localhost:5173`

## Expected Backend Endpoints

- `POST /auth/login`
- `GET /dashboard/consolidated`
- `GET /projects`
- `GET /projects/:projectId`
- `POST /exports/dashboard-summary`
- `POST /exports/dashboard-drilldown`

The frontend sends tenant context in header: `x-tenant-id`.

## Notes

- UI does not recalculate KPI/roll-up metrics; all metrics are rendered directly from backend responses.
- Mock login is included for local role testing (`Executive`, `PMO`, `Project Manager`) when backend auth is not available.
