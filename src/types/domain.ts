// ─── Core domain types for MedOps ────────────────────────────────────────────

export interface Surgeon {
  id: string;
  full_name: string;
  specialty?: string;
  email?: string;
  phone?: string;
  user_id?: string;
  created_at?: string;
}

export interface Hospital {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  created_at?: string;
}

export interface ARS {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface ImplantLot {
  id: string;
  implant_id: string;
  lot_number: string;
  expiration_date: string;
  current_quantity: number;
  created_at?: string;
}

export interface Implant {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unit_cost: number;
  selling_price: number;
  min_stock: number;
  implant_lots?: ImplantLot[];
  created_at?: string;
}

export interface Tray {
  id: string;
  name: string;
  code?: string;
  procedure_type?: string;
  status: 'Disponible' | 'En limpieza' | 'En reparación' | 'Baja';
  last_sterilization?: string | null;
  next_maintenance?: string | null;
  usage_count?: number;
  surgery_trays?: Array<{ count: number }>;
  created_at?: string;
}

export interface TrayWithAvailability extends Tray {
  busy: boolean;
  unavailable_reason: string | null;
}

export type SurgeryStatus = 'Programada' | 'En Proceso' | 'Completada' | 'Cancelada';

export interface Surgery {
  id: string;
  patient_name: string;
  surgery_date: string;
  surgeon_id: string;
  hospital_id: string;
  operating_room?: string;
  procedure_type?: string;
  status: SurgeryStatus;
  delivery_responsible?: string;
  notes?: string;
  ars_id?: string;
  surgeon?: Pick<Surgeon, 'id' | 'full_name' | 'specialty'>;
  hospital?: Pick<Hospital, 'id' | 'name'>;
  ars?: Pick<ARS, 'id' | 'name'>;
  surgery_trays?: Array<{ tray: Tray }>;
  surgery_consumption?: Array<{ id: string }>;
  created_at?: string;
}

export interface SurgeryConsumption {
  id: string;
  surgery_id: string;
  implant_lot_id: string;
  quantity_used: number;
  notes?: string;
  auth_number?: string;
  used_at?: string;
  implant_lots?: ImplantLot & { implants?: Pick<Implant, 'name' | 'sku' | 'unit_cost'> };
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success';

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
}

export type UserRole = 'Superadmin' | 'Administrador' | 'Cirujano';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at?: string;
}

export interface OrganizationSettings {
  id: number;
  company_name?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  rnc?: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface MaintenanceLog {
  id: string;
  tray_id: string;
  action: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
}
