-- Function to generate repair reports efficiently on the server side
-- Replaces client-side aggregation in src/app/admin/reports/page.tsx

CREATE OR REPLACE FUNCTION get_periodic_repair_stats(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_by_status JSON;
  v_by_repair_type JSON;
  v_by_lab JSON;
  v_monthly_repairs JSON;
BEGIN
  -- Check permissions (assuming is_admin() exists)
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can view repair reports';
  END IF;

  -- 1. By Status
  SELECT COALESCE(json_object_agg(status, count), '{}'::json)
  INTO v_by_status
  FROM (
    SELECT status, COUNT(*) as count
    FROM repairs
    WHERE created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY status
  ) t;

  -- 2. By Repair Type (handling legacy fault_type fallback)
  SELECT COALESCE(json_object_agg(repair_name, count), '{}'::json)
  INTO v_by_repair_type
  FROM (
    SELECT
      CASE
        WHEN rt.name IS NOT NULL THEN rt.name
        WHEN r.fault_type = 'screen' THEN 'מסך'
        WHEN r.fault_type = 'charging_port' THEN 'שקע טעינה'
        WHEN r.fault_type = 'flash' THEN 'פנס'
        WHEN r.fault_type = 'speaker' THEN 'רמקול'
        WHEN r.fault_type = 'board' THEN 'לוח אם'
        WHEN r.fault_type = 'other' THEN 'אחר'
        ELSE 'אחר'
      END as repair_name,
      COUNT(*) as count
    FROM repairs r
    LEFT JOIN repair_types rt ON r.repair_type_id = rt.id
    WHERE r.created_at >= p_start_date AND r.created_at <= p_end_date
    GROUP BY 1
  ) t;

  -- 3. By Lab
  SELECT COALESCE(json_object_agg(lab_name, json_build_object('count', count, 'revenue', revenue)), '{}'::json)
  INTO v_by_lab
  FROM (
    SELECT
      COALESCE(u.full_name, u.email, 'מעבדה') as lab_name,
      COUNT(*) as count,
      COALESCE(SUM(r.cost), 0) as revenue
    FROM repairs r
    LEFT JOIN users u ON r.lab_id = u.id
    WHERE r.created_at >= p_start_date AND r.created_at <= p_end_date AND r.lab_id IS NOT NULL
    GROUP BY 1
  ) t;

  -- 4. Monthly Repairs
  SELECT COALESCE(
    json_agg(
      json_build_object('month', month, 'count', count, 'revenue', revenue)
      ORDER BY month
    ),
    '[]'::json
  )
  INTO v_monthly_repairs
  FROM (
    SELECT
      TO_CHAR(created_at, 'YYYY-MM') as month,
      COUNT(*) as count,
      COALESCE(SUM(cost), 0) as revenue
    FROM repairs
    WHERE created_at >= p_start_date AND created_at <= p_end_date
    GROUP BY 1
  ) t;

  RETURN json_build_object(
    'byStatus', v_by_status,
    'byRepairType', v_by_repair_type,
    'byLab', v_by_lab,
    'monthlyRepairs', v_monthly_repairs
  );
END;
$$;