# Estado de verificación — 11 de octubre de 2026

## Ampliación del examen

Se añadió WF11, EP11_Checkin y la interfaz Check-in en un commit separado. Las pruebas y sus límites se detallan en [CHECKIN.md](CHECKIN.md). El rechazo sin sesión se comprobó contra el Webhook publicado de n8n: HTTP 401 y registro RECHAZADO en EP11. ASISTIO se integra en el cálculo de ocupación y en la consulta de inscripciones, sin habilitar cancelación o edición de asistencias.

Repositorio existente: https://github.com/Sotwareeasy/EventPass

Frontend público: https://eventpass-drab.vercel.app

## Comprobado

- Compilación TypeScript y Vite satisfactoria.
- 11 pruebas de dominio y proxy satisfactorias: prioridad por fecha, cupos, duplicados, recordatorios, edición y conservación del estado HTTP.
- 3 pruebas de navegador satisfactorias con respuestas simuladas: catálogo, sesión/error 409 y diseño móvil. Estas pruebas no sustituyen la aceptación autenticada contra n8n.
- 338 nodos y 103 bloques Code revisados automáticamente, sin errores sintácticos ni enlaces rotos; 17 rutas HTTP identificadas.
- Catálogo real servido por Vercel a través de n8n y ngrok.
- Asistente real consultado desde el endpoint de Vercel: HTTP 200, respuesta del modelo y conversation_id. Modelo configurado: Gemini 3.1 Flash Lite mediante credencial de n8n.
- EP07, EP08, EP09 y EP10 creados con sus pestañas y encabezados.
- Datos leídos desde n8n: 7 eventos en 3 categorías. EVT-169 conserva una inscripción confirmada; EVT-167 no tiene inscripciones confirmadas. No se crearon inscripciones para estas comprobaciones.
- En las pruebas anteriores realizadas y confirmadas por el propietario: HTTP 201 al crear, 409 al duplicar, 200 al consultar/cancelar, 409 al repetir cancelación y auditorías verificadas.

- WF07 y WF08 ejecutados correctamente contra Sheets con los datos actuales, sin candidatos ni escrituras; posteriormente publicados con Schedule Trigger cada cinco minutos. Esto valida la lectura y selección vacía, no demuestra todavía una promoción ni un envío real.

## Pendiente de aceptación de extremo a extremo

- Inicio de sesión, edición de inscripción y demás operaciones autenticadas desde la web publicada con una cuenta de EventPass.
- Promoción real de lista de espera y recordatorio real, con repetición para comprobar idempotencia. La prueba previa de lista de espera fue omitida por decisión del propietario.
- Recepción real de una misma notificación en Gmail y Telegram y comprobación de fallo independiente de cada canal.
- Completar los datos de demostración: evento lleno y evento público próximo. Los eventos existentes no se alteraron para fabricar esos casos.

## Organización del repositorio

Se conserva el historial de `Sotwareeasy/EventPass`. Los workflows se organizan en `n8n/` y se añaden frontend, pruebas y documentación. El antiguo archivo `WF02_auth_sesiones.json.json` era otra versión del workflow «Webhook - Validar sesión», con el mismo ID; su versión vigente se conserva con ese nombre descriptivo en `n8n/` y la anterior permanece en el historial Git.

Los JSON de entrega se exportan desde la instancia después de importar las correcciones. No se incluyen `.env`, credenciales exportadas, resultados de ejecución ni datos fijados en nodos.

## Dependencia de disponibilidad

La web requiere que el equipo local, n8n, sus credenciales y el túnel ngrok estén disponibles. Vercel aloja el frontend y el proxy; no aloja la instancia de n8n. El estado de implementación no equivale a una aceptación completa mientras falten las pruebas anteriores.
