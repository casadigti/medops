// SECURITY F-02: do not hardcode the production Supabase URL/ref in
// versioned code. Read from the environment; default to local Supabase.
const ENV = process.env;
export const SUPABASE_URL = ENV['E2E_SUPABASE_URL'] || 'http://localhost:54321';
export const PROJECT_REF = ENV['E2E_SUPABASE_PROJECT_REF'] || 'local';

export const MOCK_USER = {
  id: 'mock-user-id-e2e',
  email: 'admin@test.com',
  role: 'authenticated',
  aud: 'authenticated',
  created_at: '2024-01-01T00:00:00Z',
  user_metadata: { full_name: 'Admin Test' },
};

export const MOCK_SESSION = {
  access_token: 'mock-access-token-e2e',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: 'mock-refresh-token-e2e',
  user: MOCK_USER,
};

export const MOCK_PROFILE = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  full_name: 'Admin Test',
  role: 'Administrador',
  is_active: true,
  must_change_password: false,
  created_at: '2024-01-01T00:00:00Z',
};

export const MOCK_SURGERIES = [
  {
    id: 'surgery-1',
    patient_name: 'Juan Pérez',
    surgery_date: '2026-05-20',
    status: 'Pendiente',
    hospital_id: 'hospital-1',
    surgeon_id: 'surgeon-1',
    created_at: '2026-05-01T00:00:00Z',
    hospital: { id: 'hospital-1', name: 'Hospital General' },
    surgeon: { id: 'surgeon-1', name: 'Dr. García' },
    surgery_trays: [],
    surgery_consumptions: [],
  },
];

export const MOCK_TRAYS = [
  {
    id: 'tray-1',
    name: 'Set Ortopédico Básico',
    description: 'Set para cirugías de cadera y rodilla',
    status: 'Disponible',
    category: 'Ortopedia',
    created_at: '2024-01-01T00:00:00Z',
    tray_items: [],
    sterilization_records: [],
  },
];

export const MOCK_HOSPITALS = [
  { id: 'hospital-1', name: 'Hospital General', city: 'Santo Domingo', address: 'Av. Principal 123', logistics_notes: '' },
];

export const MOCK_SURGEONS = [
  { id: 'surgeon-1', name: 'Dr. García', specialty: 'Ortopedia', email: 'garcia@hospital.com', user_id: null },
];

export const MOCK_ARS = [
  { id: 'ars-1', name: 'ARS Salud Segura' },
];
