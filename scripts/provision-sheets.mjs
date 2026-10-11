import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=process.cwd();
const schemas={
 EP07_Reasignaciones:{Reasignaciones:'reasignacion_id evento_id inscripcion_id usuario_id fecha orden_lista estado_anterior estado_nuevo resultado_notificacion'},
 EP08_Recordatorios:{Recordatorios:'recordatorio_id usuario_id evento_id inscripcion_id tipo_recordatorio fecha_programada fecha_envio estado clave_idempotencia'},
 EP09_Notificaciones:{Notificaciones:'notificacion_id usuario_id tipo titulo mensaje evento_id inscripcion_id fecha gmail_estado telegram_estado gmail_error telegram_error clave_idempotencia'},
 EP10_Soporte:{Conversaciones:'conversation_id usuario_id visitor_id fecha_inicio fecha_ultima_interaccion estado',Mensajes:'message_id conversation_id usuario_id visitor_id rol mensaje timestamp'},
};
fs.mkdirSync('docs',{recursive:true});
fs.writeFileSync('docs/sheets-schema.json',JSON.stringify(schemas,null,2));
const configFile=path.join(root,'config.local.json');
const config=fs.existsSync(configFile)?JSON.parse(fs.readFileSync(configFile,'utf8')):{sheets:{}};
function docker(args){const r=spawnSync('docker',['exec','-e','N8N_RUNNERS_ENABLED=false','n8n-main',...args],{encoding:'utf8',timeout:120000,maxBuffer:8e6});if(r.status!==0)throw new Error((r.stderr||r.stdout).slice(-2000));return r.stdout;}
for(const [name,tabs] of Object.entries(schemas)){
 if(config.sheets[name]){console.log(name+': ya configurado');continue;}
 const body={properties:{title:name},sheets:Object.entries(tabs).map(([title,cols])=>({properties:{title},data:[{startRow:0,startColumn:0,rowData:[{values:cols.split(' ').map(col=>({userEnteredValue:{stringValue:col}}))}]}]}))};
 const workflow={name:'Preparar '+name,nodes:[{id:'start',name:'Inicio',type:'n8n-nodes-base.manualTrigger',typeVersion:1,position:[0,0],parameters:{}},{id:'create',name:'Crear archivo',type:'n8n-nodes-base.httpRequest',typeVersion:4.2,position:[240,0],parameters:{method:'POST',url:'https://sheets.googleapis.com/v4/spreadsheets',authentication:'predefinedCredentialType',nodeCredentialType:'googleSheetsOAuth2Api',sendBody:true,specifyBody:'json',jsonBody:JSON.stringify(body),options:{}},credentials:{googleSheetsOAuth2Api:{id:'jzVSx4ibnSlPFZiO',name:'Google Sheets account'}}}],connections:{Inicio:{main:[[{node:'Crear archivo',type:'main',index:0}]]}},settings:{executionOrder:'v1',saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false}};
 workflow.id='EPSetup'+name.slice(0,4);workflow.active=false;
 const local=path.join(root,'provision.tmp.json');fs.writeFileSync(local,JSON.stringify(workflow));
 const cp=spawnSync('docker',['cp',local,'n8n-main:/tmp/eventpass-provision.json'],{encoding:'utf8'});fs.unlinkSync(local);if(cp.status!==0)throw new Error('No se pudo copiar el flujo de preparación.');
 docker(['n8n','import:workflow','--input=/tmp/eventpass-provision.json']);
 const output=docker(['n8n','execute','--id='+workflow.id,'--rawOutput']);
 const found=[...output.matchAll(/"spreadsheetId"\s*:\s*"([A-Za-z0-9_-]+)"/g)].map(m=>m[1]);
 if(!found.length)throw new Error('No se obtuvo spreadsheetId para '+name+'. Revisa n8n antes de repetir. '+output.slice(-1200));
 config.sheets[name]=found[0];fs.writeFileSync(configFile,JSON.stringify(config,null,2));console.log(name+': creado y registrado');
}
