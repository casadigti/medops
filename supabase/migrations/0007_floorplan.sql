-- Floor plan 2D: posición de estanterías en sala + configuración de sala por org

-- Posición de cada estantería en el mapa de sala (NULL = sin colocar)
ALTER TABLE storage_shelves
  ADD COLUMN IF NOT EXISTS position_x INT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS position_y INT DEFAULT NULL;

-- Tamaño del cuarto/sala por org (en unidades de celda de estantería)
ALTER TABLE organization_settings
  ADD COLUMN IF NOT EXISTS room_width  INT NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS room_height INT NOT NULL DEFAULT 20;
