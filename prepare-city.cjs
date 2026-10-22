const fs=require('node:fs');
const BBOX={south:35.5888,west:139.3385,north:35.6000,east:139.3520};
const ORIGIN={lat:35.5949,lon:139.34497};
const cos=Math.cos(ORIGIN.lat*Math.PI/180),round=n=>Math.round(n*100)/100;
const project=p=>[round((p.lon-ORIGIN.lon)*111320*cos),round((ORIGIN.lat-p.lat)*111320)];
const bounds={minX:project({lat:0,lon:BBOX.west})[0],maxX:project({lat:0,lon:BBOX.east})[0],minZ:project({lat:BBOX.north,lon:0})[1],maxZ:project({lat:BBOX.south,lon:0})[1]};
function clipPolygon(poly){
  for(const [axis,edge,sign] of [[0,bounds.minX,1],[0,bounds.maxX,-1],[1,bounds.minZ,1],[1,bounds.maxZ,-1]]){
    const next=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ain=(a[axis]-edge)*sign>=0,bin=(b[axis]-edge)*sign>=0;
      if(ain)next.push(a);if(ain!==bin){const t=(edge-a[axis])/(b[axis]-a[axis]);const p=[round(a[0]+(b[0]-a[0])*t),round(a[1]+(b[1]-a[1])*t)];p[axis]=edge;next.push(p);}}
    poly=next;if(!poly.length)break;
  }return poly;
}
function clipLine(points){
  const lines=[];let line=[];
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],d=[b[0]-a[0],b[1]-a[1]];let lo=0,hi=1,okay=true;
    for(const [p,q] of [[-d[0],a[0]-bounds.minX],[d[0],bounds.maxX-a[0]],[-d[1],a[1]-bounds.minZ],[d[1],bounds.maxZ-a[1]]]){
      if(p===0){if(q<0)okay=false;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);
    }
    if(!okay||lo>hi){if(line.length>1)lines.push(line);line=[];continue;}
    const start=[round(a[0]+lo*d[0]),round(a[1]+lo*d[1])],end=[round(a[0]+hi*d[0]),round(a[1]+hi*d[1])];
    if(line.length&&Math.hypot(line.at(-1)[0]-start[0],line.at(-1)[1]-start[1])>.05){lines.push(line);line=[];}
    if(!line.length)line.push(start);line.push(end);
  }if(line.length>1)lines.push(line);return lines;
}
const centroid=p=>({x:round(p.reduce((s,v)=>s+v[0],0)/p.length),z:round(p.reduce((s,v)=>s+v[1],0)/p.length)});
async function main(){
  let raw=JSON.parse(fs.readFileSync('hashimoto-osm-raw.json','utf8'));
  if(process.argv.includes('--extend')){
    const bb=`${BBOX.south},${BBOX.west},${BBOX.north},${BBOX.east}`;
    const q=`[out:json][timeout:90];(way[building](${bb});way[highway](${bb});way[railway](${bb});way[landuse](${bb});way[leisure](${bb});nwr[name~"ミウィ|イオン橋本|アリオ橋本|橋本駅|SING|MOVIX|ミーナ"](${bb}););out tags geom;`;
    const res=await fetch('https://overpass-api.de/api/interpreter?data='+encodeURIComponent(q),{headers:{'User-Agent':'HashimotoProtocolMap/1.0','Accept':'application/json'}});
    if(!res.ok)throw new Error('Overpass '+res.status);raw=await res.json();fs.writeFileSync('hashimoto-osm-raw.json',JSON.stringify(raw));
  }
  const city={origin:ORIGIN,bbox:BBOX,bounds,buildings:[],roads:[],rails:[],areas:[],landmarks:[],stats:{},source:{name:'OpenStreetMap',timestamp:raw.osm3s?.timestamp_osm_base,license:'ODbL 1.0',url:'https://www.openstreetmap.org/copyright',projection:'Local equirectangular metres; +X east, +Z south'}};
  const widths={motorway:20,trunk:17,primary:13,secondary:11,tertiary:9,residential:5.8,unclassified:6,service:3.8,living_street:4.5,pedestrian:7,footway:2.8,path:2.2,steps:2.8,cycleway:2.5,track:3};
  for(const e of raw.elements){const t=e.tags||{};if(e.type!=='way'||!e.geometry?.length)continue;const projected=e.geometry.filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon)).map(project);
    const polygon=()=>{let p=projected;if(p.length>1&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1])p=p.slice(0,-1);return clipPolygon(p);};
    if(t.building&&t.building!=='no'){
      const p=polygon();if(p.length<3)continue;
      const levels=parseFloat(t['building:levels'])||null,explicit=parseFloat(t.height),type=t.building;
      let h=Number.isFinite(explicit)?explicit:levels?levels*(type==='retail'?4:3.15):/house|detached|residential|terrace/.test(type)?6.5:/apartments|office/.test(type)?12:/retail|commercial/.test(type)?13:7.5;
      if(e.id===28665605)h=13;if(e.id===172138436)h=27;if(e.id===58199839)h=32;
      city.buildings.push({id:e.id,name:t.name||'',kind:type,levels,height:round(h),inferredHeight:!Number.isFinite(explicit),layer:parseInt(t.layer)||0,polygon:p});
    }
    if(t.highway&&!['bus_stop','traffic_signals','crossing'].includes(t.highway))for(const points of clipLine(projected))city.roads.push({id:e.id,name:t.name||'',kind:t.highway,width:parseFloat(t.width)||widths[t.highway]||4,points,bridge:t.bridge==='yes',tunnel:t.tunnel==='yes',layer:parseInt(t.layer)||0,surface:t.surface||''});
    if(t.railway&&t.railway!=='abandoned'){
      if(t.railway==='platform'&&projected.length>3){const p=polygon();if(p.length>=3)city.areas.push({id:e.id,kind:'platform',name:t.name||t.ref||'',polygon:p,layer:parseInt(t.layer)||0});}
      else for(const points of clipLine(projected))city.rails.push({id:e.id,name:t.name||'',kind:t.railway,width:1.067,points,bridge:t.bridge==='yes',layer:parseInt(t.layer)||0});
    }
    if((t.landuse||t.leisure||e.id===84880106||t.amenity==='parking')&&projected.length>3){const p=polygon();if(p.length>=3)city.areas.push({id:e.id,kind:t.landuse||t.leisure||t.amenity||'retail',name:t.name||'',polygon:p});}
  }
  // POI coordinates are sourced from OSM; travel points are picked on nearby public paths in map.js.
  const poi=[['north','JR橋本駅 北口',35.59537,139.34492],['mewe','ミウィ橋本',35.59505,139.34561],['aeon','イオン橋本',35.5961,139.34486],['south','京王橋本駅 南口',35.59419,139.34513],['movix','SING / MOVIX橋本',35.5944547,139.3489059],['ario','アリオ橋本',35.59189,139.35015],['linear','リニア駅工事エリア',35.5931,139.3438]];
  for(const [id,name,lat,lon]of poi){const [x,z]=project({lat,lon});city.landmarks.push({id,name,x,z,lat,lon});}
  city.stats={buildings:city.buildings.length,roadSegments:city.roads.length,railSegments:city.rails.length,width:round(bounds.maxX-bounds.minX),depth:round(bounds.maxZ-bounds.minZ),area:round((bounds.maxX-bounds.minX)*(bounds.maxZ-bounds.minZ))};
  fs.writeFileSync('dist/city-data.json',JSON.stringify(city));fs.writeFileSync('dist/city-data.js','// Projected OpenStreetMap database. © OpenStreetMap contributors; ODbL 1.0.\nexport const CITY='+JSON.stringify(city)+';\n');
  fs.writeFileSync('dist/data-license.txt','Hashimoto geographic database\n© OpenStreetMap contributors\nhttps://www.openstreetmap.org/copyright\nOpen Database License 1.0 (ODbL): https://opendatacommons.org/licenses/odbl/1-0/\n\nDownload the complete projected database: ./city-data.json\nSource timestamp: '+city.source.timestamp+'\nProjection: local equirectangular metres around '+ORIGIN.lat+', '+ORIGIN.lon+'; east is +X and south is +Z.\nRoad and building footprints derive from OpenStreetMap. Heights missing from source are estimates; landmark detailing and game objects are original artistic work. This is not a survey or an official station plan.\n');
  console.log(JSON.stringify(city.stats));console.log(JSON.stringify(city.buildings.filter(b=>[28665605,58199839,172138436,1411138800,1411138801].includes(b.id)).map(b=>({id:b.id,name:b.name,...centroid(b.polygon),polygon:b.polygon}))));
}
main().catch(e=>{console.error(e);process.exitCode=1});
