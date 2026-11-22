# Independent Requirements Analysis: Generative Interface for Client Opportunities

**Scope of this document:** this is a requirements review only. It contains no solution design, screens, navigation structures, libraries or architecture.

**Sources reviewed:** `Product_Engineer_Candidate_Brief.docx`, `README.txt`, `API_Contract.txt`, `block_schema.json`, `data/clients.json`, `data/opportunities.json`, `data/sources.json`, `data/response_fixtures.json`.

**Labels used throughout**

- **[E]** means the documents state it directly.
- **[I]** means it is my interpretation.
- **[A]** marks an ambiguity, contradiction or gap that needs clarification.

> **Note on sources:** `docs/produc_engineer_brief.txt` is a shortened copy of the brief. It stops after "A live model is optional." Only the `.docx` contains the sections *Handle real application states*, *Explain Azure delivery*, *What to submit* and *What we assess*. This analysis treats the `.docx` as authoritative.

---

## 1. Product Understanding

### What is the product supposed to do?

- **[E]** It is "a responsive application that helps a relationship partner explore client opportunities, examine the supporting evidence and prepare a review task" (Brief, intro).
- **[E]** "Structured AI responses should determine which interface components appear and how users can act on them" (Brief, intro).
- **[I]** The AI returns neither prose nor code. It returns a typed list of UI blocks, and the application renders them as interactive components that it controls.
- **[E]** The fixtures stand in for an LLM: "The supplied JSON fixtures replace an LLM for this assessment" (README).

### What business problem is it solving?

- **[I]** An advisory partner has to keep up with outside developments, decide which ones matter to which client, and turn the relevant ones into conversations with that client. The developments in the data are consultations, industry reviews and grid bulletins (`sources.json`).
- **[E]** The client record states this need: "Partner wants opportunities tied to the client's actual activities" (`clients.json` → `CL001.relationship_notes`).
- **[I]** The main risk is overstating weak, uncertain or outdated evidence. The data keeps flagging uncertainty:
  - "Consultation proposal; no mandatory implementation date" (O001)
  - "relevance needs partner confirmation" (O002)
  - "verify current project status" (O003)
  - "this is not yet a rule in force" (evidence card for SRC001)
  - SRC004, an older source that conflicts with a newer one

### What value does it provide?

- **[I]** It turns scattered source material into a set of client opportunities ranked by priority. Each claim can be traced back to a source the user can check.
- **[E]** The human stays in control:
  - the review form can be edited
  - saving requires explicit confirmation
  - nothing is sent externally ("Never send an email or write to an external CRM", API_Contract)

### What is the expected outcome for the user?

- **[E]** A locally saved review task with a `task_id`. It is created only after explicit confirmation and never duplicated (API_Contract, `POST /api/review-tasks`).
- **[I]** Along the way, the user should understand which opportunities matter, why they matter, and how reliable the supporting evidence is.

---

## 2. Target Users and Context

| Aspect | Stated by the documents **[E]** | Interpretation or assumption **[I]** |
|---|---|---|
| Primary user | "a relationship partner" (Brief, intro) | A senior professional at an advisory or legal firm. The brief says "No legal knowledge… is required", and the sources are regulatory. |
| Role and context | Owns client relationships. `relationship_notes` says "Existing advisory relationship" for CL001 and "Exploring grid access and project development advice" for CL002. | Short on time and accountable for the advice given. Values accuracy over volume. |
| Goal | Explore opportunities, examine evidence, prepare a review task (Brief) | Decide what to raise with which client, and record a follow-up action. |
| Information needed | Opportunity fields: priority, stage, status_note, source_ids (table schema). Source fields: title, source_name, published_date, content (`sources.json`). Evidence fields: excerpt and interpretation (evidence cards). | The source's date and legal status (proposal vs rule in force), and its fit with the client's `activities` and `markets`. |
| Devices and abilities | "usable on desktop and mobile, including keyboard navigation" (Brief) | Probably used both at a desk and on the move. |

### Secondary users

- **[E]** No secondary user of the application is named.
- **[A]** The response content refers to the relationship partner in the third person:
  - review form body: "Confirm the current scope with the relationship partner"
  - SRC002 interpretation: "Explore payment data arrangements with the relationship partner"

  This implies that the person preparing the briefing may not be the partner, for example an associate preparing work for the partner. It conflicts with the brief, which names the partner as the user.
- **[E]** Some actors are implied but not defined. The 403 scenario ("Your account does not have access to this information") and the required note on Entra ID and API authorisation imply authenticated users with different permissions. No roles, users or permission rules are supplied.
- **[I]** The assessors are effectively a second audience. The demo has to show all six scenarios, a repeated save and out-of-order requests (Brief, *What to submit*).

### User behaviour

The documents do not describe how often partners use the tool, how deeply they read the evidence, or what their workflow looks like. Any claim of that kind would be an assumption.

---

## 3. User Journeys

