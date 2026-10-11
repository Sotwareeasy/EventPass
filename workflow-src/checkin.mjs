export function evaluateCheckin(user, body, registrations, events, history) {
  const reject=(status,codigo,mensaje,resultado='RECHAZADO')=>({status,resultado,respuesta:{ok:false,error:{codigo,mensaje},data:{resultado}}});
  if(!user)return reject(401,'SESION_INVALIDA','Inicia sesión para continuar.');
  if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['inscripcion_id','evento_id'].includes(k))||!/^INS-[a-f0-9]{32}$/.test(body.inscripcion_id??'')||!/^EVT-[A-Za-z0-9_-]{1,76}$/.test(body.evento_id??''))return reject(400,'CHECKIN_SOLICITUD_INVALIDA','Envía una inscripción y un evento válidos.');
  const rs=registrations.filter(r=>r.inscripcion_id===body.inscripcion_id);
  if(rs.length>1)throw Error('Inscripción no única');
  const r=rs[0];
  if(!r||r.usuario_id!==user)return reject(404,'INSCRIPCION_NO_ENCONTRADA','No se encontró la inscripción.');
  const es=events.filter(e=>e.evento_id===body.evento_id);
  if(es.length>1)throw Error('Evento no único');
  if(!es.length)return reject(404,'EVENTO_NO_ENCONTRADO','No se encontró el evento.');
  if(r.evento_id!==body.evento_id)return reject(409,'CHECKIN_EVENTO_INCORRECTO','La inscripción no pertenece al evento indicado.');
  if(history.some(h=>h.inscripcion_id===r.inscripcion_id&&String(h.detalle??'').includes('"codigo":"CHECKIN_EN_PROCESO"')))return reject(503,'CHECKIN_REQUIERE_REVISION','Hay un intento pendiente de verificación. Solicita revisión antes de repetir.');
  const successes=history.filter(h=>h.inscripcion_id===r.inscripcion_id&&h.resultado==='EXITOSO');
  if(successes.length>1)throw Error('Historial de check-in inconsistente');
  if(successes.length&&r.estado!=='ASISTIO')return reject(503,'CHECKIN_REQUIERE_REVISION','Existe un registro de ingreso con actualización pendiente. Solicita revisión; no repitas la operación.');
  if(successes.length||r.estado==='ASISTIO')return reject(409,'CHECKIN_DUPLICADO','El ingreso ya había sido registrado.','DUPLICADO');
  if(r.estado!=='CONFIRMADA')return reject(409,'CHECKIN_ESTADO_NO_PERMITIDO','Solo una inscripción confirmada permite registrar el ingreso.');
  if(!['PUBLICADO','CERRADO'].includes(es[0].estado))return reject(409,'CHECKIN_EVENTO_NO_DISPONIBLE','Este evento no permite registrar ingresos.');
  return {status:201,resultado:'EXITOSO',inscripcion:r,evento:es[0],respuesta:{ok:true,mensaje:'Check-in realizado correctamente.',data:{resultado:'EXITOSO',inscripcion_id:r.inscripcion_id,evento_id:r.evento_id,estado:'ASISTIO'}}};
}
