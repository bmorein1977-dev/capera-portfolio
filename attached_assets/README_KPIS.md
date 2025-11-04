# Assessor KPIs — Expired / Expiring / OK / Not Started

## SQL
Run `501_assessor_elements_kpis.sql` to create a KPI query (CTE-based). It calculates:
- `expired`: `valid_until < now()`
- `expiring_90`: `now() <= valid_until <= now() + 90 days`
- `ok`: `valid_until > now() + 90 days`
- `not_started`: no assessment yet (null `valid_until`)

## Routes
Add to `server/routes.ts`:
```ts
import { getAssessorKpis } from './routes.assessorKpis.patch'
app.get('/assessors/:id/kpis', getAssessorKpis)
```

## Client
Use `client.useAssessorKpis.patch.ts` in your Assessor Dashboard:
```ts
const { data, loading } = useAssessorKpis(currentAssessorId)
if (!loading && data) {
  // render counters: data.expired, data.expiring_90, data.ok, data.not_started
}
```

This KPIs endpoint respects the same logic as your “My Assessments” view (current elements only, latest assessment per element).
