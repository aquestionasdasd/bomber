/** Local range-only sign. Removing it also removes its bullet ray surface. */
export function createRangeControl(THREE){
  const group=new THREE.Group();group.name='range-start-control';
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#102d31';ctx.fillRect(0,0,1024,512);
  ctx.strokeStyle='#bbf36b';ctx.lineWidth=18;ctx.strokeRect(16,16,992,480);
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#bbf36b';
  ctx.font='bold 140px sans-serif';ctx.fillText('スタート',512,225);
  ctx.fillStyle='#ffffff';ctx.font='48px sans-serif';ctx.fillText('撃って開始 / 60秒 BOT撃ち',512,380);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const face=new THREE.Mesh(new THREE.BoxGeometry(2.6,1.3,.12),new THREE.MeshBasicMaterial({map:texture}));
  face.position.y=1.65;face.userData.rangeStart=true;group.add(face);
  const postMaterial=new THREE.MeshStandardMaterial({color:'#344c51',roughness:.8});
  for(const x of [-.85,.85]){const post=new THREE.Mesh(new THREE.BoxGeometry(.08,1,.08),postMaterial);post.position.set(x,.5,0);group.add(post);}
  return{group,face,show(parent,{x,y=0,z,yaw=0}){group.position.set(x,y,z);group.rotation.y=yaw;parent.add(group);group.updateMatrixWorld(true);},hide(){group.removeFromParent();}};
}
