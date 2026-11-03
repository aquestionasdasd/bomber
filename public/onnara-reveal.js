// Borrow avatar geometries; never add damage surfaces or alter normal materials.
export function createOrbReveal(T) {
  const group=new T.Group(),items=new Map();group.name='Onnara / camera-confirmed silhouettes';
  const material=new T.MeshBasicMaterial({color:'#64ffe0',transparent:true,opacity:.52,depthTest:false,depthWrite:false,side:T.DoubleSide});
  function reset(){group.clear();items.clear();}
  function update(actors){
    const seen=new Set();
    for(const actor of actors){if(!actor.alive||!actor.group?.visible)continue;actor.group.updateWorldMatrix(true,true);
      actor.group.traverse(source=>{if(!source.isMesh||source.isInstancedMesh)return;
        for(let p=source;p&&p!==actor.group.parent;p=p.parent)if(!p.visible)return;
        seen.add(source);let clone=items.get(source);if(!clone){clone=new T.Mesh(source.geometry,material);clone.matrixAutoUpdate=false;clone.frustumCulled=false;clone.renderOrder=900;clone.raycast=()=>{};group.add(clone);items.set(source,clone);}
        clone.matrix.copy(source.matrixWorld);
      });
    }
    for(const[source,clone]of items)if(!seen.has(source)){clone.removeFromParent();items.delete(source);}
    group.visible=items.size>0;
  }
  return{group,update,reset,dispose(){reset();material.dispose();group.removeFromParent();}};
}
