# TaxAI Frontend API Contract

Base URL:

```text
http://127.0.0.1:8000
```

Auth header for protected endpoints:

```text
Authorization: Bearer <access_token>
```

Content type for JSON endpoints:

```text
Content-Type: application/json
```

## Main Frontend Flow

1. Register or login
2. Fetch `/api/tax-assistant/options`
3. Create a job with `/api/tax-assistant/jobs`
4. Upload documents to `/api/tax-assistant/jobs/{job_id}/documents`
5. Process with `/api/tax-assistant/jobs/{job_id}/process`
6. Show review screen from `/api/tax-assistant/jobs/{job_id}/review`
7. Approve with `/api/tax-assistant/jobs/{job_id}/approve`
8. Download cached PDF from `/api/tax-assistant/jobs/{job_id}/export/itr-pdf`

## 1. Health

### `GET /health`

Response:

```json
{
  "status": "ok"
}
```

## 2. Auth

### `POST /api/auth/register`

Request:

```json
{
  "name": "Test User",
  "pancard_number": "ABCDE1234F",
  "password": "password123",
  "mobile_number": "9876543210",
  "email": "test@example.com"
}
```

Response:

```json
{
  "message": "User registered successfully.",
  "access_token": "jwt-token",
  "user": {
    "id": 1,
    "name": "Test User",
    "pancard_number": "ABCDE1234F",
    "mobile_number": "9876543210",
    "email": "test@example.com"
  }
}
```

### `POST /api/auth/login`

Request:

```json
{
  "identifier": "test@example.com",
  "password": "password123"
}
```

Response:

```json
{
  "message": "Login successful.",
  "access_token": "jwt-token",
  "user": {
    "id": 1,
    "name": "Test User",
    "pancard_number": "ABCDE1234F",
    "mobile_number": "9876543210",
    "email": "test@example.com"
  }
}
```

### `GET /api/auth/me`

Response:

```json
{
  "user": {
    "id": 1,
    "name": "Test User",
    "pancard_number": "ABCDE1234F",
    "mobile_number": "9876543210",
    "email": "test@example.com"
  }
}
```

## 3. Options / Metadata

### `GET /api/tax-assistant/options`

Response:

```json
{
  "profile_types": ["individual", "small_business"],
  "regimes": ["old", "new", "auto"],
  "default_financial_year": "2024-25",
  "supported_documents": {
    "bank_statement": {
      "description": "Bank statement in CSV format for receipt and expense analysis.",
      "required_any_of": [["date", "txn_date"], ["description", "narration", "particulars"]],
      "optional": ["amount", "debit", "credit", "balance", "gst_rate", "vendor_state", "business_state", "eligible_itc", "category"]
    }
  },
  "job_statuses": [
    "approved",
    "computed",
    "efile_ready",
    "exported",
    "needs_review",
    "normalized",
    "parsed",
    "reconciled",
    "uploaded"
  ],
  "portal_adapter": {
    "enabled": false,
    "status": "not_configured",
    "message": "Direct Income Tax Department portal filing is not enabled in this build.",
    "next_step": "Use the approved ITR PDF export for review until the portal adapter is integrated."
  },
  "ai_provider": {
    "enabled": true,
    "has_api_key": true,
    "sdk_installed": false,
    "transport": "http",
    "model": "openai/gpt-oss-120b"
  }
}
```

## 4. Filing Jobs

### `POST /api/tax-assistant/jobs`

Request:

```json
{
  "profile_type": "individual",
  "regime": "auto",
  "financial_year": "2024-25",
  "taxpayer_profile": {
    "full_name": "Test User",
    "pan": "ABCDE1234F"
  },
  "tax_profile": {
    "deductions": {
      "80c": 50000,
      "80d": 15000
    },
    "advance_tax": 1000
  }
}
```

Response:

```json
{
  "status": "success",
  "job": {
    "job_id": "uuid",
    "profile_type": "individual",
    "regime_preference": "auto",
    "financial_year": "2024-25",
    "status": "uploaded",
    "taxpayer_profile": {
      "full_name": "Test User",
      "pan": "ABCDE1234F"
    },
    "tax_profile": {
      "deductions": {
        "80c": 50000,
        "80d": 15000
      },
      "advance_tax": 1000
    },
    "created_at": "2026-03-27T10:00:00",
    "updated_at": "2026-03-27T10:00:00"
  }
}
```

