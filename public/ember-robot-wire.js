// Optional, lossless event-key dictionary while robot state shares the existing
// 64KiB game packet. No extra messages, actor/event drops or simulation changes.
const columns=rows=>({n:rows.length,c:rows.length?rows[0].map((_,i)=>{const col=rows.map(r=>r[i]);return col.every(v=>v===col[0])?[col[0]]:col;}):[]});
function expand(p,width){if(!p||Object.keys(p).sort().join()!=='c,n'||!Number.isInteger(p.n)||p.n<0||p.n>96||!Array.isArray(p.c)||p.c.length!==(p.n?width:0)||p.c.some(c=>!Array.isArray(c)||(c.length!==1&&c.length!==p.n)||c.some(v=>!Number.isSafeInteger(v)||Math.abs(v)>1e9)))return null;return Array.from({length:p.n},(_,i)=>p.c.map(c=>c.length===1?c[0]:c[i]));}
export function packRobotEvents(packet){
 if(!packet.robotArmy||!packet.ordinarySkills)return packet;
 const keys=[],rows=[],names=['events','blinds','markers'],sizes=names.map(k=>(packet.ordinarySkills[k]||[]).length);
 for(const name of names)for(const event of packet.ordinarySkills[name]||[]){const row=[];for(const [key,value]of Object.entries(event)){let index=keys.indexOf(key);if(index<0){index=keys.length;keys.push(key);}row.push(index,value);}rows.push(row);}
 return{...packet,robotArmy:{...packet.robotArmy,u:[],w:[]},ordinarySkills:{...packet.ordinarySkills,events:[],blinds:[],markers:[]},robotEvents:{k:keys,r:rows,n:sizes,u:columns(packet.robotArmy.u),w:columns(packet.robotArmy.w)}};
}
export function unpackRobotEvents(packet){
 if(!Object.hasOwn(packet,'robotEvents'))return packet;
 const p=packet.robotEvents,names=['events','blinds','markers'];if(!packet.robotArmy||!Array.isArray(packet.robotArmy.u)||packet.robotArmy.u.length||!Array.isArray(packet.robotArmy.w)||packet.robotArmy.w.length||!p||Object.keys(p).sort().join()!=='k,n,r,u,w'||!Array.isArray(p.k)||p.k.length>64||!Array.isArray(p.r)||p.r.length>80||!Array.isArray(p.n)||p.n.length!==3||p.n.some((n,i)=>!Number.isInteger(n)||n<0||n>[20,40,20][i])||p.n.reduce((a,b)=>a+b,0)!==p.r.length||!packet.ordinarySkills||names.some(k=>!Array.isArray(packet.ordinarySkills[k])||packet.ordinarySkills[k].length)||p.k.some(k=>typeof k!=='string'||k.length>40||!/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)||k==='constructor'||k==='prototype')||new Set(p.k).size!==p.k.length)return null;
 const units=expand(p.u,24),wrecks=expand(p.w,7);if(!units||!wrecks)return null;
 const events=[];
 for(const row of p.r){if(!Array.isArray(row)||row.length>128||row.length%2)return null;const event={};for(let i=0;i<row.length;i+=2){const index=row[i];if(!Number.isInteger(index)||index<0||index>=p.k.length||Object.hasOwn(event,p.k[index]))return null;event[p.k[index]]=row[i+1];}events.push(event);}
 const skills={...packet.ordinarySkills};let offset=0;for(let i=0;i<3;i++){skills[names[i]]=events.slice(offset,offset+p.n[i]);offset+=p.n[i];}const result={...packet,robotArmy:{...packet.robotArmy,u:units,w:wrecks},ordinarySkills:skills};delete result.robotEvents;return result;
}
