# EventPass — Nos encontramos aquí

## Examen — Check-in digital

La ampliación añade **WF11_checkin_digital** con Webhook y el archivo independiente **EP11_Checkin**, pestaña **Checkins**. En la web, el titular inicia sesión y selecciona **Mis inscripciones → Hacer check-in**, o introduce los identificadores en **Check-in**. La interfaz muestra carga, éxito, duplicado y rechazo, y bloquea el botón mientras se procesa la solicitud.

### Endpoint y contrato

`POST /webhook/eventpass/checkin` en n8n. El frontend utiliza `POST /api/eventpass/checkin` a través del proxy de Vercel. Requiere `Authorization: Bearer <token de sesión>` y `Content-Type: application/json`.

```json
{"inscripcion_id":"INS-0123456789abcdef0123456789abcdef","evento_id":"EVT-169"}
```

Éxito: **HTTP 201**, una fila EXITOSO y actualización **CONFIRMADA → ASISTIO**:

```json
{
  "ok": true,
  "mensaje": "Check-in realizado correctamente.",
  "data": {
    "resultado": "EXITOSO",
    "checkin_id": "CHK-0123456789abcdef0123456789abcdef",
    "inscripcion_id": "INS-0123456789abcdef0123456789abcdef",
    "evento_id": "EVT-169",
    "estado": "ASISTIO",
    "fecha_checkin": "2026-10-11T17:00:00.000Z"
  },
  "notificacion": {"gmail":"ENVIADO","telegram":"ENVIADO"}
}
```

Los identificadores y la fecha anteriores son ejemplos de contrato. Los estados de notificación reflejan la respuesta de WF09; no se simula una entrega cuando un canal falla.

Duplicado: **HTTP 409**, sin nueva actualización ni nueva notificación:

```json
{"ok":false,"error":{"codigo":"CHECKIN_DUPLICADO","mensaje":"El ingreso ya había sido registrado."},"data":{"resultado":"DUPLICADO","checkin_id":"CHK-identificador-del-intento"}}
```

Otros resultados: **400** petición inválida, **401** sin sesión válida, **404** inscripción inexistente/ajena o evento inexistente, **409** estado no permitido/evento incorrecto/evento no disponible, **503** indisponibilidad o intento inconcluso que necesita revisión. Los rechazos funcionales utilizan `data.resultado=RECHAZADO` y un código específico en `error.codigo`.

### Validaciones y persistencia

- Sesión válida y usuario activo mediante **SW_validar_sesion**. Solo se permite registrar el ingreso del titular; los IDs no conceden acceso a una inscripción ajena.
- Inscripción existente y única; evento existente y único; correspondencia exacta inscripción-evento.
- Inscripción **CONFIRMADA**; se rechazan LISTA_ESPERA, CANCELADA y otros estados. Un ASISTIO previo se trata como duplicado.
- Evento PUBLICADO o CERRADO. Un evento CANCELADO o BORRADOR no admite ingresos. El examen no define una ventana horaria de check-in: esta versión permite el registro explícito del titular sin comprobar presencia física, ubicación ni horario.
- Historial de EP11 sin éxito previo ni operación incompleta. El estado ASISTIO aporta una segunda defensa contra repetición.

Campos de **EP11_Checkin / Checkins**: `checkin_id`, `inscripcion_id`, `evento_id`, `usuario_id`, `fecha_checkin`, `resultado`, `detalle`. Resultado final: **EXITOSO**, **RECHAZADO** o **DUPLICADO**. `detalle` contiene el código y el HTTP del intento; no almacena tokens ni contraseñas. Fecha ISO en UTC, presentada en hora de Colombia.

Cada intento registra su propio ID. Se reserva primero una fila RECHAZADO con `CHECKIN_EN_PROCESO` (todavía no se ha concedido el ingreso), se actualiza únicamente la inscripción seleccionada y se relee para verificar ASISTIO y los campos que deben conservarse. Solo entonces la reserva cambia a EXITOSO. Se añade auditoría CHECKIN en EP06. Los intentos rechazados/duplicados no alteran la inscripción y quedan en filas separadas de EP11.

**Idempotencia:** historial por `inscripcion_id`, comprobación de ASISTIO y ejecución serial en el worker existente con `--concurrency=1`. Una reserva inconclusa bloquea nuevos ingresos para esa inscripción y devuelve 503 para revisión. Sheets no ofrece transacciones entre archivos: no aumentar la concurrencia ni ejecutar escrituras manuales simultáneas sin incorporar un bloqueo distribuido. No se promete recuperación automática de una escritura parcial.

