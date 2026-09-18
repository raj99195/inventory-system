# Oxygen 2 — Inventory Management System

Production-grade inventory + asset management portal built for Oxygen 2 Innovation Pvt. Ltd.

**Design language:** STEMmantra (learn.stemmantra.com) — orange/cream/chocolate with pastel category accents.

---

## Stack

- **React 19 + Vite + TypeScript**
- **Tailwind CSS v4** (STEMmantra theme tokens)
- **Firebase Auth** (single admin, email/password)
- **Firestore** (writes locked to admin UID via rules)
- **Recharts** (dashboard graphs)
- **pdf.js** (client-side Zoho invoice parsing)
- **React Router v7 · TanStack Query · Zustand · Framer Motion · react-hot-toast**

---

## Setup

1. **Install**
   ```bash
   npm install
   ```

2. **Firebase project setup**
   - Create Firebase project → enable **Authentication (Email/Password)** and **Firestore**.
   - Create a single admin user in Auth console. Copy its UID.
   - Deploy `firestore.rules` — replace `REPLACE_WITH_ADMIN_UID` with the real UID.
     ```bash
     firebase deploy --only firestore:rules
     ```

3. **Env**
   Copy `.env.example` → `.env` and fill in Firebase config + admin UID.

4. **Run**
   ```bash
   npm run dev
   ```

---

## Foundation delivered

- STEMmantra design system (colors, fonts, radii, shadows)
- Full type system for products, stock, invoices, employees, assets, assignments, repairs, audit log
- Firebase Auth + protected routes
- Locked-down Firestore rules (only admin UID can write)
- Responsive sidebar layout with mobile drawer
- Login page with STEMmantra hero panel
- Dashboard with 4 chart types (area, pie, bar) + 8 stat cards + activity feed
- Placeholder pages for every module

## Next modules (in order)

1. **Product Master** — CRUD + image upload + SKU auto-gen
2. **Stock Movement** — manual entry, transaction ledger, filters
3. **Zoho Invoice Import** — pdf.js extraction, verification screen, duplicate check
4. **Employees + Assets** — full CRUD
5. **Assignments + Returns + Transfers** — with condition tracking
6. **Repairs**
7. **Reports + Excel/PDF/CSV export**
8. **Audit log viewer**
