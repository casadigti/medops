-- ============================================================
-- SEED DATA — MedOps Sistema de Cirugías Ortopédicas
-- Ejecutar en Supabase SQL Editor DESPUÉS del schema principal
-- ============================================================

-- HOSPITALES
INSERT INTO hospitals (id, name, address, coordinator_contact, logistics_notes, operating_rooms) VALUES
  ('11111111-0000-0000-0000-000000000001', 'Hospital General Plaza de la Salud', 'Av. Ortega y Gasset, Santo Domingo', 'Lic. Carmen Reyes - Tel: 809-562-7474', 'Recepción de bandejas de Lunes a Viernes 7am - 5pm. Requerir firma del coordinador.', '["Qx #1","Qx #2","Qx #3","Qx #4","Qx #5"]'),
  ('11111111-0000-0000-0000-000000000002', 'Clínica Abreu', 'Calle Beller 42, Santo Domingo', 'Enf. Mirna Santos - Tel: 809-688-4411', 'Entregar bandejas en recepción de piso 2. No se reciben después de las 4pm.', '["Qx #1","Qx #2","Qx #3"]'),
  ('11111111-0000-0000-0000-000000000003', 'Centro Médico UCE', 'Av. Independencia 202, Santo Domingo', 'Dr. Rafael Méndez - Tel: 809-533-8100', 'Horario de quirófano: 7am - 3pm. Urgencias 24h.', '["Qx #1","Qx #2"]'),
  ('11111111-0000-0000-0000-000000000004', 'Hospital Metropolitano de Santiago', 'Autopista Duarte Km 2, Santiago', 'Sra. Juana Pérez - Tel: 809-947-2222', 'Contactar 24h antes para confirmar recepción. Acceso por puerta lateral.', '["Qx #1","Qx #2","Qx #3","Qx #4"]');

-- CIRUJANOS
INSERT INTO surgeons (id, full_name, specialty, phone, email, preferences) VALUES
  ('22222222-0000-0000-0000-000000000001', 'Dr. Carlos Martínez', 'Ortopedia General', '809-555-0101', 'cmartinez@ortoped.do', 'Prefiere Set Rodilla Total marca Stryker. Siempre solicita Set de Cementos adicional.'),
  ('22222222-0000-0000-0000-000000000002', 'Dr. Ana Gutiérrez', 'Cirugía de Cadera', '809-555-0202', 'agutierrez@medpro.do', 'Especialista en artroplastia de cadera. Usa tornillos de 4.5mm exclusivamente.'),
  ('22222222-0000-0000-0000-000000000003', 'Dr. Roberto Fernández', 'Trauma y Ortopedia', '809-555-0303', 'rfernandez@trauma.do', 'Trauma de urgencia principalmente. Prefiere clavos endomedulares marca Synthes.'),
  ('22222222-0000-0000-0000-000000000004', 'Dr. María Santos', 'Cirugía de Rodilla', '809-555-0404', 'msantos@knee.do', 'Artroscopia y artroplastia de rodilla. Requiere óptica de 30° para artroscopias.'),
  ('22222222-0000-0000-0000-000000000005', 'Dr. Juan Herrera', 'Cirugía de Columna', '809-555-0505', 'jherrera@spine.do', 'Fusión lumbar y cervical. Siempre requiere fluoroscopio intraoperatorio.');

