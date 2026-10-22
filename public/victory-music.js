import { VICTORY_MUSIC } from './victory-music-config.js';

const unit=(value,fallback)=>Number.isFinite(Number(value))?Math.min(1,Math.max(0,Number(value))):fallback;

// Separate from weapon/footstep audio. Selecting a track never starts playback.
export function createVictoryMusic({config=VICTORY_MUSIC,createAudio=()=>new Audio(),urls=globalThis.URL,schedule=setTimeout,cancel=clearTimeout,onChange=()=>{}}={}){
  let local=null,current=null,timer=null,disposed=false,error='';
  let gate={enabled:true,soundEnabled:true,masterVolume:.45,musicVolume:.6,hidden:false};
  const seen=new Set();
  const track=()=>local||config;
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
    if(!won||!audible||!canPlay()||!track().src)return false;
    let media;
    try{
      media=createAudio();current=media;media.preload='none';media.loop=false;media.volume=gate.masterVolume*gate.musicVolume;media.src=track().src;
      const fail=()=>{if(current!==media)return;stop();error='音源を再生できません。形式を確認し、別の音源を選んでください。';onChange();};
      media.onerror=fail;media.onended=()=>{if(current===media)stop();};
      timer=schedule(()=>{if(current===media)stop();},Math.min(30,Math.max(1,Number(config.maxSeconds)||15))*1000);
      const attempt=media.play();attempt?.catch(fail);return true;
    }catch{if(current===media)stop();error='BGMを開始できませんでした。次の勝利時に再試行します。';onChange();return false;}
  }
  function selectFile(file){
    if(disposed||!file)return false;
    if(!(file.size>0)||file.size>40*1024*1024||!(file.type?.startsWith('audio/')||!file.type&&/\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(file.name||''))){
      error='40MB以下の音声ファイルを選んでください。';onChange();return false;
    }
    let src;try{src=urls.createObjectURL(file);}catch{error='このブラウザーでは音源を選択できません。';onChange();return false;}
    stop();if(local)urls.revokeObjectURL(local.src);local={src,title:file.name};error='';onChange();return true;
  }
  function clearFile(){stop();if(local)urls.revokeObjectURL(local.src);local=null;error='';onChange();}
  function state(){return {configured:!!track().src,title:track().title||'未設定',local:!!local,error};}
  function dispose(){if(disposed)return;reset();if(local)urls.revokeObjectURL(local.src);local=null;disposed=true;}
  return {result,stop,reset,setGate,selectFile,clearFile,state,dispose};
}

export function bindVictoryMusicSettings({document,music,preferences,onChange}){
  const enabled=document.getElementById('victory-music-enabled'),volume=document.getElementById('victory-music-volume'),output=document.getElementById('victory-music-value');
  const file=document.getElementById('victory-music-file'),clear=document.getElementById('victory-music-clear'),status=document.getElementById('victory-music-status');
  function render(){const s=music.state();if(status)status.textContent=s.error||(s.configured?`${s.title}${s.local?'（このページを閉じるまで）':''}`:'音源は未設定です。後から追加できます。');if(clear)clear.disabled=!s.local;}
  if(enabled){enabled.checked=preferences.enabled;enabled.addEventListener('change',()=>onChange({enabled:enabled.checked}));}
  if(volume){volume.value=preferences.volume;const label=()=>{if(output)output.textContent=`${Math.round(Number(volume.value)*100)}%`;};label();volume.addEventListener('input',()=>{label();onChange({volume:unit(volume.value,.6)});});}
  file?.addEventListener('change',()=>{if(file.files?.[0])music.selectFile(file.files[0]);file.value='';render();});
  clear?.addEventListener('click',()=>{music.clearFile();render();});render();return {render};
}
