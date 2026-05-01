# MedOps - Sistema de Gestión de Cirugías Ortopédicas

Este proyecto es una aplicación web completa para la gestión logística de bandejas y sets quirúrgicos.

## Stack Tecnológico
- **Frontend:** React 18 + Vite
- **Estilos:** Tailwind CSS
- **Estado:** Zustand
- **Backend:** Supabase (PostgreSQL + Auth + Realtime)
- **Iconos:** Lucide React
- **Gráficos:** Recharts

## Configuración Inicial

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Supabase:**
   - Crea un proyecto en [Supabase](https://supabase.com).
   - Ve al Editor SQL y pega el contenido del archivo `supabase_schema.sql` para crear las tablas y políticas.

3. **Variables de Entorno:**
   - Copia `.env.example` a `.env`.
   - Reemplaza `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con tus credenciales de Supabase (Settings -> API).

4. **Ejecutar en desarrollo:**
   ```bash
   npm run dev
   ```

## Estructura de Carpetas
- `src/components`: Componentes reutilizables organizados por módulos.
- `src/pages`: Vistas principales de la aplicación.
- `src/store`: Manejo de estado global con Zustand.
- `src/lib`: Configuraciones de librerías externas (Supabase).
- `src/utils`: Funciones de utilidad y helpers.
