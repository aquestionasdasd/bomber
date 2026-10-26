// Owner-supplied victory tracks. Settings never preview the audio.
export const VICTORY_TRACKS = Object.freeze([
  Object.freeze({id:'sandstorm',src:new URL('./audio/victory-sandstorm.wav',import.meta.url).href,title:'sandstorm',maxSeconds:15}),
  Object.freeze({id:'break-the-dancefloor',src:new URL('./audio/victory-break-the-dancefloor.wav',import.meta.url).href,title:'Break the dancefloor!!',maxSeconds:15}),
]);
export const VICTORY_MUSIC = VICTORY_TRACKS[0];
