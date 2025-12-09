-- ═══════════════════════════════════════════════════════════════════════════════
-- WARRANTY MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ═══════════════════════════════════════════════════════════════════════════════
-- Version: 3.0
-- Date: 2025
-- Description: Complete database schema for warranty and repair management system
-- 
-- SECTIONS:
--   1. Extensions
--   2. ENUMs
--   3. Tables
--   4. Indexes
--   5. Views
--   6. Helper Functions
--   7. RPC Functions (Business Logic)
--   8. Trigger Functions
--   9. Triggers
--  10. RLS Enable
--  11. Default Data
--  12. RLS Policies
--  13. Permissions
--  14. Realtime Configuration
--
-- SECURITY NOTES:
--   - All tables have RLS enabled
--   - SECURITY DEFINER functions have explicit search_path
--   - Internal functions have EXECUTE revoked from authenticated
--   - Service role has full access, users access via RLS only
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$ BEGIN RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║     WARRANTY MANAGEMENT SYSTEM - SCHEMA DEPLOYMENT v3.0       ║
╚════════════════════════════════════════════════════════════════╝
'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 1: EXTENSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '📦 Installing extensions...'; END $$;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 2: ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '🔤 Creating ENUMs...'; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'store', 'lab');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE fault_type AS ENUM ('screen', 'charging_port', 'flash', 'speaker', 'board', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE repair_status AS ENUM ('received', 'in_progress', 'completed', 'replacement_requested', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 3: TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '📊 Creating tables...'; END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.1 Users Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT NULL,
  phone TEXT NULL,
  role user_role NOT NULL DEFAULT 'store',
  is_active BOOLEAN NOT NULL DEFAULT false, -- חדש: ברירת מחדל false לאבטחה
  notification_preferences JSONB DEFAULT '{
    "emailOnRepairAssigned": true,
    "emailOnRepairCompleted": true,
    "emailOnPaymentReceived": true,
    "emailOnWarrantyExpiring": true,
    "emailOnReplacementRequest": true
  }'::jsonb,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT users_pkey PRIMARY KEY (id),
  CONSTRAINT users_email_key UNIQUE (email),
  CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE,
  CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  CONSTRAINT valid_full_name CHECK (full_name IS NULL OR length(TRIM(full_name)) >= 2),
  CONSTRAINT valid_phone CHECK (phone IS NULL OR length(phone) >= 9),
  CONSTRAINT valid_notification_preferences CHECK (
    notification_preferences IS NULL OR jsonb_typeof(notification_preferences) = 'object'
  )
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.2 Device Models Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_models (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL,
  manufacturer TEXT NULL,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT device_models_pkey PRIMARY KEY (id),
  CONSTRAINT device_models_model_name_key UNIQUE (model_name),
  CONSTRAINT device_models_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT device_models_warranty_months_check CHECK (warranty_months > 0 AND warranty_months <= 36)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.3 Devices Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS devices (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  imei TEXT NOT NULL,
  imei2 TEXT NULL,
  model_id UUID NOT NULL,
  warranty_months INTEGER NOT NULL DEFAULT 12,
  is_replaced BOOLEAN NOT NULL DEFAULT false,
  replaced_at TIMESTAMPTZ NULL,
  imported_by UUID NULL,
  import_batch TEXT NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT devices_pkey PRIMARY KEY (id),
  CONSTRAINT devices_imei_key UNIQUE (imei),
  CONSTRAINT devices_imei2_key UNIQUE (imei2),
  CONSTRAINT devices_model_id_fkey FOREIGN KEY (model_id) REFERENCES device_models (id) ON DELETE RESTRICT,
  CONSTRAINT devices_imported_by_fkey FOREIGN KEY (imported_by) REFERENCES auth.users (id),
  CONSTRAINT devices_imei_check CHECK (imei ~ '^[0-9]{15}$'),
  CONSTRAINT devices_imei2_check CHECK (imei2 IS NULL OR imei2 ~ '^[0-9]{15}$'),
  CONSTRAINT devices_warranty_months_check CHECK (warranty_months >= 1 AND warranty_months <= 36)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.4 Repair Types Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_types (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT repair_types_pkey PRIMARY KEY (id),
  CONSTRAINT repair_types_name_key UNIQUE (name)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.5 Lab Repair Prices Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lab_repair_prices (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  lab_id UUID NOT NULL,
  repair_type_id UUID NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT lab_repair_prices_pkey PRIMARY KEY (id),
  CONSTRAINT lab_repair_prices_lab_id_repair_type_id_key UNIQUE (lab_id, repair_type_id),
  CONSTRAINT lab_repair_prices_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT lab_repair_prices_repair_type_id_fkey FOREIGN KEY (repair_type_id) REFERENCES repair_types (id) ON DELETE CASCADE,
  CONSTRAINT lab_repair_prices_price_check CHECK (price >= 0)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.6 Warranties Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warranties (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL,
  store_id UUID NULL, -- NULL מאפשר אחריות שנוצרה ע"י אדמין
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  activation_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE,
  expiry_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  activated_by UUID NULL,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT warranties_pkey PRIMARY KEY (id),
  CONSTRAINT warranties_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT warranties_store_id_fkey FOREIGN KEY (store_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT warranties_activated_by_fkey FOREIGN KEY (activated_by) REFERENCES auth.users (id),
  CONSTRAINT warranties_customer_phone_check CHECK (customer_phone ~ '^[0-9]{9,10}$'),
  CONSTRAINT warranties_customer_name_check CHECK (length(TRIM(customer_name)) >= 2),
  CONSTRAINT check_expiry_after_activation CHECK (expiry_date > activation_date)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.7 Repairs Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS repairs (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL,
  lab_id UUID NOT NULL,
  warranty_id UUID NULL,
  repair_type_id UUID NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  fault_type fault_type NULL,
  fault_description TEXT NULL,
  status repair_status NOT NULL DEFAULT 'received',
  cost NUMERIC(10, 2) NULL,
  completed_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  notes TEXT NULL,
  custom_repair_description TEXT NULL,
  custom_repair_price NUMERIC(10, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT repairs_pkey PRIMARY KEY (id),
  CONSTRAINT repairs_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT repairs_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT repairs_warranty_id_fkey FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE SET NULL,
  CONSTRAINT repairs_repair_type_id_fkey FOREIGN KEY (repair_type_id) REFERENCES repair_types (id) ON DELETE SET NULL,
  CONSTRAINT repairs_cost_check CHECK (cost IS NULL OR cost >= 0),
  CONSTRAINT repairs_custom_repair_price_check CHECK (custom_repair_price IS NULL OR custom_repair_price >= 0),
  CONSTRAINT check_repair_type_or_custom CHECK (
    (repair_type_id IS NOT NULL AND custom_repair_description IS NULL) OR
    (repair_type_id IS NULL AND custom_repair_description IS NOT NULL) OR
    (repair_type_id IS NULL AND custom_repair_description IS NULL)
  ),
  CONSTRAINT check_completed_status CHECK (
    (status = 'completed' AND completed_at IS NOT NULL) OR
    (status != 'completed' AND completed_at IS NULL)
  )
);

COMMENT ON COLUMN repairs.custom_repair_description IS 'Custom repair type. When set, repair_type_id must be NULL.';
COMMENT ON COLUMN repairs.custom_repair_price IS 'Price for custom repairs. Used when custom_repair_description is set.';

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.8 Replacement Requests Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS replacement_requests (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL,
  warranty_id UUID NULL,
  repair_id UUID NULL,
  requester_id UUID NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  reason TEXT NOT NULL,
  status request_status NOT NULL DEFAULT 'pending',
  admin_notes TEXT NULL,
  resolved_by UUID NULL,
  resolved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT replacement_requests_pkey PRIMARY KEY (id),
  CONSTRAINT replacement_requests_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE CASCADE,
  CONSTRAINT replacement_requests_warranty_id_fkey FOREIGN KEY (warranty_id) REFERENCES warranties (id) ON DELETE SET NULL,
  CONSTRAINT replacement_requests_repair_id_fkey FOREIGN KEY (repair_id) REFERENCES repairs (id) ON DELETE SET NULL,
  CONSTRAINT replacement_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT replacement_requests_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT check_reason_length CHECK (length(TRIM(reason)) >= 5),
  CONSTRAINT check_resolved_fields CHECK (
    (status = 'pending' AND resolved_by IS NULL AND resolved_at IS NULL) OR
    (status != 'pending' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL)
  )
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.9 Payments Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  lab_id UUID NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  payment_date DATE NOT NULL DEFAULT (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE,
  reference TEXT NULL,
  notes TEXT NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_lab_id_fkey FOREIGN KEY (lab_id) REFERENCES users (id) ON DELETE RESTRICT,
  CONSTRAINT payments_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users (id),
  CONSTRAINT payments_amount_check CHECK (amount > 0)
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.10 Device Search Log Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS device_search_log (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  search_term TEXT NOT NULL,
  device_found BOOLEAN NOT NULL,
  device_id UUID NULL,
  ip_address INET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT device_search_log_pkey PRIMARY KEY (id),
  CONSTRAINT device_search_log_device_id_fkey FOREIGN KEY (device_id) REFERENCES devices (id) ON DELETE SET NULL,
  CONSTRAINT device_search_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.11 Notifications Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB NULL DEFAULT '{}',
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_opened BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notifications_pkey PRIMARY KEY (id),
  CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT notifications_type_check CHECK (type IN (
    'replacement_request_new',
    'replacement_request_updated',
    'repair_new',
    'repair_updated',
    'payment_new',
    'user_registered',
    'repair_completed'
  ))
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.12 Settings Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───────────────────────────────────────────────────────────────────────────────
-- 3.13 Audit Log Table
-- ───────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  actor_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  meta JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT audit_log_pkey PRIMARY KEY (id),
  CONSTRAINT audit_log_actor_user_id_fkey FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 4: INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '⚡ Creating indexes...'; END $$;

-- Users Indexes
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Device Models Indexes
CREATE INDEX IF NOT EXISTS idx_device_models_active ON device_models(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_models_name ON device_models(model_name);

-- Devices Indexes
CREATE INDEX IF NOT EXISTS idx_devices_model ON devices(model_id);
CREATE INDEX IF NOT EXISTS idx_devices_imei ON devices(imei);
CREATE INDEX IF NOT EXISTS idx_devices_imei2 ON devices(imei2) WHERE imei2 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_devices_not_replaced ON devices(is_replaced) WHERE is_replaced = false;
CREATE INDEX IF NOT EXISTS idx_devices_model_lookup ON devices(model_id) INCLUDE (imei, imei2, created_at);
CREATE INDEX IF NOT EXISTS idx_devices_created ON devices(created_at DESC);

-- Repair Types Indexes
CREATE INDEX IF NOT EXISTS idx_repair_types_active ON repair_types(is_active) WHERE is_active = true;

-- Lab Repair Prices Indexes
CREATE INDEX IF NOT EXISTS idx_lab_repair_prices_lab ON lab_repair_prices(lab_id);
CREATE INDEX IF NOT EXISTS idx_lab_repair_prices_type ON lab_repair_prices(repair_type_id);
CREATE INDEX IF NOT EXISTS idx_lab_repair_prices_active ON lab_repair_prices(lab_id, repair_type_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_lab_prices_lab_type_active ON lab_repair_prices(lab_id, repair_type_id, is_active) WHERE is_active = true;

-- Warranties Indexes
CREATE INDEX IF NOT EXISTS idx_warranties_device ON warranties(device_id);
CREATE INDEX IF NOT EXISTS idx_warranties_store ON warranties(store_id);
CREATE INDEX IF NOT EXISTS idx_warranties_active ON warranties(device_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_warranties_expiry ON warranties(expiry_date) WHERE is_active = true;

-- Repairs Indexes
CREATE INDEX IF NOT EXISTS idx_repairs_device ON repairs(device_id);
CREATE INDEX IF NOT EXISTS idx_repairs_lab ON repairs(lab_id);
CREATE INDEX IF NOT EXISTS idx_repairs_warranty ON repairs(warranty_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status ON repairs(status);
CREATE INDEX IF NOT EXISTS idx_repairs_type ON repairs(repair_type_id);
CREATE INDEX IF NOT EXISTS idx_repairs_completed ON repairs(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_custom_repair ON repairs(custom_repair_description) WHERE custom_repair_description IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_repairs_status_created_desc ON repairs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repairs_open_status ON repairs(created_at DESC) WHERE status IN ('received', 'in_progress');
CREATE INDEX IF NOT EXISTS idx_repairs_lab_status_created ON repairs(lab_id, status, created_at DESC) WHERE lab_id IS NOT NULL;

-- Replacement Requests Indexes
CREATE INDEX IF NOT EXISTS idx_replacement_requests_device ON replacement_requests(device_id);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_requester ON replacement_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_status ON replacement_requests(status);
CREATE INDEX IF NOT EXISTS idx_replacement_requests_pending ON replacement_requests(device_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_replacements_created_at ON replacement_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replacements_status_created ON replacement_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replacements_requester ON replacement_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replacements_device ON replacement_requests(device_id);

-- Payments Indexes
CREATE INDEX IF NOT EXISTS idx_payments_lab ON payments(lab_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Device Search Log Indexes
CREATE INDEX IF NOT EXISTS idx_search_log_user_date ON device_search_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_log_date ON device_search_log(created_at DESC);

-- Notifications Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Audit Log Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Update statistics
ANALYZE users;
ANALYZE device_models;
ANALYZE devices;
ANALYZE repair_types;
ANALYZE lab_repair_prices;
ANALYZE warranties;
ANALYZE repairs;
ANALYZE replacement_requests;
ANALYZE payments;
ANALYZE notifications;
ANALYZE audit_log;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 5: VIEWS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '👁️ Creating views...'; END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.1 Lab Balances View
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW view_lab_balances AS
WITH lab_earnings AS (
  SELECT 
    lab_id, 
    COALESCE(SUM(cost), 0) AS total_earned,
    COUNT(id) AS repairs_count
  FROM repairs 
  WHERE status = 'completed'
  GROUP BY lab_id
),
lab_payments AS (
  SELECT 
    lab_id, 
    COALESCE(SUM(amount), 0) AS total_paid,
    COUNT(id) AS payments_count
  FROM payments 
  GROUP BY lab_id
)
SELECT 
  u.id AS lab_id,
  u.full_name AS lab_name,
  u.email AS lab_email,
  COALESCE(le.total_earned, 0) AS total_earned,
  COALESCE(lp.total_paid, 0) AS total_paid,
  (COALESCE(le.total_earned, 0) - COALESCE(lp.total_paid, 0)) AS balance,
  COALESCE(le.repairs_count, 0) AS repairs_count,
  COALESCE(lp.payments_count, 0) AS payments_count
FROM users u
LEFT JOIN lab_earnings le ON u.id = le.lab_id
LEFT JOIN lab_payments lp ON u.id = lp.lab_id
WHERE u.role = 'lab' AND u.is_active = true;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.2 IMEI Lookup View
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW devices_imei_lookup AS
SELECT
  d.id, d.imei, d.imei2, d.is_replaced, dm.model_name,
  EXISTS(
    SELECT 1 FROM warranties w 
    WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE
  ) AS has_active_warranty,
  EXISTS(
    SELECT 1 FROM repairs r 
    WHERE r.device_id = d.id AND r.status IN ('received', 'in_progress')
  ) AS has_active_repair
FROM devices d
LEFT JOIN device_models dm ON d.model_id = dm.id;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.3 Devices with Status View
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW devices_with_status AS
SELECT
  d.id,
  d.imei,
  d.imei2,
  d.model_id,
  d.warranty_months,
  d.is_replaced,
  d.replaced_at,
  d.imported_by,
  d.import_batch,
  d.notes,
  d.created_at,
  d.updated_at,
  dm.model_name,
  CASE
    WHEN d.is_replaced THEN 'replaced'
    WHEN EXISTS(
      SELECT 1 FROM warranties w 
      WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE
    ) THEN 'active'
    WHEN EXISTS(SELECT 1 FROM warranties w WHERE w.device_id = d.id) THEN 'expired'
    ELSE 'new'
  END AS warranty_status
FROM devices d
LEFT JOIN device_models dm ON d.model_id = dm.id;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.4 Active Warranties with Replacements View
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW active_warranties_with_replacements AS
SELECT
  w.id, w.device_id, w.store_id, w.activation_date, w.expiry_date, w.is_active,
  w.customer_name, w.customer_phone, w.notes, w.created_at, w.updated_at,
  d.imei, d.is_replaced, dm.model_name, u.full_name AS store_name,
  CASE
    WHEN w.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE AND w.is_active THEN 'active'
    WHEN w.expiry_date < (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE THEN 'expired'
    ELSE 'cancelled'
  END AS warranty_status,
  (SELECT COUNT(*) FROM replacement_requests rr WHERE rr.device_id = w.device_id AND rr.status = 'pending') AS pending_replacements,
  (SELECT COUNT(*) FROM replacement_requests rr WHERE rr.device_id = w.device_id AND rr.status = 'approved') AS approved_replacements
FROM warranties w
JOIN devices d ON w.device_id = d.id
LEFT JOIN device_models dm ON d.model_id = dm.id
LEFT JOIN users u ON w.store_id = u.id
WHERE w.is_active = true;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.5 Rich Devices View (For Admin Table)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW devices_rich_view AS
WITH latest_warranties AS (
  SELECT DISTINCT ON (device_id) *
  FROM warranties
  ORDER BY device_id, created_at DESC
)
SELECT
  d.id, d.imei, d.imei2, d.model_id, d.warranty_months, d.is_replaced, 
  d.replaced_at, d.import_batch, d.created_at, d.updated_at,
  dm.model_name,
  dm.manufacturer,
  lw.id AS warranty_id,
  lw.customer_name,
  lw.customer_phone,
  lw.activation_date,
  lw.expiry_date,
  lw.is_active AS warranty_is_active,
  u.id AS store_id,
  u.full_name AS store_name,
  u.email AS store_email,
  CASE
    WHEN d.is_replaced THEN 'replaced'
    WHEN lw.id IS NOT NULL AND lw.is_active AND lw.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE THEN 'active'
    WHEN lw.id IS NOT NULL THEN 'expired'
    ELSE 'new'
  END AS warranty_status,
  (SELECT COUNT(*) FROM repairs r WHERE r.device_id = d.id) AS repairs_count
FROM devices d
LEFT JOIN device_models dm ON d.model_id = dm.id
LEFT JOIN latest_warranties lw ON d.id = lw.device_id
LEFT JOIN users u ON lw.store_id = u.id;

-- ───────────────────────────────────────────────────────────────────────────────
-- 5.6 Admin Dashboard Stats View
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM devices WHERE NOT is_replaced) AS total_devices,
  (SELECT COUNT(*) FROM warranties WHERE is_active = true AND expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE) AS active_warranties,
  (SELECT COUNT(*) FROM repairs WHERE status IN ('received', 'in_progress')) AS pending_repairs,
  (SELECT COUNT(*) FROM replacement_requests WHERE status = 'pending') AS pending_replacements,
  (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'store') AS total_stores,
  (SELECT COUNT(*) FROM users WHERE is_active = true AND role = 'lab') AS total_labs;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 6: HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '🔧 Creating helper functions...'; END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.1 Get Current User's Role
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE id = auth.uid();
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.2 Current User Role (Alternative)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.3 Check if Current User is Admin
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN

  IF SESSION_USER = 'postgres' OR current_setting('is_superuser') = 'on' THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'admin'
    AND is_active = true
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.4 Check if Current User is Store
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_store()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'store'
    AND is_active = true
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.5 Check if Current User is Lab
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_lab()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'lab'
    AND is_active = true
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.6 Notify All Admins (Internal - Trigger Only)
-- ⚠️ SECURITY: This function should only be called by triggers
-- EXECUTE permission is revoked from authenticated users in Section 13
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_admins(
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}',
  p_excluded_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT id, p_type, p_title, p_message, p_data
  FROM users
  WHERE role = 'admin'
    AND is_active = true
    AND (p_excluded_user_id IS NULL OR id <> p_excluded_user_id);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.7 Notify Single User (Internal - Trigger Only)
-- ⚠️ SECURITY: This function should only be called by triggers
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_user(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_data JSONB DEFAULT '{}'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (p_user_id, p_type, p_title, p_message, p_data);
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.8 Mark Notifications as Read
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_notifications_as_read(notification_ids UUID[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET is_read = true
  WHERE id = ANY(notification_ids)
    AND user_id = auth.uid();
  
  RETURN true;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.9 Mark Notification as Opened
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION mark_notification_as_opened(notification_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE notifications
  SET is_opened = true, is_read = true
  WHERE id = notification_id
    AND user_id = auth.uid();
  
  RETURN true;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.10 Search Device (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_device(search_term TEXT)
RETURNS TABLE(
  id UUID,
  imei TEXT,
  imei2 TEXT,
  model_name TEXT,
  has_warranty BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.imei,
    d.imei2,
    dm.model_name,
    EXISTS(
      SELECT 1 FROM warranties w 
      WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE
    ) AS has_warranty
  FROM devices d
  LEFT JOIN device_models dm ON d.model_id = dm.id
  WHERE d.imei ILIKE '%' || search_term || '%'
     OR d.imei2 ILIKE '%' || search_term || '%'
  LIMIT 20;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.7 Get User Notification Preference
-- ⚠️ SECURITY: Users can only access their own preferences, admins can access any
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_notification_preference(
  p_user_id UUID,
  p_preference_key TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preferences JSONB;
  v_value TEXT;
BEGIN
  -- Security check
  IF p_user_id != auth.uid() AND NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: you can only access your own notification preferences';
  END IF;

  SELECT notification_preferences INTO v_preferences
  FROM users
  WHERE id = p_user_id;

  IF v_preferences IS NULL THEN
    RETURN true;
  END IF;

  v_value := v_preferences->>p_preference_key;

  IF v_value IS NULL THEN
    RETURN true;
  END IF;

  RETURN v_value::BOOLEAN;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 6.8 Auth Hook: Add user_role and user_active to JWT
-- ⚠️ SECURITY: Only supabase_auth_admin should execute this
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_role TEXT;
  user_active BOOLEAN;
BEGIN
  claims := event->'claims';

  SELECT role::TEXT, is_active
  INTO user_role, user_active
  FROM public.users
  WHERE id = (event->>'user_id')::UUID;

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;

  IF user_active IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_active}', to_jsonb(user_active));
  END IF;

  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in custom_access_token_hook: %', SQLERRM;
    RETURN event;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 7: RPC FUNCTIONS (BUSINESS LOGIC)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '🚀 Creating business logic functions...'; END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.1 Get Dashboard Counts (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_dashboard_counts()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role TEXT;
  v_total BIGINT;
  v_new BIGINT;
  v_active BIGINT;
  v_expired BIGINT;
  v_replaced BIGINT;
  v_in_repair BIGINT;
BEGIN
  SELECT role::TEXT INTO v_user_role FROM users WHERE id = auth.uid();

  IF v_user_role != 'admin' THEN
    RETURN json_build_object(
      'total', 0, 'new', 0, 'active', 0, 'expired', 0, 'replaced', 0, 'inRepair', 0
    );
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE warranty_status = 'new'),
    COUNT(*) FILTER (WHERE warranty_status = 'active'),
    COUNT(*) FILTER (WHERE warranty_status = 'expired'),
    COUNT(*) FILTER (WHERE warranty_status = 'replaced')
  INTO v_total, v_new, v_active, v_expired, v_replaced
  FROM devices_with_status;

  SELECT COUNT(*) INTO v_in_repair
  FROM repairs
  WHERE status IN ('received', 'in_progress');

  RETURN json_build_object(
    'total', v_total,
    'new', v_new,
    'active', v_active,
    'expired', v_expired,
    'replaced', v_replaced,
    'inRepair', v_in_repair
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.2 Get Repair Statistics (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_repair_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_received BIGINT;
  v_in_progress BIGINT;
  v_completed BIGINT;
  v_replacement_requested BIGINT;
  v_total_cost NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'received'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'replacement_requested'),
    COALESCE(SUM(cost), 0)
  INTO v_total, v_received, v_in_progress, v_completed, v_replacement_requested, v_total_cost
  FROM repairs;

  RETURN json_build_object(
    'total', v_total,
    'received', v_received,
    'in_progress', v_in_progress,
    'completed', v_completed,
    'replacement_requested', v_replacement_requested,
    'total_cost', v_total_cost
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.3 Get Warranty Statistics (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_warranty_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_active BIGINT;
  v_expired BIGINT;
  v_today DATE;
BEGIN
  v_today := (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE is_active = true AND expiry_date >= v_today),
    COUNT(*) FILTER (WHERE is_active = false OR expiry_date < v_today)
  INTO v_total, v_active, v_expired
  FROM warranties;

  RETURN json_build_object(
    'total', v_total,
    'active', v_active,
    'expired', v_expired
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.4 Get Replacement Statistics (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_replacement_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
  v_pending BIGINT;
  v_approved BIGINT;
  v_rejected BIGINT;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'rejected')
  INTO v_total, v_pending, v_approved, v_rejected
  FROM replacement_requests;

  RETURN json_build_object(
    'total', v_total,
    'pending', v_pending,
    'approved', v_approved,
    'rejected', v_rejected
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.5 Get Lab Dashboard Stats
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_lab_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab_id UUID := auth.uid();
  v_stats JSON;
  v_today_start TIMESTAMPTZ := date_trunc('day', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
  v_start_of_month TIMESTAMPTZ := date_trunc('month', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
BEGIN
  IF NOT is_lab() THEN
    RETURN '{}'::JSON;
  END IF;

  WITH monthly_completed_repairs AS (
    SELECT cost, fault_type, created_at, completed_at
    FROM repairs
    WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_start_of_month
  ),
  monthly_created_repairs AS (
    SELECT 1 FROM repairs WHERE lab_id = v_lab_id AND created_at >= v_start_of_month
  )
  SELECT json_build_object(
    'pendingRepairs', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status = 'received'),
    'inProgressRepairs', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status = 'in_progress'),
    'completedToday', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_today_start),
    'monthlyCompleted', (SELECT COUNT(*) FROM monthly_completed_repairs),
    'monthlyRevenue', (SELECT COALESCE(SUM(cost), 0) FROM monthly_completed_repairs),
    'averageRepairTime', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600), 0) FROM monthly_completed_repairs WHERE completed_at IS NOT NULL),
    'topFaultType', (SELECT fault_type FROM monthly_completed_repairs GROUP BY fault_type ORDER BY COUNT(*) DESC LIMIT 1),
    'completionRate', (CASE WHEN (SELECT COUNT(*) FROM monthly_created_repairs) > 0 THEN ((SELECT COUNT(*) FROM monthly_completed_repairs)::FLOAT / (SELECT COUNT(*) FROM monthly_created_repairs)::FLOAT) * 100 ELSE 0 END)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.6 Get Lab Balance
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_lab_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab_id UUID := auth.uid();
  v_total_earned NUMERIC;
  v_total_paid NUMERIC;
BEGIN
  IF NOT is_lab() THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(cost), 0) INTO v_total_earned
  FROM repairs
  WHERE lab_id = v_lab_id AND status = 'completed';

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM payments
  WHERE lab_id = v_lab_id;

  RETURN v_total_earned - v_total_paid;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.7 Get Lab Monthly Stats (Alternative)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_lab_monthly_stats(p_lab_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab_id UUID;
  v_month_start TIMESTAMPTZ;
  v_today_start TIMESTAMPTZ;
  v_stats JSON;
BEGIN
  v_lab_id := COALESCE(p_lab_id, auth.uid());
  
  v_month_start := date_trunc('month', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';
  v_today_start := date_trunc('day', NOW() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem';

  WITH monthly_created_repairs AS (
    SELECT * FROM repairs
    WHERE lab_id = v_lab_id AND created_at >= v_month_start
  ),
  monthly_completed_repairs AS (
    SELECT * FROM repairs
    WHERE lab_id = v_lab_id AND status = 'completed' AND completed_at >= v_month_start
  )
  SELECT json_build_object(
    'totalRepairs', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id),
    'activeRepairs', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND status IN ('received', 'in_progress')),
    'todayReceived', (SELECT COUNT(*) FROM repairs WHERE lab_id = v_lab_id AND created_at >= v_today_start),
    'monthlyCompleted', (SELECT COUNT(*) FROM monthly_completed_repairs),
    'monthlyRevenue', (SELECT COALESCE(SUM(cost), 0) FROM monthly_completed_repairs),
    'averageRepairTime', (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600), 0) FROM monthly_completed_repairs WHERE completed_at IS NOT NULL),
    'topFaultType', (SELECT fault_type FROM monthly_completed_repairs GROUP BY fault_type ORDER BY COUNT(*) DESC LIMIT 1),
    'completionRate', (CASE WHEN (SELECT COUNT(*) FROM monthly_created_repairs) > 0 THEN ((SELECT COUNT(*) FROM monthly_completed_repairs)::FLOAT / (SELECT COUNT(*) FROM monthly_created_repairs)::FLOAT) * 100 ELSE 0 END)
  ) INTO v_stats;

  RETURN v_stats;
END;
$$;
-- ───────────────────────────────────────────────────────────────────────────────
-- 7.4 Get Store Device Count
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_store_device_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_count INTEGER;
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  
  IF user_role != 'store' THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(DISTINCT w.device_id) INTO device_count
  FROM public.warranties w
  WHERE w.store_id = auth.uid();
  
  RETURN device_count;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.5 Get Lab Device Count
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_lab_device_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  device_count INTEGER;
  user_role user_role;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();

  IF user_role != 'lab' THEN
    RETURN 0;
  END IF;

  SELECT COUNT(DISTINCT r.device_id) INTO device_count
  FROM public.repairs r
  WHERE r.lab_id = auth.uid();

  RETURN device_count;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.6 Activate Warranty (Store)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION activate_warranty(
  p_device_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  warranty_id UUID,
  expiry_date DATE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_store_id UUID; 
  v_warranty_months INTEGER; 
  v_expiry_date DATE; 
  v_warranty_id UUID; 
  v_is_replaced BOOLEAN;
  v_today DATE;
BEGIN
  v_store_id := auth.uid();
  v_today := (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE;
  
  IF NOT is_store() THEN 
    RETURN QUERY SELECT false, 'רק חנויות יכולות להפעיל אחריות'::TEXT, NULL::UUID, NULL::DATE; 
    RETURN; 
  END IF;
  
  SELECT d.is_replaced INTO v_is_replaced
  FROM devices d
  WHERE d.id = p_device_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'מכשיר לא נמצא במערכת'::TEXT, NULL::UUID, NULL::DATE;
    RETURN;
  END IF;

  SELECT dm.warranty_months INTO v_warranty_months
  FROM devices d
  JOIN device_models dm ON d.model_id = dm.id
  WHERE d.id = p_device_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'למכשיר אין מודל תקין במערכת. יש לפנות למנהל'::TEXT, NULL::UUID, NULL::DATE;
    RETURN;
  END IF;
  
  IF v_is_replaced THEN 
    RETURN QUERY SELECT false, 'מכשיר זה הוחלף ולא ניתן להפעיל עליו אחריות'::TEXT, NULL::UUID, NULL::DATE; 
    RETURN; 
  END IF;
  
  IF EXISTS(
    SELECT 1 FROM warranties w 
    WHERE w.device_id = p_device_id 
      AND w.is_active = true 
      AND w.expiry_date >= v_today
  ) THEN 
    RETURN QUERY SELECT false, 'למכשיר זה כבר קיימת אחריות פעילה'::TEXT, NULL::UUID, NULL::DATE; 
    RETURN; 
  END IF;
  
  v_expiry_date := v_today + (v_warranty_months || ' months')::INTERVAL;
  
  INSERT INTO warranties (device_id, store_id, customer_name, customer_phone, activation_date, expiry_date, is_active, activated_by)
  VALUES (p_device_id, v_store_id, p_customer_name, p_customer_phone, v_today, v_expiry_date, true, v_store_id) 
  RETURNING id INTO v_warranty_id;
  
  RETURN QUERY SELECT true, 'אחריות הופעלה בהצלחה'::TEXT, v_warranty_id, v_expiry_date;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.7 Search Device by IMEI
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_device_by_imei(
  p_imei TEXT,
  p_user_ip TEXT DEFAULT NULL
)
RETURNS TABLE(
  device_id UUID,
  imei TEXT,
  imei2 TEXT,
  model_id UUID,
  model_name TEXT,
  manufacturer TEXT,
  warranty_months INTEGER,
  is_replaced BOOLEAN,
  replaced_at TIMESTAMPTZ,
  has_active_warranty BOOLEAN,
  warranty_id UUID,
  warranty_expiry_date DATE,
  customer_name TEXT,
  customer_phone TEXT,
  message TEXT,
  device_found BOOLEAN,
  is_own_warranty BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_searches_today INTEGER := 0;
  v_rate_limit INTEGER;
  v_device_record RECORD;
  v_warranty_record RECORD;
  v_is_own_warranty BOOLEAN := false;
BEGIN
  SELECT role::TEXT INTO v_user_role FROM users WHERE id = v_user_id;
  
  -- Rate limit for stores and labs
  IF v_user_role IN ('store', 'lab') THEN
    SELECT COALESCE((value->>'value')::INTEGER, 50) INTO v_rate_limit 
    FROM settings WHERE key = 'imei_search_rate_limit';
    
    SELECT COUNT(*) INTO v_searches_today 
    FROM device_search_log 
    WHERE user_id = v_user_id AND created_at >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE;
    
    IF v_searches_today >= v_rate_limit THEN
      RETURN QUERY SELECT 
        NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT,
        NULL::INTEGER, NULL::BOOLEAN, NULL::TIMESTAMPTZ, NULL::BOOLEAN,
        NULL::UUID, NULL::DATE, NULL::TEXT, NULL::TEXT,
        'חרגת ממכסת החיפושים היומית'::TEXT, false, false;
      RETURN;
    END IF;
  END IF;

  -- Find device
  SELECT d.*, dm.model_name AS mn, dm.manufacturer AS mf
  INTO v_device_record
  FROM devices d
  JOIN device_models dm ON d.model_id = dm.id
  WHERE d.imei = p_imei OR d.imei2 = p_imei;

  -- Log the search
  INSERT INTO device_search_log (user_id, search_term, device_found, device_id, ip_address)
  VALUES (v_user_id, p_imei, (v_device_record.id IS NOT NULL), v_device_record.id, p_user_ip::INET);

  IF v_device_record.id IS NULL THEN
    RETURN QUERY SELECT 
      NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::UUID, NULL::TEXT, NULL::TEXT,
      NULL::INTEGER, NULL::BOOLEAN, NULL::TIMESTAMPTZ, NULL::BOOLEAN,
      NULL::UUID, NULL::DATE, NULL::TEXT, NULL::TEXT,
      'מכשיר לא נמצא במערכת'::TEXT, false, false;
    RETURN;
  END IF;

  -- Find active warranty
  SELECT w.* INTO v_warranty_record
  FROM warranties w
  WHERE w.device_id = v_device_record.id
    AND w.is_active = true
    AND w.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE
  ORDER BY w.created_at DESC
  LIMIT 1;

  -- Check if this is the user's own warranty (for stores)
  -- Admin and lab can see all details, store only sees own warranty details
  IF v_user_role = 'admin' THEN
    v_is_own_warranty := true;  -- Admin sees all
  ELSIF v_user_role = 'lab' THEN
    v_is_own_warranty := true;  -- Lab sees all (needs customer info for repairs)
  ELSIF v_user_role = 'store' THEN
    v_is_own_warranty := (v_warranty_record.store_id = v_user_id);
  END IF;

  -- Return result with conditional customer details
  -- If warranty belongs to another store, hide sensitive details
  IF v_warranty_record.id IS NOT NULL AND NOT v_is_own_warranty THEN
    -- Warranty exists but belongs to another store - show limited info
    RETURN QUERY SELECT 
      v_device_record.id,
      v_device_record.imei,
      v_device_record.imei2,
      v_device_record.model_id,
      v_device_record.mn,
      v_device_record.mf,
      v_device_record.warranty_months,
      v_device_record.is_replaced,
      v_device_record.replaced_at,
      true,  -- has_active_warranty
      NULL::UUID,  -- hide warranty_id
      NULL::DATE,  -- hide expiry_date
      NULL::TEXT,  -- hide customer_name
      NULL::TEXT,  -- hide customer_phone
      'למכשיר זה קיימת אחריות פעילה בחנות אחרת'::TEXT,
      true,
      false;  -- is_own_warranty = false
  ELSE
    -- No warranty, own warranty, or admin/lab - show full details
    RETURN QUERY SELECT 
      v_device_record.id,
      v_device_record.imei,
      v_device_record.imei2,
      v_device_record.model_id,
      v_device_record.mn,
      v_device_record.mf,
      v_device_record.warranty_months,
      v_device_record.is_replaced,
      v_device_record.replaced_at,
      (v_warranty_record.id IS NOT NULL),
      v_warranty_record.id,
      v_warranty_record.expiry_date,
      v_warranty_record.customer_name,
      v_warranty_record.customer_phone,
      CASE 
        WHEN v_device_record.is_replaced THEN 'מכשיר הוחלף'
        WHEN v_warranty_record.id IS NOT NULL THEN 'מכשיר נמצא עם אחריות פעילה'
        ELSE 'מכשיר נמצא ללא אחריות פעילה'
      END::TEXT,
      true,
      v_is_own_warranty;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION search_device_by_imei(TEXT, TEXT) TO authenticated;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.8 Store: Check if IMEI Exists
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION store_check_imei_exists(p_imei TEXT)
RETURNS TABLE(
  device_exists BOOLEAN,
  device_id UUID,
  is_mine BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_device_id UUID;
  v_is_mine BOOLEAN;
BEGIN
  IF NOT is_store() THEN
    RETURN QUERY SELECT false, NULL::UUID, false, 'אין הרשאה'::TEXT;
    RETURN;
  END IF;

  SELECT d.id INTO v_device_id
  FROM devices d
  WHERE d.imei = p_imei OR d.imei2 = p_imei;

  IF v_device_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, false, 'מכשיר לא נמצא במערכת'::TEXT;
    RETURN;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM warranties 
    WHERE device_id = v_device_id AND store_id = v_user_id
  ) INTO v_is_mine;

  IF v_is_mine THEN
    RETURN QUERY SELECT true, v_device_id, true, 'מכשיר נמצא - שייך לחנות שלך'::TEXT;
  ELSE
    RETURN QUERY SELECT true, NULL::UUID, false, 'מכשיר קיים במערכת אך לא שייך לחנות שלך'::TEXT;
  END IF;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.9 Lab: Check if IMEI Exists
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION lab_check_imei_exists(p_imei TEXT)
RETURNS TABLE(
  device_exists BOOLEAN,
  device_id UUID,
  model_name TEXT,
  has_active_warranty BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_device_id UUID;
  v_model_name TEXT;
  v_has_warranty BOOLEAN;
  v_rate_limit INTEGER;
  v_searches_today INTEGER;
BEGIN
  IF NOT is_lab() THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, 'אין הרשאה'::TEXT;
    RETURN;
  END IF;

  SELECT (value->>'value')::INTEGER INTO v_rate_limit
  FROM settings WHERE key = 'imei_search_rate_limit';
  v_rate_limit := COALESCE(v_rate_limit, 50);

  SELECT COUNT(*) INTO v_searches_today
  FROM device_search_log
  WHERE user_id = v_user_id AND created_at >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE;

  IF v_searches_today >= v_rate_limit THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, 'חרגת ממכסת החיפושים היומית'::TEXT;
    RETURN;
  END IF;

  SELECT 
    d.id, dm.model_name,
    EXISTS(SELECT 1 FROM warranties w WHERE w.device_id = d.id AND w.is_active = true AND w.expiry_date >= (NOW() AT TIME ZONE 'Asia/Jerusalem')::DATE)
  INTO v_device_id, v_model_name, v_has_warranty
  FROM devices d
  LEFT JOIN device_models dm ON d.model_id = dm.id
  WHERE d.imei = p_imei OR d.imei2 = p_imei;

  INSERT INTO device_search_log (user_id, search_term, device_found, device_id, ip_address)
  VALUES (v_user_id, p_imei, (v_device_id IS NOT NULL), v_device_id, NULL);

  IF v_device_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, false, 'מכשיר לא נמצא'::TEXT;
    RETURN;
  END IF;

  IF EXISTS(SELECT 1 FROM repairs WHERE device_id = v_device_id AND status IN ('received', 'in_progress')) THEN
    RETURN QUERY SELECT true, v_device_id, v_model_name, v_has_warranty, 'כבר קיים תיקון פעיל למכשיר זה'::TEXT;
    RETURN;
  END IF;

  IF NOT v_has_warranty THEN
    RETURN QUERY SELECT true, v_device_id, v_model_name, false, 'למכשיר אין אחריות פעילה'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, v_device_id, v_model_name, true, 'מכשיר נמצא ותקין'::TEXT;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.10 Create Replacement Request (Secure)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_replacement_request(
  p_device_id UUID,
  p_reason TEXT,
  p_repair_id UUID DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT, request_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_role TEXT;
  v_warranty_id UUID;
  v_store_id UUID;
  v_customer_name TEXT;
  v_customer_phone TEXT;
  v_new_request_id UUID;
BEGIN
  SELECT role INTO v_user_role FROM users WHERE id = v_user_id;

  IF v_user_role IS NULL THEN
    RETURN QUERY SELECT false, 'User not found or inactive.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Get warranty and customer details
  SELECT id, store_id, customer_name, customer_phone
  INTO v_warranty_id, v_store_id, v_customer_name, v_customer_phone
  FROM warranties
  WHERE device_id = p_device_id AND is_active = true
  ORDER BY created_at DESC
  LIMIT 1;

  -- Fallback to repair details
  IF v_customer_name IS NULL AND p_repair_id IS NOT NULL THEN
    SELECT customer_name, customer_phone
    INTO v_customer_name, v_customer_phone
    FROM repairs
    WHERE id = p_repair_id;
  END IF;

  -- Role-based authorization
  IF v_user_role = 'store' THEN
    IF v_store_id IS NULL OR v_store_id <> v_user_id THEN
      RETURN QUERY SELECT false, 'אתה יכול לבקש החלפה רק למכשיר שאתה הפעלת לו אחריות'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  ELSIF v_user_role = 'lab' THEN
    NULL; -- Labs can request replacement for any device
  ELSE
    RETURN QUERY SELECT false, 'Permission denied for your role.'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  INSERT INTO replacement_requests
    (device_id, warranty_id, repair_id, requester_id, reason, customer_name, customer_phone, status)
  VALUES
    (p_device_id, v_warranty_id, p_repair_id, v_user_id, p_reason, COALESCE(v_customer_name, 'N/A'), COALESCE(v_customer_phone, 'N/A'), 'pending')
  RETURNING id INTO v_new_request_id;

  IF p_repair_id IS NOT NULL THEN
    UPDATE repairs SET status = 'replacement_requested' WHERE id = p_repair_id;
  END IF;

  RETURN QUERY SELECT true, 'Replacement request created successfully.'::TEXT, v_new_request_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.11 Approve Replacement Request (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION approve_replacement(
  p_request_id UUID,
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id UUID;
  v_warranty_id UUID;
  v_current_status request_status;
BEGIN
  IF NOT is_admin() THEN 
    RETURN QUERY SELECT false, 'רק מנהל יכול לאשר בקשות החלפה'::TEXT; 
    RETURN; 
  END IF;
  
  SELECT device_id, warranty_id, status 
  INTO v_device_id, v_warranty_id, v_current_status
  FROM replacement_requests 
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN 
    RETURN QUERY SELECT false, 'בקשה לא נמצאה'::TEXT; 
    RETURN; 
  END IF;
  
  IF v_current_status != 'pending'::request_status THEN 
    RETURN QUERY SELECT false, 'בקשה כבר טופלה'::TEXT; 
    RETURN; 
  END IF;
  
  UPDATE replacement_requests 
  SET status = 'approved', admin_notes = p_admin_notes, resolved_by = auth.uid(), resolved_at = NOW() 
  WHERE id = p_request_id;
  
  UPDATE devices SET is_replaced = true, replaced_at = NOW() WHERE id = v_device_id;
  
  IF v_warranty_id IS NOT NULL THEN 
    UPDATE warranties SET is_active = false WHERE id = v_warranty_id; 
  END IF;
  
  RETURN QUERY SELECT true, 'בקשת ההחלפה אושרה בהצלחה'::TEXT;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.12 Reject Replacement Request (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reject_replacement(
  p_request_id UUID,
  p_admin_notes TEXT
)
RETURNS TABLE(success BOOLEAN, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status request_status;
BEGIN
  IF NOT is_admin() THEN 
    RETURN QUERY SELECT false, 'רק מנהל יכול לדחות בקשות החלפה'::TEXT; 
    RETURN; 
  END IF;
  
  SELECT status INTO v_current_status
  FROM replacement_requests 
  WHERE id = p_request_id;
  
  IF NOT FOUND THEN 
    RETURN QUERY SELECT false, 'בקשה לא נמצאה'::TEXT; 
    RETURN; 
  END IF;
  
  IF v_current_status != 'pending'::request_status THEN 
    RETURN QUERY SELECT false, 'בקשה כבר טופלה'::TEXT; 
    RETURN; 
  END IF;
  
  UPDATE replacement_requests 
  SET status = 'rejected', admin_notes = p_admin_notes, resolved_by = auth.uid(), resolved_at = NOW() 
  WHERE id = p_request_id;
  
  RETURN QUERY SELECT true, 'בקשת ההחלפה נדחתה'::TEXT;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.13 Get Repairs Paginated (Admin)
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_repairs_paginated(
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50,
  p_status TEXT DEFAULT NULL,
  p_lab_id UUID DEFAULT NULL,
  p_search TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM repairs r
  WHERE (p_status IS NULL OR r.status::TEXT = p_status)
    AND (p_lab_id IS NULL OR r.lab_id = p_lab_id)
    AND (p_search IS NULL OR r.customer_name ILIKE '%' || p_search || '%' OR r.customer_phone ILIKE '%' || p_search || '%');

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::JSON)
  INTO v_data
  FROM (
    SELECT 
      r.id, r.device_id, r.lab_id, r.warranty_id, r.repair_type_id,
      r.cost, r.status, r.fault_type, r.customer_name, r.customer_phone,
      r.custom_repair_description, r.custom_repair_price,
      r.created_at, r.completed_at,
      CASE WHEN d.id IS NOT NULL THEN
        json_build_object(
          'id', d.id, 'imei', d.imei, 'imei2', d.imei2,
          'device_models', CASE WHEN dm.id IS NOT NULL THEN json_build_object('model_name', dm.model_name) ELSE NULL END
        )
      ELSE NULL END AS device,
      CASE WHEN u.id IS NOT NULL THEN
        json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email)
      ELSE NULL END AS lab,
      CASE WHEN rt.id IS NOT NULL THEN
        json_build_object('id', rt.id, 'name', rt.name, 'description', rt.description)
      ELSE NULL END AS repair_type
    FROM repairs r
    LEFT JOIN devices d ON r.device_id = d.id
    LEFT JOIN device_models dm ON d.model_id = dm.id
    LEFT JOIN users u ON r.lab_id = u.id
    LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
    WHERE (p_status IS NULL OR r.status::TEXT = p_status)
      AND (p_lab_id IS NULL OR r.lab_id = p_lab_id)
      AND (p_search IS NULL OR r.customer_name ILIKE '%' || p_search || '%' OR r.customer_phone ILIKE '%' || p_search || '%')
    ORDER BY r.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'data', v_data,
    'count', v_total,
    'page', p_page,
    'pageSize', p_page_size,
    'totalPages', CEIL(v_total::FLOAT / p_page_size)
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.14 Get Lab Repairs Paginated
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_lab_repairs_paginated(
  p_lab_id UUID,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total FROM repairs WHERE lab_id = p_lab_id;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::JSON)
  INTO v_data
  FROM (
    SELECT 
      r.id, r.device_id, r.lab_id, r.warranty_id, r.repair_type_id,
      r.cost, r.status, r.fault_type, r.customer_name, r.customer_phone,
      r.custom_repair_description, r.custom_repair_price,
      r.created_at, r.completed_at,
      CASE WHEN d.id IS NOT NULL THEN
        json_build_object('id', d.id, 'imei', d.imei, 'imei2', d.imei2,
          'device_models', CASE WHEN dm.id IS NOT NULL THEN json_build_object('model_name', dm.model_name) ELSE NULL END)
      ELSE NULL END AS device,
      CASE WHEN rt.id IS NOT NULL THEN
        json_build_object('id', rt.id, 'name', rt.name, 'description', rt.description)
      ELSE NULL END AS repair_type,
      (SELECT json_agg(json_build_object('id', rr.id, 'status', rr.status, 'created_at', rr.created_at))
       FROM replacement_requests rr WHERE rr.device_id = r.device_id) AS replacement_requests
    FROM repairs r
    LEFT JOIN devices d ON r.device_id = d.id
    LEFT JOIN device_models dm ON d.model_id = dm.id
    LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
    WHERE r.lab_id = p_lab_id
    ORDER BY r.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'data', v_data, 'count', v_total, 'page', p_page,
    'pageSize', p_page_size, 'totalPages', CEIL(v_total::FLOAT / p_page_size)
  );
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 7.15 Search Repairs by IMEI
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_repairs_by_imei(
  p_imei TEXT,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 50
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offset INT;
  v_total BIGINT;
  v_data JSON;
BEGIN
  v_offset := (p_page - 1) * p_page_size;

  SELECT COUNT(*) INTO v_total
  FROM repairs r JOIN devices d ON r.device_id = d.id
  WHERE d.imei = p_imei OR d.imei2 = p_imei;

  SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::JSON)
  INTO v_data
  FROM (
    SELECT 
      r.id, r.device_id, r.lab_id, r.warranty_id, r.repair_type_id,
      r.cost, r.status, r.fault_type, r.customer_name, r.customer_phone,
      r.custom_repair_description, r.custom_repair_price,
      r.created_at, r.completed_at,
      json_build_object('id', d.id, 'imei', d.imei, 'imei2', d.imei2,
        'device_models', CASE WHEN dm.id IS NOT NULL THEN json_build_object('model_name', dm.model_name) ELSE NULL END) AS device,
      CASE WHEN u.id IS NOT NULL THEN
        json_build_object('id', u.id, 'full_name', u.full_name, 'email', u.email)
      ELSE NULL END AS lab,
      CASE WHEN rt.id IS NOT NULL THEN
        json_build_object('id', rt.id, 'name', rt.name)
      ELSE NULL END AS repair_type
    FROM repairs r
    JOIN devices d ON r.device_id = d.id
    LEFT JOIN device_models dm ON d.model_id = dm.id
    LEFT JOIN users u ON r.lab_id = u.id
    LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
    WHERE d.imei = p_imei OR d.imei2 = p_imei
    ORDER BY r.created_at DESC
    LIMIT p_page_size
    OFFSET v_offset
  ) t;

  RETURN json_build_object(
    'data', v_data, 'count', v_total, 'page', p_page,
    'pageSize', p_page_size, 'totalPages', CEIL(v_total::FLOAT / p_page_size)
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 8: TRIGGER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '⚙️ Creating trigger functions...'; END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.1 Update Updated_at Timestamp
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.2 Handle New User (Auth Hook)
-- ⚠️ SECURITY: Creates user with is_active = false by default
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (id, email, full_name, phone, role, is_active, created_by)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), ''),
    'store',
    false, -- ⚠️ SECURITY: New users are inactive by default
    NULL
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create user in public.users: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.3 Handle User Profile Update
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_user_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Only admins can change user roles';
    END IF;
  END IF;
  
  IF OLD.is_active = false AND NEW.is_active = true THEN
    IF auth.uid() = NEW.id AND NOT is_admin() THEN
      RAISE EXCEPTION 'Users cannot activate themselves';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.4 Validate Repair Cost
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_repair_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_price NUMERIC(10, 2);
BEGIN
  -- טיפול בתיקון מותאם אישית (Custom)
  IF NEW.custom_repair_description IS NOT NULL THEN
    IF NEW.custom_repair_price IS NOT NULL THEN
       NEW.cost := NEW.custom_repair_price;
    END IF;
    RETURN NEW;
  END IF;

  -- טיפול בתיקון מחירון (Standard)
  IF NEW.repair_type_id IS NOT NULL AND NEW.lab_id IS NOT NULL THEN
    
    SELECT price INTO v_price
    FROM lab_repair_prices
    WHERE lab_id = NEW.lab_id 
      AND repair_type_id = NEW.repair_type_id
      AND is_active = true;

    IF v_price IS NOT NULL THEN
       
       -- INSERT (יצירה)
       IF TG_OP = 'INSERT' THEN
          IF NEW.status = 'completed' AND NEW.cost IS NULL THEN
             NEW.cost := v_price;
          END IF;

       -- UPDATE (עדכון)
       ELSIF TG_OP = 'UPDATE' THEN
          IF NEW.status = 'completed' THEN
             IF (NEW.cost IS NULL OR NEW.cost = OLD.cost) THEN
                
                IF 
                   (OLD.status IS DISTINCT FROM 'completed' AND OLD.cost IS NULL) OR 
                   (OLD.repair_type_id IS DISTINCT FROM NEW.repair_type_id) OR
                   (OLD.lab_id IS DISTINCT FROM NEW.lab_id) OR
                   (NEW.cost IS NULL) 
                THEN
                   NEW.cost := v_price;
                END IF;
             END IF;
          END IF;
       END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.5 Populate Replacement Customer Details
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION populate_replacement_customer_details()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_name TEXT;
  v_customer_phone TEXT;
BEGIN
  IF NEW.customer_name IS NULL OR NEW.customer_name = '' OR 
     NEW.customer_phone IS NULL OR NEW.customer_phone = '' THEN
    
    IF NEW.repair_id IS NOT NULL THEN
      SELECT customer_name, customer_phone INTO v_customer_name, v_customer_phone
      FROM repairs WHERE id = NEW.repair_id;
    END IF;
    
    IF v_customer_name IS NULL AND NEW.warranty_id IS NOT NULL THEN
      SELECT customer_name, customer_phone INTO v_customer_name, v_customer_phone
      FROM warranties WHERE id = NEW.warranty_id;
    END IF;
    
    IF v_customer_name IS NOT NULL THEN
      NEW.customer_name := COALESCE(NEW.customer_name, v_customer_name);
      NEW.customer_phone := COALESCE(NEW.customer_phone, v_customer_phone);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.6 Prevent Warranty Date Change
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_warranty_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Prevent any change to activation_date
  IF OLD.activation_date IS DISTINCT FROM NEW.activation_date THEN
    RAISE EXCEPTION 'Cannot change warranty activation date after creation';
  END IF;
  
  -- Only admin can change expiry_date
  IF OLD.expiry_date IS DISTINCT FROM NEW.expiry_date THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Only admin can change warranty expiry date';
    END IF;
  END IF;
  
  -- Prevent change to store_id (who activated the warranty)
  IF OLD.store_id IS DISTINCT FROM NEW.store_id THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Cannot change the store that activated the warranty';
    END IF;
  END IF;
  
  -- Prevent change to customer details (only admin can change)
  IF OLD.customer_name IS DISTINCT FROM NEW.customer_name 
     OR OLD.customer_phone IS DISTINCT FROM NEW.customer_phone THEN
    IF NOT is_admin() THEN
      RAISE EXCEPTION 'Only admin can change customer details';
    END IF;
  END IF;
  
  -- Prevent change to device_id
  IF OLD.device_id IS DISTINCT FROM NEW.device_id THEN
    RAISE EXCEPTION 'Cannot change the device associated with a warranty';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.6 Prevent Repair Immutable Fields Change
-- Labs cannot change: lab_id, device_id, created_at, warranty_id
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_repair_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Admin can change anything
  IF is_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Prevent change to lab_id (who created the repair)
  IF OLD.lab_id IS DISTINCT FROM NEW.lab_id THEN
    RAISE EXCEPTION 'Cannot change the lab assigned to this repair';
  END IF;
  
  -- Prevent change to device_id
  IF OLD.device_id IS DISTINCT FROM NEW.device_id THEN
    RAISE EXCEPTION 'Cannot change the device for this repair';
  END IF;
  
  -- Prevent change to warranty_id
  IF OLD.warranty_id IS DISTINCT FROM NEW.warranty_id THEN
    RAISE EXCEPTION 'Cannot change the warranty linked to this repair';
  END IF;
  
  -- Prevent change to created_at
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Cannot change repair creation date';
  END IF;
  
  -- Prevent change to created_by
  IF OLD.created_by IS DISTINCT FROM NEW.created_by THEN
    RAISE EXCEPTION 'Cannot change who created this repair';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.7 Prevent Replacement Request Immutable Fields Change
-- Users cannot change: requester_id, device_id, warranty_id, created_at
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_replacement_request_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Admin can change anything
  IF is_admin() THEN
    RETURN NEW;
  END IF;
  
  -- Prevent change to requester_id (who created the request)
  IF OLD.requester_id IS DISTINCT FROM NEW.requester_id THEN
    RAISE EXCEPTION 'Cannot change the requester of this replacement request';
  END IF;
  
  -- Prevent change to device_id
  IF OLD.device_id IS DISTINCT FROM NEW.device_id THEN
    RAISE EXCEPTION 'Cannot change the device for this replacement request';
  END IF;
  
  -- Prevent change to warranty_id
  IF OLD.warranty_id IS DISTINCT FROM NEW.warranty_id THEN
    RAISE EXCEPTION 'Cannot change the warranty linked to this replacement request';
  END IF;
  
  -- Prevent change to repair_id
  IF OLD.repair_id IS DISTINCT FROM NEW.repair_id THEN
    RAISE EXCEPTION 'Cannot change the repair linked to this replacement request';
  END IF;
  
  -- Prevent change to created_at
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Cannot change replacement request creation date';
  END IF;
  
  -- Prevent change to customer details (populated from warranty)
  IF OLD.customer_name IS DISTINCT FROM NEW.customer_name 
     OR OLD.customer_phone IS DISTINCT FROM NEW.customer_phone THEN
    RAISE EXCEPTION 'Cannot change customer details on replacement request';
  END IF;
  
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.7 Prevent Unreplace Device
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION prevent_unreplace_device()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_replaced = true AND NEW.is_replaced = false THEN
    RAISE EXCEPTION 'Cannot unreplace a device that has been marked as replaced';
  END IF;
  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.8 Handle Repair Notifications
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_repair_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_imei TEXT;
  v_lab_name TEXT;
  v_repair_type_name TEXT;
  v_model_name TEXT;
BEGIN
  SELECT d.imei, dm.model_name
  INTO v_device_imei, v_model_name
  FROM devices d
  LEFT JOIN device_models dm ON d.model_id = dm.id
  WHERE d.id = NEW.device_id;
  
  SELECT full_name INTO v_lab_name FROM users WHERE id = NEW.lab_id;

  IF (TG_OP = 'INSERT') THEN
    PERFORM notify_admins(
      'repair_new',
      'תיקון חדש נוצר',
      'תיקון חדש נוצר (' || COALESCE(v_model_name, 'דגם לא ידוע') || ') על ידי ' || COALESCE(v_lab_name, 'מעבדה') || ' למכשיר ' || v_device_imei,
      jsonb_build_object(
        'device_imei', v_device_imei,
        'model_name', COALESCE(v_model_name, 'לא ידוע'),
        'lab_name', COALESCE(v_lab_name, 'מעבדה'),
        'fault_type', NEW.fault_type
      )
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'completed' AND OLD.status != 'completed') THEN
      IF NEW.repair_type_id IS NOT NULL THEN
        SELECT name INTO v_repair_type_name FROM repair_types WHERE id = NEW.repair_type_id;
      ELSE
        v_repair_type_name := NEW.custom_repair_description;
      END IF;

      PERFORM notify_admins(
        'repair_completed',
        'תיקון הושלם',
        'התיקון למכשיר ' || COALESCE(v_model_name, v_device_imei) || ' (עלות: ' || COALESCE(NEW.cost::TEXT, 'לא נקבע') || ' ש"ח) הושלם.',
        jsonb_build_object(
          'device_imei', v_device_imei,
          'model_name', COALESCE(v_model_name, 'לא ידוע'),
          'lab_name', COALESCE(v_lab_name, 'מעבדה'),
          'repair_type', COALESCE(v_repair_type_name, 'לא צוין'),
          'cost', NEW.cost
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.9 Notify on New Payment
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_new_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lab_name TEXT;
  v_actor_id UUID;
BEGIN
  v_actor_id := auth.uid();

  SELECT full_name INTO v_lab_name FROM users WHERE id = NEW.lab_id;

  PERFORM notify_admins(
    'payment_new',
    'תשלום חדש התקבל',
    'תשלום בסך ' || NEW.amount || ' ₪ התקבל מ-' || COALESCE(v_lab_name, 'מעבדה'),
    jsonb_build_object(
      'payment_id', NEW.id,
      'lab_id', NEW.lab_id,
      'lab_name', v_lab_name,
      'amount', NEW.amount,
      'payment_date', NEW.payment_date
    ),
    v_actor_id
  );

  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.10 Notify on Replacement Request
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_replacement_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_imei TEXT;
  v_requester_name TEXT;
BEGIN
  SELECT imei INTO v_device_imei FROM devices WHERE id = NEW.device_id;
  SELECT full_name INTO v_requester_name FROM users WHERE id = NEW.requester_id;

  PERFORM notify_admins(
    'replacement_request_new',
    'בקשת החלפה חדשה',
    'בקשת החלפה חדשה למכשיר ' || v_device_imei || ' נשלחה על ידי ' || COALESCE(v_requester_name, 'משתמש'),
    jsonb_build_object(
      'request_id', NEW.id,
      'device_id', NEW.device_id,
      'device_imei', v_device_imei,
      'requester_name', v_requester_name,
      'reason', NEW.reason
    )
  );

  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.11 Notify on Replacement Status Change
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION notify_on_replacement_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_imei TEXT;
  v_status_text TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status != 'pending' THEN
    SELECT imei INTO v_device_imei FROM devices WHERE id = NEW.device_id;
    
    v_status_text := CASE NEW.status
      WHEN 'approved' THEN 'אושרה'
      WHEN 'rejected' THEN 'נדחתה'
      ELSE NEW.status::TEXT
    END;

    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.requester_id,
      'replacement_request_updated',
      'עדכון סטטוס בקשת החלפה',
      'בקשת ההחלפה למכשיר ' || v_device_imei || ' ' || v_status_text,
      jsonb_build_object(
        'request_id', NEW.id,
        'device_imei', v_device_imei,
        'new_status', NEW.status,
        'admin_notes', NEW.admin_notes
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- ───────────────────────────────────────────────────────────────────────────────
-- 8.12 Audit Replacement Request Creation
-- ───────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION audit_replacement_request_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, meta)
  VALUES (NEW.requester_id, 'replacement.create', 'replacement_request', NEW.id, jsonb_build_object(
    'device_id', NEW.device_id,
    'reason', NEW.reason,
    'requester_id', NEW.requester_id
  ));
  RETURN NEW;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 9: TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '⚡ Creating triggers...'; END $$;

-- Auth.users trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Updated_at triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_device_models_updated_at ON device_models;
CREATE TRIGGER update_device_models_updated_at BEFORE UPDATE ON device_models FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_devices_updated_at ON devices;
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_repair_types_updated_at ON repair_types;
CREATE TRIGGER update_repair_types_updated_at BEFORE UPDATE ON repair_types FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_lab_repair_prices_updated_at ON lab_repair_prices;
CREATE TRIGGER update_lab_repair_prices_updated_at BEFORE UPDATE ON lab_repair_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_warranties_updated_at ON warranties;
CREATE TRIGGER update_warranties_updated_at BEFORE UPDATE ON warranties FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_repairs_updated_at ON repairs;
CREATE TRIGGER update_repairs_updated_at BEFORE UPDATE ON repairs FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_replacement_requests_updated_at ON replacement_requests;
CREATE TRIGGER update_replacement_requests_updated_at BEFORE UPDATE ON replacement_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Business logic triggers
DROP TRIGGER IF EXISTS enforce_repair_cost_trigger ON repairs;

CREATE TRIGGER enforce_repair_cost_trigger
  BEFORE INSERT OR UPDATE OF 
    repair_type_id, 
    lab_id, 
    status, 
    custom_repair_price,
    cost
  ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION validate_repair_cost();

DROP TRIGGER IF EXISTS populate_replacement_customer_details_trigger ON replacement_requests;
CREATE TRIGGER populate_replacement_customer_details_trigger
  BEFORE INSERT ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION populate_replacement_customer_details();

DROP TRIGGER IF EXISTS prevent_warranty_date_change_trigger ON warranties;
CREATE TRIGGER prevent_warranty_date_change_trigger
  BEFORE UPDATE ON warranties
  FOR EACH ROW
  EXECUTE FUNCTION prevent_warranty_date_change();

DROP TRIGGER IF EXISTS prevent_unreplace_device_trigger ON devices;
CREATE TRIGGER prevent_unreplace_device_trigger
  BEFORE UPDATE ON devices
  FOR EACH ROW
  EXECUTE FUNCTION prevent_unreplace_device();

DROP TRIGGER IF EXISTS prevent_repair_immutable_fields_trigger ON repairs;
CREATE TRIGGER prevent_repair_immutable_fields_trigger
  BEFORE UPDATE ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION prevent_repair_immutable_fields();

DROP TRIGGER IF EXISTS prevent_replacement_request_immutable_fields_trigger ON replacement_requests;
CREATE TRIGGER prevent_replacement_request_immutable_fields_trigger
  BEFORE UPDATE ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION prevent_replacement_request_immutable_fields();

DROP TRIGGER IF EXISTS on_user_profile_update ON users;
CREATE TRIGGER on_user_profile_update
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION handle_user_profile_update();

-- Notification triggers
DROP TRIGGER IF EXISTS on_new_repair ON repairs;
CREATE TRIGGER on_new_repair
  AFTER INSERT ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION handle_repair_notifications();

DROP TRIGGER IF EXISTS on_update_repair ON repairs;
CREATE TRIGGER on_update_repair
  AFTER UPDATE ON repairs
  FOR EACH ROW
  EXECUTE FUNCTION handle_repair_notifications();

DROP TRIGGER IF EXISTS trigger_notify_new_payment ON payments;
CREATE TRIGGER trigger_notify_new_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_new_payment();

DROP TRIGGER IF EXISTS trigger_notify_replacement_request ON replacement_requests;
CREATE TRIGGER trigger_notify_replacement_request
  AFTER INSERT ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_replacement_request();

DROP TRIGGER IF EXISTS trigger_notify_replacement_status ON replacement_requests;
CREATE TRIGGER trigger_notify_replacement_status
  AFTER UPDATE ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_replacement_status_change();

DROP TRIGGER IF EXISTS on_replacement_request_created ON replacement_requests;
CREATE TRIGGER on_replacement_request_created
  AFTER INSERT ON replacement_requests
  FOR EACH ROW
  EXECUTE FUNCTION audit_replacement_request_creation();

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 10: RLS ENABLE
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '🔒 Enabling Row Level Security...'; END $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_repair_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;
ALTER TABLE replacement_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 11: DEFAULT DATA
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '💾 Inserting default data...'; END $$;

INSERT INTO settings (key, value)
VALUES ('imei_search_rate_limit', '{"value": 50}')
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 12: RLS POLICIES
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '🛡️ Creating RLS policies...'; END $$;

-- Drop all existing policies
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN (SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────────────────────
-- Users Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON users FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "users_read_own" ON users FOR SELECT TO authenticated 
  USING (auth.uid() = id);
CREATE POLICY "users_insert_own" ON users FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated 
  USING (auth.uid() = id) 
  WITH CHECK (auth.uid() = id AND role = (SELECT u.role FROM users u WHERE u.id = auth.uid()));
CREATE POLICY "service_role_insert" ON users FOR INSERT TO service_role 
  WITH CHECK (true);

-- ───────────────────────────────────────────────────────────────────────────────
-- Device Models Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON device_models FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "public_select" ON device_models FOR SELECT TO authenticated 
  USING (is_active = true);

-- ───────────────────────────────────────────────────────────────────────────────
-- Devices Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON devices FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "store_view_own_devices" ON devices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM warranties 
      WHERE warranties.device_id = devices.id 
      AND warranties.store_id = auth.uid()
    )
  );
CREATE POLICY "lab_view_work_devices" ON devices FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repairs 
      WHERE repairs.device_id = devices.id 
      AND repairs.lab_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- Repair Types Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON repair_types FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "public_select" ON repair_types FOR SELECT TO authenticated 
  USING (is_active = true);

-- ───────────────────────────────────────────────────────────────────────────────
-- Lab Repair Prices Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON lab_repair_prices FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "lab_select" ON lab_repair_prices FOR SELECT TO authenticated 
  USING (is_lab() AND lab_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Warranties Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON warranties FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "store_select" ON warranties FOR SELECT TO authenticated 
  USING (is_store() AND store_id = auth.uid());
CREATE POLICY "store_insert" ON warranties FOR INSERT TO authenticated 
  WITH CHECK (is_store() AND store_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Repairs Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON repairs FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "lab_select" ON repairs FOR SELECT TO authenticated 
  USING (is_lab() AND lab_id = auth.uid());
CREATE POLICY "lab_insert" ON repairs FOR INSERT TO authenticated 
  WITH CHECK (is_lab() AND lab_id = auth.uid());
CREATE POLICY "lab_update" ON repairs FOR UPDATE TO authenticated 
  USING (is_lab() AND lab_id = auth.uid()) 
  WITH CHECK (is_lab() AND lab_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Replacement Requests Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_select" ON replacement_requests FOR SELECT TO authenticated 
  USING (is_admin());
CREATE POLICY "admin_update" ON replacement_requests FOR UPDATE TO authenticated 
  USING (is_admin());
CREATE POLICY "admin_delete" ON replacement_requests FOR DELETE TO authenticated 
  USING (is_admin());
CREATE POLICY "users_view_own" ON replacement_requests FOR SELECT TO authenticated 
  USING (requester_id = auth.uid());
CREATE POLICY "users_update_own_pending" ON replacement_requests FOR UPDATE TO authenticated 
  USING (requester_id = auth.uid() AND status = 'pending');
CREATE POLICY "store_insert" ON replacement_requests FOR INSERT TO authenticated 
  WITH CHECK (is_store() AND requester_id = auth.uid());
CREATE POLICY "lab_insert" ON replacement_requests FOR INSERT TO authenticated 
  WITH CHECK (is_lab() AND requester_id = auth.uid());
CREATE POLICY "lab_view_device_requests" ON replacement_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM repairs 
      WHERE repairs.device_id = replacement_requests.device_id 
      AND repairs.lab_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────────
-- Payments Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON payments FOR ALL TO authenticated 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "labs_view_own" ON payments FOR SELECT TO authenticated 
  USING (is_lab() AND lab_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Device Search Log Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON device_search_log FOR ALL TO authenticated 
  USING (is_admin());
CREATE POLICY "users_view_own" ON device_search_log FOR SELECT TO authenticated 
  USING (user_id = auth.uid());
CREATE POLICY "users_insert_own" ON device_search_log FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Notifications Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "users_view_own" ON notifications FOR SELECT TO authenticated 
  USING (user_id = auth.uid());
CREATE POLICY "users_update_own" ON notifications FOR UPDATE TO authenticated 
  USING (user_id = auth.uid());
CREATE POLICY "users_delete_own" ON notifications FOR DELETE TO authenticated 
  USING (user_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────────
-- Settings Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON settings FOR ALL 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "authenticated_read" ON settings FOR SELECT 
  USING (auth.role() = 'authenticated');

-- ───────────────────────────────────────────────────────────────────────────────
-- Audit Log Policies
-- ───────────────────────────────────────────────────────────────────────────────
CREATE POLICY "admin_all" ON audit_log FOR ALL 
  USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "service_role_insert" ON audit_log FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 13: PERMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '🔑 Granting permissions...'; END $$;

-- ⚠️ SECURITY: Only service_role gets full access
-- All user access is controlled via RLS policies
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Explicitly grant INSERT on users table for auth trigger
GRANT INSERT ON users TO postgres;

-- Authenticated users get sequence access only (for inserts)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Authenticated users can execute RPC functions (SECURITY DEFINER protects them)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant execute permission to supabase_auth_admin for the auth hook
GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;

-- ⚠️ SECURITY: Revoke execute on internal/system functions from authenticated users
-- These functions should only be called by triggers, not directly by users
REVOKE EXECUTE ON FUNCTION notify_admins(TEXT, TEXT, TEXT, JSONB, UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_user(UUID, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_user_profile_update() FROM authenticated;
REVOKE EXECUTE ON FUNCTION update_updated_at() FROM authenticated;
REVOKE EXECUTE ON FUNCTION validate_repair_cost() FROM authenticated;
REVOKE EXECUTE ON FUNCTION populate_replacement_customer_details() FROM authenticated;
REVOKE EXECUTE ON FUNCTION prevent_warranty_date_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION prevent_unreplace_device() FROM authenticated;
REVOKE EXECUTE ON FUNCTION prevent_repair_immutable_fields() FROM authenticated;
REVOKE EXECUTE ON FUNCTION prevent_replacement_request_immutable_fields() FROM authenticated;
REVOKE EXECUTE ON FUNCTION handle_repair_notifications() FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_new_payment() FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_replacement_request() FROM authenticated;
REVOKE EXECUTE ON FUNCTION notify_on_replacement_status_change() FROM authenticated;
REVOKE EXECUTE ON FUNCTION audit_replacement_request_creation() FROM authenticated;
REVOKE EXECUTE ON FUNCTION custom_access_token_hook FROM authenticated, anon, public;

-- Views: Read-only access for authenticated users
GRANT SELECT ON view_lab_balances TO authenticated;
GRANT SELECT ON devices_imei_lookup TO authenticated;
GRANT SELECT ON devices_with_status TO authenticated;
GRANT SELECT ON devices_rich_view TO authenticated;
GRANT SELECT ON active_warranties_with_replacements TO authenticated;
GRANT SELECT ON admin_dashboard_stats TO authenticated;

-- Default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO service_role, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SECTION 14: REALTIME CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '📡 Configuring Realtime publication...'; END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    devices, 
    warranties, 
    repairs, 
    replacement_requests, 
    notifications, 
    payments;
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Tables already in publication, skipping...';
  WHEN undefined_object THEN
    RAISE WARNING 'Publication supabase_realtime does not exist (are you running locally?)';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLETION
-- ═══════════════════════════════════════════════════════════════════════════════

COMMIT;

DO $$
DECLARE
  table_count INTEGER;
  view_count INTEGER;
  function_count INTEGER;
  trigger_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO table_count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
  
  SELECT COUNT(*) INTO view_count 
  FROM information_schema.views 
  WHERE table_schema = 'public';
  
  SELECT COUNT(*) INTO function_count 
  FROM pg_proc p 
  JOIN pg_namespace n ON p.pronamespace = n.oid 
  WHERE n.nspname = 'public' AND p.prokind = 'f';
  
  SELECT COUNT(*) INTO trigger_count 
  FROM information_schema.triggers 
  WHERE trigger_schema = 'public';
  
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public';
  
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║          DEPLOYMENT COMPLETED SUCCESSFULLY! ✅                ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Database Summary:';
  RAISE NOTICE '   • Tables:    %', table_count;
  RAISE NOTICE '   • Views:     %', view_count;
  RAISE NOTICE '   • Functions: %', function_count;
  RAISE NOTICE '   • Triggers:  %', trigger_count;
  RAISE NOTICE '   • Policies:  %', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '🔐 Security Features:';
  RAISE NOTICE '   • RLS enabled on all tables';
  RAISE NOTICE '   • New users created with is_active = false';
  RAISE NOTICE '   • Internal functions protected from direct execution';
  RAISE NOTICE '   • JWT includes user_role and user_active claims';
  RAISE NOTICE '';
  RAISE NOTICE '📝 Next Steps:';
  RAISE NOTICE '   1. Create first admin: Sign up, then run:';
  RAISE NOTICE '      UPDATE users SET role = ''admin'', is_active = true WHERE email = ''your@email.com'';';
  RAISE NOTICE '   2. Test access: SELECT * FROM admin_dashboard_stats;';
  RAISE NOTICE '   3. Import your device data if needed';
  RAISE NOTICE '';
  RAISE NOTICE '💡 Tip: Always backup before making changes!';
  RAISE NOTICE '';
END $$;