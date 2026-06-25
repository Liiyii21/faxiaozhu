# Legal Assistant Directus Backend

This project expects its own Directus instance for legal consultation operations.

## Local Start

1. Copy `directus/.env.example` to `directus/.env`.
2. Replace `DIRECTUS_KEY`, `DIRECTUS_SECRET`, and admin credentials.
3. Run `docker compose --env-file .env up -d` from this `directus` folder.
4. Set the frontend env to `VITE_DIRECTUS_URL=http://127.0.0.1:8057`.

## Operations Workflow

Use the backend as a legal lead and case intake workspace:

1. New lead: user submits a consultation, booking, or case detail from the H5 page.
2. Qualification: operator checks phone, issue type, evidence completeness, urgency, and budget fit.
3. Follow-up: assign an owner, set the next action, add notes, and move the record through the status pipeline.
4. Lawyer handoff: qualified records are marked `qualified` or `booked` and linked to the booking or case file.
5. Closeout: records are marked `closed`, `rejected`, or `archived` with a clear reason.

## Collections

Create these collections in Directus Studio:

- `legal_consultations`: first legal questions and lawyer callback requests.
- `legal_bookings`: video, phone, or offline appointment requests.
- `legal_cases`: case reference/detail records created from "view detail" flows.

## Shared Fields

Recommended fields for all three collections:

| Field | Type | Notes |
| --- | --- | --- |
| `name` | string | Client display name. |
| `phone` | string | PII; hide from roles that do not need contact access. |
| `source_page` | string | Expected value: `legal`. |
| `action_id` | string | `lawyer`, `booking`, or `detail`. |
| `context` | JSON | Frontend state such as query text and active tab. |
| `consent_accepted` | boolean | Required before follow-up. |
| `submitted_at` | datetime | Client submission time. |
| `status` | string | Pipeline enum below. Default `new`. |
| `owner` | string | Operator or lawyer currently responsible. |
| `priority` | string | `low`, `normal`, `high`, `urgent`. |
| `next_action` | string | Concrete next follow-up step. |
| `notes` | text | Internal handling notes. |

## Domain Fields

- `legal_consultations`: `issue_type`, `claim_amount`, `summary`, `evidence_status`, `preferred_time`.
- `legal_bookings`: `channel`, `time`, `appointment_status`, `lawyer_name`, `meeting_link`.
- `legal_cases`: `case_type`, `case_title`, `evidence_items`, `risk_level`, `recommended_path`.

## Status Pipeline

Use one consistent enum across collections:

- `new`: just submitted, not reviewed.
- `contacted`: first contact attempted.
- `qualified`: legal issue and contact info are valid.
- `booked`: appointment or lawyer handoff scheduled.
- `in_progress`: case material or consultation is being handled.
- `closed`: handled successfully.
- `rejected`: not suitable or invalid.
- `archived`: kept for record only.

## Dashboard Views

Create Directus Insights or saved filters for:

- Today's new legal leads by collection.
- Open follow-ups grouped by `status` and `owner`.
- Urgent records where `priority = urgent` and `status not in closed/rejected/archived`.
- Bookings for the next 7 days.
- Evidence incomplete cases where `evidence_status != complete`.

## Permissions

- Public role: allow user registration and login only.
- Authenticated role: create records in the three business collections; do not allow list/read/update of other users' records unless required.
- Operator role: read and update `status`, `owner`, `priority`, `next_action`, and `notes`.
- Lawyer role: read qualified/booked records and add handling notes.
- Admin role: manage users, records, files, roles, permissions, and Insights.

## Local Mock Admin

The repository also includes a development-only Directus-compatible mock server. Run it from the workspace root:

```bash
node scripts/start-local-directus.mjs
```

Open `http://127.0.0.1:8057` to view the local legal operations dashboard. The mock supports record creation, status updates, list metadata, and JSON export at `/admin/export`.
