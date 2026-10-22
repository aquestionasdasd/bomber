const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Small static server for local solo matches and practice. Online rooms require
// the Sites/Vinext backend: npm run dev -- --port 8022 (see README.md).
const root = path.resolve(__dirname, 'public');
const port = Number(process.env.PORT) || 8018;
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
http.createServer((req,res) => {
  let file;
  let pathname;
  try { pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch {res.writeHead(400);res.end();return;}
  if(pathname==='/api'||pathname.startsWith('/api/')){
    res.writeHead(503,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({message:'オンライン対戦は「起動.cmd」、または npm run dev -- --port 8022 で起動し、http://127.0.0.1:8022/play.html を開いてください。'}));return;
  }
  if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405,{'Allow':'GET, HEAD'});res.end();return;}
  file=path.resolve(root, '.'+pathname);
  if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  if(file===root)file=path.join(root,'play.html');
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404);res.end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:data);});
}).listen(port,'127.0.0.1',()=>{
  console.log(`Local solo / practice: http://127.0.0.1:${port}/play.html`);
  console.log('Online rooms: run 起動.cmd or npm run dev -- --port 8022, then open http://127.0.0.1:8022/play.html');
});
