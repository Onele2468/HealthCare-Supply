
# Smart Supply — Completion Report

## ✅ Completed modules
- **Authentication** — Supabase auth, sign-in/up, protected `_authenticated` layout.
- **Organizations** — create, settings, ownership/industry/description, currency (ZAR default), employee join codes.
- **Members & Invitations** — invite by email + token, join requests, roles.
- **Business Network** — directory search, connection requests, accept/reject/remove.
- **Product Catalog** — CRUD, empty-state, healthcare-friendly labels.
- **Inventory** — stock levels per warehouse.
- **Warehouses** — CRUD.
- **Purchase Orders** — buyer creates PO to supplier with line items, statuses.
- **Deliveries** — status tracking against POs.
- **Reports** — basic analytics.
- **Public REST API v1** — `/products`, `/inventory`, `/purchase-orders`, `/deliveries/:id`, `/restock`, `/companies`, `/connections` + API-key scopes.
- **Role-aware shell & dashboard** — sidebar + widgets vary by org.type.
- **Audit logs** — table + writes from key actions.

## 🟡 Partially completed
- **Suppliers/Customers page** — lists partners but no ratings, no supplier profile page, no "browse marketplace" experience distinct from the network directory.
- **Product Catalog** — no images, no batch/expiry, no barcode, no storage requirements, no categories.
- **Notifications** — audit-log only; no in-app notification centre.
- **Analytics/Reports** — basic totals; no supplier scorecards, no procurement KPIs.

## ❌ Missing modules
- **Quotations / RFQ workflow** (the biggest gap in the procurement flow)
- **Marketplace browse** (public supplier + product discovery UX)
- **Drivers & dispatch assignment**
- **Proof of Delivery capture**
- **WhatsApp Business notifications**
- **AI assistant (Ollama-first)**
- **Yoco payments / subscriptions**
- **Supplier ratings & reviews**
- **Batch/expiry tracking on inventory**
- **OpenAPI docs for the public API**

## 🎯 Recommended next module: **Quotations (RFQ → Quote → PO)**

Rationale: the master brief's procurement workflow explicitly requires
`Submit Procurement Request → Supplier Quotation → Accept → PO`. Today buyers
jump straight to PO. Quotations unblock the marketplace UX, price negotiation,
supplier comparison, and future AI quote-comparison — every downstream module
(analytics, AI, WhatsApp) depends on it.

---

# Plan — Quotations Module

## 1. Database (one migration)

New tables (all in `public`, RLS on, with GRANTs, `service_role` full, `authenticated` scoped):

```text
rfqs                       -- buyer's Request For Quotation
  id, buyer_org_id, supplier_org_id, rfq_number (auto),
  status ('draft'|'sent'|'quoted'|'accepted'|'rejected'|'expired'|'cancelled'),
  notes, needed_by (date), created_by, created_at, updated_at

rfq_items
  id, rfq_id, product_id (nullable — free-text allowed),
  description, quantity, unit_hint

quotations                 -- supplier's response to an RFQ
  id, rfq_id, supplier_org_id, buyer_org_id, quote_number (auto),
  status ('draft'|'sent'|'accepted'|'rejected'|'expired'|'withdrawn'),
  subtotal, tax, total, currency, valid_until,
  payment_terms, delivery_terms, notes,
  created_by, decided_by, decided_at, created_at, updated_at

quotation_items
  id, quotation_id, rfq_item_id, product_id (nullable),
  description, quantity, unit_price, line_total
```

RPCs (all SECURITY DEFINER, search_path=public):
- `create_rfq(_supplier_org, _needed_by, _notes, _items jsonb)` — buyer, must be connected to supplier.
- `send_rfq(_rfq_id)` — buyer, draft → sent.
- `submit_quotation(_rfq_id, _items jsonb, _valid_until, _payment_terms, _delivery_terms, _notes)` — supplier admin/staff.
- `decide_quotation(_quotation_id, _accept boolean)` — buyer; on accept auto-creates a `purchase_orders` row + items linked back to the quotation (adds `quotation_id` column on `purchase_orders`, nullable).
- `withdraw_quotation(_quotation_id)` — supplier.
- Auto-numbering triggers: `RFQ-XXXXXX`, `QT-XXXXXX` using `md5(random())` (avoids `gen_random_bytes` — that lesson is already baked in).

RLS: buyers see rows where `buyer_org_id` is their org; suppliers see where `supplier_org_id` is theirs. Enforced via `is_org_member`.

## 2. Frontend (three new files + light edits)

- `src/routes/_authenticated/rfqs.tsx` — buyer-side list + "New RFQ" dialog (choose connected supplier, add products from catalog OR free-text, quantity, needed-by, notes). Shows status pills and links to the received quotation.
- `src/routes/_authenticated/quotations.tsx` — role-aware:
  - **Supplier view**: inbox of incoming RFQs → "Prepare quote" drawer with per-line pricing, validity, terms → send.
  - **Buyer view**: received quotations, side-by-side comparison for the same RFQ, Accept / Reject. Accept triggers `decide_quotation` which creates a PO and navigates to it.
- `src/lib/quotations.ts` — thin wrappers over the RPCs with types.
- `src/lib/org-config.ts` — add nav entries: `RFQs` (buyer types) and `Quotations` (supplier + buyer types).
- `src/components/shell.tsx` — no code change; nav is data-driven.
- `src/routes/_authenticated/purchase-orders.tsx` — show "From quotation #QT-XXXX" chip when `quotation_id` is set.

## 3. Public API (additive, non-breaking)

- `GET/POST /api/public/v1/rfqs` — scope `rfqs:read` / `rfqs:write`.
- `GET/POST /api/public/v1/quotations` and `POST /api/public/v1/quotations/:id/decide` — scopes `quotations:read` / `quotations:write`.
- Register the new scopes in `api-keys.tsx` (checkbox list only — no logic rewrite).

## 4. Audit + notifications

Every RPC writes to `audit_logs`. In-app toasts on the client. WhatsApp/email hooks intentionally deferred — will slot in when the Notifications module lands.

## 5. Out of scope for this pass

- No AI quote-comparison (waits for AI module).
- No supplier ratings.
- No changes to existing PO/Delivery/Warehouse/Inventory schemas beyond adding `purchase_orders.quotation_id`.
- No removal or rename of existing routes.

## Verification

- Migration applies cleanly; types regenerate.
- Buyer creates RFQ → supplier sees it → submits quote → buyer accepts → PO auto-created with the quoted lines and prices.
- Non-members of either org get RLS-denied on all four tables.
- Existing PO creation flow still works unchanged (quotation_id nullable).

After you approve, I'll ship it as: **migration → types refresh → new pages + nav → public API additions**, in that order.
