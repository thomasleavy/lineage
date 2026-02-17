# LINEAGE

This is a prototype for an internal garment archive and lookbook that would be for a fashion design house. With this app, the user can track garments, versions, lookbooks and notes in one place. This is very useful for ateliers and creative teams who might need a single source of truth and auditable history when they are designing clothes, shoes, etc.

**Tech:** Next.js (App Router), React, TypeScript, tRPC, Prisma, Postgres, S3-compatible storage (MinIO/Supabase/R2), React for PDF generating. I also used session-based auth (httpOnly cookies, Argon2), RBAC enforced server-side, immutable versioning (every edit would creates a new version), hash-chained audit log for tracking changes made by various users, Postgres features, rate-limited PDF export (sync + async via pg-boss), and CI (GitHub Actions) with unit, integration and Playwright E2E tests. 
I didn't understand absolutely everything, but was comfortable and assured of the app's potential and each piece's relevance to the project.

---

## How to run

**You need:** Node, Docker (Postgres + optional MinIO).

```bash
git clone <repo> && cd lineage && npm install
docker compose up -d
cp .env.example .env   # (MAKE SURE YOU set DATABASE_URL, SESSION_SECRET (no less than 32 chars)
npm run db:push && npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000); and you’ll then be redirected to login. Seed user: **director@lineage.demo** / **director-secure**. For async PDF export, run `npm run job:worker` in another terminal.

---

## What I’d improve

- **Visual design:** Optional dark/light theme toggle, and a more polished lookbook preview.
- **User experience:** Drag-and-drop reordering for lookbook items, image cropping or annotations, and clearer empty states when there's no data yet.
- **Features:** Bulk actions (for example, being able to archive several garments at once), saved filters or views, and optional sharing links for specific looks or garments.
- **Onboarding:** A short guided tour or tooltips for first-time users so new team members can get up to speed quickly.