The brief names exactly two journeys (Brief, *Build two user journeys*). Several other required flows run across both of them; they are listed in 3.4.

### 3.1 Journey A: Explore opportunities **[E]**

> "submit or select the overview prompt, render its table and chart, filter or select an opportunity, and open the supporting source."

| Element | Detail |
|---|---|
| Starting point | **[A]** Not specified. It could be an empty session or a session where a previous response is still on screen. |
| Trigger | The user submits or selects the prompt "Show the current client opportunities and their priority." (`overview.prompt`) |
| Step 1 | A request is made: `POST /api/respond` with `{"scenario_id": "overview", "request_id": "<unique>"}` (API_Contract). |
| Step 2 | Progress is shown as events arrive. The status event reads "Preparing opportunity overview" (Brief: "Show progress as response events arrive"). |
| Step 3 | The `overview-table` block renders "Client opportunities": three rows (O001–O003) with client, title, priority, stage, status note and source IDs. |
| Step 4 | The `overview-chart` block renders "Opportunities by priority": x = Priority, y = Number of opportunities, High = 2, Medium = 1. |
| Step 5 | The completion event reads "Three opportunities available for review." |
| Step 6 | The user filters or selects an opportunity. **[A]** The filter dimensions are not defined; client, priority and stage are all candidates. It is also not stated whether the chart should change when the table is filtered. |
| Step 7 | The user opens the supporting source, for example SRC001, through `GET /api/sources/:source_id`. The response is the source record (title, source_name, published_date, content) or "a clear not-found response". |
| Information presented | Opportunity attributes, the priority distribution, and the source record. |
| Decisions | Which opportunity deserves attention, and whether the evidence behind it is credible and current. |
| Interaction | Selecting or submitting a prompt, filtering or selecting rows, and following source links. Keyboard and mobile use are required. |
| Success | **[I]** The user has identified an opportunity of interest and read the source behind it. |

### 3.2 Journey B: Prepare a briefing **[E]**

> "request the client-focused response and render the evidence cards and editable review form. Preserve relevant user selections between responses. Require explicit confirmation before saving a local task and prevent duplicate saves."

| Element | Detail |
|---|---|
| Starting point | **[I]** Usually after Journey A, but the brief does not require this. **[A]** Not specified. |
| Trigger | "Focus on Asteria Payments and help me prepare a partner briefing." (`client_focus.prompt`) |
| Step 1 | Progress is shown. The status event reads "Gathering evidence for Asteria Payments". |
| Step 2 | The `client-evidence` block renders "Evidence for Asteria Payments" with two cards (SRC001, SRC002). Each card has an excerpt and an interpretation. |
| Step 3 | The `client-review` block renders "Prepare a review task", prefilled with client CL001, opportunity O001, subject "Payment resilience consultation" and a draft body. The form is editable **[E]**. |
| Step 4 | The completion event reads "Briefing prepared. Review and edit before saving a local task." The message itself tells the user to review before saving. |
| Step 5 | The user reviews and edits the subject and body. **[I]** The user may also check the sources linked from the evidence cards ("clear source links", Brief). |
| Step 6 | The user gives explicit confirmation. The API requires `"confirmed": true` (API_Contract). |
| Step 7 | The task is saved: `POST /api/review-tasks` with client_id, opportunity_id, subject, body, confirmed and idempotency_key. The response returns a `task_id`. |
| Step 8 | A repeated save with the same key must not create a duplicate. The demo has to show this ("including a repeated save", Brief). |
| Information presented | Excerpts from sources, AI interpretations, the draft task, and a confirmation state. |
| Decisions | Whether the interpretation is sound, how to edit the draft, and whether to commit the task. |
| Success | Exactly one task is stored, and the user receives a clear, accessible confirmation that includes the outcome (`task_id`). |

### 3.3 How the journeys relate

- **[E]** "Preserve relevant user selections between responses" is the only stated link between the two journeys.
- **[A]** "Relevant" is not defined. Candidates include the selected client or opportunity, active filters, review form edits and the chosen scenario.
- **[A]** There is a tension between the user's selection and the fixture. `client_focus` is fixed to CL001/O001. A user who selected O002, or O003 (which belongs to a different client), in Journey A still receives a form for O001. The documents do not say whether the user's selection should override the fixture, be shown next to it, or be flagged as a mismatch.
- **[I]** Journey A leads naturally into Journey B: find an opportunity, then brief on it.

### 3.4 Required flows across both journeys **[E]**

- **Scenario selection:** "Use a visible demo scenario selector" (API_Contract) or "prompt suggestions" (Brief).
- **Retry:** "provide retry without losing user work" (Brief).
- **Stale responses:** "Prevent an earlier response from overwriting a later request. Demonstrate this with two delayed requests" (Brief).
- **Fallback, error and permission handling:** covered in section 6.

The assessment does not require a particular page structure or navigation pattern.

---

## 4. Data and Business Entities

### 4.1 Entities and relationships

