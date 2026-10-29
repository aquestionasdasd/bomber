// Trusted build preload. Candidate browser modules must remain copied assets.
import {registerHooks} from 'node:module';
import {resolve} from 'node:path';import {fileURLToPath} from 'node:url';
import {files} from './policy.mjs';
const blocked=new Set(Object.keys(files).map(path=>resolve(process.cwd(),path)));
registerHooks({load(url,context,next){if(url.startsWith('file:')&&blocked.has(resolve(fileURLToPath(url))))throw Error('Candidate asset execution blocked during trusted build');return next(url,context);}});
