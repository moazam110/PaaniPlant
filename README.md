# The Paani™ — Water Delivery Management System

A full-stack, mobile-first water delivery management system for RO plant businesses. Provides separate portals for **Admin**, **Staff**, and **Customers** with real-time synchronisation, a complete khata/ledger system, PDF billing, and WhatsApp integration.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Portals](#portals)
   - [Landing Page](#landing-page)
   - [Admin Portal](#admin-portal)
   - [Staff Portal](#staff-portal)
   - [Customer Portal](#customer-portal)
5. [Customer Dashboard — Deep Dive](#customer-dashboard--deep-dive)
6. [Payment & Ledger System](#payment--ledger-system)
7. [Real-Time WebSocket Layer](#real-time-websocket-layer)
8. [API Reference](#api-reference)
9. [Database Models](#database-models)
10. [Installation & Setup](#installation--setup)
11. [Environment Variables](#environment-variables)
12. [Scripts](#scripts)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                        │
│                                                                 │
│   ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│   │  Admin      │  │  Staff      │  │  Customer            │   │
│   │  Portal     │  │  Portal     │  │  Portal              │   │
│   │  /admin     │  │  /staff     │  │  /customer/dashboard │   │
│   └──────┬──────┘  └──────┬──────┘  └──────────┬───────────┘   │
│          │                │                    │               │
│          └────────────────┼────────────────────┘               │
│                           │                                     │
│              ┌────────────▼────────────┐                        │
│              │   Next.js 15 App Router │                        │
│              │   (port 9002 / build)   │                        │
│              └────────────┬────────────┘                        │
└───────────────────────────┼─────────────────────────────────────┘
                            │  HTTP REST + WebSocket
            ┌───────────────▼───────────────────┐
            │        Express.js Backend          │
            │        backend/index.js            │
            │        (port 4000)                 │
            │                                   │
            │  REST API  │  WebSocket (4001)     │
            └───────────────────────────────────┘
                            │
            ┌───────────────▼───────────────────┐
            │         MongoDB Atlas              │
            │  (Customers, Requests, Payments,  │
            │   Credentials, Notifications)     │
            └───────────────────────────────────┘
```

### Request Lifecycle

```
Customer / Admin creates request
          │
          ▼
    [pending]  ──────────────────────────────────────►  [cancelled]
          │                                            (admin/staff/
          ▼                                            customer/system)
  [pending_confirmation]
          │
          ▼
    [processing]  ──────────────────────────────────►  [cancelled]
          │
          ▼
    [delivered]
```

---

## Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | Next.js 15.3 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI Library | React 18, Radix UI primitives |
| Styling | Tailwind CSS 3.4, tailwindcss-animate |
| Components | shadcn/ui |
| Charts | Recharts 2.15 |
| PDF Export | jsPDF 4.2 + jspdf-autotable |
| Excel Export | XLSX 0.18 |
| Date Handling | date-fns 3.6 |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| AI | Google Genkit 1.8 |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express.js |
| Database | MongoDB Atlas + Mongoose |
| Real-time | WebSocket (`ws` library, port 4001) |
| Email | Resend + Nodemailer |
| File Uploads | Multer |
| Caching | node-cache (5 s TTL) |
| Timezone | PKT UTC+5 (`BUSINESS_TZ_OFFSET_MINUTES=300`) |

---

## Project Structure

```
PaaniPlant/
├── backend/
│   ├── index.js              # Express server + all API routes (≈2,900 lines)
│   └── package.json
│
├── src/
│   ├── app/                  # Next.js App Router pages
│   │   ├── layout.tsx        # Root layout (fonts, metadata, Toaster)
│   │   ├── page.tsx          # Landing page (portal selector)
│   │   ├── globals.css       # Global CSS + glass-table utility
│   │   ├── admin/
│   │   │   ├── page.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── customer-access/page.tsx
│   │   ├── staff/
│   │   │   ├── page.tsx
│   │   │   └── login/page.tsx
│   │   └── customer/
│   │       ├── login/page.tsx
│   │       └── dashboard/page.tsx
│   │
│   ├── components/
│   │   ├── ui/               # 50+ shadcn/ui primitives
│   │   ├── admin/
│   │   │   ├── AdminDashboardClient.tsx
│   │   │   ├── AdminBulkBillsDialog.tsx     # Bulk PDF billing + WhatsApp
│   │   │   ├── AdminDeliveriesReportDialog.tsx
│   │   │   ├── CustomerAccessManagement.tsx
│   │   │   ├── CustomerList.tsx
│   │   │   ├── DeliveryRequestList.tsx
│   │   │   ├── TabNavigation.tsx
│   │   │   └── tabs/
│   │   │       ├── CustomersTab.tsx
│   │   │       ├── DeliveryTab.tsx
│   │   │       ├── PaymentsTab.tsx          # Khata ledger
│   │   │       ├── RecurringTab.tsx
│   │   │       └── StatsTab.tsx
│   │   ├── staff/
│   │   │   └── StaffDashboardClient.tsx
│   │   ├── customer/
│   │   │   ├── CustomerDashboardClient.tsx  # Main customer UI
│   │   │   ├── CustomerLoginForm.tsx
│   │   │   ├── CustomerRequestHistory.tsx   # Responsive request table
│   │   │   └── CustomerBillDialog.tsx       # Monthly bill viewer
│   │   ├── forms/
│   │   │   ├── CustomerForm.tsx
│   │   │   ├── AddCustomerForm.tsx
│   │   │   └── CreateDeliveryRequestForm.tsx
│   │   ├── requests/
│   │   │   ├── RequestQueue.tsx
│   │   │   └── RequestCard.tsx
│   │   └── shared/
│   │       ├── Header.tsx
│   │       └── Footer.tsx
│   │
│   ├── hooks/
│   │   ├── use-websocket.ts  # WS with exponential-backoff reconnection
│   │   ├── use-toast.ts
│   │   └── use-mobile.tsx
│   │
│   ├── lib/
│   │   ├── api.ts            # buildApiUrl, API_ENDPOINTS
│   │   ├── server-api.ts     # SSR fetch helpers
│   │   ├── api-cache.ts      # Client-side response cache
│   │   ├── data-utils.ts     # Hash-based change detection
│   │   ├── search-utils.ts
│   │   └── utils.ts          # cn() utility
│   │
│   └── types/index.ts        # Customer, DeliveryRequest, AdminUser …
│
├── next.config.ts            # API rewrites → paani-b.onrender.com
├── tailwind.config.ts
└── package.json
```

---

## Portals

### Landing Page

The root page (`/`) presents three animated portal entry points.

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│   ≡  The Paani™                         [menu icon] │
│                                                      │
│         ┌──────────────────────────────┐             │
│         │     Animated gradient bg     │             │
│         │   ┌─────────┐               │             │
│         │   │  ADMIN  │               │             │
│         │   └─────────┘               │             │
│         │   ┌─────────┐               │             │
│         │   │  STAFF  │               │             │
│         │   └─────────┘               │             │
│         │   ┌──────────┐              │             │
│         │   │ CUSTOMER │              │             │
│         │   └──────────┘              │             │
│         └──────────────────────────────┘             │
│                                                      │
└──────────────────────────────────────────────────────┘
```

- Animated floating orb background with radial gradients
- Hamburger menu (Sheet) shows company info, address, WhatsApp, Google Maps
- Auto-redirect logic: returns to last portal on revisit via `sessionStorage`

---

### Admin Portal

#### Tabs

```
Admin Dashboard
├── Deliveries Tab    — queue view, status transitions, filter panel
├── Customers Tab     — add/edit customers, grant portal access
├── Payments Tab      — Khata ledger, record payments, delete with reason
├── Recurring Tab     — automated daily/weekly request schedules
└── Stats Tab         — charts (yearly/monthly/daily/day-of-week)
```

#### Key Features

| Feature | Description |
|---|---|
| Bulk Billing | Generate PDF bills for multiple customers at once; send via WhatsApp sequentially |
| Deliveries Report | CSV/XLSX export of filtered delivery data |
| Customer Access | Grant/revoke customer portal login; set username + password |
| Notifications | Bell icon with unread count; filters for payments vs. request events |
| Dark Mode | Class-based toggle persisted in localStorage |
| Stats Charts | Recharts-powered line/bar charts per time range |

#### Bulk Bills Dialog — Flow

```
Select date range / Full Month
         │
         ▼
Select payment type (All / Cash / Account)
  [or enable Specific Customer ID checkbox → enter ID]
         │
         ▼
[Generate Bills]  →  fetches ledger per customer  →  calculates netPayable
         │
         ▼
Preview table: ID · Customer · Cans · Billed · Paid · Net Due (PAID badge or Rs X DUE)
         │
    ┌────┴────┐
    │         │
Download   Send All
All PDF    Sequentially
               │
               ▼
         Step-by-step WhatsApp
         open per customer
         Skip / Done / Prev navigation
         Progress bar
```

---

### Staff Portal

```
Staff Dashboard
├── Request Queue     — all active requests (pending → processing → delivered)
├── Status Updates    — tap card to change status
└── Real-time Sync    — WebSocket subscription to 'staff' room
```

Staff see the same delivery queue as admin but cannot manage customers or access billing.

---

### Customer Portal

See the [Customer Dashboard — Deep Dive](#customer-dashboard--deep-dive) section below.

---

## Customer Dashboard — Deep Dive

### Route
`/customer/dashboard` — protected by customer credential login (`/customer/login`).

### Overview Layout

```
┌─────────────────────────────────────────────────────┐
│  The Paani™                          [🔔] [Account] │  ← Header bar
│  Welcome, Muhammad Ali                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [  Request Water  ]   [  View Bill  ]              │  ← Action buttons
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Request History                                    │  ← Table section
│  ┌───────────────────────────────────────────────┐  │
│  │ Date  │ Cans │ Priority │ Status │ Price │ ... │  │
│  │ ...   │      │          │        │       │     │  │
│  └───────────────────────────────────────────────┘  │
│                  [Load More]                        │
│                                                     │
├─────────────────────────────────────────────────────┤
│  Footer                                             │
└─────────────────────────────────────────────────────┘
```

### Header Bar Components

```
The Paani™          [Notifications Bell]  [Account Balance Popover]
     │                      │                        │
  dark navy              Popover with             Popover with
  hsl(231,55%,28%)       unread count             ledger + balance
                          badge
                         Tabs: All / Payments / Price
```

### Notification System

- Bell icon with unread badge (capped at `9+`)
- Popover with tab filter: **All**, **Payments**, **Price**
- Marks all as read on open
- Data sourced from `/api/notifications/customer/:id` + `/api/payment-notifications/customer/:id`

### Account Balance Popover

```
┌─────────────────────────────┐
│  Account Balance            │  ← sticky header
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │  Rs 450 DUE          │    │  ← top summary (green=ADV, red=DUE, muted=Settled)
│  └─────────────────────┘    │
│                             │
│  MONTHLY SUMMARY            │
│  ┌─────────────────────┐    │
│  │ April 2026          │    │
│  │ Billed Rs 700        │    │
│  │ Paid Rs 250   DUE   │    │  ← dueForMonth from FIFO ledger
│  └─────────────────────┘    │
│                             │
│  PAYMENT RECORDS            │
│  ┌─────────────────────┐    │
│  │ Rs 250  (green)      │    │  ← payment amount always green
│  │ 30 Apr 2026 · Cash   │    │
│  └─────────────────────┘    │
└─────────────────────────────┘
```

- `dueForMonth` from backend FIFO ledger (not `runningBalance`)
- Scrollable inner content (`max-h-80 overflow-y-auto`)
- Fetches from `/api/payments/ledger/:id`

### Request Water Flow

```
[Request Water button]
         │
         ▼
Sheet opens (bottom drawer on mobile)
         │
         ▼
CustomerRequestForm
  • Cans (1–20, default = customer.defaultCans)
  • Priority (Normal / Urgent)
  • Optional note
         │
         ▼
POST /api/delivery-requests
{ customerId, cans, priority, createdBy: 'customer_portal' }
         │
         ▼
Success → close sheet → refresh history
```

- Duplicate guard: if active request already exists, button shows cooldown
- Rate limit: backend enforces 1 request / 5 seconds per customer

### View Bill Flow

```
[View Bill button]
         │
         ▼
CustomerBillDialog opens
         │
  Fetches /api/payments/ledger/:id
         │
  Displays monthly breakdown:
  • Billed amount
  • Payments received
  • Outstanding balance (DUE / ADV / Settled)
         │
  [Download PDF] button
```

### Request History Table

The table adapts to screen orientation:

```
Portrait mode (phone upright):
┌──────────────┬──────┬──────────────────┬────────────┐
│ Date         │ Cans │ Status           │ Created By │
│ 1 Apr 26     │  4   │ ✓ Delivered      │ Customer   │
│ 18 Apr 26    │  3   │ ⊘ Cancelled      │ Admin      │
│              │      │   Door Closed    │            │
└──────────────┴──────┴──────────────────┴────────────┘

Landscape mode (phone sideways / desktop):
+ Priority | Price/Can | Payment | Time columns revealed
```

#### Column Behaviour

| Column | Portrait | Landscape | Notes |
|---|---|---|---|
| Date | ✓ `d MMM yy` | ✓ `d MMM yyyy, HH:mm` | `whitespace-nowrap`, `font-semibold` |
| Cans | ✓ | ✓ | `font-black text-primary/80` |
| Priority | ✗ | ✓ | Normal / Urgent badge |
| Status | ✓ | ✓ | Icon + badge, cancellation reason below |
| Price/Can | ✗ | ✓ | |
| Payment | ✗ | ✓ | Cash / Account badge |
| Time | ✗ | ✓ | Delivery duration from request |
| Created By | ✓ | ✓ | Customer / Admin badge |

#### Status Badge Colours

```
pending              → default (blue)
pending_confirmation → secondary (muted)
processing           → default (blue) + amber row bg
delivered            → outline + green row bg  + ✓ icon
cancelled            → outline + muted row     + ✗ icon
```

#### Table Padding Override

The wrapper uses Tailwind arbitrary variants with `!important` to override shadcn's default `px-4`:

```html
<div class="[&_th]:!px-1 [&_td]:!px-1
            [&_th:first-child]:!pl-2 [&_td:first-child]:!pl-2
            [&_th:last-child]:!pr-2  [&_td:last-child]:!pr-2">
```

### Load More Pagination

```
GET /api/delivery-requests?customerId=X&page=N&limit=20
         │
         ▼
hasMore = total > page * limit
         │
    [Load More] button visible when hasMore=true
         │
         ▼
Appends next page to existing list
```

---

## Payment & Ledger System

### FIFO Ledger Logic

Payments are applied to outstanding months in chronological order (oldest first).

```
Example: Customer billed Rs 700 in April, pays Rs 250 in May

Month        Billed    Paid(FIFO)   dueForMonth
─────────────────────────────────────────────
April 2026    700         250          450
```

**Retroactive FIFO (backend):** Payments made after the delivery month (e.g., May payment covering April bill) are redistributed via a post-delivery credit loop:

```javascript
let postDeliveryCredit = 0;
// Accumulate payments from months after last delivery month
for (const pm of futureMonths) {
  postDeliveryCredit += paymentsByMonth[pm];
}

// Apply credit to oldest due months first
let retroCredit = postDeliveryCredit;
for (const entry of ledger) {
  if (retroCredit <= 0) break;
  if (entry.dueForMonth > 0) {
    const apply = Math.min(retroCredit, entry.dueForMonth);
    entry.dueForMonth -= apply;
    retroCredit -= apply;
  }
}
```

### Balance Terminology

| Value | Meaning |
|---|---|
| `finalBalance > 0` | Customer has **advance** (overpaid) |
| `finalBalance < 0` | Customer has **due** (underpaid) |
| `finalBalance = 0` | Fully settled |
| `netPayable` | `-finalBalance` when negative, else 0 |
| `advanceCredit` | `finalBalance` when positive, else 0 |
| `dueForMonth` | Per-month outstanding after FIFO |

### PDF Bill Summary

```
Current period bill:         Rs. 700
+ Previous outstanding dues:
    February 2026          + Rs. 200
Paid:                      - Rs. 900
────────────────────────────────────
TOTAL PAYABLE:                  PAID   ← green when netPayable = 0
                                       ← "Rs. X" in blue when still owed

Advance on account: Rs. 550 (will apply to next billing)  ← italic note if advance exists
```

### Admin Payments Tab

```
Customer List
  ─ search by name / ID
  ─ filter: All / Cash / Account
  ─ each card shows:
      Customer name (#ID)
      Billed Rs X · Paid Rs X (green)   ← tabular-nums aligned
      Rs X   ← right, font-bold
      DUE    ← 10px uppercase (red) or ADV (green) or Settled

Click customer → Sheet opens:
  ┌ Current status banner (DUE / ADV / Settled) ┐
  ├ Monthly Ledger (FIFO per month)              │
  │  April 2026                    Rs 450        │
  │  Billed Rs 700 · Paid Rs 250   DUE           │
  ├ Record Payment form                          │
  │  Amount (Rs) + Note + [Add Payment]          │
  └ Payment Records (amount in green, date/note) ┘
```

---

## Real-Time WebSocket Layer

### Connection

```
Frontend hook: useWebSocket(room, onMessage?)
                    │
        ws://localhost:4001 (dev)
        wss://paani-b.onrender.com (prod)
                    │
           Sends: { type: 'subscribe', room }
           Receives: broadcast events
```

### Reconnection Strategy

```
Attempt 1: wait 1 s
Attempt 2: wait 2 s
Attempt 3: wait 4 s
...exponential backoff...
Max interval: ~30 s
```

### Rooms & Events

| Room | Used By | Events |
|---|---|---|
| `admin` | Admin dashboard | request created/updated, customer changes, metrics |
| `staff` | Staff dashboard | request status updates |
| `customer` | Customer portal | own request status updates, forced logout |

---

## API Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/customer-credentials/login` | Customer login |
| POST | `/api/register-request` | Customer self-registration |

### Customers
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/customers` | List (paginated, filterable) |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer |
| GET | `/api/customers/:id/stats` | Stats for one customer |
| GET | `/api/customers/:id/active-requests` | Active requests |
| GET | `/api/customers/stats-summary` | Aggregate stats |

### Delivery Requests
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/delivery-requests` | List (paginated, filterable) |
| POST | `/api/delivery-requests` | Create request |
| PUT | `/api/delivery-requests/:id` | Update details |
| PUT | `/api/delivery-requests/:id/status` | Transition status |
| POST | `/api/delivery-requests/:id/cancel` | Cancel with reason |
| DELETE | `/api/delivery-requests/:id` | Hard delete |

### Payments / Ledger
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/payments` | List payments |
| POST | `/api/payments` | Record payment |
| DELETE | `/api/payments/:id` | Delete (with reason) |
| GET | `/api/payments/balances` | All customer balances |
| GET | `/api/payments/ledger/:customerId` | FIFO ledger + finalBalance |
| GET | `/api/payments/summary/:customerId` | Summary for billing |

### Notifications
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/notifications/admin` | Admin notifications |
| GET | `/api/notifications/customer/:id` | Customer notifications |
| PUT | `/api/notifications/:id/read` | Mark read |
| PUT | `/api/notifications/admin/read-all` | Mark all admin read |
| PUT | `/api/notifications/customer/:id/read-all` | Mark all customer read |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/dashboard/metrics` | Summary metrics |
| GET | `/api/stats/chart/yearly` | Yearly chart data |
| GET | `/api/stats/chart/monthly` | Monthly chart data |
| GET | `/api/stats/chart/daily` | Daily chart data |
| GET | `/api/stats/chart/dayofweek` | Day-of-week chart |

### Recurring Requests
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/recurring-requests` | List schedules |
| POST | `/api/recurring-requests` | Create schedule |
| PUT | `/api/recurring-requests/:id` | Update schedule |
| DELETE | `/api/recurring-requests/:id` | Remove schedule |

### Customer Credentials
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/customer-credentials` | List all |
| POST | `/api/customer-credentials` | Create / update |
| PUT | `/api/customer-credentials/:customerId` | Update |
| DELETE | `/api/customer-credentials/:customerId` | Revoke access |

---

## Database Models

### Customer
```
id          : Number  (auto-increment, sequential)
name        : String
phone       : String
address     : String
defaultCans : Number
pricePerCan : Number
notes       : String
paymentType : 'cash' | 'account'
createdAt   : Date
updatedAt   : Date
```

### DeliveryRequest
```
customerId          : ObjectId  → Customer
customerIntId       : Number    (denormalized)
customerName        : String    (denormalized)
address             : String    (denormalized)
cans                : Number
priority            : 'normal' | 'urgent'
status              : 'pending' | 'pending_confirmation' | 'processing' | 'delivered' | 'cancelled'
requestedAt         : Date
processingAt        : Date
deliveredAt         : Date
cancelledAt         : Date
cancelledBy         : 'admin' | 'staff' | 'customer' | 'system'
cancellationReason  : enum (door_closed | duplicate | other | ...)
pricePerCan         : Number    (denormalized at creation time)
paymentType         : String    (denormalized)
createdBy           : 'admin' | 'staff' | 'customer_portal'
```

**Indexes:**
- Unique partial index on `(customerId, status)` for active statuses → prevents duplicate active requests per customer

### Payment
```
customerId : ObjectId → Customer
amount     : Number
date       : Date
forMonth   : String  ('YYYY-MM')
note       : String
```

### CustomerCredential
```
customerId         : ObjectId → Customer
username           : String
passwordHash       : String
hasDashboardAccess : Boolean
```

### Notification
```
type        : 'requestCancelled' | 'newCustomer' | 'requestCreated' | 'generic'
customerId  : ObjectId
message     : String
relatedDocId: String
isRead      : Boolean
createdAt   : Date
```

---

## Installation & Setup

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- npm or yarn

### 1. Clone & Install

```bash
# Frontend dependencies
npm install

# Backend dependencies
cd backend && npm install
```

### 2. Environment — Frontend

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

### 3. Environment — Backend

Create `backend/.env`:

```env
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.u5haqnr.mongodb.net/test
PORT=4000
WS_PORT=4001
NODE_ENV=development
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
BUSINESS_TZ_OFFSET_MINUTES=300
RESEND_API_KEY=re_...          # optional — email notifications
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev        # nodemon, port 4000 + WS 4001

# Terminal 2 — Frontend
npm run dev        # Next.js Turbopack, port 9002
```

### 5. Production Build

```bash
npm run build
npm start
```

---

## Environment Variables

| Variable | Where | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Frontend + Backend | Base URL for REST calls |
| `MONGO_URI` | Backend | MongoDB connection string |
| `PORT` | Backend | Express HTTP port (default 4000) |
| `WS_PORT` | Backend | WebSocket port (default 4001) |
| `BUSINESS_TZ_OFFSET_MINUTES` | Backend | Minutes offset for PKT (300 = UTC+5) |
| `NODE_ENV` | Backend | `development` or `production` |
| `RESEND_API_KEY` | Backend | Optional email via Resend |

---

## Scripts

### Frontend (`package.json`)

| Script | Command | Description |
|---|---|---|
| `dev` | `next dev --turbopack -p 9002` | Dev server with Turbopack |
| `build` | `next build` | Production build |
| `start` | `next start` | Serve production build |
| `lint` | `next lint` | ESLint |
| `typecheck` | `tsc --noEmit` | TypeScript type check |
| `genkit:dev` | `genkit start` | AI dev server |

### Backend (`backend/package.json`)

| Script | Command | Description |
|---|---|---|
| `dev` | `nodemon index.js` | Dev with auto-restart |
| `start` | `node index.js` | Production start |

---

## Duplicate Request Prevention

Three-layer guard prevents a customer from having multiple simultaneous active requests:

```
Layer 1 — Database
  Unique partial index: { customerId: 1, status: 1 }
  Only active statuses (pending, processing, …) are indexed

Layer 2 — Application (Backend)
  Checks for existing active request before inserting

Layer 3 — Rate Limiting (Backend)
  1 request per customerId per 5 seconds (node-cache TTL)
```

---

## Mobile Responsiveness

All dashboards are mobile-first:

- Request history table hides non-essential columns in portrait mode
- Bulk bills replaced table with card layout on mobile
- Sheet components (`side="bottom"` or `side="right"`) for forms/drawers
- `tabular-nums` on all amounts for consistent digit alignment
- `whitespace-nowrap` on date cells to prevent multi-line wrapping
- Orientation detection (`window.innerHeight > window.innerWidth`) for column toggling

---

*System-generated bills do not require a signature.*