### Notificaciones e integración

WF11 llama mediante **Execute Sub-workflow** a **WF09_notificaciones**, sin duplicar nodos Gmail/Telegram. Envía `usuario_id`, `tipo=CHECKIN`, título, mensaje, evento, inscripción y `clave_idempotencia=CHECKIN:<inscripcion_id>`. WF09 intenta ambos canales y conserva sus resultados independientes. Un fallo de notificación no revierte una asistencia ya confirmada; la interfaz muestra el resultado disponible. Un duplicado no llama nuevamente a WF09.

ASISTIO sigue ocupando cupo en el catálogo, nuevas inscripciones y reasignación. Impide otra inscripción activa para el mismo usuario/evento, se muestra en la consulta y no permite edición/cancelación ni nuevos recordatorios. Las demás rutas mantienen sus contratos.

### Verificación y entrega

`npm test` ejecuta los casos de éxito, duplicado, cancelada, espera, evento incorrecto, propietario ajeno, ausencia de sesión y fallos parciales, además de regresiones de cupos. Los tests del grafo ejecutan los Code nodes de WF11 con adaptadores de Sheets/sesión/notificaciones en memoria: no prueban recepción real de mensajes. `npx playwright test` comprueba la interfaz con respuestas HTTP controladas.

El JSON de entrega **[n8n/WF11_checkin_digital.json](n8n/WF11_checkin_digital.json)** se exporta desde la instancia n8n después de importar y publicar el flujo. Véase [docs/CHECKIN.md](docs/CHECKIN.md) para comprobaciones reales, recuperación y límites de la evidencia.

Proyecto integrador de **Fabian Uribe**. Aplicación de encuentros de networking con frontend React, API y automatizaciones n8n y persistencia independiente por dominio en Google Sheets.

- Aplicación: https://eventpass-drab.vercel.app
- Repositorio: https://github.com/Sotwareeasy/EventPass.
- El estado de las verificaciones y los pendientes se registra en [docs/ESTADO.md](docs/ESTADO.md). Una compilación correcta no equivale a todas las pruebas externas aprobadas.

## Arquitectura

```mermaid
flowchart LR
  A[Frontend React en Vercel] --> B[Proxy HTTP sin lógica de negocio]
  B --> C[n8n: Webhooks y Chat Trigger]
  C --> D[Reglas, sesiones e idempotencia]
  D --> E[EP01 a EP10: Google Sheets]
  D --> F[WF09: Gmail y Telegram]
  G[Schedules WF07 y WF08] --> D
  C --> H[WF10: modelo IA de solo lectura]
```

El navegador nunca lee ni escribe Google Sheets. El proxy de Vercel solo permite rutas y métodos conocidos, transmite la autorización al backend y conserva el código HTTP real. Los secretos OAuth, Telegram e IA permanecen en las credenciales cifradas de n8n.

## Tecnologías

React 19, TypeScript, Vite 7, Node.js, funciones Node de Vercel, n8n 2.40.5, Google Sheets, Gmail, Telegram y cadena LLM. n8n local utiliza Postgres, Redis y un worker con concurrencia 1. Node Test Runner prueba reglas y proxy; Playwright prueba la interfaz.

## Ejecutar localmente

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

La interfaz queda en http://127.0.0.1:5173. Ajustar `.env` con las URLs correspondientes y publicar los webhooks de producción de n8n. Para iniciar el entorno n8n utiliza la instalación Docker existente; este repositorio no contiene sus secretos ni reemplaza su configuración.

```powershell
npm run build
npm test
npm run check:workflows
npx playwright test
node scripts/smoke-http.mjs
```

Los tests de navegador usan Edge en modo headless y respuestas simuladas explícitas; no sustituyen la prueba de integración con Sheets ni envían notificaciones reales. `smoke-http` consulta los endpoints reales y comprueba rechazos sin sesión; el catálogo registra esa consulta en EP05.

## Variables

| Variable | Uso |
|---|---|
| `N8N_BASE_URL` | Local: http://127.0.0.1:5678. Vercel: origen HTTPS público de n8n, sin `/webhook` |
| `N8N_CHAT_URL` | URL de producción del Chat Trigger, incluyendo `/chat` |
| `VITE_TELEGRAM_BOT_USERNAME` | Nombre público del bot, sin `@`; opcional para mostrar el enlace |

