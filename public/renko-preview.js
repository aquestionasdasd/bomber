import * as THREE from './vendor/three.module.js';
import {createCharacterPreview} from './character-preview.js';
import {createAgentModel} from './agent-model.js';

// A visual-only page. It loads no game, room, persistence or audio code.
export function mountRenkoPreview({document:doc=globalThis.document,previewFactory=createCharacterPreview}={}) {
  let pose='stand',portrait=false,disposed=false;
  const buttons=[...doc.querySelectorAll('[data-pose]')],views=[...doc.querySelectorAll('[data-view]')],view=doc.defaultView;
  const preview=previewFactory(THREE,{canvas:doc.getElementById('renko-model'),document:doc,
    rendererFactory(canvas) {
      const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      const render=renderer.render.bind(renderer),camera=new THREE.PerspectiveCamera(32,1,.05,30),target=new THREE.Vector3();
      renderer.render=(scene,normalCamera)=>{
        if(!portrait){render(scene,normalCamera);return;}
        camera.aspect=normalCamera.aspect;camera.updateProjectionMatrix();
        // Follow the actual head while crouching or dancing, using this page's
        // own camera and the same single renderer as the full-body view.
        let head;scene.traverse(node=>{if(node.name==='Renko avatar frame / head')head=node;});
        scene.updateMatrixWorld(true);head?.getWorldPosition(target);
        camera.position.set(target.x,target.y+.04,target.z+1.5);camera.lookAt(target.x,target.y+.06,target.z);render(scene,camera);
      };
      return renderer;
    },
    modelFactory(T,{team}) {
      const model=createAgentModel(T,{team,character:'renko'});
      return {...model,update(dt,state){model.update(dt,{...state,character:'renko',weapon:'knife',crouch:pose==='crouch'?1:0,dancing:pose==='dance'});}};
    },
    onError(){doc.getElementById('error').hidden=false;},
  });
  function change(event){if(disposed)return;const next=event.currentTarget.dataset.pose;if(!['stand','crouch','dance'].includes(next))return;pose=next;for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.pose===pose));}
  function changeView(event){if(disposed)return;portrait=event.currentTarget.dataset.view==='face';for(const button of views)button.setAttribute('aria-pressed',String((button.dataset.view==='face')===portrait));}
  for(const button of buttons)button.addEventListener('click',change);
  for(const button of views)button.addEventListener('click',changeView);
  function resume(){if(!disposed)preview.setActive(true);}
  function hide(event){if(event.persisted)preview.setActive(false);else dispose();}
  function dispose(){if(disposed)return;disposed=true;for(const button of buttons)button.removeEventListener('click',change);for(const button of views)button.removeEventListener('click',changeView);view?.removeEventListener('pagehide',hide);view?.removeEventListener('pageshow',resume);preview.dispose();}
  view?.addEventListener('pagehide',hide);view?.addEventListener('pageshow',resume);resume();
  return {dispose};
}
if(typeof document!=='undefined'&&document.getElementById('renko-model'))mountRenkoPreview();
