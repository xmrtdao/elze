# Elze Contract Suite — Full Accounting & Phases 5-8 Plan

Status: v1.3, 2026-08-29. Landing page hero now reads "Phase 4 — Contract Intelligence". Phase-5 (correction engine + rule-ID unification) + Phase-6 (.docx export) + Phase-7 core (learning-loop productionization) complete 2026-08-29.

## What the platform is

A closed **analyze → write → redline-docx → learn** loop, **multi-jurisdiction**, for
**8 contract types**: commercial lease, residential lease, service contract, partnership
agreement, articles of incorporation, NDA, employment, independent contractor.

## Jurisdiction expansion (2026-08-29)

**6 states** — Virginia (base: common law + Va. Code) **plus DE, MD, NY, PA, NJ**. Each
new state detects jurisdiction (governing-law clause → statute refs → address → named
state), then applies its own **commercial + residential** rule set and per-state redline
corrections (in `state-rules.mjs`). Commercial vs residential kept fully separate (e.g. a
DE commercial lease is NOT hit by the residential deposit cap — §5101(b) excludes
commercial from the Residential L-T Code). Citations verified from primary sources
(2026-08-29); PA/NJ were unblocked via the Firecrawl REST API. Verified: 6/6 states
detect + fire correctly, no empty redline suggested_text.

## Accounting (grounded in code, 2026-08-29)

### Backend edge functions (`relay/functions/`)
| Function | Capability |
|---|---|
| lease-analyzer | **61 base rules** / 8 doc types + **35 state rules** across 5 new states. CL-001→025 + CL-S01-03 (28 comm), RL-001→010 (10 res), SC×5, PA×4, CO×4, IC×3, ND×3, EM×4; state-rule IDs DE-/MD-/NY-/PA-/NJ- (RL + CL). 8 statute KBs. Compliance score→A-D. Clause detection. Structured PDF/DOCX/TXT extraction. Attorney-preference-aware. Emits redlines[] + redlinedHtml with per-state suggested_text. |
| lease-builder | 5 templates (Office26/Warehouse28/Retail27/NNN28/Ground20) + 31-clause library, mustache {{var}} engine, compliance pre-check. |
| lease-writer | Apply analyzer redlines → correctedText + redlinedHtml (analyze→write loop). |
| docx-redline | Word native tracked changes w/ rule+statute author attribution + tables + images + final export. **Clean output — no score/rating chrome** (2026-08-29 product change). |
| elze-templates | DB template/clause retrieval shim. |
| elze-learnings | Per-attorney feedback capture + acceptance dashboards. |

### Frontends (relay/public, routes in relay/server.js ~3747-3815)
Landing (`/elze`), Analyzer (`/elze/analyzer`), Writer (`/elze/writer`), Learnings
(`/elze/learnings`), Word add-in (`/elze/word-addin`).

### Database (xmrt_suite)
elze_redline_feedback (10 rows), elze_playbook_metrics (4 rules), elze_attorney_profiles
(2). lease_templates(5) + template_clauses(129) + clause_definitions(31) + lease_clauses view.
lease_documents (0 — built, unused). No RLS on Elze tables.

## Gaps that define the roadmap

1. ~~Non-commercial doc types can't be corrected~~ — **DONE 2026-08-29**: CORRECTIONS added for all 33 rules across RL/SC/PA/CO/IC/ND/EM; every fired rule emits suggested_text.
2. ~~Writer can't export .docx~~ — **DONE 2026-08-29**: Writer has a .docx (Redlined) button calling docx-redline; verified end-to-end via relay (tracked changes + author attribution).
3. **Rule-ID inconsistency.** analyzer CL/RL vs builder RF-xxx vs COMMON-LAW-* vs CL-* short.
4. ~~8 undefined statute keys~~ — **DONE 2026-08-29**: INSURANCE/CAM/REPAIR/SNDA/GUARANTY/COMMENCEMENT/INDEMNITY/RELOCATION now defined in COMMERCIAL_COMMON_LAW.
5. ~~Stale docs~~ — **DONE 2026-08-29** (multi-state + accurate counts + real feature set).
6. Learning loop core DONE 2026-08-29 (attorney selector + attorney-on-analyze + preference hydration verified). Remaining: feedback volume, preferred_terms hydration polish, updated_at triggers.

## Phases 5-8 Plan

### Phase 5 — Complete the correction engine (foundation)
Fill CORRECTIONS/suggested-fix maps for all 61 base rules across 7 non-commercial types.
Unify rule registry (single IDs). Add 8 missing statute definitions. Round-trip tests
asserting clean output + structure preservation.

### Phase 6 — Wire the Writer into the full loop
Add .docx export to Writer via docx-redline. Build→analyze→redline-docx as one path; persist
to lease_documents. Fix landing stat mismatches; refresh docs.

### Phase 7 — Make the learning loop the moat
Productionize attorney-preference loop (feedback volume, preferred_terms hydration,
over/under tuning). Auto-learned-fix backfill into Phase-5 maps. updated_at triggers +
retention + dashboards.

### Phase 8 — Ship the Word add-in + harden
Word 2016+/M365 sideload + taskpane click-through. Real lease_documents persistence +
retrieval list. Auth hardening (cosmetic /elze login gate). Landing update to Phase 5+ badge.
