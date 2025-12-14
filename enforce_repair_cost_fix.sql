CREATE OR REPLACE FUNCTION validate_repair_cost() 
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_price NUMERIC(10, 2);
BEGIN
  -- 1. Custom Repair: Trust the lab's input
  IF NEW.custom_repair_description IS NOT NULL THEN
    IF NEW.custom_repair_price IS NOT NULL THEN
       NEW.cost := NEW.custom_repair_price;
    END IF;
    RETURN NEW;
  END IF;

  -- 2. Standard Repair: ALWAYS enforce catalog price
  IF NEW.repair_type_id IS NOT NULL AND NEW.lab_id IS NOT NULL THEN
    SELECT price INTO v_price
    FROM lab_repair_prices
    WHERE lab_id = NEW.lab_id 
      AND repair_type_id = NEW.repair_type_id
      AND is_active = true;

    -- If price exists in catalog, force it.
    -- This overrides any 'cost' value sent by the user/lab.
    IF v_price IS NOT NULL THEN
       NEW.cost := v_price;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
