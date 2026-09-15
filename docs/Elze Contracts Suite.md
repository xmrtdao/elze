# Elze Contracts Suite

**Type:** AI-powered legal document processing system
**Location:** relay/functions/lease-*.mjs
**Status:** Active — multi-jurisdiction (2026-08-29)

## Overview

The Elze Contracts Suite is a multi-function system for commercial real estate lease analysis, drafting, and correction. Built for Joe (Elze Law PLLC). **Multi-jurisdiction**: covers **6 states — Virginia (base: common law + Va. Code) plus DE, MD, NY, PA, NJ** — with jurisdiction-aware rule selection. Each state carries its own **commercial and residential** rule sets, authored only from primary-source-verified statute citations, and its own per-state redline corrections.

## Jurisdiction model

- **Virginia** — the original base rule set (commercial = common law, residential = VRLTA § 55.1-1200).
- **DE, MD, NY, PA, NJ** — jurisdiction detected first (governing-law clause, then statute references, address, then state name), then rules resolve per state. Commercial vs residential are kept fully separate.
- Rule/statute/correction registries are keyed `[state][docType]` (see `state-rules.mjs`). A state falls back to Virginia common-law only in rule gaps, never in lieu of its own verified law.

## Components

- [[Elze Lease Analyzer]] — Reads lease text, detects issues vs the governing state's statutes (commercial or residential), returns redlines, suggested-correct text, and a compliance grade
- [[Elze Lease Builder]] — Generates complete lease documents from structured form data using clause library and templates
- [[Elze Lease Writer]] — Applies redlines from the analyzer to produce a corrected document with tracked changes
- [[Elze Database Schema]] — lease_templates, clause_definitions, template_clauses, lease_documents, lease_clauses view, elze_attorney_profiles, elze_redline_feedback, elze_playbook_metrics

## Endpoints

- POST /api/v1/functions/lease-analyzer
- POST /api/v1/functions/lease-builder
- POST /api/v1/functions/lease-writer
- POST /api/v1/functions/docx-redline

## Status

Multi-jurisdiction expansion complete as of 2026-08-29: 6 states detecting correctly, each with commercial + residential rule sets and per-state redline corrections, verified live through the relay. Analyzer ships 8 document types (commercial/residential lease, service contract, partnership, incorporation, contractor, NDA, employment) and ~60 base rules plus 32 state rules.

## Related

- [[Elize Lease Analyzer]], [[Elize Lease Builder]], [[Elize Lease Writer]], [[Elize Database Schema]]
- [[Joe]] — Owner and end user (Elze Law PLLC)
- [[Relay Server]] — Serves the functions at /api/v1/functions/
- [[Postgres Database]] — Stores templates, clauses, and documents
