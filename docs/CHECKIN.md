# Examen — Check-in digital

## Implementación

WF11: `EP11CheckinDigital`. Trigger POST `eventpass/checkin`. Archivo independiente EP11_Checkin creado con pestaña Checkins y los siete campos obligatorios. La credencial existente de Google Sheets permanece en n8n. La web no accede directamente a Sheets.

Los datos de inscripción/evento enviados por el navegador no contienen usuario_id: WF11 obtiene el titular de la sesión validada. El flujo audita cada rechazo funcional y duplicado, y solo el camino válido modifica EP06 y llama a WF09.

Archivo creado: https://docs.google.com/spreadsheets/d/1wMqF8Efvifn4emQbbzxoPnkrE5NOWuUlwacmKKPGDbU/edit

## Pruebas automatizadas

- 36 pruebas de dominio, grafo y proxy: satisfactorias antes de la publicación.
- 5 pruebas de navegador: satisfactorias, incluyendo confirmación/duplicado, rechazo y bloqueo del botón durante la petición.
- Compilación TypeScript/Vite: satisfactoria.
- Validación de workflows: 363 nodos, 113 Code nodes, 18 rutas, sin errores sintácticos ni enlaces inexistentes.

Las pruebas de grafo sustituyen los servicios externos con adaptadores en memoria y ejecutan el código real de los nodos. Comprueban reserva, transición, auditoría, notificación única, repetición sin cambios y conservación de otras inscripciones. No deben presentarse como prueba de recepción real de Gmail/Telegram ni de cuatro ingresos reales en producción.

## Comprobación pública

La versión con Check-in está publicada en https://eventpass-drab.vercel.app. Se verificó la pantalla en un navegador real, el catálogo con HTTP 200 y la solicitud de check-in sin token con HTTP 401 / SESION_INVALIDA / RECHAZADO, tanto por n8n local como por Vercel. Los intentos técnicos generados quedan trazados en EP11. N8N_BASE_URL y N8N_CHAT_URL quedaron configuradas en Production de Vercel.

## Aceptación con una cuenta real

1. Iniciar sesión en la web y elegir una inscripción CONFIRMADA propia. Confirmar que se quiere cambiar definitivamente su estado a ASISTIO.
2. Hacer check-in: HTTP 201. Verificar una fila EXITOSO en EP11, ASISTIO en EP06 y una auditoría CHECKIN. Verificar notificación de ambos canales en EP09 y recepción en Gmail/Telegram.
3. Repetir los mismos IDs: HTTP 409 CHECKIN_DUPLICADO, fila DUPLICADO, una sola fila EXITOSO, misma fecha de inscripción y sin nuevas notificaciones.
4. Enviar una inscripción CANCELADA o LISTA_ESPERA: 409 RECHAZADO, sin cambios de estado.
5. Enviar una inscripción con otro evento existente: 409 CHECKIN_EVENTO_INCORRECTO y RECHAZADO.
6. Confirmar que las otras inscripciones no cambiaron; consultar catálogo, agenda, perfil y asistente.

Las inscripciones históricas del propietario no se convirtieron en asistencias para fabricar evidencia del examen. La recepción efectiva de una notificación de check-in y los cuatro casos con persistencia real requieren la aceptación anterior con datos elegidos para esa prueba.

## Recuperación de fallo parcial

Una fila temporal RECHAZADO cuyo detalle contiene CHECKIN_EN_PROCESO es una reserva inconclusa. No borrarla ni reenviar automáticamente. Revisar EP11, el estado y fecha en EP06, la auditoría y la clave CHECKIN:<inscripcion_id> en EP09. Si EP06 está ASISTIO, completar la confirmación/auditoría faltante con los mismos IDs tras comprobar la evidencia; si continúa CONFIRMADA y no hubo ingreso, cerrar la reserva con un motivo de rechazo definitivo antes de permitir otro intento. Conservar trazabilidad de la intervención.

Una fila EXITOSO y un estado distinto de ASISTIO se consideran inconsistentes y bloquean el reintento con 503. Una notificación fallida no autoriza revertir la asistencia ni reenviar el canal que sí entregó. Sheets no tiene transacciones distribuidas; mantener un único worker con concurrencia 1 y evitar escrituras concurrentes externas.
