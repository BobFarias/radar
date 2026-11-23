# RADAR

A responsive web app that helps a relationship partner explore client opportunities, check the evidence behind them and prepare a review task. Structured AI responses (supplied as JSON fixtures in `data/`) decide which interface components appear. The app validates each block and renders it with a trusted component.

## Run

Requires Node 22+. No live LLM, API key, database or cloud service is needed.

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

## Dependencies

| Package | Used for |
|---|---|
| `next`, `react`, `react-dom` | App, routing and API route handlers |
| `ajv` | Runtime validation of every response block against `block_schema.json` |
| `recharts` | Bar chart block |
| `lucide-react` | Icons |
| `tailwindcss` | Styling |
| `vitest`, `@testing-library/*`, `jsdom` | Tests |

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
- Manual accessibility check (keyboard, semantics, contrast, reflow) and its fixes: [`docs/accessibility_check.md`](docs/accessibility_check.md).

## Assumptions

- **One user, no sign-in.** The user is the relationship partner. `permission_denied` is decided by the fixture: the API returns 403 with no protected content, so access is enforced on the server, not only in the UI.
- **Demo prompts only.** Each prompt maps to one fixture scenario. Free-text questions are not supported, and the UI says so.
- **Untrusted responses.** Every block is validated at runtime. Unknown or invalid blocks get a safe fallback and the response is marked as having problems, never as a success. Generated HTML or code is never rendered.
- **Newest request wins.** A response that arrives after a newer request is discarded, and the discard is shown to the user.
- **Retry** sends a new request for the same scenario. Partial results stay visible and are labelled incomplete. Retrying never loses a draft.
- **Chart ignores table filters.** The chart always shows every opportunity in the response, and its caption says so.
- **Review tasks** need `confirmed: true`, an existing client and opportunity, a subject of up to 200 characters and details of up to 5,000. Saving a task does not change the opportunity's stage.
- **Local history.** Saved analyses and briefings live in this browser's `localStorage`. They are not shared between browsers.

## Time spent

About 8 hours in total.

| Work | Time |
|---|---|
| UX exploration and Figma wireframes | ~50 min |
| Phase 1: architecture, APIs and validation | ~1 h |
| Phase 2.1: Agent and generative UI | ~1 h 30 min |
| Phase 2.2: Opportunities and history | ~1 h |
| Phase 2.3: Briefing and task workflow | ~1 h |
| Focused QA and browser checks | ~30 min |
| Documentation and presentation | ~2 h |

## AI and tool use

| Tool | Used for |
|---|---|
| Claude Code | Writing code and tests |
| Figma and Figma MCP | Wireframes, and a design reference for the code |
| ChatGPT | Refining prompts and documentation |

**How the output was checked:** manual walkthroughs in the browser, a code review of each phase's Git diff, and the automated test suite (`npm test`), type check and lint.

## Unfinished work

Out of scope for this submission:

- Onboarding materials.
- A facilitator script for onboarding sessions.
- Full manual run of the QA test-case matrix.
- Introduce Microsoft Entra ID authentication and API authorisation.
- Move filtering to the API to support larger datasets and server-side pagination.
- Deploy to Azure with managed persistence and secure document access.
- Implement monitoring, CI/CD and deployment rollback strategies.
- Known gaps from the accessibility check:
- The VoiceOver pass has not been run yet. The script is in [`docs/accessibility_check.md`](docs/accessibility_check.md).
- At 320 px the mobile tab bar cuts off "Briefing". It can still be reached by scrolling the bar sideways or with Tab.

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
docs/           Brief, API contract, block schema, requirements analysis, accessibility check
data/           Fixture data
```
