// Trusted adversarial probe, executed only in the disposable remote container.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
assert.equal(process.getuid(),10000);
assert.equal(process.env.GITHUB_TOKEN,undefined);
assert.equal(process.env.HOST_CANARY,undefined);
assert.equal(existsSync('/var/run/docker.sock'),false);
assert.equal(existsSync('/host-private/canary'),false);
const status=readFileSync('/proc/self/status','utf8');
assert.match(status,/CapEff:\s+0+\n/);assert.match(status,/NoNewPrivs:\s+1\n/);
assert.throws(()=>writeFileSync('/project/probe-write-denied','x'));
assert.throws(()=>writeFileSync('/root-write-denied','x'));
let connected=false;try{await fetch('http://1.1.1.1/',{signal:AbortSignal.timeout(1200)});connected=true;}catch{}
assert.equal(connected,false);
console.log(JSON.stringify({probe:'passed',nonRoot:true,networkBlocked:true,noHostMount:true,noDockerSocket:true,noCredentials:true,readOnlyProject:true,readOnlyRoot:true,noCapabilities:true,noNewPrivileges:true}));
