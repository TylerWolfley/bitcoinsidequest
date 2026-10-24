import { spawnSync } from 'node:child_process';
import { mkdir,copyFile,access,writeFile,readFile,readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { ARCHIVE,ROOT,readJSON,writeJSON } from './history-store.mjs';
import { archiveKey,sealArchive,openArchive } from './archive-crypto.mjs';
const branch='market-history',checkout=path.join(ROOT,'.archive');
const key=archiveKey(process.env.HISTORY_KEY);
function git(args,{input,allow=[0],cwd=ROOT}={}){
 const r=spawnSync('git',args,{cwd,input,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
 if(!allow.includes(r.status))throw new Error('History Git operation failed: '+args[0]+' (exit '+r.status+'). Publication stopped; no archive was overwritten.');
 return r.stdout.trim();
}
async function files(directory,prefix=''){
 const out=[];
 for(const entry of await readdir(path.join(directory,prefix),{withFileTypes:true})){
  if(entry.name.startsWith('.'))continue;
  const name=prefix?prefix+'/'+entry.name:entry.name;
  if(entry.isDirectory())out.push(...await files(directory,name));else if(entry.isFile())out.push(name);
 }
 return out;
}
const identity=['-c','user.name=Bitcoin Side Quest','-c','user.email=41898282+github-actions[bot]@users.noreply.github.com'];
if(process.argv[2]==='restore'){
 try{await access(checkout);throw new Error('Archive checkout already exists; refusing to replace it.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const ref=git(['ls-remote','--heads','origin','refs/heads/'+branch]);
 let commit;
 if(ref){git(['fetch','--depth=1','origin','refs/heads/'+branch]);commit='FETCH_HEAD';}
 else{const tree=git(['hash-object','-t','tree','--stdin'],{input:''});commit=git([...identity,'commit-tree',tree,'-m','Initialize encrypted market research archive']);}
 git(['worktree','add','--detach',checkout,commit]);
 await mkdir(ARCHIVE,{recursive:true});
 for(const name of await files(checkout)){
  if(!name.endsWith('.enc.json'))continue;
  const relative=name.slice(0,-9),destination=path.resolve(ARCHIVE,relative);
  if(!destination.startsWith(path.resolve(ARCHIVE)+path.sep))throw new Error('Unsafe archive path');
  const bytes=openArchive(await readJSON(path.join(checkout,name)),relative,key);
  await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,bytes);
 }
 const legacy=await readJSON(path.join(ROOT,'data','market-temperature.json'));
 if(legacy?.modelVersion===1&&!await readJSON(path.join(ARCHIVE,'legacy','market-temperature-v1.json')))await writeJSON(path.join(ARCHIVE,'legacy','market-temperature-v1.json'),legacy);
 const original=await readJSON(path.join(ROOT,'data','legacy-market-temperature-v1.json'));
 if(original?.modelVersion===1&&!await readJSON(path.join(ARCHIVE,'legacy','market-temperature-v1.json')))await writeJSON(path.join(ARCHIVE,'legacy','market-temperature-v1.json'),original);
 for(const name of ['market-temperature.json','journal.json','price-history.json','evidence-latest.json']){
  try{await copyFile(path.join(ARCHIVE,'current',name),path.join(ROOT,'data',name));}catch(e){if(e.code!=='ENOENT')throw e;}
 }
}else if(process.argv[2]==='save'){
 await access(path.join(checkout,'.git'));
 await mkdir(path.join(ARCHIVE,'models'),{recursive:true});
 for(const name of ['risk-temperature.js','temperature-policy.js','scenarios.js'])await copyFile(path.join(ROOT,'lib',name),path.join(ARCHIVE,'models',name));
 for(const name of await files(ARCHIVE)){
  const bytes=await readFile(path.join(ARCHIVE,name)),destination=path.join(checkout,name+'.enc.json'),prior=await readJSON(destination);
  if(prior?.sha256===createHash('sha256').update(bytes).digest('hex'))continue;
  await writeJSON(destination,sealArchive(bytes,name,key));
 }
 await writeFile(path.join(checkout,'README.md'),'# Encrypted market research archive\n\nOriginal observations, model policies, price histories and immutable daily notes are encrypted with AES-256-GCM before they enter Git. HISTORY_KEY is a repository Actions secret, never part of this branch or the website. This is a recovery store for internal evaluation, not a public data export. Public readings and explanations are on bitcoinsidequest.com. Never force-push this branch. Retain the owner key backup; losing it makes the archive unrecoverable.\n');
 git(['add','.'],{cwd:checkout});if(git(['status','--porcelain'],{cwd:checkout}))git([...identity,'commit','-m','Preserve encrypted observations and daily publication state'],{cwd:checkout});
 git(['push','origin','HEAD:refs/heads/'+branch],{cwd:checkout});
 const file=path.join(ROOT,'data','archive-status.json'),data=await readJSON(file);
 if(data)await writeJSON(file,{...data,durable:true,encrypted:true,commit:git(['rev-parse','HEAD'],{cwd:checkout})});
}else throw new Error('Use restore or save');
