// Owner-supplied victory tracks. Settings never preview the audio.
export const VICTORY_TRACKS = Object.freeze([
  Object.freeze({id:'bd3do',src:new URL('./audio/victory-bd3do.mp3',import.meta.url).href,title:'BD3DO 勝利BGM',maxSeconds:15}),
  Object.freeze({id:'sandstorm',src:new URL('./audio/victory-sandstorm.wav',import.meta.url).href,title:'sandstorm',maxSeconds:15}),
  Object.freeze({id:'break-the-dancefloor',src:new URL('./audio/victory-break-the-dancefloor.wav',import.meta.url).href,title:'Break the dancefloor!!',maxSeconds:15}),
]);
export const VICTORY_MUSIC = VICTORY_TRACKS[0];
