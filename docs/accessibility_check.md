# Manual Accessibility Check

**Date:** 23 Nov 2026 · **Build:** `main` + the fixes listed below · **Target:** WCAG 2.2 AA (spot check, not a full audit)

## Scope and method

| | |
|---|---|
| Browser | Chrome (desktop, macOS), local dev server (`npm run dev`) |
| Pages | `/agent` (all six scenarios), `/opportunities`, `/opportunities/[reference]`, `/briefing`, `/briefing/[reference]`, not-found references, source panel |
| Keyboard | Real key presses only (Tab, Shift+Tab, Enter, Space, Escape), no mouse |
| Semantics | Accessibility tree and DOM inspection: landmarks, headings, accessible names, live regions, `aria-*` state |
| Contrast | Script that measured every visible text node against its composited background, plus a check of the colour tokens |
| Reflow | 375 px and 320 px viewports (320 px ≈ 400 % zoom on a 1280 px screen) |
| Screen reader | **Not yet run.** See [VoiceOver script](#voiceover-script-still-to-run) |

## Results

| # | Area | Check | Result |
|---|---|---|---|
| 1 | Structure | `lang="en-GB"`, unique page titles (e.g. `BR00001 · Briefing · RADAR`), one `h1` per page, `nav` / `main` / labelled `section` landmarks | Pass |
| 2 | Structure | "Skip to content" is the first Tab stop and becomes visible on focus | Pass |
| 3 | Keyboard | Tab order on `/agent`: skip link → sidebar nav → suggested prompts → demo prompt → send → "Simulate a slow response". Logical; no positive `tabindex` | Pass |
| 4 | Keyboard | Every control showed a 2 px accent focus ring (`:focus-visible`) | Pass |
| 5 | Keyboard | Table rows select with Space/Enter (`aria-pressed` updates); source button opens the panel | Pass |
| 6 | Keyboard | Source panel: `role="dialog"` + `aria-modal`, labelled by the source title, focus moves to "Close source", Tab stays inside, Escape closes and **returns focus to the button that opened it** | Pass |
| 7 | Keyboard | Review form: "Edit task" moves focus to Subject; "Review and save" moves focus to the "Review before saving" heading; save moves focus to the "Review task saved" message; the save buttons are then removed, so a second save is not possible | Pass |
| 8 | Forms | Subject/Details have visible `<label>`s and hints linked with `aria-describedby`. An empty Subject sets `aria-invalid="true"`, links "Enter a subject.", and moves focus back to the field | Pass |
| 9 | Status | Progress ("Receiving response…", "Preparing opportunity overview…") is in `role="status"`; results summary ("Three opportunities available for review.") is announced politely; only the active turn is live, so older turns stay quiet | Pass |
| 10 | Status | `permission_denied` renders `role="alert"` "Access denied" with no protected content; `unsupported_block` and `malformed_block` render a `role="status"` notice in place of the block, and the outcome reads "Response finished with problems", never as success; `partial_then_error` labels the section "Incomplete response to: …" and offers Retry | Pass |
| 11 | Chart | SVG is `aria-hidden`; the same values are given as a text `<dl>` with a `<figcaption>`, so the chart is readable without seeing it | Pass |
| 12 | Table | Real `<table>` with `<caption>`, `scope="col"` headers and `scope="row"` row headers; scroll wrapper is a named `role="region"` | Pass |
| 13 | Names | No focusable element without an accessible name on any page tested; icon-only buttons have `aria-label`s (e.g. "View source SRC001 for Review payment resilience readiness") | Pass |
| 14 | Reflow | No page-level horizontal scroll at 375 px or 320 px on Agent, Opportunities or Briefing; mobile header + tab bar replace the sidebar | Pass |
| 15 | Focus visibility | Focused control hidden behind the sticky prompt bar (desktop) and the sticky mobile header (WCAG 2.4.11) | **Fixed** (F1) |
| 16 | Contrast | Snapshot footer text 4.37:1 and "High" priority badge 4.15:1 (need 4.5:1). After the fix, 0 failures across all text on the pages tested | **Fixed** (F2) |
| 17 | Structure | Not-found briefing/analysis pages had no heading | **Fixed** (F3) |
| 18 | Motion | Pulsing progress dot and smooth scroll to each new answer ignored `prefers-reduced-motion` | **Fixed** (F4) |
| 19 | Keyboard | "Created by the Agent" tooltip on saved analyses appeared on hover only | **Fixed** (F5) |
| 20 | Reflow | At 320 px the mobile tab bar is 339 px wide in 296 px, so "Briefing" is partly cut off. The bar scrolls sideways and Tab brings it into view | Minor, open |
| 21 | Live regions | The outcome message (`role="status"` / `role="alert"`) sits inside an `aria-live="polite"` wrapper. Nested live regions can be read twice by some screen readers | To confirm with VoiceOver |

## Fixes made during this check

| | Problem | Change |
|---|---|---|
| F1 | With the review form near the bottom of the page, Tab put focus on "Review and save" entirely under the sticky prompt bar. On mobile, Shift+Tab could leave focus under the 97 px header | `scroll-padding-bottom` on `html` while the prompt bar is mounted, and `scroll-padding-top` below the `md` breakpoint (`src/app/globals.css`, `data-sticky-composer` in `AgentView.tsx`). Re-tested: the browser now scrolls the focused control clear of both bars |
| F2 | Footer text `#6a6865` on `sand` = 4.37:1; badge `accent` on `accent/10` = 4.15:1 | Footer text → `#5f5d5a` (5.17:1) in `SnapshotFooter.tsx`; accent badge text → `danger` (6.66:1) in `Badge.tsx`. Same red family, so the look is unchanged |
| F3 | "Briefing X isn't available" was a `<p>`, so the page had no `h1` | New `titleAs` prop on the state messages (`StateMessage.tsx`); both detail views use `titleAs="h1"` |
| F4 | Animations ran regardless of OS setting | `motion-reduce:animate-none` on the pulse dots; `AgentView` uses `behavior: "auto"` when `prefers-reduced-motion: reduce` |
| F5 | Sighted keyboard users never saw the tooltip | Tooltip also shows when the row link has `:focus-visible` (`OpportunitiesView.tsx`) |

All 319 automated tests, `tsc` and ESLint pass after the fixes.

## VoiceOver script (still to run)

Turn on VoiceOver with Cmd+F5 in Chrome or Safari, then go through the script below. Write the result next to each step.

| Step | Expected | Result |
|---|---|---|
| 1. Load `/agent`, press VO+U → Landmarks | Navigation "Workspaces", main | |
| 2. Choose the overview prompt, press Enter | Hears "Receiving response", then "Three opportunities available for review" | |
| 3. Run `permission_denied` | Hears "Access denied…" **once** (checks item 21) | |
| 4. Run `malformed_block` | Hears "Response finished with problems…" | |
| 5. Navigate to the chart (VO+Cmd+H) | Hears heading, caption and the values High 2, Medium 1, not SVG noise | |
| 6. Move through the table with VO+arrows | Column headers are read with each cell | |
| 7. Open a source, then Escape | Dialog title read on open; back on the source button after closing | |
| 8. Save an empty Subject | Hears "Subject, invalid data, Enter a subject." | |
| 9. Confirm and save | Hears "Review task saved, Task ID…" | |

## Known limitations

- Only Chrome on macOS was tested; Safari, Firefox and Windows screen readers (NVDA/JAWS) were not.
- Real 200 %/400 % browser zoom was simulated with narrow viewports.
- Windows High Contrast / forced colours was not tested.
- Chart colour does not carry meaning on its own (one series, values printed), but data-viz contrast was not measured separately.
