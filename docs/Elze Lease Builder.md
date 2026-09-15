# Elze Lease Builder

**Type:** Local edge function
**Category:** legal
**File:** relay/functions/lease-builder.mjs
**Status:** Active

## Overview

Generates complete commercial real estate lease documents from structured form data. Includes templates and a clause library with compliance-aware defaults. Provides a compliance pre-check against the governing state's rules.

## Capabilities

- **Templates** — Commercial Office, Commercial Warehouse, Commercial Retail, Triple Net (NNN), Ground Lease (20–28 clauses each)
- **Clause library** — Core, financial, operational, and legal categories with compliant defaults
- **Compliance pre-check** — Validates security deposit cap, late fee reasonableness, entry notice, self-help eviction prohibition, waiver of rights, mitigation duty
- **Template engine** — Mustache-style {{variable}} substitution for computed values (rent, escalation, security deposit amount)
- **Multi-format export** — txt, md, json. (Word/DOCX export is the roadmap gap: the Writer front-end does not yet wire into the docx-redline function; see phase-6 work.)

## Usage

POST /api/v1/functions/lease-builder
x-api-key: ***
Body: { "action": "build", "templateId": "commercial_office", "landlordName": "...", "tenantName": "...", ... }

## Database

Uses templates and clauses (in-memory / DB-backed). DB tables:
- [[Elze Database Schema]] — lease_templates, clause_definitions (31 clauses), template_clauses (129 links)

## Endpoints

- POST /api/v1/functions/lease-builder (actions: templates, clauses, build, precheck)

## Related

- [[Elze Contracts Suite]] — Parent system
- [[Elze Lease Analyzer]] — Analyzes built leases
- [[Elze Lease Writer]] — Applies redlines to corrected doc
- [[Elze Database Schema]] — Template and clause storage
- [[Relay Server]] — Serves the function
