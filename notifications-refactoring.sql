-- ═══════════════════════════════════════════════════════════════════════════════
-- NOTIFICATIONS SYSTEM REFACTORING
-- ═══════════════════════════════════════════════════════════════════════════════
-- Version: 1.1 (Fixed)
-- Date: 2025
-- Description: Refactoring notification system - fixing payment notifications,
--              adding warranty activation notifications, updating types
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$ BEGIN RAISE NOTICE '
╔════════════════════════════════════════════════════════════════╗
║     NOTIFICATIONS SYSTEM REFACTORING                          ║
╚════════════════════════════════════════════════════════════════╝
'; END $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 1: Migrate existing notification types FIRST (before constraint change!)
-- ⚠️ IMPORTANT: Must happen BEFORE changing the constraint
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '1️⃣ Migrating existing notification types...'; END $$;

-- Rename old payment_new to payment_received
UPDATE notifications SET type = 'payment_received' WHERE type = 'payment_new';

-- Remove types that are no longer used
DELETE FROM notifications WHERE type IN ('warranty_expiring', 'user_registered', 'repair_updated');

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 2: Update notification types constraint
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '2️⃣ Updating notification types constraint...'; END $$;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'warranty_activated',           -- NEW: warranty activation (to admins)
  'replacement_request_new',      -- replacement request created (to admins)
  'replacement_request_updated',  -- replacement request status changed (to requester)
  'repair_new',                   -- new repair created (to admins)
  'repair_completed',             -- repair completed (to admins)
  'payment_received'              -- payment received (to lab) - RENAMED from payment_new
));

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Fix notify_on_new_payment - send to LAB instead of admins
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '3️⃣ Fixing notify_on_new_payment function...'; END $$;

CREATE OR REPLACE FUNCTION notify_on_new_payment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Send notification to the LAB (not admins!)
  PERFORM notify_user(
    NEW.lab_id,
    'payment_received',
    'תשלום התקבל',
    'תשלום בסך ' || NEW.amount || ' ₪ נרשם עבורך',
    jsonb_build_object(
      'payment_id', NEW.id,
      'amount', NEW.amount,
      'payment_date', NEW.payment_date,
      'notes', COALESCE(NEW.notes, '')
    )
  );

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 4: Create notify_on_warranty_activation function
-- ⚠️ NOTE: store_id can be NULL (when admin creates warranty)
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '4️⃣ Creating notify_on_warranty_activation function...'; END $$;

CREATE OR REPLACE FUNCTION notify_on_warranty_activation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_imei TEXT;
  v_model_name TEXT;
  v_store_name TEXT;
  v_activated_by_name TEXT;
BEGIN
  -- Get device details
  SELECT d.imei, dm.model_name
  INTO v_device_imei, v_model_name
  FROM devices d
  LEFT JOIN device_models dm ON d.model_id = dm.id
  WHERE d.id = NEW.device_id;

  -- Get store name (store_id can be NULL if admin activated)
  IF NEW.store_id IS NOT NULL THEN
    SELECT full_name INTO v_store_name 
    FROM users 
    WHERE id = NEW.store_id;
  ELSE
    -- If store_id is NULL, check activated_by
    SELECT full_name INTO v_activated_by_name 
    FROM users 
    WHERE id = NEW.activated_by;
    
    v_store_name := COALESCE(v_activated_by_name, 'מנהל');
  END IF;

  -- Notify all admins
  PERFORM notify_admins(
    'warranty_activated',
    'אחריות חדשה הופעלה',
    'אחריות הופעלה למכשיר ' || COALESCE(v_model_name, v_device_imei) || 
    ' על ידי ' || COALESCE(v_store_name, 'משתמש'),
    jsonb_build_object(
      'warranty_id', NEW.id,
      'device_id', NEW.device_id,
      'device_imei', v_device_imei,
      'model_name', COALESCE(v_model_name, 'לא ידוע'),
      'store_name', COALESCE(v_store_name, 'לא ידוע'),
      'customer_name', NEW.customer_name
    )
  );

  RETURN NEW;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 5: Create trigger for warranty activation
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '5️⃣ Creating warranty activation trigger...'; END $$;

DROP TRIGGER IF EXISTS trigger_notify_warranty_activation ON warranties;
CREATE TRIGGER trigger_notify_warranty_activation
  AFTER INSERT ON warranties
  FOR EACH ROW
  EXECUTE FUNCTION notify_on_warranty_activation();

-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 6: Security - Revoke execute permissions on internal functions
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN RAISE NOTICE '6️⃣ Setting up security permissions...'; END $$;

-- Revoke execute on the new function from authenticated users
REVOKE EXECUTE ON FUNCTION notify_on_warranty_activation() FROM authenticated;

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMPLETION
-- ═══════════════════════════════════════════════════════════════════════════════

COMMIT;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║     NOTIFICATIONS REFACTORING COMPLETED! ✅                   ║';
  RAISE NOTICE '╚════════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Summary:';
  RAISE NOTICE '   • Migrated existing notification types';
  RAISE NOTICE '   • Updated notification types constraint';
  RAISE NOTICE '   • Fixed notify_on_new_payment (now sends to lab)';
  RAISE NOTICE '   • Added notify_on_warranty_activation function';
  RAISE NOTICE '   • Created warranty activation trigger';
  RAISE NOTICE '   • Secured new function permissions';
  RAISE NOTICE '';
  RAISE NOTICE '🔔 Notification Types:';
  RAISE NOTICE '   • warranty_activated → admins';
  RAISE NOTICE '   • replacement_request_new → admins';
  RAISE NOTICE '   • replacement_request_updated → requester';
  RAISE NOTICE '   • repair_new → admins';
  RAISE NOTICE '   • repair_completed → admins';
  RAISE NOTICE '   • payment_received → lab';
END $$;