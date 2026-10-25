import { VICTORY_MUSIC } from './victory-music-config.js';

const unit=(value,fallback)=>Number.isFinite(Number(value))?Math.min(1,Math.max(0,Number(value))):fallback;

// Separate from weapon/footstep audio. Settings never start playback.
export function createVictoryMusic({config=VICTORY_MUSIC,createAudio=()=>new Audio(),schedule=setTimeout,cancel=clearTimeout,onChange=()=>{}}={}){
  let current=null,timer=null,disposed=false,error='';
  let gate={enabled:true,soundEnabled:true,masterVolume:.45,musicVolume:.6,hidden:false};
  const seen=new Set();
  const canPlay=()=>!disposed&&gate.enabled&&gate.soundEnabled&&!gate.hidden&&gate.masterVolume>0&&gate.musicVolume>0;
  function stop(){
    if(timer!==null){cancel(timer);timer=null;}
    if(current){const old=current;current=null;old.onended=null;old.onerror=null;old.pause();old.removeAttribute('src');old.load();}
  }
  function reset(){stop();seen.clear();}
  function setGate(next){
    gate={...gate,...next,masterVolume:unit(next.masterVolume??gate.masterVolume,.45),musicVolume:unit(next.musicVolume??gate.musicVolume,.6)};
    if(!canPlay())stop();else if(current)current.volume=gate.masterVolume*gate.musicVolume;
  }
  function result({key,won,audible=true}){
    if(disposed||typeof key!=='string'||!key||seen.has(key))return false;
    seen.add(key);while(seen.size>32)seen.delete(seen.values().next().value);
    stop();
    if(!won||!audible||!canPlay()||!config.src)return false;
    let media;
    try{
      media=createAudio();current=media;media.preload='none';media.loop=false;media.volume=gate.masterVolume*gate.musicVolume;media.src=config.src;
      const fail=()=>{if(current!==media)return;stop();error='BGMを再生できませんでした。次の勝利時に再試行します。';onChange();};
      media.onerror=fail;media.onended=()=>{if(current===media)stop();};
      timer=schedule(()=>{if(current===media)stop();},Math.min(30,Math.max(1,Number(config.maxSeconds)||15))*1000);
      const attempt=media.play();attempt?.catch(fail);return true;
    }catch{if(current===media)stop();error='BGMを開始できませんでした。次の勝利時に再試行します。';onChange();return false;}
  }
  function state(){return {configured:!!config.src,title:config.title||'未設定',error};}
  function dispose(){if(disposed)return;reset();disposed=true;}
  return {result,stop,reset,setGate,state,dispose};
}

export function bindVictoryMusicSettings({document,music,preferences,onChange}){
  const enabled=document.getElementById('victory-music-enabled'),volume=document.getElementById('victory-music-volume'),output=document.getElementById('victory-music-value');
  const dialog=document.getElementById('victory-music-settings'),status=document.getElementById('victory-music-status'),title=document.getElementById('victory-music-title');
  const openers=['victory-music-open','victory-music-pause-open'].map(id=>document.getElementById(id)).filter(Boolean);
  function render(){
    const s=music.state();
    if(title)title.textContent=s.title;
    if(status)status.textContent=s.error||'自分のチームがラウンドに勝利したときに再生します。';
  }
  if(enabled){enabled.checked=preferences.enabled;enabled.addEventListener('change',()=>onChange({enabled:enabled.checked}));}
  if(volume){volume.value=preferences.volume;const label=()=>{if(output)output.textContent=`${Math.round(Number(volume.value)*100)}%`;};label();volume.addEventListener('input',()=>{label();onChange({volume:unit(volume.value,.6)});});}
  function close(){if(dialog?.open)dialog.close();}
  for(const button of openers){
    button.setAttribute('aria-expanded','false');
    button.addEventListener('click',()=>{if(!dialog||dialog.open)return;render();dialog.showModal();button.setAttribute('aria-expanded','true');});
  }
  document.getElementById('victory-music-close')?.addEventListener('click',close);
  dialog?.addEventListener('close',()=>{for(const button of openers)button.setAttribute('aria-expanded','false');});
  // Native modal focus trapping/cancel returns focus to its opener. Do not let
  // Escape or combat keys bubble into the paused game's keyboard handler.
  dialog?.addEventListener('keydown',event=>event.stopPropagation());
  dialog?.addEventListener('click',event=>{if(event.target===dialog)close();});
  render();return {render,close,isOpen:()=>!!dialog?.open};
}