```
Client (CL001 Asteria Payments, CL002 Northstar Renewables)
  └─< Opportunity (O001, O002 → CL001; O003 → CL002)
        └─>< Source via source_ids[] (O001→SRC001, O002→SRC002, O003→SRC003)
                                       SRC004 — not referenced anywhere

Response scenario (6, keyed by scenario_id)
  └─< Event (kind: status | block | complete | error)
        └─ Block (opportunity_table | bar_chart | evidence_cards | review_form | invalid/unknown)

Evidence card item ──source_id──> Source
Review form block ──client_id, opportunity_id──> Client, Opportunity
Review task (created) ──client_id, opportunity_id──> Client, Opportunity
```

| Entity | File | Shape | Key fields |
|---|---|---|---|
| Client | `clients.json` | Object keyed by ID | client_id, name, sector, activities[], markets[], relationship_notes |
| Opportunity | `opportunities.json` | Array | opportunity_id, client_id, client_name (copied from the client), title, priority (High/Medium/Low), stage (New/Reviewing/Reviewed), source_ids[], status_note |
| Source | `sources.json` | Object keyed by ID | source_id, title, source_name, published_date, content |
| Response scenario | `response_fixtures.json` | Object keyed by scenario_id | prompt, http_status, run_id, events[] |
| Review task | None (created) | Defined by the API request | client_id, opportunity_id, subject, body, confirmed, idempotency_key, and a returned task_id |

### 4.2 Notable observations

- **SRC004 is a conflicting source that nothing references.**
  - It was published on 2026-08-20 and claims resilience testing "will become mandatory on 1 November 2026".
  - It says of itself: "This conflicts with the newer consultation, which describes a proposal" (SRC001, published 2026-09-28).
  - Combined with the README's fixed as-of date ("Use 1 October 2026"), this looks like a deliberate test of judgement about evidence recency and conflict **[I]**.
  - No requirement says it must be shown **[A]**. It can only be reached through `GET /api/sources/SRC004`.
- **The overview chart leaves out "Low".** The fixture has High = 2 and Medium = 1, and no Low opportunities exist. **[A]** It is unclear whether zero-count categories should be displayed.
- **No opportunity is at stage "Reviewed".** **[A]** It is unclear whether saving a task should move an opportunity's stage forward.
- **The fixture table rows match `opportunities.json` exactly.** **[A]** It is not stated whether responses should be returned unchanged or checked or enriched against the master data.
- **Client fit is built into the data:**
  - SRC001 concerns "UK merchant acquirers", which matches Asteria's activity "Merchant acquiring" and market "UK".
  - SRC002 concerns "payment processors operating in the EU", which matches "Online payment processing" and "EU".
- **`client_name` is stored on each opportunity** as well as on the client. **[I]** This copy could fall out of sync with the client record.
- **Source counts differ from the brief.** The brief lists "two client profiles, three opportunities, source material and six response scenarios". There are four sources.

### 4.3 Existing records vs created records

- **Existing and read-only [E/I]:** clients, opportunities, sources and response fixtures.
- **Created by the application [E]:** review tasks only. "Persist local tasks and return a task_id… Local file or SQLite storage is sufficient" (API_Contract).

### 4.4 What must be preserved between interactions

- **[E]** "relevant user selections between responses" (Brief).
- **[E]** "user work" during a retry (Brief). **[I]** This at least includes edits to the review form.
- **[E]** Request and run identity, so that a newer request is not overwritten (API_Contract).
- **[E]** Idempotency keys alongside persisted tasks, so that repeats are detected.

### 4.5 Persistence beyond review tasks

- **[E]** None is required. Only review tasks must be persisted.
- **[I]** Selections and edits only need to survive within a session, across responses and retries. Nothing requires them to survive a page reload.
- **[A]** Open questions:
  - Should saved tasks be listed or viewable?
  - Does saving a task change the opportunity stage?
  - Does editing the form after a successful save count as a new task (a new key) or as the same submission?

### 4.6 Review task validation

- **[E]** "Require explicit review confirmation and validate client/opportunity references" (API_Contract).
- **[I]** Validation should also check that the opportunity belongs to the client (O001 belongs to CL001). The contract only says to validate references.
- **[A]** No rules are given for subject or body (required? length limits?).

---

## 5. Structured AI Responses and Generative UI

### 5.1 What "Generative UI" means here

- **[E]** "The generative UI requirement is response-driven composition of typed components" (README).
- **[I]** The response decides which components appear, in what order and with what data. The application owns every component and decides which component may render each block type.
- **[E]** It does not mean generated markup or code: "Do not render or execute arbitrary generated HTML, JavaScript or component code" (API_Contract). "Never execute generated HTML, JavaScript or component code" (Brief).

### 5.2 How the fixtures work

- Each scenario is a canned "backend-generated response" to the prompt it states (API_Contract).
- `POST /api/respond` returns the fixture's `http_status`, `run_id` and `events` list.
- **[E]** "Simulate event arrival over time on client or server; a specific streaming transport is not required."
- **[E]** The scenarios must be reachable through "a visible demo scenario selector" or prompt suggestions.

