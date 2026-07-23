
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS invoice_number text,
  ADD COLUMN IF NOT EXISTS invoice_date date,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_payment_status_check;
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_payment_status_check
  CHECK (payment_status IN ('unpaid','partial','paid','overdue','cancelled'));

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_notes text;
