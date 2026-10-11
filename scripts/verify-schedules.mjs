import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
// Ejecuta los flujos reales. Si existen candidatos, puede promover o notificar.
// Usar solo tras comprobar el estado de los datos y las credenciales.
for (const file of ['WF07_reasignacion_lista_espera','WF08_recordatorios']) {
  const w=JSON.parse(fs.readFileSync(`n8n/${file}.json`,'utf8'));
  const trigger=w.nodes.find(n=>n.type==='n8n-nodes-base.scheduleTrigger');
  trigger.type='n8n-nodes-base.manualTrigger';trigger.typeVersion=1;trigger.parameters={};
  w.id=file.startsWith('WF07')?'EPVerifySchedule7':'EPVerifySchedule8';w.active=false;
  w.name='Verificación manual '+file;
  const path='schedule-check.tmp.json';fs.writeFileSync(path,JSON.stringify(w));
  function run(args){const r=spawnSync('docker',args,{encoding:'utf8',timeout:120000,maxBuffer:16e6});if(r.status!==0)throw Error('Falló la verificación '+file);return r.stdout;}
  run(['cp',path,'n8n-main:/tmp/eventpass-schedule-check.json']);fs.unlinkSync(path);
  run(['exec','n8n-main','n8n','import:workflow','--input=/tmp/eventpass-schedule-check.json']);
  const out=run(['exec','n8n-main','n8n','execute','--id='+w.id,'--rawOutput']);
  const start=out.search(/^\s*\{/m);const parsed=JSON.parse(out.slice(start));
  const result=parsed.data?.resultData;
  if(result?.error)throw Error(file+': ejecución fallida; revisar n8n.');
  console.log(JSON.stringify({workflow:file,status:parsed.status,nodos:Object.keys(result?.runData??{})}));
}
