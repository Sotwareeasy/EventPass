# Proyecto EventPass — criterios de aceptación

Fuente: documento del proyecto entregado por el usuario en esta conversación (11 de octubre de 2026).

Aplicación pública en Vercel, lógica de negocio en n8n, persistencia académica en diez archivos Google Sheets independientes. El frontend nunca consulta Sheets directamente. Administración exclusivamente mediante formularios n8n protegidos. Repositorio GitHub con frontend, n8n/, docs/, README.md y .env.example, sin secretos.

| Flujo | Trigger | Archivo | Responsabilidad |
|---|---|---|---|
| WF01 | Webhook | EP01_Usuarios | Alta, perfil, edición, desactivación lógica; email único, hash y salt |
| WF02 | Webhook | EP02_Sesiones | Login, logout, validación, expiración y usuario activo |
| WF03 | Webhook + Telegram Trigger | EP03_Telegram | Código temporal de un solo uso, vinculación activa |
| WF04 | Form Trigger | EP04_Eventos | CREATE, READ, UPDATE, CANCEL/CLOSE; administración exclusiva |
| WF05 | Webhook | EP05_Catalogo_Log | Listado, detalle, categoría y cupos calculados; registrar consulta |
| WF06 | Webhook | EP06_Inscripciones | Crear, consultar, editar datos permitidos, cancelar; auditoría y notificaciones |
| WF07 | Schedule | EP07_Reasignaciones | Reasignar cupos por fecha_inscripcion ASC; registrar y notificar |
| WF08 | Schedule | EP08_Recordatorios | Recordatorios de confirmados; clave usuario+evento+tipo |
| WF09 | Execute Sub-workflow Trigger | EP09_Notificaciones | Intentar Gmail y Telegram; registrar resultado independiente |
| WF10 | Chat Trigger + IA | EP10_Soporte | Soporte informativo sin herramientas de modificación; conversaciones y mensajes |

## Invariantes

- Cuenta ACTIVA y sesión vigente para operaciones privadas. La identidad se deriva de la sesión.
- Telegram activo, evento PUBLICADO y futuro para crear inscripción.
- A lo sumo una inscripción activa por usuario y evento.
- Cupos = capacidad menos inscripciones CONFIRMADAS. Sin cupos: LISTA_ESPERA.
- Estados de inscripción: CONFIRMADA, LISTA_ESPERA, CANCELADA.
- Promoción por fecha de inscripción ascendente, no por orden de filas de Sheets.
- Borrado lógico de usuarios, eventos e inscripciones.
- Notificaciones al usuario por Gmail y Telegram. El HTTP no sustituye esos envíos.
- El asistente no crea usuarios, no autentica, no inscribe, no cancela y no cambia estados ni cupos.
- UI con carga, éxito, error; diseño responsive.

## Datos y entrega

Al menos seis eventos de prueba en tres categorías, incluyendo disponible, lleno, próximo y cerrado/cancelado. Verificar datos reales, no sustituir por tarjetas ficticias.

Los diez nombres de archivo WF01–WF10 deben respetar el documento. Los JSON finales deben exportarse desde n8n después de importar y verificar. README debe incluir arquitectura, autor, endpoints, estados, seguridad, idempotencia, integración, variables, instrucciones y enlaces reales de GitHub/Vercel.

## Decisiones de implementación

- Cancelar y editar antes del inicio, en eventos PUBLICADO o CERRADO.
- Un recordatorio 24H entra en ventana durante las 24 horas previas al evento.
- Reserva persistida antes de enviar: ante resultado incierto se revisa, no se reintenta automáticamente.
- Sesión del frontend en memoria; recargar requiere iniciar sesión otra vez.
- Soporte público identificado por visitor_id; no devuelve datos personales ni estados privados de una cuenta.
