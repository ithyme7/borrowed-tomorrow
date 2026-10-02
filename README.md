# Borrowed Tomorrow

A fictional time-travelling lending library, built with Astro and a public Sanity catalogue. AI-assisted source and fictional objects, eras and borrowers; begun on 2 October 2026. This is a technical demo with local borrowing rehearsals, not an operating lending service or a paid product.

## What works

Six objects and five eras; era filters; restoration and date checks; overlapping approved-loan checks; useful alternatives; proposed/approved/rejected history; approval rechecks against current state. Loans occupy `[startDate, endDate)`: collection included, return day excluded. Proposed and rejected loans do not hold inventory.

The frontend reads anonymous **published** Sanity data once on page load from project `v9cykwdr`, public dataset `production`. Seventeen fictional documents were imported and read back on 2 October 2026: five eras, six artifacts and six reservations. The loaded snapshot is validated before replacing the working catalogue. Controls remain disabled during the initial load. Read errors retain a visible error and explicitly labelled fixture fallback. Reload to see later published content.

**All proposals and approvals below the catalogue remain in this tab and disappear on reload. They do not write to Sanity.** There is no public cloud-write endpoint, browser write token, account system, payment integration, multi-user transaction boundary or automatic cloud approval. Studio checks are editorial validation; they do not enforce atomic authorization or prevent concurrent API approvals. A real booking service would need authenticated server validation and concurrency-safe transactions.

## Local frontend

Use Node 22.12 or newer (the prepared Pages workflow uses Node 24).

```sh
npm ci
npm test
npm run build
npm run preview
```

The packaged config targets the planned project site and uses base `/borrowed-tomorrow`. Local preview therefore opens at `http://localhost:3333/borrowed-tomorrow/`. For a connected local build, copy `.env.example` to an ignored `.env` before building. These two identifiers are public, never credentials. With no configured project the catalogue remains an explicit local fixture. A configured public query still needs the actual project's browser CORS policy to permit the current origin.

The original local frontend at `http://localhost:3333` was checked against real published Sanity data. The domain and catalogue validation suite passed 28 tests, the original Astro build passed, and the original Studio TypeScript check passed. Those results describe the source before this publication preparation. The separate preparation report records any build checks actually completed for this packaged Pages configuration; do not treat a prepared workflow as a successful deployment.

## Schema and fixtures

`src/domain/` contains a pure lending rules engine and fictional fixture. `sanity/` contains schema, a published GROQ query and the fixture exporter. See `sanity/SETUP.txt`. The initial import is already complete; the exporter is for inspection/reproduction, not an instruction to overwrite published documents. No provisioning material is included.

## Planned public demo

Proposed repository: `https://github.com/ithyme7/borrowed-tomorrow`.
Proposed demo: `https://ithyme7.github.io/borrowed-tomorrow/`.
These are planned locations, not evidence that either has been created. See `PUBLISHING.md` for the owner-controlled steps. The workflow is **manual only** and contains public identifiers rather than repository secrets. This local preparation creates no repository, deployment or challenge entry.

No project LICENSE has been selected or added. Owner review must resolve source publication and any desired license separately; public visibility does not itself select an open-source license. Dependency license metadata in the lockfiles remains separate. This source package makes no exclusive copyright claim.

There is no earned prize or revenue claim. Publication is promotion of a technical demo, not income.