### 5.3 Events vs blocks

Events describe the response lifecycle. Blocks are the renderable content carried inside some of those events.

| Event `kind` | Meaning | Payload |
|---|---|---|
| `status` | A progress update | `message` |
| `block` | A component to render | `block` |
| `complete` | The stream ended normally | `message` |
| `error` | The stream ended in failure | `code`, `message`, `retryable` |

- **[A]** No schema for the event envelope is supplied. `block_schema.json` covers blocks only, so the documents don't say how to handle unknown event kinds or malformed envelopes.
- **[I]** A `complete` event does not mean the response succeeded. `unsupported_block` and `malformed_block` both end with `complete` even though their only block is unusable. The brief says "Do not present invalid responses as successful results."
- **[I]** The HTTP status does not mean success either. `partial_then_error` returns 200 but ends in an error event.

### 5.4 Block types (`block_schema.json`, a `oneOf` with four branches)

| Type | Represents | Required fields | Constraints |
|---|---|---|---|
| `opportunity_table` | A list of opportunities | id, title, rows[] | Each row needs 8 fields. `priority` must be High, Medium or Low. `stage` must be New, Reviewing or Reviewed. |
| `bar_chart` | Aggregate counts | id, title, x_label, y_label, series[] | Each series item is {label: string, value: number ≥ 0}. |
| `evidence_cards` | Claims backed by sources | id, title, items[] | Each item is {source_id, excerpt, interpretation}. |
| `review_form` | A draft task to edit | id, title, client_id, opportunity_id, subject, body | All fields are strings. |

- **[E]** "At least the table, chart and evidence components must work; the review form provides the confirmation journey" (README).
- Schema details worth noticing:
  - Each top-level block sets `additionalProperties: false`, and so do chart series items and evidence items. **Table rows do not**, so rows may carry extra fields.
  - No array has `minItems`, so empty tables, charts and evidence lists are schema-valid. This links to "empty or missing data" (Brief).
  - IDs are plain strings. The schema does not check that they refer to real records.
- **[E]** The brief says block_schema.json contains "deliberately invalid fixtures". In fact the invalid examples are in `response_fixtures.json` (see section 10).

### 5.5 Component registry

- **[E]** "Use a typed component registry so response structure drives the interface" (Brief).
- **[I]** The registry should:
  - be a single, closed mapping from block `type` to a trusted component, so only registered types can render
  - keep components reusable and independent of where a response places them
  - provide one place where validation and fallback are enforced
  - allow new block types to be added without changing the code that orchestrates responses

### 5.6 Runtime validation and the JSON Schema

- **[E]** "Treat JSON as untrusted input at the render boundary" (API_Contract). "Validate incoming blocks and provide a useful fallback for unsupported or invalid types" (Brief).
- **[I]** Compile-time TypeScript types do not protect against bad data at runtime. Each block must be checked against the contract in `block_schema.json` when it arrives, before any component receives it.
  - A valid block goes to its registered component, already narrowed to its type.
  - An invalid or unknown block gets a safe fallback for that block alone. Other valid blocks in the same response keep rendering.
- **[A]** The documents don't say whether to use the supplied JSON Schema directly or reproduce it in an equivalent form. Either way, "Focused automated checks for block validation" are required (Brief).

---

## 6. Error Scenarios and Application Resilience

### 6.1 `overview`: happy path for exploration

| Aspect | Analysis |
|---|---|
| Simulates | A successful multi-block response: status → table → chart → complete (HTTP 200, `RUN-OVERVIEW`). |
| Expected display | Progress while events arrive, then the table and chart, then the completion message. The chart must be readable (Brief). |
| User reaction | Filter or select an opportunity, then open a source (Journey A). |
| State to preserve | The selection and filter, which are "relevant user selections" to carry into later responses. |
| Intended test | Composition of more than one block type from one response, progressive rendering, table and chart quality, and source linking. |

### 6.2 `client_focus`: happy path for briefing

| Aspect | Analysis |
|---|---|
| Simulates | A successful response with evidence cards and a review form (HTTP 200, `RUN-CLIENT`). |
| Expected display | Progress, two evidence cards that can link to their sources, a prefilled editable form, and a completion message that asks the user to review before saving. |
| User reaction | Read the evidence, edit the draft, confirm explicitly, save, and attempt a repeated save. |
| State to preserve | Form edits, earlier selections, and the idempotency key for the submission. |
| Intended test | Interactive generated components, human-in-the-loop confirmation, idempotent persistence, and validation of references. |
| Ambiguity | **[A]** The form is fixed to CL001/O001, which may conflict with an earlier selection (see 3.3). |

### 6.3 `partial_then_error`: partial result, then upstream failure

