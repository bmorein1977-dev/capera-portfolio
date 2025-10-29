# Training Management & Booking – Replit Scaffold

This is a minimal scaffold for your Training Management & Booking module with AI suggestions.

- **server/** – Node + Express + Postgres (pg)
- **client/** – React + Vite minimal UI
- **schema.sql** – Postgres DDL for core entities
- **Seed script** – demo data
- **AI endpoints** – rule-based policy-aware recommendations

## Quick Start (Replit)

**Server**:
1) Set `DATABASE_URL` in environment.  
2) Run:
```bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

**Client**:
```bash
npm install
npm run dev
```

Set `VITE_API_BASE` in `client/.env` if needed (defaults to `http://localhost:4000`).