-- BANDEJAS / SETS
INSERT INTO trays (id, name, code, procedure_type, content, status, location, sterilization_count, last_sterilization) VALUES
  ('33333333-0000-0000-0000-000000000001', 'Set Rodilla Total', 'SET-ROD-001', 'Artroplastia total de rodilla', 'Sierra oscilante, guías de corte femoral y tibial, espaciadores de prueba, retractores, impactores, cemento óseo', 'Disponible', 'Bodega 1, Estante A', 45, NOW() - INTERVAL '5 days'),
  ('33333333-0000-0000-0000-000000000002', 'Set Cadera Total', 'SET-CAD-001', 'Artroplastia total de cadera', 'Fresadores acetabulares, raspa femoral, pruebas de cabeza y cuello, impactores, retractores de Hohmann', 'Disponible', 'Bodega 1, Estante B', 62, NOW() - INTERVAL '3 days'),
  ('33333333-0000-0000-0000-000000000003', 'Set Artroscopia Rodilla', 'SET-ART-ROD-001', 'Artroscopia de rodilla', 'Óptica 30°, shaver, canulas de trabajo, sondas, graspers, tijeras artroscópicas', 'Disponible', 'Bodega 2, Estante A', 88, NOW() - INTERVAL '1 days'),
  ('33333333-0000-0000-0000-000000000004', 'Set Clavo Endomedular Fémur', 'SET-CLV-FEM-001', 'Fijación de fractura de fémur (clavo endomedular)', 'Clavos 9-13mm, punteros, brocas, arandelas, tornillos de bloqueo, mira de disparo', 'Disponible', 'Bodega 1, Estante C', 31, NOW() - INTERVAL '7 days'),
  ('33333333-0000-0000-0000-000000000005', 'Set Placas Húmero', 'SET-PLA-HUM-001', 'Fijación de fractura de húmero (placa)', 'Placas de 3.5mm anatómicas, tornillos corticales y esponjosos, brocas, destornilladores', 'Disponible', 'Bodega 2, Estante B', 19, NOW() - INTERVAL '10 days'),
  ('33333333-0000-0000-0000-000000000006', 'Set Columna Lumbar', 'SET-COL-LUM-001', 'Cirugía de columna (fusión / laminectomía)', 'Tornillos pediculares, barras de titanio, conectores, destornilladores, distractores', 'Disponible', 'Bodega 1, Estante D', 178, NOW() - INTERVAL '2 days');