| Aspect | Analysis |
|---|---|
| Simulates | A stream that fails partway. Status → a one-row table ("Available opportunity data", O001 only) → error `upstream_timeout`: "The response ended before all evidence was available." `retryable: true`. **The HTTP status is 200.** |
| Expected display | **[E]** "Keep partial results visibly incomplete when an upstream error occurs." The single row must not look like a complete dataset. The error and its message must be shown. |
| User reaction | **[E]** Retry, because the error is retryable. **[I]** Or carry on working with what was received, understanding that it is incomplete. |
| State to preserve | **[E]** "provide retry without losing user work". This covers selections, filters and any form edits made before the failure. |
| Intended test | Telling transport success (200) apart from logical failure, honest handling of partial state, retry behaviour, and keeping state. |
| Ambiguity | **[A]** The fixture is deterministic, so a retry gives the same error again. Nothing says whether retry should ever succeed, for example by falling back to `overview`. **[A]** Nothing says whether the partial result should replace or sit alongside an earlier complete overview. |

### 6.4 `unsupported_block`: unknown component and injection attempt

| Aspect | Analysis |
|---|---|
| Simulates | A model asking for a component the application doesn't have (`type: "future_component"`), with a payload of `<script>window.__assessmentUnsafe = true</script>`, followed by `complete`. There is no status event. |
| Expected display | **[E]** "a useful fallback for unsupported or invalid types". The block must never be rendered as HTML or executed. **[I]** The fallback should say that a view was requested but is not available. |
| User reaction | **[I]** Understand that nothing went wrong in their own work and continue. Retrying won't help. |
| State to preserve | All earlier selections and work. One bad block must not wipe out the session. |
| Intended test | Registry closure, safety at the render boundary, and fallback quality. **[I]** There is an implicit check: `window.__assessmentUnsafe` must stay unset. |
| Note | The `complete` message ("An unsupported component was requested.") must not be presented as a successful result. |

### 6.5 `malformed_block`: known type, invalid data

| Aspect | Analysis |
|---|---|
| Simulates | A `bar_chart` whose series value is `"not-a-number"`, which breaks `value: number, minimum 0`. It is followed by `complete` ("Count response received."). |
| Expected display | **[E]** Validation fails and a fallback is shown. **[E]** "Do not present invalid responses as successful results." **[I]** The value must not be quietly converted to 0 or NaN, and an empty or broken chart must not be drawn. |
| User reaction | **[I]** See that the data could not be shown, and possibly retry or ask for the overview instead. |
| State to preserve | Earlier selections and work. |
| Intended test | Schema validation of known types, not just unknown ones, and refusing to show misleading output. |

### 6.6 `permission_denied`: authorisation failure

| Aspect | Analysis |
|---|---|
| Simulates | A request for restricted data ("Show restricted client financials."). HTTP 403, `forbidden`, "Your account does not have access to this information.", `retryable: false`. |
| Expected display | **[E]** A clear denial. **[E]** "Permission_denied returns 403 with no protected content." **[I]** Retry should not be offered. The message should not suggest that a retry will help. |
| User reaction | **[I]** Understand that access is denied rather than broken, and continue with other work. |
| State to preserve | Earlier selections and work. Nothing protected may appear. |
| Intended test | Enforcing access on the server rather than in the UI ("A UI check is not a substitute for enforcing access at a real application API") and handling a non-retryable error. |
| Ambiguity | **[A]** There is no user or role model, so the fixture decides the denial rather than a real policy. Real enforcement through Entra ID is to be described in the delivery note, not built. **[A]** No "financials" data exists. |

### 6.7 Stale-response requirement

- **[E]** "Keep run/request identity so an older response cannot overwrite a newer request" (API_Contract). "Prevent an earlier response from overwriting a later request. Demonstrate this with two delayed requests" (Brief). "A delay simulation is enough" (README).
- **[I] Identity:** `run_id` is fixed per fixture, so two `overview` requests both return `RUN-OVERVIEW`. Only the client-generated `request_id` tells the requests apart. The "latest request wins" rule therefore has to be based on request identity.
- **[I] What this means for the user:**
  - The screen must always match the user's most recent intent. A slow earlier response must not replace a newer result, including half-way through an event stream.
  - Selections and form edits must not be overwritten by a late response.
  - Progress indicators must belong to the active request only.
  - A discarded response should not cause visible flicker or misleading status messages.
- **[A]** Nothing says whether a superseded request should be cancelled or simply ignored, or whether the user should be told.

### 6.8 Other resilience requirements that no fixture covers

- **[E]** "empty or missing data". No fixture covers it. **[I]** It can appear through filters that match nothing, schema-valid empty arrays, or unknown source IDs.
- **[E]** The source endpoint must give "a clear not-found response". No fixture references a missing source.
- **[E]** Review task validation errors (bad references, missing confirmation) need clear handling.

---

## 7. Functional vs Non-Functional Requirements

### 7.1 Mandatory functionality

