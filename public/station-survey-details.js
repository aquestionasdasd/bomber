// Observation-derived detail, hand modeled. No Google/third-party imagery is
// embedded. Dimensions are adapted to the existing gameplay envelope.
export function addHirakataSurvey({part,sign}){
 // 2026 north-plaza completion photograph: shallow arched passage fascia.
 for(let i=0;i<28;i++){const x=-26.75+i*.5,y=4.02+.65*Math.sqrt(Math.max(0,1-((x+20)/7)**2));part(x,y,-19.32,.52,.13,.16,'white');}
 sign('北口 / バスのりば','NORTH EXIT · BUS TERMINAL',-20,3.25,-19.35,10,.7,{bg:'#354a50',fg:'#fff3d7',ry:Math.PI});
 // Ground-painted north holding bay, separate from the western general-car loop.
 const road=sign('バ ス 待 機 場','BUS ONLY',29,.075,-49,16,2.8,{bg:'#4d5355',fg:'#eeeae2'});road.rotation.x=-Math.PI/2;
 sign('一般車・送迎','PICK-UP / 公道から進入',-43,1.7,-24,6,.85,{bg:'#eeeae2',fg:'#354a50',ry:Math.PI});
 // Station Hill / Hirakata Mall horizontal dark bands, within the old facade.
 for(const y of[5,10,15]){part(70,y,-66.92,20.8,.65,.12,'dark');part(70,y+.65,-66.87,20.7,.08,.12,'silver');}
 sign('HIRAKATA MALL','枚方モール / 東改札口 2F',70,3.1,-66.78,17,1.05,{bg:'#273039',fg:'#f3e8d6'});
 // Layered glazed T-SITE elevation; surrounding building collision stays intact.
 for(const[y,inset]of[[4,0],[9,1.8],[14,3.6],[19,5.4]]){part(52,y,70.92,35-inset,.36,.15,'white');for(let x=36+inset/2;x<68-inset/2;x+=2.7)part(x,y+2.1,70.88,.085,3.8,.12,'metal');}
 return['north-arched-fascia','north-bus-holding-marking','north-car-wayfinding','hirakata-mall-bands','tsite-layered-glazing'];
}

export function addHashimotoSurvey({box,label,M,parkedBus}){
 // Current official JR station number and observed north-side JR/Keio routing.
 label('JH 28','橋本 / HASHIMOTO',-31.6,7.45,-32.78,2.2,1.7,'#f8f7e8','#39784a').name='Survey / JR JH28';
 label('京王線のりば ↑','KEIO LINE / 南口方面',-20.5,5.1,-52,9,.9,'#3b454b','#eeeade').name='Survey / Keio transfer';
 label('ミウィ橋本 →','2F PEDESTRIAN DECK',-7.5,4.1,-33.85,7,.8,'#3b454b','#eeeade').name='Survey / north deck';
 // Recessed grid ceiling and warm panels on the sheltered Mewe frontage.
 // Every panel remains within an existing roof/wall footprint.
 for(let x=49.4;x<75;x+=2.4){box(x,2.923,-16.7,.045,.025,4.4,M.edge);box(x,2.918,-16.7,.5,.035,.5,M.light);}
 for(const z of[-18.8,-16.4,-14.2])box(62,2.924,z,27,.022,.035,M.edge);
 // Pale fascia jointing and blue glazing horizontal bands seen in north photos.
 for(let y=5.6;y<20.5;y+=.85){box(62,y,-18.49,27.7,.045,.06,M.ivory);box(47.57,y,-39,.06,.045,39.5,M.ivory);}
 // North-side road SV (2024-01): yellow body and red/orange waist, distinct
 // from Hirakata's white/red Keihan buses. Thin cosmetic skins cover the old
 // teal belt without touching its audited collision/roof/mesh transforms.
 const{x,z}=parkedBus;
 for(const side of[-1,1]){
  box(x+side*1.625,1.13,z,.018,.9,11.92,M.busYellow);
  box(x+side*1.64,.99,z,.012,.26,11.94,M.busRed);
  box(x,1.13,z+side*5.97,3.24,.9,.018,M.busYellow);
  box(x,.99,z+side*5.985,3.27,.26,.012,M.busRed);
  // Exterior mirrors stay outside the windscreen, not across the glass.
  box(x+side*1.76,2.72,z+5.45,.32,.065,.065,M.edge);
  box(x+side*1.91,2.52,z+5.46,.18,.46,.15,M.black);
 }
 // Front is +Z, so the bus's left is +X. Two tall leaves per opening.
 for(const dz of[-.8,4.95]){
  box(x+1.66,1.53,z+dz,.025,2.28,1.13,M.edge);
  for(const leaf of[-1,1])box(x+1.678,1.59,z+dz+leaf*.26,.012,1.99,.48,M.glassShade);
 }
 // Front wipers are small trim; headlights/plate remain in front of the paint.
 for(const dx of[-.65,.65])box(x+dx,1.57,z+6.016,.75,.035,.018,M.black);
 return['jr-jh28','keio-transfer-sign','north-deck-sign','mewe-covered-ceiling','mewe-glazing-bands','north-bus-livery-and-doors'];
}
