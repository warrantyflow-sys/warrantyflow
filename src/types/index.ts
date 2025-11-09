// User Types
export type UserRole = 'admin' | 'store' | 'lab';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Device Types
export type WarrantyStatus = 'new' | 'active' | 'expired' | 'replaced';

export interface Device {
  id: string;
  imei: string;
  model: string;
  import_batch: string | null;
  warranty_status: WarrantyStatus;
  warranty_months: number;
  imported_by: string | null;
  created_at: string;
  updated_at: string;
  warranty?: Warranty;
  repairs?: Repair[];
}

// Warranty Types
export interface Warranty {
  id: string;
  device_id: string;
  store_id: string | null;
  customer_name: string;
  customer_phone: string;
  activation_date: string;
  expiry_date: string;
  is_active: boolean;
  activated_by: string | null;
  created_at: string;
  updated_at: string;
  device?: Device;
  store?: User;
}

// Repair Types
export type RepairStatus = 'received' | 'in_progress' | 'completed' | 'replacement_requested';
export type FaultType = 'screen' | 'charging_port' | 'flash' | 'speaker' | 'board' | 'other';

export interface Repair {
  id: string;
  device_id: string;
  lab_id: string | null;
  warranty_id: string | null;
  repair_type_id: string | null;
  customer_name: string;
  customer_phone: string;
  fault_type: FaultType;
  fault_description: string | null;
  status: RepairStatus;
  cost: number | null;
  created_by: string | null;
  completed_at: string | null;
  notes: string | null;
  custom_repair_description: string | null;
  custom_repair_price: number | null;
  created_at: string;
  updated_at: string;
  device?: Device;
  lab?: User;
  warranty?: Warranty;
}

// Replacement Request Types
export type RequestStatus = 'pending' | 'approved' | 'rejected';

export interface ReplacementRequest {
  id: string;
  device_id: string;
  repair_id: string | null;
  requester_id: string | null;
  reason: string;
  status: RequestStatus;
  admin_notes: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  device?: Device;
  repair?: Repair;
  requester?: User;
  resolver?: User;
}

// Payment Types
export type PaymentStatus = 'pending' | 'paid';

export interface Payment {
  id: string;
  lab_id: string | null;
  amount: number;
  payment_date: string;
  reference: string | null;
  status: PaymentStatus;
  created_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  lab?: User;
  creator?: User;
}

// Audit Log Types
export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: User;
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface DeviceForm {
  imei: string;
  model: string;
  import_batch?: string;
  warranty_months: number;
}

export interface WarrantyActivationForm {
  device_id: string;
  customer_name: string;
  customer_phone: string;
}

export interface RepairForm {
  device_id: string;
  customer_name: string;
  customer_phone: string;
  fault_type: FaultType;
  fault_description?: string;
  cost?: number;
  notes?: string;
  custom_repair_description?: string;
  custom_repair_price?: number;
}

export interface ReplacementRequestForm {
  device_id: string;
  repair_id?: string;
  reason: string;
}

export interface PaymentForm {
  lab_id: string;
  amount: number;
  payment_date: string;
  reference?: string;
  notes?: string;
}

// Dashboard Stats
export interface DashboardStats {
  totalDevices: number;
  activeWarranties: number;
  pendingRepairs: number;
  pendingReplacements: number;
  monthlyRevenue?: number;
  recentActivities: Activity[];
}

export interface Activity {
  id: string;
  type: 'warranty_activated' | 'repair_created' | 'replacement_requested' | 'payment_received';
  description: string;
  timestamp: string;
  user?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Filter Types
export interface DeviceFilters {
  search?: string;
  warranty_status?: WarrantyStatus;
  model?: string;
  import_batch?: string;
}

export interface RepairFilters {
  search?: string;
  status?: RepairStatus;
  fault_type?: FaultType;
  lab_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface WarrantyFilters {
  search?: string;
  store_id?: string;
  is_active?: boolean;
  expiry_from?: string;
  expiry_to?: string;
}

// Chart Data Types
export interface ChartDataPoint {
  name: string;
  value: number;
  label?: string;
}

export interface TimeSeriesData {
  date: string;
  [key: string]: string | number;
}

// Export Types
export interface ExportOptions {
  format: 'csv' | 'excel' | 'pdf';
  columns?: string[];
  filters?: Record<string, any>;
  dateRange?: {
    from: string;
    to: string;
  };
}