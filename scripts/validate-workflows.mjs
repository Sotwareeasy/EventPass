import fs from 'node:fs';import vm from 'node:vm';
let nodes=0,codes=0;const errors=[];const routes=new Map();
for(const file of fs.readdirSync('n8n').filter(f=>f.endsWith('.json'))){
 const w=JSON.parse(fs.readFileSync('n8n/'+file,'utf8'));const names=new Set(w.nodes.map(n=>n.name));
 if(names.size!==w.nodes.length)errors.push(file+': nombres duplicados');
 for(const n of w.nodes){nodes++;
  if(n.type==='n8n-nodes-base.code'){codes++;try{new vm.Script('(async function(){'+n.parameters.jsCode+'})');}catch(e){errors.push(file+'/'+n.name+': '+e.message);}}
  if(n.type==='n8n-nodes-base.webhook'){const route=(n.parameters.httpMethod??'GET')+' '+n.parameters.path;if(routes.has(route))errors.push('Ruta duplicada: '+route);routes.set(route,file);}
  if(JSON.stringify(n.parameters).includes('CONFIGURAR_EP'))errors.push(file+': hoja no configurada en '+n.name);
  if(n.type==='n8n-nodes-base.respondToWebhook'&&n.parameters.options?.responseCode===undefined)errors.push(file+'/'+n.name+': código HTTP implícito');
 }
 for(const [from,outputs] of Object.entries(w.connections??{})){if(!names.has(from))errors.push(file+': origen inexistente '+from);for(const streams of Object.values(outputs))for(const stream of streams)for(const edge of stream)if(!names.has(edge.node))errors.push(file+': destino inexistente '+edge.node);}
}
console.log(JSON.stringify({nodes,codes,routes:routes.size,errors},null,2));if(errors.length)process.exitCode=1;
