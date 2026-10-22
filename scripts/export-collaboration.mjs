// Export a source snapshot, never local credentials, databases or Git history.
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const workspace=path.dirname(path.resolve(root));
const destination=path.resolve(process.argv[2]||path.join(workspace,'collab-bomber'));
const relative=path.relative(workspace,destination);
if(!relative||relative.startsWith('..')||path.isAbsolute(relative)||destination===path.resolve(root))throw Error('Choose a separate export folder inside this workspace.');
if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Export only a committed, clean source snapshot.');
const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const excluded=name=>name.startsWith('.openai/')||name.startsWith('.env')||/^(?:\.git|\.sites-runtime|\.wrangler|node_modules|dist|work|outputs)(?:\/|$)/.test(name)||['POLISH.md','SKILL-ROADMAP.md'].includes(name);
let count=0;
for(const name of files){
  if(excluded(name))continue;
  const target=path.resolve(destination,name);
  if(path.relative(destination,target).startsWith('..'))throw Error('Invalid tracked path.');
  await mkdir(path.dirname(target),{recursive:true});
  await copyFile(path.join(root,name),target);count++;
}
await mkdir(path.join(destination,'.openai'),{recursive:true});
await writeFile(path.join(destination,'.openai','hosting.json'),JSON.stringify({d1:'DB',r2:null},null,2)+'\n');
await writeFile(path.join(destination,'SOURCE-SNAPSHOT.json'),JSON.stringify({sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),purpose:'Collaborative source; production deployment and credentials are managed separately.'},null,2)+'\n');
console.log(`Exported ${count} source files to ${destination}; no Git history, credentials or runtime data. Existing unrelated files were not deleted.`);