### `GET /api/tax-assistant/jobs`

Response:

```json
{
  "jobs": [
    {
      "job_id": "uuid",
      "profile_type": "individual",
      "regime_preference": "auto",
      "financial_year": "2024-25",
      "status": "needs_review",
      "taxpayer_profile": {},
      "tax_profile": {},
      "created_at": "2026-03-27T10:00:00",
      "updated_at": "2026-03-27T10:30:00",
      "documents": [
        {
          "id": 1,
          "document_type": "form16",
          "source_name": "form16.csv",
          "storage_kind": "inline_csv",
          "parse_status": "parsed",
          "metadata": {},
          "created_at": "2026-03-27T10:05:00"
        }
      ]
    }
  ]
}
```

### `POST /api/tax-assistant/jobs/{job_id}/documents`

JSON request:

```json
{
  "documents": [
    {
      "document_type": "form16",
      "source_name": "form16.csv",
      "csv_content": "component,amount,employer_name\nGross Salary,900000,ABC Technologies\nTax Deducted at Source,65000,ABC Technologies\nTaxable Income Chargeable Under The Head Salaries,825000,ABC Technologies\n"
    },
    {
      "document_type": "ais",
      "source_name": "ais.csv",
      "csv_content": "income_type,amount,tds,tcs,description\ninterest,12000,1200,0,Savings and FD interest\ndividend,5000,0,0,Dividend from mutual funds\n"
    }
  ]
}
```

Alternative multipart form-data request:

```text
files: <csv-file-1>
files: <csv-file-2>
document_types: form16
document_types: ais
```

Response:

```json
{
  "status": "success",
  "job": {
    "job_id": "uuid",
    "profile_type": "individual",
    "regime_preference": "auto",
    "financial_year": "2024-25",
    "status": "uploaded",
    "taxpayer_profile": {},
    "tax_profile": {},
    "created_at": "2026-03-27T10:00:00",
    "updated_at": "2026-03-27T10:05:00"
  },
  "documents": [
    {
      "id": 1,
      "document_type": "form16",
      "source_name": "form16.csv",
      "storage_kind": "inline_csv",
      "parse_status": "uploaded",
      "metadata": {},
      "created_at": "2026-03-27T10:05:00"
    }
  ]
}
```

### `POST /api/tax-assistant/jobs/{job_id}/process`

Request:

```json
{}
```

Response:

