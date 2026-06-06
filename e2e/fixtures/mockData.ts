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

// JWT parseable (HS256 header + payload con sub/role/aud/exp). Firma falsa pero
// Supabase JS solo decodifica el payload — no verifica la firma en cliente.
export const MOCK_ACCESS_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' +
  '.eyJzdWIiOiJtb2NrLXVzZXItaWQtZTJlIiwiZW1haWwiOiJhZG1pbkB0ZXN0LmNvbSIsInJvbGUiOiJhdXRoZW50aWNhdGVkIiwiYXVkIjoiYXV0aGVudGljYXRlZCIsImlhdCI6MTAwMDAwMDAwMCwiZXhwIjo5OTk5OTk5OTk5fQ' +
  '.fake-sig-e2e';

export const MOCK_SESSION = {
  access_token: MOCK_ACCESS_TOKEN,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 9999999999,
  refresh_token: 'mock-refresh-token-e2e',
  user: MOCK_USER,
};

export const MOCK_ORG_ID = 'mock-org-id-e2e';

export const MOCK_PROFILE = {
  id: MOCK_USER.id,
  email: MOCK_USER.email,
  full_name: 'Admin Test',
  role: 'Administrador',
  org_id: MOCK_ORG_ID,
  is_active: true,
  is_platform_admin: false,
  must_change_password: false,
  created_at: '2024-01-01T00:00:00Z',
};

export const MOCK_ORG = {
  id: MOCK_ORG_ID,
  name: 'Organización Test',
  slug: 'org-test',
  is_active: true,
  max_users: 20,
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

export const MOCK_PROCEDURE_TYPES = [
  { id: 'proc-1', name: 'Artroplastia de Cadera', is_active: true },
  { id: 'proc-2', name: 'Artroplastia de Rodilla', is_active: true },
];

export const MOCK_IMPLANTS = [
  {
    id: 'implant-1',
    name: 'Tornillo Tibial 6mm',
    sku: 'TT-006',
    category: 'Ortopedia',
    unit_cost: 1200,
    selling_price: 1800,
    min_stock: 5,
    org_id: MOCK_ORG_ID,
    implant_lots: [
      { id: 'lot-1', lot_number: 'L001', current_quantity: 10, expiration_date: '2027-01-01' },
    ],
  },
  {
    id: 'implant-2',
    name: 'Placa de Titanio 3.5',
    sku: 'PT-35',
    category: 'Trauma',
    unit_cost: 3500,
    selling_price: 5000,
    min_stock: 8,
    org_id: MOCK_ORG_ID,
    implant_lots: [
      { id: 'lot-2', lot_number: 'L002', current_quantity: 2, expiration_date: '2026-06-01' },
    ],
  },
];
