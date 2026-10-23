// Only accepted host damage enters this bounded, one-round ledger. Store actual
// HP + armour lost, after lethal protection; healing and overkill add nothing.
export function createRoundDamageTracker(){
  let current=null,previous=null;
  const seats=roster=>roster.map(r=>({id:r.id,team:r.team}));
  const validSeats=roster=>Array.isArray(roster)&&roster.length>0&&roster.length<=10&&new Set(roster.map(r=>r?.id)).size===roster.length&&roster.every(r=>r&&typeof r.id==='string'&&['blue','red'].includes(r.team));
  return{
    reset(){current=null;previous=null;},
    begin(round,roster){if(!Number.isSafeInteger(round)||round<1||!validSeats(roster))return false;current={round,seats:seats(roster),rows:new Map()};return true;},
    record(round,victim,killer,loss){
      if(!current||current.round!==round||!Number.isFinite(loss)||loss<=0)return;
      const to=current.seats.findIndex(r=>r.id===victim),from=current.seats.findIndex(r=>r.id===killer);
      if(to<0)return;const key=`${from}:${to}`,old=current.rows.get(key);
      current.rows.set(key,{from,to,loss:Math.min(10000000,(old?.loss||0)+loss)});
    },
    finish(round){if(current?.round!==round)return false;previous={round,seats:current.seats,rows:[...current.rows.values()].map(r=>[r.from,r.to,Math.round(r.loss*10)]).filter(r=>r[2]>0)};current=null;return true;},
    snapshot(team,round){
      if(!previous||previous.round!==round-1)return null;
      return[previous.round,previous.rows.filter(([from,to])=>previous.seats[to].team===team||previous.seats[from]?.team===team).map(r=>[...r])];
    },
    restore(value,roster,round,team,validateOnly=false){
      if(!validSeats(roster)||!Array.isArray(value)||value.length!==2||value[0]!==round-1||!Number.isSafeInteger(value[0])||value[0]<1||!Array.isArray(value[1])||value[1].length>100)return false;
      const seen=new Set();
      for(const row of value[1]){
        if(!Array.isArray(row)||row.length!==3||!row.every(Number.isSafeInteger))return false;
        const[from,to,loss]=row,key=`${from}:${to}`;
        if(from< -1||from>=roster.length||to<0||to>=roster.length||loss<=0||loss>100000000||seen.has(key)||(roster[to].team!==team&&roster[from]?.team!==team))return false;
        seen.add(key);
      }
      if(!validateOnly)previous={round:value[0],seats:seats(roster),rows:value[1].map(r=>[...r])};return true;
    },
    report(id,roster,round){
      if(!previous||previous.round!==round-1)return null;
      const own=previous.seats.findIndex(r=>r.id===id);if(own<0)return null;
      const entries=new Map();let given=0,received=0;
      for(const[from,to,loss]of previous.rows){
        if(from!==own&&to!==own)continue;
        const other=from===own?to:from,key=previous.seats[other]?.id??null;
        const row=entries.get(other)||{id:key,name:roster.find(r=>r.id===key)?.name||'環境・バス',friendly:other>=0&&previous.seats[other].team===previous.seats[own].team,given:0,received:0};
        if(from===own){row.given+=loss/10;given+=loss/10;}if(to===own){row.received+=loss/10;received+=loss/10;}
        entries.set(other,row);
      }
      return{round:previous.round,given,received,rows:[...entries.values()]};
    }
  };
}

export function renderCombatReport(panel,report,{document}={}){
  if(!panel||!report)return;
  const label=document.getElementById('combat-report-round'),given=document.getElementById('combat-report-given'),received=document.getElementById('combat-report-received'),body=document.getElementById('combat-report-body');
  label.textContent=`ROUND ${String(report.round).padStart(2,'0')} のダメージ`;
  given.textContent=Math.round(report.given).toLocaleString();received.textContent=Math.round(report.received).toLocaleString();body.replaceChildren();
  for(const entry of report.rows){
    const row=document.createElement('tr');
    for(const text of [entry.name+(entry.friendly?'（味方）':''),Math.round(entry.given).toLocaleString(),Math.round(entry.received).toLocaleString()]){const cell=document.createElement('td');cell.textContent=text;row.append(cell);}body.append(row);
  }
  if(!report.rows.length){const row=document.createElement('tr'),cell=document.createElement('td');cell.colSpan=3;cell.textContent='このラウンドのダメージはありません';row.append(cell);body.append(row);}
}