-- CIRUGÍAS (15 distribuidas en los próximos 30 días + 3 con alertas)
INSERT INTO surgeries (id, patient_name, surgery_date, surgeon_id, hospital_id, operating_room, procedure_type, status, delivery_responsible, notes) VALUES
  -- 🔴 ALERTA CRÍTICA: Hoy / Mañana
  ('44444444-0000-0000-0000-000000000001', 'Pedro Ramírez García', NOW() + INTERVAL '1 hours', '22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Qx #2', 'Fijación de fractura de fémur (clavo endomedular)', 'Pendiente', 'Juan Carlos Marte', 'Fractura trauma de caída. Urgente.'),
  ('44444444-0000-0000-0000-000000000002', 'Lucía Méndez Torres', NOW() + INTERVAL '20 hours', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Qx #1', 'Artroplastia total de rodilla', 'Pendiente', 'María Rodríguez', 'Paciente diabética, preparar con anticipación.'),

  -- 🟡 ALERTA URGENTE: 2 días
  ('44444444-0000-0000-0000-000000000003', 'Antonio Flores Díaz', NOW() + INTERVAL '2 days', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'Qx #1', 'Artroplastia total de cadera', 'Pendiente', 'Luis Alberto Pérez', 'Segunda cirugía de revisión. Set completo requerido.'),

  -- Próximas cirugías normales (próximos 30 días)
  ('44444444-0000-0000-0000-000000000004', 'Carmen Jiménez Vda. Pérez', NOW() + INTERVAL '3 days', '22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000001', 'Qx #3', 'Artroscopia de rodilla', 'En preparación', 'Juan Carlos Marte', 'Lesión menisco interno.'),
  ('44444444-0000-0000-0000-000000000005', 'Marcos Almonte Cuevas', NOW() + INTERVAL '4 days', '22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000004', 'Qx #2', 'Cirugía de columna (fusión / laminectomía)', 'En preparación', 'María Rodríguez', 'Fusión L4-L5. Paciente hipertenso controlado.'),
  ('44444444-0000-0000-0000-000000000006', 'Isabel Reyes Santana', NOW() + INTERVAL '5 days', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Qx #2', 'Artroplastia total de rodilla', 'Lista', 'Luis Alberto Pérez', NULL),
  ('44444444-0000-0000-0000-000000000007', 'Miguel Ángel De la Cruz', NOW() + INTERVAL '6 days', '22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Qx #1', 'Fijación de fractura de húmero (placa)', 'Lista', 'Juan Carlos Marte', 'Fractura proximal, placa anatómica.'),
  ('44444444-0000-0000-0000-000000000008', 'Rosa Elena Matos', NOW() + INTERVAL '8 days', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', 'Qx #1', 'Artroplastia total de cadera', 'En tránsito', 'María Rodríguez', NULL),
  ('44444444-0000-0000-0000-000000000009', 'Ernesto Corporán Liriano', NOW() + INTERVAL '9 days', '22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000004', 'Qx #3', 'Artroscopia de rodilla', 'Pendiente', 'Luis Alberto Pérez', 'Ligamento cruzado anterior roto.'),
  ('44444444-0000-0000-0000-000000000010', 'Josefina Espaillat', NOW() + INTERVAL '11 days', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Qx #4', 'Artroplastia total de rodilla', 'Pendiente', 'Juan Carlos Marte', NULL),
  ('44444444-0000-0000-0000-000000000011', 'Rafael Taveras Núñez', NOW() + INTERVAL '13 days', '22222222-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000002', 'Qx #1', 'Cirugía de columna (fusión / laminectomía)', 'Pendiente', 'María Rodríguez', 'Estenosis espinal L3-L5.'),
  ('44444444-0000-0000-0000-000000000012', 'Altagracia Pérez de Gómez', NOW() + INTERVAL '15 days', '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000004', 'Qx #1', 'Artroplastia total de cadera', 'Pendiente', 'Luis Alberto Pérez', 'Necrosis avascular de cadera derecha.'),
  ('44444444-0000-0000-0000-000000000013', 'Víctor Manuel Guerrero', NOW() + INTERVAL '18 days', '22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000001', 'Qx #2', 'Fijación de fractura de fémur (clavo endomedular)', 'Pendiente', 'Juan Carlos Marte', NULL),
  ('44444444-0000-0000-0000-000000000014', 'Nancy Ogando Bautista', NOW() + INTERVAL '22 days', '22222222-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000003', 'Qx #2', 'Artroscopia de rodilla', 'Pendiente', 'María Rodríguez', 'Condromalacia grado III.'),
  ('44444444-0000-0000-0000-000000000015', 'Héctor Ramos Espinal', NOW() + INTERVAL '28 days', '22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Qx #3', 'Fijación de fractura de húmero (placa)', 'Pendiente', 'Luis Alberto Pérez', 'Fractura diafisaria. Pre-operatorio completo.');

-- ASIGNACIONES DE BANDEJAS A CIRUGÍAS
INSERT INTO surgery_trays (surgery_id, tray_id) VALUES
  ('44444444-0000-0000-0000-000000000001', '33333333-0000-0000-0000-000000000004'), -- Fémur
  ('44444444-0000-0000-0000-000000000002', '33333333-0000-0000-0000-000000000001'), -- Rodilla
  ('44444444-0000-0000-0000-000000000003', '33333333-0000-0000-0000-000000000002'), -- Cadera
  ('44444444-0000-0000-0000-000000000004', '33333333-0000-0000-0000-000000000003'), -- Artroscopia rodilla
  ('44444444-0000-0000-0000-000000000005', '33333333-0000-0000-0000-000000000006'), -- Columna
  ('44444444-0000-0000-0000-000000000006', '33333333-0000-0000-0000-000000000001'), -- Rodilla
  ('44444444-0000-0000-0000-000000000007', '33333333-0000-0000-0000-000000000005'), -- Húmero
  ('44444444-0000-0000-0000-000000000008', '33333333-0000-0000-0000-000000000002'), -- Cadera
  ('44444444-0000-0000-0000-000000000009', '33333333-0000-0000-0000-000000000003'), -- Artroscopia
  ('44444444-0000-0000-0000-000000000010', '33333333-0000-0000-0000-000000000001'), -- Rodilla
  ('44444444-0000-0000-0000-000000000011', '33333333-0000-0000-0000-000000000006'), -- Columna
  ('44444444-0000-0000-0000-000000000012', '33333333-0000-0000-0000-000000000002'), -- Cadera
  ('44444444-0000-0000-0000-000000000013', '33333333-0000-0000-0000-000000000004'), -- Fémur
  ('44444444-0000-0000-0000-000000000014', '33333333-0000-0000-0000-000000000003'), -- Artroscopia
  ('44444444-0000-0000-0000-000000000015', '33333333-0000-0000-0000-000000000005'); -- Húmero
