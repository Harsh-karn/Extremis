# Personalized Bulk Email Sender — Technical Specification

**How to use this document:** it works both as project documentation (README / spec.md in the repo) and as a build brief you can paste directly into an AI coding assistant (Claude Code, Cursor, etc.) to scaffold the application.

---

## Table of Contents

1. Overview
2. Objective
3. Core Features
4. Compliance & Deliverability
5. Tech Stack
6. System Architecture
7. Data Model
8. API Surface
9. User Flow
10. Non-Functional Requirements
11. Nice-to-Have Features
12. Testing & Deployment

---

## 1. Overview

A web application for sending personalized bulk emails where **each recipient receives an individual email** — not a BCC, CC, or mailing-list send. Every message is generated and delivered as its own transaction, addressed to one recipient, with merge fields filled in from that recipient's row of data.

## 2. Objective

Let a user upload a list of recipients and send a customized email to each person individually, so that every email reads as if it were written and sent to that one person, at a volume that would be impractical to do by hand.

---

## 3. Core Features

### 3.1 Recipient Upload & Import

Import recipients from:

- Excel (`.xlsx`)
- CSV
- PDF (extract email addresses/tables)
- Manual entry

Expected columns — auto-detected on upload:

| Name | Email | Company | Role |
|---|---|---|---|
| John Doe | john@gmail.com | Google | Recruiter |
| Alice | alice@microsoft.com | Microsoft | HR |

`Name` and `Email` are required; `Company` and `Role` are optional; any additional columns in the source file are picked up as custom fields automatically. If auto-detection is ambiguous, show a column-mapping step before import.

### 3.2 Email Personalization

Merge-field syntax:

```
{{name}}  {{company}}  {{role}}  {{email}}  {{custom_field}}
```

Template:

```
Hi {{name}},

I came across your profile at {{company}} and wanted to reach out regarding...

Thanks,
Harsh
```

Rendered:

```
Hi John,

I came across your profile at Google and wanted to reach out regarding...

Thanks,
Harsh
```

Handle the edge cases explicitly: a fallback value (or blank) for missing fields, and a pre-send warning listing any placeholder in the template with no matching column.

### 3.3 Rich Email Editor

- Subject line field (also supports merge fields)
- Rich text (WYSIWYG) editor
- Markdown mode
- HTML preview / plain-text preview toggle
- Reusable signature block
- Links, inline images, standard formatting (bold, lists, headers, etc.)

### 3.4 Individual (1:1) Delivery Engine

No BCC, CC, or mailing-list sends. Each recipient gets their own message, generated and dispatched as a separate transaction:

```text
for recipient in recipient_list:
    rendered = render(template, recipient.fields)
    send_email(
        to=recipient.email,
        subject=rendered.subject,
        body=rendered.body,
        attachments=resolve_attachments(recipient),
    )
    wait(random(delay_min_seconds, delay_max_seconds))
```

Each recipient only ever sees their own address in the `To:` field.

### 3.5 Email Providers

| Provider | Method |
|---|---|
| Gmail | SMTP or OAuth2 (Gmail API) |
| Outlook / Microsoft 365 | SMTP or OAuth2 (Microsoft Graph) |
| Generic SMTP | Username/password or app password |
| Amazon SES | API |
| SendGrid | API (SDK) |
| Mailgun | API |
| Resend | API |

Providers sit behind a common adapter interface (`send(message) -> DeliveryResult`) so the app can switch providers per campaign without touching the sending logic.

### 3.6 Attachments

- A single shared attachment for every recipient (e.g. a portfolio PDF)
- Per-recipient personalized attachments (e.g. a resume variant addressed to each company)
- Supported types: PDF, DOCX, common image formats

### 3.7 Email Preview

Before sending, show the exact rendered email per recipient:

```
Recipient: John

Subject: Application for Backend Engineer

Body:
Hi John,
...
```

Include a "send test to myself" action.

### 3.8 Send Controls

