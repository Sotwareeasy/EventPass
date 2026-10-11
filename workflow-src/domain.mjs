export function rows(items){return items.map(x=>x.json??x).filter(x=>Object.entries(x).some(([k,v])=>k!=='row_number'&&v!==null&&v!==undefined&&String(v).trim()!==''));}
export function eventStart(e){
 const date=String(e.fecha??'').trim(),time=String(e.hora??'').trim();
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Fecha de evento inválida');
 const ms=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(ms)||new Date(ms).toISOString().slice(0,10)!==date)throw Error('Fecha inexistente');
 return Date.parse(date+'T'+time+':00-05:00');
}
export function planPromotions(events, registrations, users, now){
 const activeUsers=new Set(users.filter(u=>u.estado==='ACTIVO').map(u=>u.usuario_id));
 const seen=new Set();for(const r of registrations){if(!r.inscripcion_id||seen.has(r.inscripcion_id))throw Error('Inscripciones duplicadas o incompletas');seen.add(r.inscripcion_id);}
 const result=[];
 for(const e of events){
  if(e.estado!=='PUBLICADO'||eventStart(e)<=now)continue;
  const capacity=Number(e.capacidad);if(!Number.isSafeInteger(capacity)||capacity<1)throw Error('Capacidad inválida');
  const list=registrations.filter(r=>r.evento_id===e.evento_id);
  const active=list.filter(r=>['CONFIRMADA','LISTA_ESPERA'].includes(r.estado));
  if(new Set(active.map(r=>r.usuario_id)).size!==active.length)throw Error('Usuario con varias inscripciones activas');
  const occupied=list.filter(r=>r.estado==='CONFIRMADA').length;
  if(occupied>capacity)throw Error('Sobreaforo');
  const waiting=list.filter(r=>r.estado==='LISTA_ESPERA'&&activeUsers.has(r.usuario_id));
  for(const r of waiting)if(!Number.isFinite(Date.parse(r.fecha_inscripcion)))throw Error('Fecha de espera inválida');
  waiting.sort((a,b)=>Date.parse(a.fecha_inscripcion)-Date.parse(b.fecha_inscripcion)||a.inscripcion_id.localeCompare(b.inscripcion_id));
  for(const r of waiting.slice(0,capacity-occupied))result.push({evento:e,inscripcion:r});
 }
 return result;
}
export function planReminders(events,registrations,records,now){
 const keys=new Set(records.map(r=>r.clave_idempotencia));const result=[];
 for(const e of events){if(e.estado!=='PUBLICADO')continue;const start=eventStart(e);if(start<=now||start>now+86400000)continue;
  for(const r of registrations){if(r.evento_id!==e.evento_id||r.estado!=='CONFIRMADA')continue;const key=`${r.usuario_id}:${e.evento_id}:24H`;if(keys.has(key))continue;keys.add(key);result.push({evento:e,inscripcion:r,clave:key});}
 }return result;
}
export function editRegistration(user,body,record,event,now){
 const fail=(status,code,message)=>({status,respuesta:{ok:false,error:{codigo:code,mensaje:message}}});
 if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).some(k=>!['inscripcion_id','nombre_acreditacion','observaciones'].includes(k)))return fail(400,'SOLICITUD_INSCRIPCION_INVALIDA','La solicitud contiene campos no permitidos.');
 if(!/^INS-[a-f0-9]{32}$/.test(body.inscripcion_id??''))return fail(400,'SOLICITUD_INSCRIPCION_INVALIDA','Identificador inválido.');
 if(!record||record.usuario_id!==user||record.inscripcion_id!==body.inscripcion_id)return fail(404,'INSCRIPCION_NO_ENCONTRADA','No se encontró la inscripción.');
 if(!['CONFIRMADA','LISTA_ESPERA'].includes(record.estado))return fail(409,'INSCRIPCION_NO_EDITABLE','La inscripción no está activa.');
 if(!event||event.evento_id!==record.evento_id)throw Error('Evento inconsistente');
 if(!['PUBLICADO','CERRADO'].includes(event.estado)||eventStart(event)<=now)return fail(409,'PLAZO_EDICION_FINALIZADO','El evento no permite editar esta inscripción.');
 const name=typeof body.nombre_acreditacion==='string'?body.nombre_acreditacion.trim():'';
 const notes=typeof body.observaciones==='string'?body.observaciones.trim():body.observaciones===undefined?String(record.observaciones??''):null;
 if([...name].length<2||[...name].length>100||/[\u0000-\u001f\u007f]/.test(name)||notes===null||[...notes].length>500||/[\u0000-\u001f\u007f]/.test(notes))return fail(400,'SOLICITUD_INSCRIPCION_INVALIDA','Revisa el nombre de acreditación y las observaciones.');
 return {status:200,actualizacion:{inscripcion_id:record.inscripcion_id,nombre_acreditacion:name,observaciones:notes,fecha_actualizacion:new Date(now).toISOString()}};
}