1. Journey A: select or submit the overview prompt, render the table and chart, filter or select an opportunity, open the source.
2. Journey B: request client_focus, render the evidence cards and editable review form, confirm explicitly, save, prevent duplicates.
3. A typed component registry in which the response structure drives the interface.
4. Table, chart and evidence components that work, plus the review form for the confirmation journey (README).
5. A visible scenario selector or prompt suggestions covering all six scenarios.
6. Progress shown as events arrive.
7. Preservation of relevant selections between responses.
8. Retry for retryable errors.

### 7.2 Usability and accessibility

- Responsive layouts that work on desktop and mobile (Brief).
- Keyboard navigation (Brief).
- Readable charts (Brief).
- Clear source links (Brief).
- Accessible loading, error and confirmation states (Brief).
- A brief manual accessibility check as part of the submission (Brief).

### 7.3 Reliability and error handling

- Partial results must look incomplete, and retry must not lose user work.
- Unsupported components, malformed chart data, empty or missing data, and 403 must each be handled clearly.
- Invalid responses must never be presented as successful.
- Older responses must never overwrite newer requests, demonstrated with two delayed requests.
- Event arrival over time must be simulated.

### 7.4 Security and data validation

- All response JSON is untrusted at the render boundary.
- Every incoming block is validated at runtime against the four allowed types.
- No generated HTML, JavaScript or component code is rendered or executed.
- 403 is returned with no protected content, and access is enforced at the API, not only in the UI.
- Client and opportunity references on review tasks are validated.
- Explicit confirmation (`confirmed: true`) is required on the server.
- Nothing is written externally: no email, no CRM.

### 7.5 API and persistence

- `POST /api/respond` returns the fixture's HTTP status, `run_id` and events, and keeps request identity.
- `GET /api/sources/:source_id` returns the source record or a clear not-found response.
- `POST /api/review-tasks` validates input, requires confirmation, is idempotent by key, persists locally (file or SQLite) and returns a `task_id`.
- The stack is React/Next.js with TypeScript (README).
- The app must run without a live LLM or any paid or cloud service.

### 7.6 Documentation and demonstration

- A runnable application.
- A short demo of both journeys and all six scenarios, including a repeated save and two requests arriving out of order.
- Focused automated checks: block validation plus one important interaction or API behaviour.
- A one-page Azure delivery note: deployment, Entra ID authentication and API authorisation, configuration and secrets, monitoring failures, rollback. It should be grounded in services the candidate has actually used.
- Five slides or a two-page summary of product and engineering decisions.
- A README with run instructions, dependencies, assumptions, actual time spent, material AI and tool use (with how outputs were verified), and unfinished work.

---

## 8. Product and UX Expectations

### 8.1 UI and UX judgement under evaluation

- **[E]** "Product experience and visual judgement" is the first assessment criterion. It sits alongside response-driven composition, full-stack delivery, resilience and accessibility, and maintainable code.
- **[I]** In practice this means:
  - presenting AI-composed content coherently even though its order and mix vary
  - making system states (loading, partial, error, fallback, denied, saved) clear and distinct
  - showing nuance and uncertainty honestly
  - designing a confirmation step with deliberate friction that doesn't get in the way

### 8.2 Information hierarchy challenges

- **Tabular and aggregate views:** the table and chart describe the same data at two levels. Their relationship, and whether filtering affects both, is not defined **[A]**.
- **Short labels vs nuance:** `priority` and `stage` are short labels, while `status_note` carries the important qualifications ("no mandatory implementation date", "needs partner confirmation"). The nuance must not be lost.
- **Excerpt vs interpretation:** each evidence card mixes quoted source text with AI interpretation. **[I]** The user has to be able to tell which is which.
- **Source metadata:** publisher and `published_date` matter for credibility, more so given the fixed as-of date and the conflicting SRC004.
- **Partial vs complete results:** a one-row table in `partial_then_error` has the same structure as a complete one. The incompleteness has to be made visible.
- **Many-to-many links:** an opportunity can have several `source_ids`. In the fixtures each has one, but the schema allows an array.
- **Errors at two levels:** an error that affects one block (a fallback) and an error that ends the whole response (an error event or 403) need different weight.

### 8.3 Interactions needing particular attention

1. Selecting or filtering opportunities, and keeping that selection across responses.
2. Opening a source from the table and from the evidence cards, including the not-found case.
3. Editing the review form while responses or retries are happening.
4. Explicit confirmation before saving.
5. Saving, a repeated save, and duplicate prevention, with clear feedback.
6. Retrying after a partial failure without losing work.
7. Starting a new request while an earlier one is still arriving (stale-response handling).
8. Using the scenario selector or prompt suggestions as the way into each response.
9. Keyboard and screen-reader access to all of the above, including announcements of dynamic status changes **[I]**.

### 8.4 Supporting trust in and verification of AI output

The documents point to the following trust signals. Each is backed by **[E]** requirements and data signals; the reading of them is **[I]**.

