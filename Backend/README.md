# Backend ReadMe

## Tax Filing Workflow

This backend now supports a job-based tax filing flow in addition to the legacy one-shot analysis endpoints.

### Main endpoints

- `POST /api/tax-assistant/jobs`
- `GET /api/tax-assistant/jobs`
- `POST /api/tax-assistant/jobs/{job_id}/documents`
- `POST /api/tax-assistant/jobs/{job_id}/process`
- `GET /api/tax-assistant/jobs/{job_id}/review`
- `POST /api/tax-assistant/jobs/{job_id}/approve`
- `GET /api/tax-assistant/jobs/{job_id}/export/itr-pdf`

### Supported CSV document types

- `bank_statement`
- `ais`
- `form16`
- `sales_register`
- `purchase_register`
- `capital_gains_statement`
- `interest_certificate`
- `rent_summary`
- `deduction_proof`

### Processing pipeline

The new flow stores uploaded documents inside a filing job, parses them into a canonical tax model, runs confidence-tagged AI-style extraction, reconciles mismatches, computes tax with deterministic rules, and produces a reviewable ITR draft packet plus a demo PDF export.

## Groq LLM Integration

Groq is now integrated as an optional low-cost classification layer.

- Set `GROQ_API_KEY` in `.env`
- Keep `GROQ_ENABLED=true` to use Groq
- The current workflow uses Groq only for compact batched bank-income classification
- Deterministic tax computation still remains the final source of truth
- If Groq is unavailable or returns invalid output, the pipeline falls back to heuristic classification

### Cost-control choices

- One compact request per bank statement at most
- Maximum rows per call controlled by `GROQ_BANK_ROWS_PER_CALL`
- Low reasoning effort by default
- Temperature `0` behavior in code for stable classifications
- Limited completion budget through `GROQ_MAX_COMPLETION_TOKENS`