```json
{
  "status": "success",
  "job": {
    "job_id": "uuid",
    "profile_type": "individual",
    "regime_preference": "auto",
    "financial_year": "2024-25",
    "status": "needs_review",
    "taxpayer_profile": {},
    "tax_profile": {},
    "created_at": "2026-03-27T10:00:00",
    "updated_at": "2026-03-27T10:10:00"
  },
  "documents_processed": [
    {
      "document_type": "form16",
      "source_name": "form16.csv",
      "summary": {
        "employer_name": "ABC Technologies",
        "gross_salary": 900000.0,
        "tds": 65000.0
      }
    }
  ],
  "parse_errors": [],
  "supported_documents": {},
  "canonical_data": {
    "taxpayer_profile": {},
    "filing_context": {
      "job_id": "uuid",
      "profile_type": "individual",
      "financial_year": "2024-25",
      "regime_preference": "auto"
    },
    "incomes": [],
    "deductions": [],
    "tax_credits": [],
    "documents": [],
    "ai_audit_trail": [],
    "review_tasks": []
  },
  "reconciliation_issues": [],
  "optimization_recommendations": [
    {
      "type": "regime_selection",
      "selected_regime": "new",
      "estimated_tax_saved": 12500.0,
      "message": "New regime is currently more tax-efficient by Rs 12500.00."
    }
  ],
  "review_blockers": [],
  "confidence_summary": {
    "income_facts": {
      "count": 2,
      "average_confidence": 0.97,
      "low_confidence_items": 0
    },
    "deduction_facts": {
      "count": 2,
      "average_confidence": 0.88,
      "low_confidence_items": 2
    },
    "tax_credit_facts": {
      "count": 2,
      "average_confidence": 0.97,
      "low_confidence_items": 0
    }
  },
  "evidence_links": [
    {
      "document_type": "form16",
      "source_name": "form16.csv",
      "summary": {
        "employer_name": "ABC Technologies",
        "gross_salary": 900000.0,
        "tds": 65000.0
      }
    }
  ],
  "ai_workflow": {
    "provider": "groq",
    "mode": "batched_document_classification",
    "groq_attempts": 1,
    "groq_calls_used": 1,
    "fallback_enabled": true,
    "audit_entries": [
      {
        "engine": "groq_bank_income_classifier_v1",
        "source_name": "bank_statement.csv",
        "success": true,
        "transport": "http",
        "classification": "salary",
        "confidence": 0.91
      }
    ]
  },
  "draft_return": {
    "job_id": "uuid",
    "suggested_itr_form": "ITR-1",
    "profile_type": "individual",
    "financial_year": "2024-25",
    "regime": "new",
    "itr_fields": {
      "gross_total_income": 842000.0,
      "total_deductions": 65000.0,
      "taxable_income": 777000.0,
      "tax_before_rebate": 22700.0,
      "total_tax_liability": 23608.0,
      "total_taxes_paid": 66200.0,
      "refund_due": 42592.0,
      "balance_tax_payable": 0.0
    },
    "income_schedule": {},
    "deduction_schedule": {},
    "credit_schedule": {},
    "reconciliation_summary": {
      "issues_count": 0,
      "review_tasks_count": 0
    },
    "canonical_documents": []
  },
  "tax_result": {
    "financial_year": "2024-25",
    "regime": "new",
    "income_breakdown": {
      "salary": 825000.0,
      "interest": 12000.0,
      "dividend": 5000.0,
      "rent": 0.0,
      "professional_receipts": 0.0,
      "business_profit": 0.0,
      "other_income": 0.0,
      "special_rate_income": {
        "capital_gains": 0.0
      }
    },
    "gross_total_income": 842000.0,
    "deductions": {
      "standard_deduction": 75000.0,
      "chapter_vi_a": {},
      "total_deductions": 75000.0
    },
    "taxable_income": 767000.0,
    "tax_computation": {
      "tax_before_rebate": 21700.0,
      "rebate_87a": 0.0,
      "cess": 868.0,
      "total_tax_liability": 22568.0
    },
    "tax_credits": {
      "form16_tds": 65000.0,
      "ais_tds": 1200.0,
      "ais_tcs": 0.0,
      "advance_tax": 1000.0,
      "total_taxes_paid": 67200.0
    },
    "net_result": {
      "balance_tax_payable": 0.0,
      "refund_due": 44632.0
    },
    "filing_position": {
      "suggested_itr_form": "ITR-1",
      "ready_for_filing": true
    },
    "compliance_flags": [],
    "warnings": [],
    "assistant_summary": "The assistant combined salary, AIS, bank, and business records into a filing worksheet and computed a draft liability.",
    "regime_recommendation": {
      "selected_regime": "new",
      "old_regime_tax": 34840.0,
      "new_regime_tax": 22568.0
    }
  },
  "business_result": {
    "profit_and_loss": {
      "revenue": 0.0,
      "expenses": 0.0,
      "net_profit": 0.0,
      "net_margin_pct": 0.0
    },
    "balance_sheet": {
      "assets": {},
      "liabilities": {},
      "equity": {}
    },
    "gst_summary": null,
    "ledger_preview": [],
    "insights": []
  },
  "review_state": {
    "ready_for_approval": true,
    "review_blockers": [],
    "review_tasks": []
  },
  "missing_data_checklist": [],
  "portal_adapter": {
    "enabled": false,
    "status": "not_configured",
    "message": "Direct Income Tax Department portal filing is not enabled in this build.",
    "next_step": "Use the approved ITR PDF export for review until the portal adapter is integrated."
  }
}
```

### `GET /api/tax-assistant/jobs/{job_id}/review`

Response:

```json
{
  "status": "success",
  "job": {
    "job_id": "uuid",
    "profile_type": "individual",
    "regime_preference": "auto",
    "financial_year": "2024-25",
    "status": "needs_review",
    "taxpayer_profile": {},
    "tax_profile": {},
    "created_at": "2026-03-27T10:00:00",
    "updated_at": "2026-03-27T10:10:00",
    "documents": [
      {
        "id": 1,
        "document_type": "form16",
        "source_name": "form16.csv",
        "storage_kind": "inline_csv",
        "parse_status": "parsed",
        "metadata": {},
        "created_at": "2026-03-27T10:05:00"
      }
    ]
  },
  "review_state": {
    "ready_for_approval": false,
    "review_blockers": [
      {
        "type": "low_confidence_fact",
        "severity": "medium",
        "field": "80c",
        "message": "80c was inferred with confidence 0.88 and should be reviewed.",
        "confidence": 0.88,
        "extraction_method": "deduction_proof_parse_v1"
      }
    ],
    "review_tasks": [
      {
        "type": "low_confidence_fact",
        "severity": "medium",
        "field": "80c",
        "message": "80c was inferred with confidence 0.88 and should be reviewed.",
        "confidence": 0.88,
        "extraction_method": "deduction_proof_parse_v1"
      }
    ]
  }
}
```

### `POST /api/tax-assistant/jobs/{job_id}/approve`

Request:

```json
{
  "reviewed_by_user": true,
  "notes": "User confirmed draft values"
}
```

Success response:

```json
{
  "status": "success",
  "job": {
    "job_id": "uuid",
    "profile_type": "individual",
    "regime_preference": "auto",
    "financial_year": "2024-25",
    "status": "approved",
    "taxpayer_profile": {},
    "tax_profile": {},
    "created_at": "2026-03-27T10:00:00",
    "updated_at": "2026-03-27T10:20:00"
  },
  "approval": {
    "reviewed_by_user": true,
    "notes": "User confirmed draft values"
  }
}
```

Failure response:

```json
{
  "message": "Job has unresolved review blockers and cannot be approved yet."
}
```

### `GET /api/tax-assistant/jobs/{job_id}/export/itr-pdf`

Response:

```text
Binary PDF file
```

If the PDF was already generated once, the backend reuses the stored file path instead of regenerating it.

Typical review payload after export includes:

```json
{
  "pdf_export": {
    "path": "generated_pdfs/itr_draft_<job_id>.pdf",
    "status": "stored",
    "filename": "itr_draft_<job_id>.pdf"
  }
}
```

## 5. Legacy Analysis Endpoints

### `POST /api/tax-assistant/analyze`

Request:

```json
{
  "profile_type": "individual",
  "regime": "auto",
  "financial_year": "2024-25",
  "tax_profile": {
    "deductions": {
      "80c": 50000
    },
    "advance_tax": 1000
  },
  "documents": [
    {
      "document_type": "form16",
      "source_name": "form16.csv",
      "csv_content": "component,amount,employer_name\nGross Salary,900000,ABC Technologies\nTax Deducted at Source,65000,ABC Technologies\nTaxable Income Chargeable Under The Head Salaries,825000,ABC Technologies\n"
    }
  ]
}
```

Response shape:

```json
{
  "status": "success",
  "profile_type": "individual",
  "financial_year": "2024-25",
  "supported_documents": {},
  "documents_processed": [],
  "parse_errors": [],
  "missing_data_checklist": [],
  "tax_result": {},
  "business_result": {}
}
```

### `POST /api/tax-assistant/ask`

Request:

```json
{
  "question": "What is my refund?",
  "analysis": {
    "tax_result": {
      "net_result": {
        "refund_due": 2500
      },
      "filing_position": {
        "suggested_itr_form": "ITR-1"
      },
      "deductions": {
        "standard_deduction": 50000,
        "chapter_vi_a": {
          "80c": 50000
        }
      }
    },
    "business_result": {
      "gst_summary": {
        "net_gst_payable": 0
      }
    },
    "missing_data_checklist": []
  }
}
```

Response:

```json
{
  "answer": "Estimated refund based on the uploaded documents is Rs 2500.00."
}
```

## Common Error Shapes

Validation / bad request:

```json
{
  "message": "profile_type is required."
}
```

Unauthorized:

```json
{
  "msg": "Missing Authorization Header"
}
```

Not found:

```json
{
  "message": "Job not found."
}
```