- **Traceability:** every claim links to a source ("clear source links"; `source_ids`; evidence `source_id`).
- **Source checking:** the user can compare an excerpt with the full source content. Each SRC excerpt does appear in the matching source content.
- **Recency and status:** published dates, the 1 October 2026 as-of date, and the distinction between proposal and rule ("not yet a rule in force"). SRC004 tests whether outdated, conflicting claims would be shown as fact.
- **Human control:** the draft can be edited, saving requires explicit confirmation, and nothing is sent externally.
- **Honest failure:** invalid output is never shown as success, partial output is marked as partial, and an unsupported view says so.
- **Labelling AI content:** **[I]** interpretation is the system's judgement, not the source's words. It should be identifiable as such.

### 8.5 Design decisions left open to the candidate

- Whether to use free-text prompt entry, prompt suggestions, a scenario selector, or a combination ("submit or select").
- Which dimensions to filter on, and how selection works.
- Whether the chart and table interact.
- How progress is shown as events arrive.
- How the source or evidence view is presented.
- The form and wording of fallbacks.
- How explicit confirmation is expressed.
- How "relevant user selections" are defined and preserved.
- Whether earlier responses accumulate or are replaced.
- What retry means for a deterministic fixture.
- Whether to show zero-count chart categories.
- How to handle the fixed CL001/O001 form when the user has selected something else.
- Whether to surface conflicting or older sources such as SRC004.
- What the user sees after a duplicate save attempt.

---

## 9. Scope and Constraints

### 9.1 Must be implemented

- A runnable TypeScript React/Next.js application with both journeys.
- The three API endpoints as specified, with local task persistence (file or SQLite).
- A typed component registry, runtime block validation and safe fallbacks.
- Handling for all six scenarios, plus empty or missing data and source not-found.
- Stale-response protection, demonstrated with two delayed requests.
- Responsive, keyboard-accessible and screen-reader-aware states.
- Automated checks for block validation and one interaction or API behaviour.
- A manual accessibility check, the Azure note, five slides or a two-page summary, the README and a demo.

### 9.2 Explicitly optional

- A live LLM: "has no scoring advantage and must not be required to run" (README).
- Existing component and chart libraries: "welcome" (README), "Use existing UI/chart libraries if helpful" (Brief).
- Where event arrival is simulated: "on client or server" (API_Contract).
- The streaming transport: "a specific streaming transport is not required".
- Storage: "Local file or SQLite storage is sufficient".

### 9.3 Explicitly out of scope

- Actual Azure deployment: "No actual Azure deployment… is required" (README). An actual cloud deployment is "outside this take-home scope" (Brief).
- Production SSO (README, Brief).
- "NRF assets" (README). **[A]** The term is not defined anywhere.
- External writes: email and CRM (API_Contract, README).
- Paid services or cloud accounts (Brief).
- Legal knowledge (Brief, README).

### 9.4 Likely overengineering

- **[E]** "We do not award extra points for a live model, a large platform build or cloud spend."
- **[I]** Examples:
  - real authentication or authorisation systems
  - streaming infrastructure (SSE or WebSockets) beyond what's needed to simulate events
  - a full database layer or ORM beyond local storage
  - a general-purpose engine that builds forms or charts from arbitrary schemas
  - dynamic or remote loading of components
  - a large design system
  - multi-tenant or role management
  - CRUD for clients, opportunities or sources
  - task management features (listing, editing, deleting tasks) beyond what's required
- **[E]** The time limit makes this concrete: aim for six hours, with a hard cap of eight including presentation preparation.

### 9.5 Assumptions needing clarification

1. Who is the actual user: the partner, or someone preparing work for the partner (see section 2)?
2. Which selections count as "relevant", and should they override the fixture's client and opportunity?
3. Filter dimensions, and whether the chart responds to filters.
4. What a retry should produce when the fixture is deterministic.
5. Whether a free-text prompt must map to scenarios, and how unmatched prompts are handled.
6. Whether saving a task changes the opportunity stage, and whether saved tasks should be viewable.
7. Idempotency key lifetime: whether editing after a save creates a new submission.
8. Whether SRC004 and the conflict between sources should be surfaced.
9. Whether zero-count chart categories should appear.
10. How the API determines that a user is denied, given there is no identity or role model.
11. Whether partial results replace or sit alongside earlier complete results.
12. What "NRF assets" refers to.
13. Validation rules for subject and body.
14. How unknown event kinds or malformed envelopes should be handled.

---

## 10. Independent Assessment

### 10.1 The product in five sentences

The product is a responsive web application that helps a relationship partner find client opportunities grounded in outside source material, check the evidence behind them, and prepare a review task. Its interface is put together at runtime from structured "AI" responses (supplied here as fixtures), which the application validates and maps to a closed set of trusted, typed components. The user explores opportunities in a table and chart and traces each one to its source. The user then reviews AI-drafted evidence and a draft task, edits it, and explicitly confirms saving it locally exactly once. The product must stay honest and usable when responses are partial, invalid, unsupported, forbidden or out of order.

### 10.2 Essential user interactions

