// A second view, never an aiming or damage camera. Main camera and input stay put.
export function createOrbView(T){
 const camera=new T.PerspectiveCamera(65,16/9,.08,140),size=new T.Vector2(),vp=new T.Vector4(),scissor=new T.Vector4();
 function render(renderer,scene,event,{actors=[],visible=()=>false,gun=null,hide=[]}={}){
  if(!event)return false;
  const hidden=hide.map(o=>[o,o.visible]);for(const[o]of hidden)o.visible=false;for(const actor of actors){if(actor.group){hidden.push([actor.group,actor.group.visible]);actor.group.visible=actor.group.visible&&visible({x:event.x,y:event.y,z:event.z},actor);}}
  const fog=scene.fog,oldFog=fog?{near:fog.near,far:fog.far,color:fog.color.clone()}:null;if(fog){fog.near=145;fog.far=380;fog.color.set('#b7d0dd');}
  const oldGun=gun?.visible;if(gun)gun.visible=false;
  renderer.getSize(size);renderer.getViewport(vp);renderer.getScissor(scissor);const oldTest=renderer.getScissorTest(),auto=renderer.autoClear;
  const width=Math.min(288,size.x*.32),height=width*9/16,x=size.x-width-18,y=size.y-height-74;
  camera.position.set(event.x,event.y+1.65,event.z);camera.rotation.set(0,event.yaw,0,'YXZ');
  try{renderer.setViewport(x,y,width,height);renderer.setScissor(x,y,width,height);renderer.setScissorTest(true);renderer.clear(true,true,false);renderer.autoClear=false;renderer.render(scene,camera);}
  finally{if(oldFog){fog.near=oldFog.near;fog.far=oldFog.far;fog.color.copy(oldFog.color);}renderer.setViewport(vp);renderer.setScissor(scissor);renderer.setScissorTest(oldTest);renderer.autoClear=auto;if(gun)gun.visible=oldGun;for(const[o,v]of hidden)o.visible=v;}
  return true;
 }
 return{render};
}