Nunca colocar tokens, passwords, claves IA ni credenciales OAuth en variables `VITE_*`. `.env`, `config.local.json`, `.vercel/` y dependencias están excluidos de Git.

## Workflows y persistencia

| Workflow | Trigger | Archivo / hojas |
|---|---|---|
| WF01_usuarios_crud | Webhook | EP01_Usuarios / Usuarios, Auditoria_Usuarios |
| WF02_auth_sesiones | Webhook | EP02_Sesiones / Sesiones |
| WF03_vinculacion_telegram | Webhook y Telegram Trigger | EP03_Telegram / Codigos_Vinculacion, Vinculaciones |
| WF04_eventos_crud | Form Trigger protegido | EP04_Eventos / Eventos, Auditoria_Eventos |
| WF05_catalogo_publico | Webhook | EP05_Catalogo_Log / Consultas_Catalogo |
| WF06_inscripciones_crud | Webhook | EP06_Inscripciones / Inscripciones, Auditoria_Inscripciones |
| WF07_reasignacion_lista_espera | Schedule, cada 5 minutos | EP07_Reasignaciones / Reasignaciones |
| WF08_recordatorios | Schedule, cada 5 minutos | EP08_Recordatorios / Recordatorios |
| WF09_notificaciones | Execute Sub-workflow Trigger | EP09_Notificaciones / Notificaciones |
| WF10_eventpass_assistant | Chat Trigger | EP10_Soporte / Conversaciones, Mensajes |

Los flujos adicionales separan actualización y desactivación de perfil, logout, validación de sesión, consulta de Telegram y cambios de estado de eventos. `SW_validar_sesion` centraliza la autenticación. Los archivos `TEST_*` y scripts PowerShell son diagnósticos, no endpoints que deban quedar publicados.

## Endpoints

Prefijo n8n: `/webhook/eventpass`. Prefijo del frontend: `/api/eventpass`.

| Método / ruta | Función |
|---|---|
| POST `/usuarios` | Crear usuario; nombre, email, password |
| GET `/usuarios/me` | Perfil autenticado |
| PATCH `/usuarios/me` | Actualizar nombre |
| DELETE `/usuarios/me` | Desactivar; cuerpo `{"confirmacion":"DESACTIVAR"}` |
| POST `/auth/login` | Email y contraseña; devuelve token de sesión |
| POST `/auth/logout` | Cerrar sesión |
| GET `/auth/sesion` | Validar sesión |
| POST `/telegram/codigo` | Generar código temporal de vinculación |
| GET `/telegram/vinculacion` | Consultar vinculación |
| GET `/eventos` | Listado; filtros `categoria` o `evento_id` |
| POST `/inscripciones` | Crear; evento_id, nombre_acreditacion, observaciones |
| GET `/inscripciones` | Solo las del titular; no admite usuario_id externo |
| PATCH `/inscripciones` | Editar acreditación y observaciones por inscripcion_id |
| POST `/inscripciones/cancelar` | Cancelar por inscripcion_id |

Las solicitudes privadas llevan `Authorization: Bearer <token>`. Los errores usan `{ok:false,error:{codigo,mensaje}}`. El frontend valida tanto el HTTP como `ok`, sin convertir errores en éxitos por el contenido. No hay reintentos automáticos de mutaciones.

El chat se envía a `/api/eventpass/soporte`; el proxy utiliza `N8N_CHAT_URL`. El cuerpo contiene `action: sendMessage`, un UUID `sessionId` y `chatInput`.

## Seguridad, hashing y sesiones

Las contraseñas se procesan en n8n mediante scrypt y salt aleatorio, conservando el formato ya implementado. Se almacenan `password_hash` y `password_salt`, nunca la contraseña. Parámetros existentes: N=131072, r=8, p=1 y salt de 16 bytes. El login compara la derivación y genera un token aleatorio; Sheets almacena su huella SHA-256. La sesión vence a las ocho horas y se rechaza si está cerrada, expirada o el usuario está inactivo.

El frontend mantiene el token en memoria. Una recarga requiere iniciar sesión nuevamente. La vinculación de Telegram utiliza un código temporal de un solo uso; Sheets conserva su huella, no el código utilizable. El usuario envía `/vincular CODIGO` por chat privado.

## Estados e idempotencia

