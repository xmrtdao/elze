# Elze Lease Analyzer

**Type:** Local edge function
**Category:** legal
**File:** relay/functions/lease-analyzer.mjs + state-rules.mjs
**Status:** Active — multi-jurisdiction

## Overview

Reads commercial/residential lease text and detects issues against the **governing state's** statutes. Determines jurisdiction first (governing-law clause → statute references → property address → state name), then applies that state's commercial or residential rules. Returns a compliance grade (A–D), score, redlines with **per-state suggested corrections**, and a clause extraction report.

## Jurisdiction coverage (6 states)

- **Virginia** (base): commercial → VA common law; residential → VRLTA § 55.1-1200.
- **DE, MD, NY, PA, NJ**: each detects jurisdiction and applies its own verified commercial + residential rules and redline corrections. Rule/statute/corrections registries keyed `[state][docType]` in `state-rules.mjs`.

## Capabilities

- **Document types** — 8: commercial_lease, residential_lease, service_contract, partnership_agreement, articles_of_incorporation, independent_contractor, non_disclosure, employment
- **Base rules** — ~60 across doc types (commercial lease: 20; residential: 10; others: 3–5 each), covering security deposits, late fees, self-help eviction, waiver of rights, confession of judgment, negligence waiver, entry notice, assignment, rent escalation, SNDA, guaranty, casualty/condemnation, etc.
- **State rules** — 32 additional rules across the 5 new states (e.g. DE §5514 deposits, MD §8-203 cap, NY GOL §7-103 trust, PA §250.511a, NJ 46:8-21.2), each with per-state redline corrections
- **Redline suggested-fix** — per-state suggested_text + comment (e.g. DE-RL-3 self-help → "recover possession only by summary possession in the Justice of the Peace Court, 25 Del. C. § 5701-5702")
- **Suggestion rules** — reciprocal indemnity, waiver of subrogation, CAM details
- **PDF/DOCX parsing** — Built-in via mammoth and pdf-parse
- **DOCX export** — Via docx-redline function with Word-compatible tracked changes (clean output preserving original structure; all scoring stays in the platform)

## Usage

POST /api/v1/functions/lease-analyzer
x-api-key: ***
Body: { "action": "analyze", "document": "...lease text..." }

## Database

Reads no DB tables. Pure in-memory analysis. Results can be stored in [[Elze Database Schema]].

## Endpoints

- POST /api/v1/functions/lease-analyzer

## Related

- [[Elze Contracts Suite]] — Parent system
- [[Elze Lease Builder]] — Generates leases for input
- [[Elze Lease Writer]] — Applies redlines to produce corrected doc
- [[Elze Database Schema]] — Stores analysis results
- [[Relay Server]] — Serves the function
