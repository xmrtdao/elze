# Elze Lease Writer

**Type:** Local edge function
**Category:** legal
**File:** relay/functions/lease-writer.mjs
**Status:** Active

## Overview

Completes the analyze→write loop. Takes redlines from [[Elze Lease Analyzer]] and generates a corrected lease document with tracked changes (redlinedHtml). The `docx-redline` function produces Word-compatible revision marks with clean output that preserves the original contract's own titles, headers, and numbered paragraphs (all compliance scoring stays in the platform).

## Capabilities

- **Redline application** — deletion, insertion, deletion_insertion, and replacement types
- **Fuzzy matching** — if exact text not found, uses word-based line matching
- **Redlined HTML** — full-lease HTML with inline tracked changes (green insertions, red deletions)
- **Change summary** — number of corrections applied, with severity and commentary
- **Clean DOCX export** — via docx-redline: original structure preserved (no "ELZE REDLINED LEASE" banner, no score/grade chrome), per-rule + statute track-change attribution (e.g. `w:author="Elze · CL-005 · Late Fee"`)

## Usage

POST /api/v1/functions/lease-writer
x-api-key: ***
Body: { "action": "write", "originalText": "...", "redlines": [...], "documentType": "lease" }

## Endpoints

- POST /api/v1/functions/lease-writer
- POST /api/v1/functions/docx-redline (binary DOCX with tracked changes)

## Known gaps / roadmap

- The Writer **front-end** currently offers only .txt/.md/.json export — it does not yet call the `docx-redline` function from the UI (the backend function works). Wiring the .docx export into the UI is phase-6 work.

## Related

- [[Elze Contracts Suite]] — Parent system
- [[Elze Lease Analyzer]] — Provides the redlines
- [[Elze Lease Builder]] — Can build and write in sequence
- [[Elze Database Schema]] — Stores generated documents
- [[Relay Server]] — Serves the function
