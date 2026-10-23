// Shared aim geometry only; gameplay/stock mutation remains in the host game.
export function carAimVector(yaw,pitch){if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return null;return{x:-Math.sin(yaw)*Math.cos(pitch),y:Math.sin(pitch),z:-Math.cos(yaw)*Math.cos(pitch)};}
export function carMovementSpread({airborne,moving,gyro}){return airborne?.15:moving&&!gyro?.09:0;}
export function carSmokeIntersection(origin,direction,field){
 if(!origin||!direction||!field||![origin.x,origin.y,origin.z,direction.x,direction.y,direction.z,field.x,field.y,field.z,field.radius].every(Number.isFinite)||field.radius<=0)return null;
 const dx=field.x-origin.x,dy=field.y-origin.y,dz=field.z-origin.z,along=dx*direction.x+dy*direction.y+dz*direction.z,perp=dx*dx+dy*dy+dz*dz-along*along;
 if(perp>field.radius*field.radius)return null;const span=Math.sqrt(Math.max(0,field.radius*field.radius-perp));return along+span>=0?Math.max(0,along-span):null;
}
