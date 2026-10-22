/** Private rooms: WebRTC first, bounded HTTP relay when a direct path is unavailable. */
const SESSION_KEY='hashimoto-online-session';
async function roomFetch(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
}
export class RoomClient {
  constructor(session,{onRoom=()=>{},onData=()=>{},onStatus=()=>{},onError=()=>{}}={}){
    this.session=session;this.room=session;this.onRoom=onRoom;this.onData=onData;this.onStatus=onStatus;this.onError=onError;
    this.host=session.hostId===session.memberId;this.cursor=session.resumeCursor||0;this.peers=new Map();this.closed=false;this.pollTimer=null;this.pendingState=null;this.pendingTeamStates=new Map();this.lastRelay=0;this.relayBusy=false;
    this.connectionId=crypto.randomUUID();RoomClient.saveSession(session);
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
    if(room.hostId===saved.memberId){
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
  async api(action,body){
    const response=await roomFetch(`/api/rooms/${this.session.code}${action}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${this.session.token}`,'X-Member-Id':this.session.memberId},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await response.json();if(!response.ok){
      if(['unauthorized','room_not_found','room_closed'].includes(data.error)){RoomClient.clearSession(this.session.memberId);this.room={...this.room,status:'closed'};if(!this.closed)this.onRoom(this.room);this.close(false);}
      const error=Error(data.message||'接続を確認してください。');error.status=response.status;throw error;
    }return data;
  }
  async poll(){
    if(this.closed)return;
    try{
      const result=await this.api(`/messages?after=${this.cursor}`);if(this.closed)return;
      this.cursor=result.cursor;this.room=result.room;this.onRoom(result.room);
      if(result.room.status==='closed'){this.onStatus('部屋が閉じられました');this.close(false);return;}
      for(const message of result.messages){if(message.kind==='signal')await this.signal(message.from,message.data);else this.receive(message.from,message.data);}
      if(this.host)for(const member of result.room.members)if(member.id!==this.session.memberId&&member.connected&&!this.peers.has(member.id))this.connect(member.id,true).catch(()=>{});
      const direct=[...this.peers.values()].filter(p=>p.channel?.readyState==='open').length;
      this.onStatus(direct?'接続中 · ダイレクト':'接続中 · リレー');
      if(this.pendingState||this.pendingTeamStates.size)this.flushRelay();
    }catch(error){if(!this.closed)this.onError(error.message);}
    if(!this.closed)this.pollTimer=setTimeout(()=>this.poll(),this.room.status==='playing'?180:650);
  }
  receive(from,data){if(!data||typeof data!=='object'||data.room!==this.session.code)return;this.onData(from,data);}
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
    const packet={...data,room:this.session.code,connection:this.connectionId};const encoded=JSON.stringify(packet);let needsRelay=false;
    const recipients=this.host?this.room.members.filter(m=>m.id!==this.session.memberId&&(team===undefined||m.team===team)&&(m.connected||this.peers.get(m.id)?.channel?.readyState==='open')).map(m=>m.id):[this.session.hostId];
    for(const id of recipients){const channel=this.peers.get(id)?.channel;if(channel?.readyState==='open'&&channel.bufferedAmount<128000){try{channel.send(encoded);}catch{needsRelay=true;}}else needsRelay=true;}
    if(needsRelay){if(team===undefined)this.pendingState=packet;else this.pendingTeamStates.set(team,packet);this.flushRelay();}
  }
  async flushRelay(){
    if(this.closed||this.relayBusy||(!this.pendingState&&!this.pendingTeamStates.size)||Date.now()-this.lastRelay<200)return;
    const batch=[];
    if(this.pendingState){batch.push({to:this.host?'all':'host',data:this.pendingState});this.pendingState=null;}
    for(const [team,data] of this.pendingTeamStates){if(batch.length===2)break;batch.push({to:`team:${team}`,data});this.pendingTeamStates.delete(team);}
    this.relayBusy=true;this.lastRelay=Date.now();
    try{await Promise.all(batch.map(async message=>{try{await this.api('/messages',{...message,kind:'game'});}catch(error){if(!this.closed)this.onError(error.message);}}));}finally{this.relayBusy=false;}
  }
  async ready(ready,team){this.room=await this.api('/ready',{ready,...(team?{team}:{})});this.onRoom(this.room);}
  async start(format){this.room=await this.api('/start',{format});this.onRoom(this.room);}
  close(notify=true){
    if(notify||this.room.status==='closed')RoomClient.clearSession(this.session.memberId);
    if(this.closed)return;this.closed=true;clearTimeout(this.pollTimer);this.pendingState=null;this.pendingTeamStates.clear();for(const peer of this.peers.values())peer.pc.close();this.peers.clear();
    if(notify)return this.api('/leave',{}).catch(()=>{});
  }
}
