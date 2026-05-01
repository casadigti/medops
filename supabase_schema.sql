-- SUPABASE SCHEMA: SISTEMA DE GESTIÓN DE CIRUGÍAS ORTOPÉDICAS

-- 1. HOSPITALS
CREATE TABLE hospitals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT,
    operating_rooms JSONB DEFAULT '[]', -- List of OR numbers/names
    coordinator_contact TEXT,
    logistics_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. SURGEONS
CREATE TABLE surgeons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    specialty TEXT,
    phone TEXT,
    email TEXT,
    preferences TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TRAYS / SETS
CREATE TABLE trays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    procedure_type TEXT,
    content TEXT, -- List of instruments
    status TEXT NOT NULL DEFAULT 'Disponible', -- 'Disponible', 'En preparación', 'En uso', 'En limpieza', 'En reparación'
    location TEXT,
    sterilization_count INTEGER DEFAULT 0,
    last_sterilization TIMESTAMPTZ,
    next_maintenance TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SURGERIES
CREATE TABLE surgeries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_name TEXT NOT NULL,
    surgery_date TIMESTAMPTZ NOT NULL,
    surgeon_id UUID REFERENCES surgeons(id),
    hospital_id UUID REFERENCES hospitals(id),
    operating_room TEXT,
    procedure_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente', -- 'Pendiente', 'En preparación', 'Lista', 'En tránsito', 'Entregada', 'Completada'
    delivery_responsible TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. SURGERY_TRAYS (Many-to-Many)
CREATE TABLE surgery_trays (
    surgery_id UUID REFERENCES surgeries(id) ON DELETE CASCADE,
    tray_id UUID REFERENCES trays(id) ON DELETE CASCADE,
    PRIMARY KEY (surgery_id, tray_id)
);

-- 6. MAINTENANCE LOGS
CREATE TABLE maintenance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tray_id UUID REFERENCES trays(id),
    action TEXT NOT NULL,
    performed_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- TRIGGERS FOR UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON hospitals FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_surgeons_updated_at BEFORE UPDATE ON surgeons FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_trays_updated_at BEFORE UPDATE ON trays FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_surgeries_updated_at BEFORE UPDATE ON surgeries FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- RLS POLICIES (Simplificado para desarrollo, ajustar luego)
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeons ENABLE ROW LEVEL SECURITY;
ALTER TABLE trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgeries ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public Access" ON hospitals FOR ALL USING (true);
CREATE POLICY "Public Access" ON surgeons FOR ALL USING (true);
CREATE POLICY "Public Access" ON trays FOR ALL USING (true);
CREATE POLICY "Public Access" ON surgeries FOR ALL USING (true);
CREATE POLICY "Public Access" ON surgery_trays FOR ALL USING (true);
CREATE POLICY "Public Access" ON maintenance_logs FOR ALL USING (true);
