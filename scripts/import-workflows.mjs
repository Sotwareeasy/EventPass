import fs from 'node:fs';import {spawnSync} from 'node:child_process';
const selected=process.argv.slice(2);
if(!selected.length)throw Error('Indica nombres de archivos JSON de n8n, sin ruta.');
for(const file of selected){if(!/^[\p{L}\p{N}_ -]+\.json$/u.test(file))throw Error('Nombre inválido');const w=JSON.parse(fs.readFileSync('n8n/'+file,'utf8'));
 for(const args of [['cp','n8n/'+file,'n8n-main:/tmp/eventpass-import.json'],['exec','n8n-main','n8n','import:workflow','--input=/tmp/eventpass-import.json']]){const r=spawnSync('docker',args,{encoding:'utf8',timeout:120000});if(r.status!==0)throw Error((r.stderr||r.stdout).slice(-2000));}
 console.log('Importado: '+w.name+' ('+w.id+'). No se publica automáticamente.');
}