- Usuario: ACTIVO / INACTIVO.
- Sesión: ACTIVA / CERRADA / EXPIRADA.
- Evento: BORRADOR / PUBLICADO / CERRADO / CANCELADO.
- Inscripción: CONFIRMADA / LISTA_ESPERA / CANCELADA.
- Código Telegram: PENDIENTE / USADO / EXPIRADO / CANCELADO.
- Vinculación: ACTIVA / INACTIVA.

Crear rechaza otra inscripción activa del mismo usuario y evento con 409. Cancelar conserva la fila y añade auditoría; repetir devuelve 409 y no añade otra auditoría. Editar no acepta propietario, estado ni evento desde el cliente. La inscripción ajena devuelve el mismo 404 que una inexistente.

Google Sheets no ofrece una transacción que abarque las varias hojas. La ejecución serial del worker reduce carreras; no aumentar la concurrencia ni añadir workers sin incorporar un bloqueo distribuido. No modificar las hojas manualmente durante las operaciones. Guardado y auditoría se verifican por separado; ante estado incierto se revisan los registros antes de repetir.

## Lista de espera y reasignación

Se calcula capacidad menos CONFIRMADAS. Cuando existe lista de espera se preserva su prioridad. WF07 ordena por `fecha_inscripcion ASC` y desempata por ID, excluye usuarios inactivos, verifica duplicados/sobreaforo y procesa una promoción por ejecución. Reserva una fila EP07 antes de cambiar el estado, relee la inscripción y llama a WF09.

Una reserva inconclusa bloquea nuevas promociones del mismo evento hasta revisión. El proceso no promete recuperación transaccional automática. La frecuencia de cinco minutos y una promoción por ejecución es una decisión para el volumen académico y las cuotas de Sheets; hay que revisarla para cargas mayores.

## Recordatorios y notificaciones

WF08 selecciona un confirmado por ejecución dentro de las 24 horas anteriores al evento. Reserva `usuario_id:evento_id:24H` antes de notificar y registra ENVIADO, ERROR u OMITIDO. Una reserva existente impide repetir automáticamente el envío.

WF09 recibe usuario_id, tipo, titulo, mensaje, evento_id, inscripcion_id y clave_idempotencia. Consulta email y Telegram, persiste una reserva y trata cada canal por separado. Un fallo de Gmail sigue hacia Telegram. Estados por canal: PENDIENTE / ENVIADO / ERROR / NO_APLICA. Sin destinatario válido o con usuario inactivo, el canal queda NO_APLICA. Un resultado incierto requiere revisión manual para evitar duplicados; no se garantiza exactamente una entrega frente a fallos de red del proveedor.

## Asistente IA

WF10 tiene Chat Trigger, cadena LLM y modelo configurado mediante credenciales de n8n. Solo lee eventos públicos futuros; no se conectan herramientas que escriban en dominios de negocio. Persiste conversación y mensajes USER/ASSISTANT en EP10, identificados por conversation_id y visitor_id. Recoge hasta 12 mensajes recientes como contexto. El texto de eventos y mensajes se trata como datos no confiables. No recibe tokens, contraseñas ni datos de otros usuarios. Ante indisponibilidad del proveedor muestra una respuesta de contingencia, que no debe confundirse con una prueba IA aprobada.

## Importar y exportar

Los scripts de administración requieren la instalación Docker local existente y los permisos de su propietario. Revisar los IDs antes de usarlos en otra instancia. Importar por CLI despublica el flujo; publicar por CLI requiere reiniciar n8n para aplicar los cambios.

```powershell
node scripts/import-workflows.mjs WF09_notificaciones.json
node scripts/export-workflows.mjs WF09_notificaciones.json
```

`scripts/build-workflows.mjs` genera los nuevos bloques desde `workflow-src/domain.mjs` y los contratos existentes. No ejecutarlo después de modificaciones manuales sin revisar los cambios. `scripts/provision-sheets.mjs` prepara EP07–EP10 y guarda IDs en `config.local.json`; no repetir si hubo creación incierta sin comprobar Drive.

## Publicación y operación

La publicación Vercel utiliza `npm run build`, salida `dist` y `api/proxy.js`. Configurar las variables del servidor en el proyecto Vercel. El host de n8n y el túnel ngrok deben permanecer encendidos y accesibles para que la web funcione. Una URL Vercel accesible no vuelve permanente un backend que depende de un equipo local.

Consulta [docs/REQUISITOS.md](docs/REQUISITOS.md), [docs/ESTADO.md](docs/ESTADO.md) y [docs/OPERACION.md](docs/OPERACION.md) para la aceptación y los procedimientos de revisión.