1. Select or submit a prompt or scenario.
2. Watch progress while response events arrive.
3. Read the opportunity table and the priority chart.
4. Filter or select an opportunity.
5. Open the supporting source, or see a clear not-found message.
6. Request the client-focused briefing.
7. Read the evidence cards and follow their source links.
8. Edit the review form's subject and body.
9. Explicitly confirm the review task.
10. Save the task and receive a `task_id` confirmation.
11. Attempt a repeated save and see that no duplicate is created.
12. Retry after a retryable partial failure without losing work.
13. Recognise fallback, invalid-data and permission-denied states.
14. Make a new request while an earlier one is still in progress, and see only the newer result.

### 10.3 Five most important technical challenges

1. **Runtime validation at the render boundary:** strict validation of untrusted blocks against the schema, with fallbacks for each block and narrowing to the right type, so components only ever receive valid data.
2. **Request ordering and stale-response protection:** with simulated, delayed event streams. Request identity must be the deciding key, because `run_id` repeats for the same fixture.
3. **Response state as a whole:** deriving a correct overall outcome from events, independently of the HTTP status (200 with an error event, `complete` after invalid blocks, 403) and of individual blocks.
4. **Idempotent, validated task persistence:** server-enforced confirmation, reference integrity, and duplicate prevention by key.
5. **Keeping user state through response churn:** selections and form edits must survive new responses, retries and discarded responses.

### 10.4 Five most important UX challenges

1. Representing uncertainty, recency and conflicting evidence honestly, so that proposals are not mistaken for binding rules.
2. Making AI interpretation clearly distinct from quoted source text, and making each claim easy to check.
3. Designing clear, accessible and distinct states: loading, partial, fallback, invalid, denied, saved and duplicate.
4. Explicit confirmation that is deliberate without being tedious, with clear feedback after saving.
5. A coherent experience even though each response varies in composition, and that experience must work on mobile and with a keyboard.

### 10.5 Contradictions and ambiguities

1. **Location of invalid fixtures:** the brief says `block_schema.json` contains "deliberately invalid fixtures". It contains only the four valid definitions. The invalid examples are in `response_fixtures.json` (as API_Contract correctly states).
2. **Truncated brief copy:** `produc_engineer_brief.txt` leaves out about half of the `.docx` brief.
3. **User identity:** the brief names the partner as the user, but the response content refers to "the relationship partner" in the third person.
4. **HTTP status vs outcome:** `partial_then_error` returns 200 but fails.
5. **`complete` after unusable content:** `unsupported_block` and `malformed_block` end with `complete`, yet must not appear successful.
6. **Deterministic retry:** retrying `partial_then_error` returns the same failure.
7. **Fixed briefing target:** `client_focus` is fixed to CL001/O001, which conflicts with "preserve relevant user selections".
8. **Source count:** the brief lists "source material" next to three opportunities, but there are four sources. SRC004 is unreferenced and conflicts with SRC001.
9. **Untestable scenarios:** "empty or missing data" and source not-found must be handled, but no fixture or reference covers them.
10. **Authorisation without identity:** 403 must be enforced at the API, but no user or role model is supplied.
11. **Missing event schema:** events have no schema; only blocks are specified.
12. **Opportunity table row schema:** unlike the other nested objects, table rows don't forbid additional properties.
13. **Undefined term:** "NRF assets" (README) is not explained.
14. **Undefined filters:** which filters, and whether the chart is affected, is not stated.
15. **Free-text prompts:** "submit" a prompt implies free text, but the only defined inputs are the six scenario IDs.

### 10.6 Likely candidate mistakes

1. Rendering `payload.html` or any generated markup, or using an HTML-injection fallback.
2. Relying on TypeScript types alone, without runtime validation.
3. Treating HTTP 200, or a `complete` event, as proof of success.
4. Coercing invalid chart values (to 0 or NaN) and drawing a misleading chart.
5. Failing the whole response because one block is invalid, or the opposite: hiding invalid blocks with no explanation.
6. Using `run_id` rather than request identity to detect stale responses.
7. Enforcing 403 only in the UI, or returning protected content alongside the 403.
8. Generating a new idempotency key on every click, which defeats duplicate prevention. Or checking duplicates only on the client.
9. Accepting a save without server-side `confirmed: true` and reference validation.
10. Losing form edits or selections on retry or when a new response arrives.
11. Showing partial results as if they were complete.
12. Offering retry for the non-retryable 403.
13. Hard-coding a UI for each scenario instead of composing it from the registry.
14. Presenting AI interpretations or the outdated SRC004 claim as established fact.
15. Overbuilding (live LLM, real auth, cloud deployment, streaming infrastructure) at the expense of required deliverables.
16. Leaving out non-code deliverables: the Azure note, the slides or summary, README disclosures, the manual accessibility check, the tests, and a demo of the repeated save and out-of-order requests.
17. Neglecting mobile layouts, keyboard access, or accessible announcements of status changes.
18. Working from the truncated `.txt` brief and missing the requirements for real application states and submission.
