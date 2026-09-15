# Elze Database Schema

**Type:** PostgreSQL schema
**Schema:** public (XMRT DAO suite `xmrt_suite`)
**Status:** Active — seeded

## Elze tables

### lease_templates
Commercial lease templates. Columns: id (uuid PK), name, description, category, metadata (jsonb), created_at, updated_at. 5 seeded.

### clause_definitions
Clause library entries with compliant defaults. Columns: id (uuid PK), template_id (FK), clause_key, label, description, default_text, sort_order, is_required, options (jsonb), created_at, updated_at. 31 clauses.

### template_clauses
Junction table for template↔clause relationships. 129 links. Columns: id (uuid PK), template_id (FK→lease_templates), clause_id (FK→clause_definitions), sort_order, is_required.

### lease_documents
Stores generated lease documents. Columns: id (uuid PK), template_id (FK→lease_templates), form_data (jsonb), generated_text, status (draft/completed/archived), created_at, updated_at.

### lease_clauses (VIEW)
Wraps clause_definitions with template_name. 31 rows.

### elze_attorney_profiles
Attorney preference profiles. PK attorney_id (text, "david"/"joe"), preferred_terms jsonb. Persists per-attorney accepted/rejected redline terms.

### elze_redline_feedback
Feedback on redline suggestions (accept/reject/edit). Trains the attorney-learnt preference engine (attorneyPrefs computed per request from this feedback).

### elze_playbook_metrics
Per-rule engagement metrics used by the learning loop.

## Notes

- RLS is disabled on the Elze tables; only `documents` and `learning_sessions` carry permissive policies.
- No FK constraints on the template tables (soft joins).
- The analyzer itself is in-memory (no DB reads); templates/clauses/documents live here.

## Related

- [[Elze Contracts Suite]] — Uses these tables
- [[Elze Lease Builder]] — Template/clause source data
- [[Elze Lease Writer]] — Stores generated docs
- [[Elze Lease Analyzer]] — Can store analysis results
- [[Postgres Database]] — All tables in public schema (xmrt_suite)
- [[app Schema]] — System tables (agents, tasks, etc.)
