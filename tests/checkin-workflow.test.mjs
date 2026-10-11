// Ejecuta el grafo y los Code nodes exportados. Sustituye solo servicios externos.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),workflow=JSON.parse(fs.readFileSync('n8n/WF11_checkin_digital.json','utf8'));
const id='INS-'+'c'.repeat(32),other='INS-'+'d'.repeat(32),user='USR-QA';
function fixture(state='CONFIRMADA'){
 return {Inscripciones:[{inscripcion_id:id,usuario_id:user,evento_id:'EVT-QA',estado:state,fecha_inscripcion:'2026-01-01T00:00:00Z',fecha_actualizacion:'2026-01-01T00:00:00Z',nombre_acreditacion:'QA',observaciones:'',origen:'QA',orden_espera:''},{inscripcion_id:other,usuario_id:'USR-OTRO',evento_id:'EVT-QA',estado:'CONFIRMADA'}],Eventos:[{evento_id:'EVT-QA',estado:'PUBLICADO'},{evento_id:'EVT-OTRO',estado:'CERRADO'}],Checkins:[],Auditoria_Inscripciones:[],notifications:[],fail:''};
}
async function execute(db,body={inscripcion_id:id,evento_id:'EVT-QA'},authenticated=true){
 const output={},nodes=new Map(workflow.nodes.map(n=>[n.name,n]));let queue=[{name:'Recibir check-in',items:[{json:{body,headers:{'content-type':'application/json'},query:{}}}]}],response;
 const item=(json)=>({json});
 while(queue.length){const {name,items}=queue.shift(),n=nodes.get(name);let result=items,port=0;
  const sandbox={$input:{first:()=>items[0],all:()=>items},$json:items[0]?.json,$:key=>({first:()=>output[key]?.[0],all:()=>output[key]??[]}),require,Date};
  const expr=v=>typeof v==='string'&&v.startsWith('={{')?vm.runInNewContext(v.slice(3,-2).trim(),sandbox):v;
  try{
   if(db.fail===name)throw Error('Injected failure');
   if(n.type.endsWith('.code'))result=await vm.runInNewContext('(async()=>{'+n.parameters.jsCode+'})()',sandbox);
   else if(n.type.endsWith('.if'))port=expr(n.parameters.conditions.conditions[0].leftValue)?0:1;
   else if(n.type.endsWith('.executeWorkflow')){
    if(name==='Autenticar check-in')result=[item(authenticated?{status_http:200,respuesta:{ok:true,data:{usuario:{usuario_id:user}}}}:{status_http:401,respuesta:{ok:false,error:{codigo:'SESION_INVALIDA',mensaje:'Inicia sesión.'}}})];
    else{db.notifications.push(structuredClone(items[0].json));result=[item({gmail_estado:'ENVIADO',telegram_estado:'ENVIADO'})];}
   }else if(n.type.endsWith('.googleSheets')){
    const p=n.parameters,table=db[p.sheetName.value],op=p.operation??'read';
    if(op==='read'){let rows=table;for(const f of p.filtersUI?.values??[])rows=rows.filter(r=>r[f.lookupColumn]===expr(f.lookupValue));result=rows.length?structuredClone(rows).map(item):[item({})];}
    else {const values=Object.fromEntries(Object.entries(p.columns.value).map(([k,v])=>[k,expr(v)]));if(op==='append')table.push(structuredClone(values));else{const key=p.columns.matchingColumns[0],rows=table.filter(r=>r[key]===values[key]);assert.equal(rows.length,1);Object.assign(rows[0],values);}result=[item(values)];}
   }else if(n.type.endsWith('.respondToWebhook')){response={status:expr(n.parameters.options.responseCode),body:expr(n.parameters.responseBody)};}
  }catch(error){if(n.onError!=='continueErrorOutput')throw error;port=1;result=[item({error:'Servicio simulado no disponible'})];}
  output[name]=result;
  for(const edge of workflow.connections[name]?.main?.[port]??[])if(result.length)queue.push({name:edge.node,items:result});
 }
 return response;
}
test('grafo: éxito cambia solo la inscripción correcta, audita y llama a WF09 una vez',async()=>{const db=fixture(),before=structuredClone(db.Inscripciones[1]);const r=await execute(db);assert.equal(r.status,201);assert.equal(r.body.data.estado,'ASISTIO');assert.equal(db.Checkins.length,1);assert.equal(db.Checkins[0].resultado,'EXITOSO');assert.equal(db.Inscripciones[0].estado,'ASISTIO');assert.deepEqual(db.Inscripciones[1],before);assert.equal(db.Auditoria_Inscripciones[0].accion,'CHECKIN');assert.equal(db.notifications.length,1);assert.equal(db.notifications[0].clave_idempotencia,'CHECKIN:'+id);});
test('grafo: segundo ingreso no modifica fecha, no duplica éxito/auditoría/notificación',async()=>{const db=fixture();await execute(db);const before=structuredClone(db.Inscripciones);const r=await execute(db);assert.equal(r.status,409);assert.equal(r.body.data.resultado,'DUPLICADO');assert.equal(db.Checkins.filter(r=>r.resultado==='EXITOSO').length,1);assert.equal(db.Checkins.filter(r=>r.resultado==='DUPLICADO').length,1);assert.deepEqual(db.Inscripciones,before);assert.equal(db.notifications.length,1);assert.equal(db.Auditoria_Inscripciones.length,1);});
for(const state of ['CANCELADA','LISTA_ESPERA'])test('grafo: rechaza '+state+' sin modificar ni notificar',async()=>{const db=fixture(state),before=structuredClone(db.Inscripciones);const r=await execute(db);assert.equal(r.status,409);assert.equal(db.Checkins[0].resultado,'RECHAZADO');assert.deepEqual(db.Inscripciones,before);assert.equal(db.notifications.length,0);});
test('grafo: evento incorrecto e inscripción inexistente quedan auditados',async()=>{const db=fixture();assert.equal((await execute(db,{inscripcion_id:id,evento_id:'EVT-OTRO'})).status,409);assert.equal((await execute(db,{inscripcion_id:'INS-'+'e'.repeat(32),evento_id:'EVT-QA'})).status,404);assert.equal(db.Checkins.length,2);assert.ok(db.Checkins.every(r=>r.resultado==='RECHAZADO'));assert.equal(db.notifications.length,0);});
test('grafo: sin sesión se registra rechazo sin tocar inscripciones',async()=>{const db=fixture();assert.equal((await execute(db,undefined,false)).status,401);assert.equal(db.Checkins[0].usuario_id,'');assert.equal(db.notifications.length,0);});
test('grafo: escritura fallida conserva reserva y bloquea reintento',async()=>{const db=fixture();db.fail='Marcar inscripción ASISTIO';assert.equal((await execute(db)).status,503);db.fail='';const retry=await execute(db);assert.equal(retry.status,503);assert.equal(db.Inscripciones[0].estado,'CONFIRMADA');assert.equal(db.notifications.length,0);assert.equal(db.Checkins.filter(r=>r.resultado==='EXITOSO').length,0);});
test('grafo: fallo de notificación no revierte un ingreso confirmado',async()=>{const db=fixture();db.fail='Notificar mediante WF09';const r=await execute(db);assert.equal(r.status,201);assert.equal(db.Checkins[0].resultado,'EXITOSO');assert.equal(r.body.notificacion.gmail,'PENDIENTE');assert.equal((await execute(db)).status,409);});
