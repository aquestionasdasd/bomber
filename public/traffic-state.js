// A bounded host marker; no arbitrary velocity, extra fields or expired launch.
export function trafficMarker(value,now){
 if(!Array.isArray(value)||value.length!==5||!value.every(Number.isFinite)||!Number.isSafeInteger(value[0])||value[0]<1||value[1]<=now||value[1]>now+.801||Math.abs(value[2])>19||Math.abs(value[3])>19||value[4]<-15||value[4]>6)return null;
 return{seq:value[0],endsAt:value[1],vx:value[2],vz:value[3],vy:value[4]};
}
// Keep authoritative game state intact. Only old, repeatable sound/flash cues
// may be omitted if environmental launches or a post-round result fill the cap.
export function fitTrafficSnapshot(packet){
 const bytes=p=>new TextEncoder().encode(JSON.stringify(p)).length;
 if(bytes(packet)<=65536)return packet;
 const result={...packet,cues:[...(packet.cues||[])]};
 while(result.cues.length&&bytes(result)>65536)result.cues.shift();
 return bytes(result)<=65536?result:null;
}
