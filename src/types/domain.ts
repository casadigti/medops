// ─── Core domain types for MedOps ────────────────────────────────────────────

export interface Surgeon {
  id: string;
  full_name: string;
  specialty?: string;
  email?: string;
  phone?: string;
  user_id?: string;
  preferences?: string;
  created_at?: string;
}

export interface Hospital {
  id: string;
  name: string;
  city?: string;
  address?: string;
  phone?: string;
  coordinator_contact?: string;
  logistics_notes?: string;
  operating_rooms?: string[];
  requires_support_tray?: boolean;
  created_at?: string;
}

export interface ARS {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface ProcedureType {
  id: string;
  name: string;
  is_active: boolean;
  created_at?: string;
}

export interface ImplantLot {
  id: string;
  implant_id: string;
  lot_number: string;
  expiration_date: string | null;
  current_quantity: number;
  location?: string;
  created_at?: string;
}

export interface Implant {
  id: string;
  name: string;
  sku: string;
  category?: string;
  description?: string;
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
  status: 'Disponible' | 'En limpieza' | 'En reparación' | 'Baja' | string;
  last_sterilization?: string | null;
  next_maintenance?: string | null;
  usage_count?: number;
  sterilization_count?: number;
  location?: string;
  content?: string;
  is_support_tray?: boolean;
  surgery_trays?: Array<{ count: number }>;
  created_at?: string;
}

export interface TrayWithAvailability extends Tray {
  busy: boolean;
  unavailable_reason: string | null;
}

export type SurgeryStatus = 'Pendiente' | 'Programada' | 'En Proceso' | 'En preparación' | 'Lista' | 'En tránsito' | 'Entregada' | 'Completada' | 'Suspendida' | 'Cancelada' | 'Facturada';

export interface Surgery {
  id: string;
  org_id?: string;
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
  nss?: string;
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
  implant_lots?: ImplantLot & { implants?: Pick<Implant, 'id' | 'name' | 'sku' | 'unit_cost' | 'selling_price'> };
  // join field from some queries
  surgeries?: Pick<Surgery, 'id' | 'patient_name' | 'surgery_date' | 'hospital_id' | 'surgeon_id'> & { hospital?: Pick<Hospital, 'name'>; surgeon?: Pick<Surgeon, 'full_name'> };
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

export type UserRole = 'Superadmin' | 'Administrador' | 'Cirujano' | 'Técnico' | 'Editor' | 'Lector';

// Una organización (tenant). La data de cada org está aislada por RLS.
export interface Organization {
  id: string;
  name: string;
  slug?: string | null;
  is_active: boolean;
  max_users: number;
  created_at?: string;
  user_count?: number; // calculado en frontend
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  is_active: boolean;
  must_change_password: boolean;
  created_at?: string;
  // Multi-tenancy: org a la que pertenece el usuario. NULL para un
  // administrador de plataforma que no está ligado a ninguna organización.
  org_id?: string | null;
  is_platform_admin?: boolean;
  telegram_chat_id?: number | null;
}

export interface OrganizationSettings {
  // Identificada por org_id (una fila de settings por organización).
  org_id?: string;
  company_name?: string;
  logo_url?: string;
  phone?: string;
  email?: string;
  address?: string;
  rnc?: string;
  // Floor plan 2D — tamaño de la sala en unidades de celda
  room_width?: number;
  room_height?: number;
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

// ─── Storage Map ───────────────────────────────────────────────────────────────

export type SlotItemType = 'implant_lot' | 'tray';

export interface StorageShelf {
  id: string;
  org_id: string;
  name: string;
  orientation: 'horizontal' | 'vertical';
  rows: number;
  cols: number;
  color: string;
  description?: string;
  created_at?: string;
  slots?: StorageSlot[];
  // Floor plan 2D — posición en sala (null = sin colocar)
  position_x?: number | null;
  position_y?: number | null;
}

export interface StorageSlot {
  id: string;
  shelf_id: string;
  row_index: number;
  col_index: number;
  item_type: SlotItemType | null;
  item_id: string | null;
  notes?: string;
  item_label?: string;
  item_detail?: string;
  is_support_tray?: boolean;
}

export interface AvailableItems {
  implantLots: Array<{ id: string; label: string; detail: string }>;
  trays:       Array<{ id: string; label: string; detail: string; is_support_tray?: boolean }>;
}
