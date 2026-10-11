import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const findings=[];
const patterns=[
  ['Google API key',/AIza[\w-]{30,}/],
  ['GitHub token',/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/],
  ['Telegram bot token',/\b\d{8,12}:[A-Za-z0-9_-]{30,}\b/],
  ['private key',/BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/],
  ['JWT',/eyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/],
];
for(const file of files){
  if(!fs.existsSync(file))continue;
  if(!fs.statSync(file).isFile()){findings.push({file,type:'embedded repository'});continue;}
  if(/(^|\/)\.env(?:\.|$)/.test(file)&&file!=='.env.example')findings.push({file,type:'private environment file'});
  const source=fs.readFileSync(file,'utf8');
  for(const [type,pattern] of patterns)if(pattern.test(source))findings.push({file,type});
  if(file.startsWith('n8n/')&&file.endsWith('.json')){
    const workflow=JSON.parse(source);
    if(Object.keys(workflow.pinData??{}).length)findings.push({file,type:'pinned execution data'});
  }
}
console.log(JSON.stringify({files:files.length,findings},null,2));
if(findings.length)process.exit(1);
