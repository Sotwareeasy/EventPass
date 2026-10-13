# Formularios administrativos en producción — 2026-10-12

## Causa y corrección

Las consultas llegaban a Google Sheets, encontraban el evento y quedaban esperando la siguiente página del formulario. Se identificaron dos problemas:

1. El trabajador carecía de URL pública y generaba enlaces de continuación con localhost. Se configuraron WEBHOOK_URL y N8N_EDITOR_BASE_URL con el dominio público en n8n-worker.
2. En una visita normal, después de aceptar el aviso de Ngrok, la petición de estado del formulario fallaba. El mismo recorrido funcionaba al omitir el aviso mediante cabecera. Se agregó ngrok-skip-browser-warning: 1 a las peticiones fetch de estado y envío de la plantilla form-trigger.handlebars de n8n. No se deshabilitó Basic Auth.

## Persistencia operativa

Configuración externa al repositorio, en Ubuntu WSL:
- /home/administrador/n8n-docker/docker-compose.yml
- /home/administrador/n8n-docker/eventpass-templates/form-trigger.handlebars

El archivo de plantilla está montado en modo lectura en el servicio n8n para futuras recreaciones. Se copió también al contenedor actual y se reinició n8n-main. El trabajador se recreó con sus URL públicas.

Este ajuste modifica una plantilla de la versión instalada de n8n. Al actualizar n8n, comparar la nueva plantilla y volver a aplicar únicamente las dos cabeceras; no mantener una plantilla antigua sin revisar compatibilidad. La cabecera omite el aviso de Ngrok, no la autenticación administrativa.

## Verificación realizada

Navegador Edge automatizado, usando la URL pública y aceptando Visit Site, sin cabeceras globales de diagnóstico:
- Consultar EVT-168: mostró Conexión con un mentor, datos y estado PUBLICADO.
- Buscar EVT-168 para actualizar: mostró los campos precargados de nombre, fecha, hora, lugar, capacidad y organizador.
- Creación: un evento técnico en BORRADOR mostró la pantalla «Evento creado correctamente». No se enviaron cambios desde el formulario de edición. La comprobación directa posterior en Sheets no se ejecutó.

Las pestañas abiertas antes de la corrección contienen JavaScript anterior: cerrarlas y abrir de nuevo los enlaces. La pantalla de confirmación de creación también fue verificada; falta la revisión directa de la fila y su auditoría.

## Reproducir el ajuste en otra instalación

Se incluye `scripts/configure-production-forms.py`, que extrae la plantilla de la versión instalada, aplica solo las dos cabeceras y genera un archivo Compose adicional. No exporta credenciales ni modifica registros. Es idempotente y se detiene si la plantilla no coincide con la estructura esperada.

Ejecutar desde Ubuntu/WSL, sustituyendo las rutas cuando corresponda:

```bash
python3 /mnt/d/ProyectoN8N/scripts/configure-production-forms.py --compose-dir /home/administrador/n8n-docker --public-url https://tubular-staunch-impromptu.ngrok-free.dev
cd /home/administrador/n8n-docker
docker compose -f docker-compose.yml -f compose.eventpass-forms.yml config --quiet
docker compose -f docker-compose.yml -f compose.eventpass-forms.yml up -d --no-deps n8n n8n-worker
```

Estos comandos presuponen los servicios `n8n` y `n8n-worker`. Mantener el archivo adicional al recrear los servicios. Tras actualizar n8n, extraer una plantilla nueva de un contenedor sin el montaje anterior y revisar compatibilidad antes de aplicar el ajuste. La plantilla generada y el Compose privado permanecen fuera de Git; el repositorio conserva el procedimiento reproducible sin secretos.
