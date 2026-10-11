import test from 'node:test';import assert from 'node:assert/strict';import handler,{resolveTarget} from '../api/proxy.js';
test('proxy no admite URL arbitraria ni métodos de administración',()=>{assert.equal(resolveTarget('https://evil.example','GET','http://localhost:5678'),null);assert.equal(resolveTarget('../credentials','GET','http://localhost:5678'),null);assert.equal(resolveTarget('eventos','DELETE','http://localhost:5678'),null);});
test('ruta permitida apunta solo al webhook',()=>assert.equal(resolveTarget('inscripciones','PATCH','http://localhost:5678').href,'http://localhost:5678/webhook/eventpass/inscripciones'));
test('proxy conserva HTTP 409 y no filtra encabezados internos',async()=>{
 const original=global.fetch,base=process.env.N8N_BASE_URL;process.env.N8N_BASE_URL='https://n8n.example';
 global.fetch=async()=>new Response(JSON.stringify({ok:false,error:{codigo:'INSCRIPCION_DUPLICADA'}}),{status:409,headers:{'content-type':'application/json'}});
 const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.code=s;return this;},send(b){this.body=b;},json(b){this.body=b;}};
 try{await handler({method:'POST',query:{path:'inscripciones'},headers:{authorization:'Bearer test'},body:{}},res);assert.equal(res.code,409);assert.equal(JSON.parse(res.body).ok,false);assert.equal(res.headers['Cache-Control'],'no-store');}finally{global.fetch=original;if(base===undefined)delete process.env.N8N_BASE_URL;else process.env.N8N_BASE_URL=base;}
});
