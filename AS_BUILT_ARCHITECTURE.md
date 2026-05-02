# AS-BUILT ARCHITECTURE - MedOps
**Estado del Sistema: Obra Terminada (Fase Seguridad y Portal de Cirujanos)**
*Última actualización: 02 de Mayo, 2026*

## 1. Introducción
Este documento detalla la arquitectura técnica implementada en **MedOps** para garantizar la seguridad, el aislamiento de datos y la comunicación proactiva entre el personal administrativo y el cuerpo médico. Sirve como referencia técnica para mantenimiento y escalabilidad.

---

## 2. Modelo de Seguridad y Onboarding
Se ha implementado un flujo de "Confianza Cero" para el acceso inicial de usuarios.

### 2.1. Cambio de Contraseña Forzoso
- **Lógica**: Todo usuario nuevo es creado con una contraseña temporal y el flag `must_change_password: true` en su perfil.
- **Implementación**: El componente `App.jsx` envuelve las rutas protegidas con un modal bloqueante (`ForcePasswordChange.jsx`).
- **Persistencia**: La sesión solo se considera "segura" una vez que el usuario actualiza su password vía `supabase.auth.updateUser()` y se actualiza el perfil a `false`.

### 2.2. Gestión de Sesiones (loadProfile)
- Se utiliza una función personalizada `loadProfile` que utiliza la API REST nativa de Supabase para evitar bloqueos en el cliente JS durante el refresco de sesión.
- **Enriquecimiento de Perfil**: Para los cirujanos, la función recupera automáticamente su `surgeon_id` desde la tabla `surgeons` y lo inyecta en el estado global del usuario.

---

## 3. Arquitectura del Portal de Cirujanos
El portal está diseñado como un entorno aislado dentro de la misma aplicación, controlado por el rol `Cirujano`.

### 3.1. Aislamiento de Datos (Data Isolation)
- **Filtrado en Origen**: Todas las consultas a la tabla `surgeries` en `surgeryService.js` aceptan un parámetro opcional `surgeonId`.
- **UI Locking**: En `Cirugias.jsx` y `Calendario.jsx`, si el usuario tiene el rol de cirujano, se fuerza el filtro de su ID y se deshabilitan funciones de edición, borrado y re-programación.

### 3.2. Visibilidad Dinámica (Role-Based UI)
- **Sidebar**: El componente `Sidebar.jsx` filtra los ítems de navegación basándose en un array de `roles` permitidos por cada ruta.
- **Configuración**: Los cirujanos solo tienen acceso a la pestaña de "Seguridad", ocultando las configuraciones de organización y sistema.

---

## 4. Sistema de Notificaciones Realtime
Se implementó una infraestructura de mensajería instantánea para notificar cambios operativos.

### 4.1. Infraestructura de Base de Datos
- **Tabla `notifications`**: Almacena el historial de alertas vinculadas por `user_id`.
- **Automatización (Postgres Triggers)**: La función `notify_surgery_status_change()` dispara una inserción automática en la tabla de notificaciones cada vez que el estado de una cirugía cambia en la tabla `surgeries`.
- **Lógica de Mapeo**: El trigger realiza un `JOIN` con la tabla `surgeons` para encontrar el `user_id` de Auth asociado al cirujano de la cirugía modificada.

### 4.2. Comunicación Realtime
- **Websockets**: Se utiliza la funcionalidad `Realtime` de Supabase para suscribir al cliente al canal `public:notifications` con un filtro por `user_id`.
- **UI Feedback**: El `NotificationPanel.jsx` se actualiza instantáneamente sin recargar la página, gestionando un contador de "No Leídas" en el Header global.

---

## 5. Tabla de Roles y Permisos

| Módulo | Superadmin | Administrador | Cirujano | Técnico/Editor |
| :--- | :---: | :---: | :---: | :---: |
| **Dashboard** | Total | Total | Redirigido | Limitado |
| **Directorio** | Full | Full | Solo Lectura | Solo Lectura |
| **Cirugías** | Full | Full | Solo Propias (Ver) | Full |
| **Notificaciones** | Recibe/Envia | Recibe/Envia | Solo Recibe | Recibe |
| **Configuración** | Total | Total | Solo Password | No Acceso |

---

## 6. Mantenimiento y Escalabilidad
- **Base de Datos**: No eliminar la tabla `profiles` ya que es el puente entre Auth y las tablas de negocio.
- **Nuevas Funciones**: Cualquier módulo nuevo debe incluir el campo `roles` en el Sidebar y verificar el `userProfile.role` para el renderizado condicional de botones de acción (Edit/Delete).