- Send immediately or schedule for later
- Fixed delay or randomized delay range between sends (e.g. 30–90 sec) — see [§4](#4-compliance--deliverability) for why this matters beyond just pacing
- Pause / Resume / Cancel a running campaign
- Configurable concurrency (how many sends can be in flight at once)

### 3.9 Campaign Dashboard

Live view of:

- Total recipients
- Sent / Pending / Failed
- Success rate
- Estimated completion time

### 3.10 Error Handling

- Categorize failures: invalid email, SMTP error, rate limit, authentication failure, bounce
- Automatic retry with exponential backoff
- Manual re-send for individual failures
- Export failed recipients to CSV

### 3.11 Logging

Per-send record: recipient, subject, send time, status, error message. Exportable as CSV.

### 3.12 Duplicate Detection

Detect duplicate email addresses on import (normalized, case-insensitive). Ask the user whether to skip, merge, or send anyway.

### 3.13 Validation

Before sending:

- Validate email format
- Drop blank rows
- Warn about unmapped/missing placeholders
- Flag unrecognized columns

### 3.14 Draft Saving

Save draft campaigns, templates, and recipient lists so they can be resumed or reused later.

### 3.15 Email Templates

Built-in starting templates: Job Application, Recruiter Outreach, Internship, Follow-up, Cold Email, Networking, Sales Outreach. Users can create, edit, and save their own.

### 3.16 Campaign History

Archive of past campaigns: name, recipient count, success rate, date sent.

### 3.17 Search & Filter

Search/filter recipients by name, company, email, or send status.

### 3.18 Security

- Encrypt SMTP credentials and OAuth tokens at rest
- Never store passwords in plaintext
- Secrets via environment variables / a secrets manager, never hardcoded or logged

---

## 4. Compliance & Deliverability

Not in the original brief, but worth building in from day one — at the recipient volumes this app targets, skipping this is what gets a sending domain or account blocked rather than just flagged.

**Authentication.** Gmail, Yahoo, and Microsoft now require SPF and DKIM on any sending domain, plus a published DMARC record (at minimum `p=none`) with the `From:` domain aligned to the SPF or DKIM organizational domain. Without this, mail doesn't just land in spam — Gmail returns outright rejection errors.

**Bulk-sender threshold.** Once a domain sends roughly 5,000+ messages a day to Gmail addresses, Google classifies it as a bulk sender — permanently, even if volume later drops. Bulk senders must additionally keep spam complaints well under Gmail's block threshold (0.3% is the hard ceiling; the safer operating target is under ~0.1%) and support one-click unsubscribe (`List-Unsubscribe` / `List-Unsubscribe-Post` headers per RFC 8058, plus a visible unsubscribe link in the body). Google treats cold outreach as commercial mail for this purpose regardless of how it's framed internally.

**Enforcement got stricter recently.** Non-compliant bulk mail used to get a temporary deferral (SMTP 421); as of November 2025 it's a permanent rejection (SMTP 550). This is worth designing around rather than discovering mid-campaign.

**Per-account caps are separate from the above.** Personal Gmail (SMTP or API) tops out around 500 recipients/day, Google Workspace around 2,000/day; Outlook/Microsoft 365 has comparable daily ceilings. These are hard limits regardless of in-app throttling. For the 10,000+ recipient scale target, route volume through a transactional ESP (SES, SendGrid, Mailgun, Resend) with a properly authenticated sending domain — treat personal SMTP/OAuth as a low-volume option, not the primary path at scale.

**Sender identity.** Use a real, consistent `From` name/address and a footer identifying the sender. This is both a platform requirement for bulk mail and, in the US, a legal one under the CAN-SPAM Act (accurate header info, no deceptive subject lines, a valid postal address, a working opt-out honored promptly).

**Jurisdiction.** Rules on unsolicited email differ by country and by B2B vs. B2C context (CAN-SPAM in the US, GDPR/ePrivacy in the EU/UK, India's IT Act/DPDP Act, etc.). Worth a quick compliance check appropriate to where the recipient list is based, especially if the tool is ever used beyond personal outreach.

**Practical implication for the delay/throttling feature ([§3.8](#38-send-controls)):** randomized delays and per-provider rate limits aren't just about mimicking a human — they're what keeps the sending pattern inside each provider's tolerance and protects the sender's domain/IP reputation for future campaigns.

---

## 5. Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS, ShadCN UI, React Hook Form |
| Backend | FastAPI, Python, Celery, Redis |
| Database | PostgreSQL |
| ORM | SQLAlchemy |
| File processing | pandas, openpyxl, pdfplumber, PyPDF2 |
| Email sending | smtplib, aiosmtplib, OAuth2, SendGrid SDK, Resend SDK |
| Auth | JWT, OAuth |
| Deployment | Docker, Docker Compose |

---

## 6. System Architecture

```text
┌─────────────┐   REST    ┌───────────────┐          ┌───────────────┐
│  Next.js     │◀────────▶│  FastAPI       │─────────▶│  PostgreSQL    │
│  Frontend    │           │  API Server    │          │  (recipients,  │
└─────────────┘           └───────┬───────┘          │  campaigns,    │
                                    │ enqueue task      │  templates,    │
                                    ▼                   │  logs)         │
                            ┌───────────────┐          └───────────────┘
                            │  Redis         │
                            │  (Celery broker│
                            │  + rate limits)│
                            └───────┬───────┘
                                    ▼
                            ┌───────────────┐          ┌────────────────────┐
                            │  Celery        │─────────▶│  Provider Adapters  │
                            │  Workers       │          │  SMTP / OAuth / SES │
                            │  (send queue,  │          │  SendGrid / Mailgun │
                            │  retries,      │          │  / Resend           │
                            │  throttling)   │          └────────────────────┘
                            └───────────────┘
```

One Celery task per recipient per campaign, so pausing, retrying, or rate-limiting operates at the individual-send level rather than the whole batch.

---

## 7. Data Model

**users**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | string | unique |
| password_hash | string | omit if using external OAuth only |
| created_at | timestamp | |

**provider_configs**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK → users |
| provider_type | enum | `smtp`, `gmail_oauth`, `outlook_oauth`, `ses`, `sendgrid`, `mailgun`, `resend` |
| display_name | string | e.g. "Work Gmail" |
| credentials_encrypted | bytes | encrypted at rest |
| daily_limit | integer | provider-specific cap |
| is_active | boolean | |

**recipient_lists**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK |
| name | string | |
| source_filename | string | original upload name |
| column_map | jsonb | detected/user-confirmed column mapping |
| created_at | timestamp | |

**recipients**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| list_id | UUID | FK → recipient_lists |
| name | string | |
| email | string | validated, indexed |
| company | string | nullable |
| role | string | nullable |
| custom_fields | jsonb | arbitrary extra columns |
| is_duplicate | boolean | |
| status | enum | `pending`, `sent`, `failed`, `skipped` |

**templates**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK |
| name | string | |
| category | string | Job Application, Cold Email, etc. |
| subject | string | supports merge fields |
| body_html | text | |
| body_markdown | text | |
| created_at | timestamp | |

**campaigns**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| user_id | UUID | FK |
| name | string | |
| template_id | UUID | FK |
| recipient_list_id | UUID | FK |
| provider_config_id | UUID | FK |
| status | enum | `draft`, `scheduled`, `sending`, `paused`, `completed`, `cancelled` |
| scheduled_at | timestamp | nullable |
| delay_min_seconds | integer | |
| delay_max_seconds | integer | |
| created_at | timestamp | |

**email_logs**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| campaign_id | UUID | FK |
| recipient_id | UUID | FK |
| rendered_subject | text | |
| status | enum | `pending`, `sent`, `failed`, `bounced` |
| provider_message_id | string | nullable |
| error_message | text | nullable |
| retry_count | integer | |
| sent_at | timestamp | nullable |

**attachments**

| Field | Type | Notes |
|---|---|---|
| id | UUID | PK |
| campaign_id | UUID | FK, nullable if attached at template level |
| recipient_id | UUID | FK, nullable if shared across all recipients |
| file_path | string | |
| is_personalized | boolean | |

---

## 8. API Surface

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/recipients/upload` | Upload xlsx/csv/pdf; returns detected columns + row preview |
| POST | `/api/recipients/lists` | Create a recipient list from parsed/mapped data |
| GET | `/api/recipients/lists/{id}` | List metadata + stats |
| GET | `/api/recipients/lists/{id}/recipients` | Paginated recipients, filterable by name/company/status |
| POST | `/api/templates` | Create a template |
| GET | `/api/templates` | List templates |
| PUT | `/api/templates/{id}` | Update a template |
| DELETE | `/api/templates/{id}` | Delete a template |
| POST | `/api/providers` | Add a provider config (SMTP/OAuth/API key) |
| GET | `/api/providers` | List configured providers |
| POST | `/api/providers/{id}/test` | Send a test email through this provider |
| POST | `/api/campaigns` | Create a campaign (template + list + provider + send settings) |
| GET | `/api/campaigns/{id}/preview` | Rendered preview per recipient (paginated) |
| POST | `/api/campaigns/{id}/start` | Begin sending |
| POST | `/api/campaigns/{id}/pause` | Pause an in-progress campaign |
| POST | `/api/campaigns/{id}/resume` | Resume a paused campaign |
| POST | `/api/campaigns/{id}/cancel` | Cancel remaining sends |
| GET | `/api/campaigns/{id}/status` | Live counts: sent/pending/failed/success rate/ETA |
| GET | `/api/campaigns/{id}/logs` | Send logs, filterable by status, exportable as CSV |
| GET | `/api/campaigns` | Campaign history |

---

## 9. User Flow

1. Upload Excel, CSV, or PDF containing recipient data.
2. Review and map columns.
3. Compose or select an email template.
4. Insert merge fields for personalization.
5. Preview individual rendered emails.
6. Choose an email provider.
7. Configure sending options (immediate, scheduled, delays).
8. Send each email as a separate message.
9. Monitor progress on the live dashboard.
10. Export logs and failed recipients.

---

## 10. Non-Functional Requirements

- Each recipient **must** receive a separate email — never BCC/CC for bulk sending.
- Scale to **10,000+ recipients** per campaign via background workers (Celery + Redis).
- Respect provider rate limits with configurable throttling and exponential-backoff retries (see [§4](#4-compliance--deliverability)).
- Clean, modular, production-quality code with proper error handling, logging, and documentation.
- REST API plus a responsive web UI.
- Unit tests, Docker configuration, and a README with setup/deployment instructions.

---

## 11. Nice-to-Have Features

**AI & personalization**
- AI-assisted email writing
- AI subject-line suggestions
- AI-generated personalized opening lines from LinkedIn/company info, where available

**Deliverability & testing**
- Spam-score estimation before send
- A/B testing between subject lines or body variants

**Tracking & analytics**
- Open tracking / click tracking, where supported by the provider
- Campaign analytics dashboard over time

**Data & integrations**
- Recipient segmentation
- Import from Google Sheets / Google Contacts
- Company logo detection
- Resume auto-attachment based on role/company

**Platform**
- Multi-user support
- Dark mode

---

## 12. Testing & Deployment

**Unit tests:**
- Merge-field rendering engine (including missing-field and malformed-placeholder cases)
- Provider adapters (mocked transport)
- Retry/backoff logic
- Validation layer (email format, duplicate detection)

**Integration tests:**
- Full campaign lifecycle: create → preview → start → pause/resume → complete → export logs

**Deployment (Docker Compose services):**
- `frontend` — Next.js
- `api` — FastAPI
- `worker` — Celery
- `redis`
- `postgres`

Include a README covering local setup, required environment variables (provider credentials, DB connection, secret keys), and deployment steps.
