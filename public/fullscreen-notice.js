// A dismissible suggestion; only the visitor's click requests fullscreen.
export function bindFullscreenNotice({document=globalThis.document,onEnable}={}){
  const notice=document.getElementById('fullscreen-notice');
  const enable=document.getElementById('fullscreen-notice-enable');
  const dismiss=document.getElementById('fullscreen-notice-dismiss');
  const message=document.getElementById('fullscreen-notice-message');
  let dismissed=false,pending=false,disposed=false;
  const supported=()=>document.fullscreenEnabled!==false&&typeof document.documentElement?.requestFullscreen==='function';
  function render(){
    if(disposed)return;
    notice.hidden=Boolean(document.fullscreenElement)||dismissed;
    enable.hidden=!supported();
    enable.disabled=pending;
    enable.textContent=pending?'切替中…':'全画面にする';
    if(!supported())message.textContent='このブラウザーは全画面切替に対応していません';
  }
  function synchronize(){
    if(document.fullscreenElement){dismissed=false;message.textContent='フルスクリーン推奨';}
    render();
  }
  async function request(){
    if(disposed||pending||document.fullscreenElement||!supported())return;
    pending=true;render();
    try{
      // Invoke synchronously from the click to retain the browser's user activation.
      await onEnable();
      if(!disposed&&!document.fullscreenElement)message.textContent='全画面に切り替えられませんでした';
    }catch{
      if(!disposed)message.textContent='全画面に切り替えられませんでした';
    }finally{pending=false;render();}
  }
  function hide(){dismissed=true;render();}
  function keepButtonKeys(event){
    if(['Enter','Space','Tab'].includes(event.code))event.stopPropagation();
  }
  enable.addEventListener('click',request);
  dismiss.addEventListener('click',hide);
  notice.addEventListener('keydown',keepButtonKeys);
  document.addEventListener('fullscreenchange',synchronize);
  render();
  return {dispose(){
    disposed=true;notice.hidden=true;
    enable.removeEventListener('click',request);
    dismiss.removeEventListener('click',hide);
    notice.removeEventListener('keydown',keepButtonKeys);
    document.removeEventListener('fullscreenchange',synchronize);
  }};
}
