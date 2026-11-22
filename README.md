# RADAR

A responsive web app that helps a relationship partner explore client opportunities, check the evidence behind them and prepare a review task. Structured AI responses (supplied as JSON fixtures in `data/`) decide which interface components appear. The app validates each block and renders it with a trusted component.

## Run

Requires Node 22+.

```bash
npm install
npm run dev        # http://localhost:3000
```

| Command | Purpose |
|---|---|
| `npm test` | Unit, API and UI tests (Vitest) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run build && npm start` | Production build |

## Workspaces

- **Agent**: pick a demo prompt. Responses stream in as blocks (table, chart, evidence cards, review form).
- **Opportunities**: saved opportunity analyses (`OP00001`, …), with filters and pagination.
- **Briefing**: saved client briefings (`BR00001`, …) and the state of each one's review task.

The demo prompts cover the six scenarios: `overview`, `client_focus`, `partial_then_error`, `unsupported_block`, `malformed_block` and `permission_denied`.

## API

| Endpoint | Purpose |
|---|---|
| `POST /api/respond` | Returns the fixture response for a `scenario_id` |
| `GET /api/sources/:source_id` | Source record, or 404 |
| `POST /api/review-tasks` | Saves a confirmed task locally |

`POST /api/review-tasks` saves a task only when `confirmed` is `true`. It checks that the client and opportunity exist and is idempotent by `idempotency_key`:
- first save: **201**
- same key and same task: **200** replay with the same `task_id`
- same key, different task: **409**

Tasks are stored in `.data/review-tasks.json` (git-ignored). Set `RADAR_TASKS_FILE` to use a different file.

## Notes

- Nothing is sent externally: no email and no CRM.
- Saved analyses, briefings and unsaved review drafts live in the browser's `localStorage`. Review tasks are saved on the server.
- The review form needs explicit confirmation before saving. A double click or a retry never creates a duplicate.

## Structure

```
src/
  app/          Next.js routes and API handlers
  server/       Fixtures, sources and review-task storage
  contracts/    API, event and block types
  validation/   Validation for blocks, events and sources
  components/   UI primitives and block renderers
  state/        Response streaming, history, workspace and drafts
  views/        Agent, Opportunities and Briefing pages
docs/           Brief, API contract, block schema, requirements analysis
data/           Fixture data
```
