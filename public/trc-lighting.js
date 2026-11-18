import {TRC_BAKE} from './trc-bake.js';
import {TRC_LIGHTING_CONFIG as config,trcProbeAt} from './trc-lighting-config.js';
import {createStaticLighting} from './static-lighting.js';

export function createTrcLighting(T,world,lights=[]){
 return createStaticLighting(T,world,lights,{config,bake:TRC_BAKE,prefix:'TRC / ',root:new URL('./lightmaps/trc/',import.meta.url),metalName:name=>/steel|aluminium|trim|glass|album/.test(name),probeAt:trcProbeAt});
}
