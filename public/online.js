/** Private rooms: WebRTC first, bounded HTTP relay when a direct path is unavailable. */
const SESSION_KEY='hashimoto-online-session';
async function roomFetch(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
}
// Relay deadlines include response bodies: receiving headers alone is not
// delivery. A stalled body must not hold the one relay batch indefinitely.
async function roomJSON(url,options,deadline=Infinity){
  const controller=new AbortController();let timer;
  try{return await Promise.race([
    (async()=>{const response=await fetch(url,{...options,signal:controller.signal});return{response,data:await response.json()};})(),
    new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('通信がタイムアウトしました。'));},Math.min(8000,Math.max(0,deadline-Date.now())));}),
  ]);}finally{clearTimeout(timer);}
}
export class RoomClient {
  constructor(session,{onRoom=()=>{},onData=()=>{},onStatus=()=>{},onError=()=>{}}={}){
    this.session=session;this.room=session;this.onRoom=onRoom;this.onData=onData;this.onStatus=onStatus;this.onError=onError;
    this.host=session.hostId===session.memberId;this.cursor=session.resumeCursor||0;this.peers=new Map();this.closed=false;this.pollTimer=null;this.pendingState=null;this.pendingTeamStates=new Map();this.lastRelay=0;this.relayBusy=false;
    this.settingsPending=false;this.connectionId=crypto.randomUUID();RoomClient.saveSession(session);
    if(session.resumed&&!this.host)this.api('/messages',{to:'host',kind:'signal',data:{reconnect:true}}).catch(()=>{});
    this.poll();
  }
  static savedSession(){
    try{
      const value=JSON.parse(globalThis.sessionStorage?.getItem(SESSION_KEY)||'null');
      if(value&&/^[A-Z2-9]{8}$/.test(value.code)&&typeof value.memberId==='string'&&value.memberId.length<=64&&/^[a-f0-9]{64}$/i.test(value.token))return value;
      globalThis.sessionStorage?.removeItem(SESSION_KEY);
    }catch{try{globalThis.sessionStorage?.removeItem(SESSION_KEY);}catch{}}
    return null;
  }
  static saveSession(session){
    try{globalThis.sessionStorage?.setItem(SESSION_KEY,JSON.stringify({code:session.code,memberId:session.memberId,token:session.token}));}catch{}
  }
  static clearSession(memberId){
    try{if(!memberId||RoomClient.savedSession()?.memberId===memberId)globalThis.sessionStorage?.removeItem(SESSION_KEY);}catch{}
  }
  static async resumeSession(){
    const saved=RoomClient.savedSession();if(!saved)return null;
    const headers={'Content-Type':'application/json','Authorization':`Bearer ${saved.token}`,'X-Member-Id':saved.memberId};
    const response=await roomFetch(`/api/rooms/${saved.code}?resume=1`,{headers});
    const room=await response.json();
    if(!response.ok){
      if([401,403,404,410].includes(response.status)){RoomClient.clearSession(saved.memberId);return{status:'expired'};}
      throw Error(room.message||'再接続できませんでした。通信を確認してもう一度開いてください。');
    }
    if(room.status==='closed'){RoomClient.clearSession(saved.memberId);return{status:'closed'};}
    if(room.hostId===saved.memberId&&room.status==='playing'){
      const left=await roomFetch(`/api/rooms/${saved.code}/leave`,{method:'POST',headers,body:'{}'});
      if(!left.ok)throw Error('ホストの部屋を終了できませんでした。接続を確認してもう一度開いてください。');
      RoomClient.clearSession(saved.memberId);return{status:'host-ended'};
    }
    return{status:'guest',session:{...room,...saved,resumeCursor:room.cursor||0,resumed:true}};
  }
  static async open(action,body){
    const response=await roomFetch(`/api/rooms${action}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await response.json();if(!response.ok)throw Error(data.message||'部屋に接続できませんでした。');return data;
  }
  async api(action,body,{deadline}={}){
    const session=this.session,connection=this.connectionId,token=session.token,code=session.code,memberId=session.memberId;
    const {response,data}=await roomJSON(`/api/rooms/${code}${action}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`,'X-Member-Id':memberId},...(body===undefined?{}:{body:JSON.stringify(body)})},deadline);
    if(!response.ok){
      if(!this.closed&&this.session===session&&this.session.code===code&&this.session.memberId===memberId&&this.session.token===token&&this.connectionId===connection&&['unauthorized','room_not_found','room_closed'].includes(data.error)){RoomClient.clearSession(memberId);this.room={...this.room,status:'closed'};this.onRoom(this.room);this.close(false);}
      const error=Error(data.message||'接続を確認してください。');error.status=response.status;throw error;
    }return data;
  }
  async poll(){
    if(this.closed)return;
    try{
      const result=await this.api(`/messages?after=${this.cursor}`);if(this.closed)return;
      this.cursor=result.cursor;this.acceptRoom(result.room);
      if(result.room.status==='closed'){this.onStatus('部屋が閉じられました');this.close(false);return;}
      for(const message of result.messages){if(message.kind==='signal')await this.signal(message.from,message.data);else this.receive(message.from,message.data);}
      if(this.host)for(const member of result.room.members)if(member.id!==this.session.memberId&&member.connected&&!this.peers.has(member.id))this.connect(member.id,true).catch(()=>{});
      const direct=[...this.peers.values()].filter(p=>p.channel?.readyState==='open').length;
      this.onStatus(direct?'接続中 · ダイレクト':'接続中 · リレー');
      if(this.pendingState||this.pendingTeamStates.size)this.flushRelay();
    }catch(error){if(!this.closed)this.onError(error.message);}
    if(!this.closed)this.pollTimer=setTimeout(()=>this.poll(),this.room.status==='playing'?180:650);
  }
  receive(from,data){if(this.closed||this.room.status!=='playing'||!data||typeof data!=='object'||data.room!==this.session.code||(data.epoch??0)!==(this.room.settings?.matchEpoch||0))return;this.onData(from,data);}
  async connect(id,offer=false){
    if(typeof RTCPeerConnection==='undefined')return null;
    const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});
    const peer={pc,channel:null,candidates:[],created:Date.now()};this.peers.set(id,peer);
    const configure=channel=>{peer.channel=channel;channel.onmessage=event=>{try{this.receive(id,JSON.parse(event.data));}catch{}};};
    pc.ondatachannel=event=>configure(event.channel);
    pc.onicecandidate=event=>{if(event.candidate)this.api('/messages',{to:id,kind:'signal',data:{candidate:event.candidate.toJSON()}}).catch(()=>{});};
    pc.onconnectionstatechange=()=>{if(['failed','closed'].includes(pc.connectionState))peer.channel=null;};
    if(offer){configure(pc.createDataChannel('match',{ordered:true}));await pc.setLocalDescription(await pc.createOffer());await this.api('/messages',{to:id,kind:'signal',data:{description:pc.localDescription.toJSON()}});}
    return peer;
  }
  async signal(from,data){
    if(!data||from===this.session.memberId)return;
    if(!this.host&&from!==this.session.hostId)return;
    if(this.host&&data.reconnect===true){this.peers.get(from)?.pc.close();this.peers.delete(from);await this.connect(from,true);return;}
    let peer=this.peers.get(from);if(!peer)peer=await this.connect(from);if(!peer)return;
    try{
      if(data.description){await peer.pc.setRemoteDescription(data.description);for(const c of peer.candidates)await peer.pc.addIceCandidate(c);peer.candidates=[];
        if(data.description.type==='offer'){await peer.pc.setLocalDescription(await peer.pc.createAnswer());await this.api('/messages',{to:from,kind:'signal',data:{description:peer.pc.localDescription.toJSON()}});}
      }else if(data.candidate){if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(data.candidate);else peer.candidates.push(data.candidate);}
    }catch{/* HTTP relay remains available during failed direct negotiation. */}
  }
  send(data,{team}={}){
    if(this.closed||this.room.status!=='playing')return;
    if(team!==undefined&&(!this.host||!['blue','red'].includes(team)||data?.type!=='snapshot'))return;
    this.ensureRelay();
    const packet={...data,room:this.session.code,connection:this.connectionId,...(this.room.settings?.matchEpoch?{epoch:this.room.settings.matchEpoch}:{})};const encoded=JSON.stringify(packet);let needsRelay=false;
    const slot=team||'default',old=this.relayLatest.get(slot);
    if(Number.isSafeInteger(packet.seq)&&Number.isSafeInteger(old?.packet.seq)&&packet.seq<old.packet.seq)return;
    // Advance even for direct-only sends, so a failed older HTTP packet cannot
    // reappear after direct connectivity resumes. Same seq keeps its budget.
    const state=old&&Number.isSafeInteger(packet.seq)&&packet.seq===old.packet.seq?old:
      {slot,packet:JSON.parse(encoded),attempts:0,created:Date.now(),nextAt:0,identity:this.relayIdentity,pauseEpoch:this.pauseRelayEpoch};
    this.relayLatest.set(slot,state);
    if(old!==state){if(team)this.pendingTeamStates.delete(team);else this.pendingState=null;}
    const recipients=this.host?this.room.members.filter(m=>m.id!==this.session.memberId&&(team===undefined||m.team===team)&&(m.connected||this.peers.get(m.id)?.channel?.readyState==='open')).map(m=>m.id):[this.session.hostId];
    for(const id of recipients){const channel=this.peers.get(id)?.channel;if(channel?.readyState==='open'&&channel.bufferedAmount<128000){try{channel.send(encoded);}catch{needsRelay=true;}}else needsRelay=true;}
    if(needsRelay&&!state.done&&!state.cancelled){this.queueRelay(state);this.flushRelay();}else this.scheduleRelay();
  }
  ensureRelay(){
    const s=this.session,key=[s.code,s.memberId,s.token,this.connectionId];
    if(this.relayIdentity&&key.every((value,i)=>value===this.relayIdentity[i]))return;
    this.clearRelay();this.relayIdentity=key;this.relayLatest=new Map();this.pauseRelayEpoch=0;
  }
  relayCurrent(state){
    const s=this.session;
    return !this.closed&&this.room.status==='playing'&&state.identity===this.relayIdentity&&
      [s.code,s.memberId,s.token,this.connectionId].every((value,i)=>value===state.identity[i])&&
      this.relayLatest?.get(state.slot)===state&&!state.cancelled&&
      (!state.packet.paused||state.pauseEpoch===this.pauseRelayEpoch);
  }
  queueRelay(state){if(state.slot==='default')this.pendingState=state.packet;else this.pendingTeamStates.set(state.slot,state.packet);}
  clearRelay(){
    clearTimeout(this.relayTimer);this.relayTimer=null;this.pendingState=null;this.pendingTeamStates?.clear();this.relayLatest?.clear();
  }
  cancelPausedRelay(){
    this.ensureRelay();this.pauseRelayEpoch++;
    for(const state of this.relayLatest.values())if(state.packet.paused===true){state.cancelled=true;if(state.slot==='default')this.pendingState=null;else this.pendingTeamStates.delete(state.slot);}
    this.scheduleRelay();
  }
  relayPending(){
    const slots=[...(this.pendingState?['default']:[]),...this.pendingTeamStates.keys()],result=[];
    for(const slot of slots){const state=this.relayLatest?.get(slot);
      if(!state||!this.relayCurrent(state)||state.done||(state.packet.paused===true&&Date.now()-state.created>=25000)){
        if(state)state.done=true;if(slot==='default')this.pendingState=null;else this.pendingTeamStates.delete(slot);
      }else result.push(state);
    }return result;
  }
  scheduleRelay(){
    clearTimeout(this.relayTimer);this.relayTimer=null;
    if(this.closed||this.room.status!=='playing'||this.relayBusy)return;
    const pending=this.relayPending();if(!pending.length)return;
    const next=Math.min(...pending.map(s=>Math.max(s.nextAt,this.lastRelay+200)));
    this.relayTimer=setTimeout(()=>{this.relayTimer=null;this.flushRelay();},Math.max(0,next-Date.now()));
    this.relayTimer?.unref?.();
  }
  async flushRelay(){
    if(this.closed||this.room.status!=='playing')return;
    this.ensureRelay();
    if(this.relayBusy)return;
    const pending=this.relayPending();
    if(Date.now()-this.lastRelay<200){this.scheduleRelay();return;}
    const batch=pending.filter(s=>s.nextAt<=Date.now()).slice(0,2);
    if(!batch.length){this.scheduleRelay();return;}
    clearTimeout(this.relayTimer);this.relayTimer=null;
    for(const state of batch){if(state.slot==='default')this.pendingState=null;else this.pendingTeamStates.delete(state.slot);state.attempts++;}
    this.relayBusy=true;this.lastRelay=Date.now();
    try{await Promise.all(batch.map(async state=>{
      try{await this.api('/messages',{to:state.slot==='default'?(this.host?'all':'host'):`team:${state.slot}`,data:state.packet,kind:'game'},{deadline:state.packet.paused===true?state.created+25000:undefined});state.done=true;}
      catch(error){if(!this.relayCurrent(state))return;
        const transient=!error.status||error.status===408||error.status===429||error.status>=500;
        const retry=this.host&&state.packet.type==='snapshot'&&state.packet.paused===true&&transient&&state.attempts<3&&Date.now()-state.created<25000;
        if(retry){state.nextAt=Date.now()+(error.status===429?1000:200*2**(state.attempts-1));this.queueRelay(state);}else state.done=true;
        this.onError(error.message);
      }
    }));}finally{this.relayBusy=false;this.scheduleRelay();}
  }
  acceptRoom(room){
    if(this.closed)return;
    // An earlier poll/ready response may arrive after the host's saved choice.
    const next=room.settings?.matchEpoch||0,current=this.room.settings?.matchEpoch||0;
    if(this.room.status==='closed'||next<current||next===current&&room.status==='lobby'&&(this.room.status==='playing'||
      (room.settings?.lobbyRevision||0)<(this.room.settings?.lobbyRevision||0)))return;
    if(next!==current)this.clearRelay();
    this.room=room;if(room.status!=='playing')this.clearRelay();this.onRoom(room);
  }
  async configure(format,mapId){
    if(this.closed||!this.host||this.room.status!=='lobby')throw Error('ホストだけが待機中に設定を変更できます。');
    if(this.settingsPending)throw Error('選択を保存しています。少し待ってください。');
    this.settingsPending=true;
    try{this.acceptRoom(await this.api('/settings',{format,mapId,epoch:this.room.settings?.matchEpoch||0}));}
    finally{this.settingsPending=false;if(!this.closed)this.onRoom(this.room);}
  }
  async ready(ready,team){this.acceptRoom(await this.api('/ready',{ready,...(team?{team}:{}),epoch:this.room.settings?.matchEpoch||0}));}
  async start(format,mapId=this.room.settings?.mapId||'hashimoto'){
    if(this.settingsPending)throw Error('選択を保存しています。少し待ってください。');
    this.acceptRoom(await this.api('/start',{format,mapId,epoch:this.room.settings?.matchEpoch||0}));
  }
  async rematch(){
    if(this.closed||!this.host||this.room.status!=='playing')throw Error('ホストだけが試合後に待機室へ戻せます。');
    this.acceptRoom(await this.api('/rematch',{epoch:this.room.settings?.matchEpoch||0}));
  }
  close(notify=true){
    if(notify||this.room.status==='closed')RoomClient.clearSession(this.session.memberId);
    if(this.closed)return;this.closed=true;clearTimeout(this.pollTimer);this.clearRelay();for(const peer of this.peers.values())peer.pc.close();this.peers.clear();
    if(notify)return this.api('/leave',{}).catch(()=>{});
  }
}
