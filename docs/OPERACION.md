# Operación y recuperación

## Antes de habilitar automatizaciones

1. Revisar que las credenciales de Sheets, Gmail, Telegram y modelo IA están conectadas a las cuentas deseadas.
2. Confirmar los cuatro archivos EP07–EP10 creados y sus pestañas. Esquema en `sheets-schema.json`.
3. Publicar WF09 antes de WF06, WF07 y WF08. Publicar WF10 para el chat.
4. Mantener un solo worker con `--concurrency=1`. No ejecutar simultáneamente pruebas manuales de escritura.
5. Revisar `datos-verificados.json` y preparar los casos de la entrega sin cambiar inadvertidamente inscripciones existentes.

## Resultado incierto de una operación

No repetir automáticamente una creación, cancelación, edición o envío. Consultar la fila principal y su auditoría por ID. Si la escritura ocurrió y falta auditoría, reparar el registro faltante con los mismos identificadores tras comprobar el estado; no crear otra inscripción. Registrar la intervención.

## Reasignación

`resultado_notificacion=RESERVADA` indica que no se confirmó toda la promoción. Comparar EP07 con la inscripción en EP06. Una reserva inconclusa bloquea ese evento. `PENDIENTE` indica promoción confirmada y resultado de notificación sin terminar; `REVISAR` indica algún canal incompleto; `ENVIADO` confirma los dos canales.

No borrar la reserva para forzar otra promoción. Comprobar estado, fecha y cupos antes de reparar. La implementación no promete transacción ni recuperación automática entre documentos de Sheets.

## Notificaciones

Filtrar por clave_idempotencia. Gmail y Telegram tienen estados independientes. ENVIADO en un canal no autoriza reenviarlo. ERROR puede ser un rechazo confirmado o una respuesta de red incierta; revisar el proveedor antes de reintentar. PENDIENTE después de una interrupción requiere revisión. NO_APLICA indica falta de destino válido o usuario inactivo.

El servicio devuelve el registro existente para una clave ya utilizada y evita reenvíos automáticos. Una falla de persistencia puede impedir continuar el flujo; revisar la fila reservada y los proveedores.

## Recordatorios

Clave: usuario_id + evento_id + 24H. Solo confirmados y eventos publicados futuros dentro de 24 horas. Reserva primero, después notifica. La ejecución procesa un candidato cada cinco minutos; es una configuración académica, no un servicio de alto volumen. Mantener los schedules activos y vigilar cuotas y errores.

## Asistente

Una respuesta de contingencia no demuestra que el modelo funcione. La prueba debe obtener una respuesta real del proveedor y verificar dos mensajes en EP10 bajo la misma conversación. Nunca enviar passwords, tokens, códigos Telegram o datos privados al chat. El modelo no tiene herramientas de modificación de negocio.

## Pruebas de aceptación pendientes de datos reales

- Login, crear inscripción, editar, cancelar y rechazo de repetición desde la web publicada.
- Una promoción real al liberar cupo, respetando el orden de fecha; antes se omitió por decisión del usuario.
- Un recordatorio real sin repetición al ejecutar nuevamente.
- Entrega real en Gmail y Telegram y fallo aislado de un canal.
- Al menos seis eventos, tres categorías y casos disponible/lleno/próximo/cerrado.

## Publicación

El dominio Vercel depende de la disponibilidad del equipo que ejecuta n8n y del túnel ngrok. Si cambia el origen público, actualizar N8N_BASE_URL y N8N_CHAT_URL y volver a desplegar. Los endpoints administrativos siguen en n8n y no aparecen en el frontend.

Exportar los JSON desde la instancia al cerrar una revisión. No incluir credenciales exportadas, .env ni datos de ejecución/pinData en Git.
