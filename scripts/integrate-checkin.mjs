import fs from 'node:fs';
function edit(file,fn){const s=fs.readFileSync(file,'utf8');const t=fn(s);if(t!==s)fs.writeFileSync(file,t);}
edit('api/proxy.js',s=>s.includes("['checkin'")?s:s.replace("['soporte', ['POST']],","['soporte', ['POST']], ['checkin', ['POST']],"));
edit('src/App.tsx',s=>{if(s.includes('CheckinPanel'))return s;return s
 .replace("type View =", "import CheckinPanel from './CheckinPanel';\n\ntype View =")
 .replace("|'soporte';","|'soporte'|'checkin';")
 .replace("CANCELADA:'Cancelada'","CANCELADA:'Cancelada',ASISTIO:'Asistió'")
 .replace("const [view,setView]", "const [checkin,setCheckin]=useState<{inscripcion_id:string;evento_id:string}|null>(null);\n  const [view,setView]")
 .replace("['catalogo','inscripciones','soporte']", "['catalogo','inscripciones','checkin','soporte']")
 .replace("['Explorar eventos','Mis inscripciones','Asistente']", "['Explorar eventos','Mis inscripciones','Check-in','Asistente']")
 .replace("{r.estado!=='CANCELADA'&&", "{['CONFIRMADA','LISTA_ESPERA'].includes(r.estado)&&")
 .replace('<div className="actions"><button', '<div className="actions">{r.estado===\'CONFIRMADA\'&&<button className="button" disabled={busy} onClick={()=>{setCheckin({inscripcion_id:r.inscripcion_id,evento_id:r.evento_id});void navigate(\'checkin\');}}>Hacer check-in</button>}<button')
 .replace("{view==='cuenta'&&", "{view==='checkin'&&<CheckinPanel authenticated={!!user} initial={checkin} login={()=>setAuth('login')} onSuccess={(id,date)=>{setRegistrations(rs=>rs.map(r=>r.inscripcion_id===id?{...r,estado:'ASISTIO',fecha_actualizacion:date}:r));}}/>}\n      {view==='cuenta'&&");});
edit('src/styles.css',s=>s.includes('.checkin-panel')?s:s+'\n.checkin-panel{max-width:680px}.checkin-result{margin-top:24px;overflow-wrap:anywhere}.checkin-result h3{margin-bottom:12px}.badge.asistio{background:#d9ed9d;color:#173d30}\n');
// ASISTIO ocupa el cupo permanentemente, no abre plaza ni admite otra inscripción activa.
edit('workflow-src/domain.mjs',s=>s.replace("['CONFIRMADA','LISTA_ESPERA'].includes(r.estado)","['CONFIRMADA','LISTA_ESPERA','ASISTIO'].includes(r.estado)").replace("list.filter(r=>r.estado==='CONFIRMADA')","list.filter(r=>['CONFIRMADA','ASISTIO'].includes(r.estado))"));
for(const file of fs.readdirSync('n8n').filter(f=>f.endsWith('.json')&&!f.startsWith('TEST_'))){
 const path='n8n/'+file,w=JSON.parse(fs.readFileSync(path,'utf8'));let changed=false;
 for(const n of w.nodes??[]){if(n.type!=='n8n-nodes-base.code')continue;let s=n.parameters.jsCode,t=s;
  // Reemplaza solo cálculos de ocupación, no reglas de cancelación/edición o recordatorios.
  if(file==='WF05_catalogo_publico.json')t=t.replace("inscripcion.estado !== 'CONFIRMADA'","!['CONFIRMADA', 'ASISTIO'].includes(inscripcion.estado)");
  if(n.name==='Evaluar duplicado y cupos')t=t.replace("['CONFIRMADA', 'LISTA_ESPERA', 'CANCELADA']","['CONFIRMADA', 'LISTA_ESPERA', 'CANCELADA', 'ASISTIO']").replaceAll("registro.estado === 'CONFIRMADA'","['CONFIRMADA', 'ASISTIO'].includes(registro.estado)");
  if(['Preparar listado de mis inscripciones','Validar inscripción para cancelar'].includes(n.name))t=t.replace("  'CANCELADA',\n];","  'CANCELADA',\n  'ASISTIO',\n];");
  if(n.name==='Validar inscripción para cancelar'&&!t.includes('INSCRIPCION_YA_ASISTIO'))t=t.replace("if (estado === 'CANCELADA')", "if (estado === 'ASISTIO') return rechazar(409, 'INSCRIPCION_YA_ASISTIO', 'Una asistencia registrada no puede cancelarse.');\n\nif (estado === 'CANCELADA')");
  if(t.includes('function planPromotions'))t=t.replace("['CONFIRMADA','LISTA_ESPERA'].includes(r.estado)","['CONFIRMADA','LISTA_ESPERA','ASISTIO'].includes(r.estado)").replace("list.filter(r=>r.estado==='CONFIRMADA')","list.filter(r=>['CONFIRMADA','ASISTIO'].includes(r.estado))");
  if(file==='SW_notificar_cambio_evento.json')t=t.replace("['CONFIRMADA','LISTA_ESPERA'].includes(r.estado)","['CONFIRMADA','LISTA_ESPERA','ASISTIO'].includes(r.estado)");
  if(file==='WF10_eventpass_assistant.json')t=t.replace('CANCELADA: inscripción anulada','ASISTIO: ingreso ya registrado, no puede repetirse ni cancelarse. CANCELADA: inscripción anulada');
  if(t!==s){n.parameters.jsCode=t;changed=true;}
 }
 if(changed){fs.writeFileSync(path,JSON.stringify(w,null,2)+'\n');console.log('Integración ASISTIO: '+file);}
}
// Conservar la ampliación cuando se regenere el servicio de avisos.
edit('scripts/build-workflows.mjs',s=>s.replace("['CONFIRMADA','LISTA_ESPERA'].includes(r.estado)","['CONFIRMADA','LISTA_ESPERA','ASISTIO'].includes(r.estado)"));
console.log('Frontend, proxy y compatibilidad ASISTIO integrados.');
