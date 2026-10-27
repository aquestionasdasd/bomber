// Linear-light authoring configuration shared by the exporter and asset signature.
export const TRC_LIGHTING_CONFIG={version:2,size:4096,aoSize:4096,padding:4,density:16,
 samples:256,bounces:6,encodingScale:.25,diffuseIntensity:2.4,aoIntensity:.18,reflectionIntensity:.18,
 world:{color:[.19,.26,.34],strength:.38},sun:{energy:1.5,angle:.08,rotation:[.3,-.45,-.6]},
 probes:[{id:'a',position:[-25,2.4,21]},{id:'mid',position:[1,4.8,-15]},{id:'b',position:[33,2.4,-24]},{id:'basement',position:[49,-1.6,-7]},{id:'outside',position:[0,2.4,63]}]
};
export function trcProbeAt(x,y,z){return y<-.3?'basement':z>42?'outside':x< -14?'a':x>14?'b':'mid';}
