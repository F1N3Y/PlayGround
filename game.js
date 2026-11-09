(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const questList = $('questList');
  const player = { x: 510, y: 510, speed: 190, facing: 1, step: 0 };
  const world = { w: 1180, h: 980 };
  const items = [
    { id:'mint', type:'plant', name:'Wild mint', note:'Cool, crinkly leaves. Smells like summer.', icon:'🌿', x:426, y:387, color:'#72a875', found:false },
    { id:'chamomile', type:'plant', name:'Chamomile', note:'Tiny sunshine flowers, growing by the path.', icon:'🌼', x:605, y:337, color:'#f1d474', found:false },
    { id:'lavender', type:'plant', name:'Wild lavender', note:'A soft purple patch buzzing with bees.', icon:'🪻', x:767, y:467, color:'#a795c7', found:false },
    { id:'wrapper1', type:'litter', name:'A little wrapper', note:'Recycled. The park says thanks.', icon:'♻️', x:453, y:646, found:false },
    { id:'wrapper2', type:'litter', name:'A juice carton', note:'Recycled. One less thing in the grass.', icon:'♻️', x:688, y:650, found:false },
    { id:'milo', type:'friend', name:'Milo the park dog', note:'Milo says hello with a very enthusiastic tail wag.', icon:'🐕', x:832, y:588, found:false }
  ];
  const discovered = [];
  let nearest = null, keys = {}, joystickVector = {x:0,y:0}, destination = null;
  let lastTime = 0, toastTimer, completed = false, journalTab = 'discoveries', soundOn = true;
  let width = 0, height = 0, dpr = 1, scale = 1, camera = {x:0,y:0};
  const rand = (seed) => { let x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width; height = rect.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    // A slightly closer framing on phones keeps discoveries legible.
    scale = Math.min(1.05, Math.max(.72, Math.min(width / 690, height / 560)));
  }
  window.addEventListener('resize', resize); resize();

  function roundedRect(x,y,w,h,r,fill,stroke=null,lw=1) {
    ctx.beginPath(); ctx.roundRect(x,y,w,h,r); if(fill){ctx.fillStyle=fill;ctx.fill();} if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke();}
  }
  function pathShape() {
    ctx.beginPath(); ctx.moveTo(-80,610); ctx.bezierCurveTo(170,580,256,713,445,652); ctx.bezierCurveTo(638,590,608,449,800,451); ctx.bezierCurveTo(997,451,924,329,1250,350);
    ctx.lineWidth=166;ctx.lineCap='round';ctx.strokeStyle='#d9c9a6';ctx.stroke();
    ctx.beginPath();ctx.moveTo(-80,610);ctx.bezierCurveTo(170,580,256,713,445,652);ctx.bezierCurveTo(638,590,608,449,800,451);ctx.bezierCurveTo(997,451,924,329,1250,350);
    ctx.lineWidth=150;ctx.strokeStyle='#e7d8b8';ctx.stroke();
    // soft path-edge flecks
    for(let i=0;i<60;i++){let x=rand(i+44)*1250-30,y=rand(i+95)*980; if(rand(i+101)>.6){ctx.fillStyle='#c9b99155';ctx.beginPath();ctx.ellipse(x,y,rand(i+11)*3+1,2,rand(i+3),0,Math.PI*2);ctx.fill();}}
  }
  function tree(x,y,r,seed=1) {
    ctx.fillStyle='#304a3150';ctx.beginPath();ctx.ellipse(x+7,y+r*.48,r*.94,r*.38,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#705b40';ctx.fillRect(x-5,y-5,10,r+9);
    const colors=['#547b58','#62885e','#739467','#4e7554'];
    for(let i=0;i<7;i++){const a=i*2.399+seed, rr=r*(.25+rand(seed+i)*.42), ox=Math.cos(a)*r*.47,oy=Math.sin(a)*r*.4;ctx.fillStyle=colors[(i+seed)%colors.length];ctx.beginPath();ctx.ellipse(x+ox,y+oy,rr,rr*.77,rand(i+seed)*.5,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#86a171';ctx.beginPath();ctx.ellipse(x-r*.16,y-r*.12,r*.43,r*.31,-.5,Math.PI,Math.PI*1.95);ctx.fill();
    for(let i=0;i<4;i++){ctx.fillStyle='#a5b88088';ctx.beginPath();ctx.arc(x+(rand(seed+i+30)-.5)*r,y+(rand(seed+i+50)-.5)*r*.55,2.2,0,Math.PI*2);ctx.fill();}
  }
  function bush(x,y,r,seed=2) {
    const colors=['#52764f','#66895b','#799664'];
    for(let i=0;i<5;i++){ctx.fillStyle=colors[(i+seed)%3];ctx.beginPath();ctx.arc(x+(rand(seed+i)*r-r/2),y+(rand(seed+i+8)*r*.42-r*.2),r*(.3+rand(seed+i+5)*.15),0,Math.PI*2);ctx.fill();}
  }
  function flower(x,y,color='#e7c86d',size=5,seed=0) {
    ctx.fillStyle='#729064';ctx.beginPath();ctx.ellipse(x-2,y+5,2,5,-.4,0,Math.PI*2);ctx.fill();
    for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x+Math.cos(a)*size*.62,y+Math.sin(a)*size*.62,size*.42,size*.28,a,0,Math.PI*2);ctx.fill();}
    ctx.fillStyle='#bd9860';ctx.beginPath();ctx.arc(x,y,size*.24,0,Math.PI*2);ctx.fill();
  }
  function drawPark() {
    ctx.fillStyle='#a8c394';ctx.fillRect(0,0,world.w,world.h);
    // Sunlit grass patches
    for(let i=0;i<190;i++){const x=rand(i+4)*world.w,y=rand(i+400)*world.h;ctx.fillStyle=i%2?'#c5d2a35a':'#748f6750';ctx.beginPath();ctx.ellipse(x,y,rand(i+70)*18+4,rand(i+91)*8+3,rand(i)*2,0,Math.PI*2);ctx.fill();}
    // pond in the far corner
    ctx.fillStyle='#6d9d91';ctx.beginPath();ctx.ellipse(1025,760,168,108,-.2,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#8db5a3';ctx.beginPath();ctx.ellipse(1025,750,154,91,-.2,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#bdd0b260';ctx.lineWidth=3;for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(1000+i*13,744+i*6,28+i*6,6,0,0,Math.PI*2);ctx.stroke();}
    for(let i=0;i<10;i++){const x=880+i*31,y=692+rand(i+8)*30;ctx.strokeStyle='#598565';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y+21);ctx.quadraticCurveTo(x-3,y+3,x+4,y-8);ctx.stroke();ctx.fillStyle='#688e64';ctx.beginPath();ctx.ellipse(x+5,y+5,8,3,-.6,0,Math.PI*2);ctx.fill();}
    pathShape();
    // playground clearing and little bench
    ctx.fillStyle='#9bb789';ctx.beginPath();ctx.ellipse(205,300,123,88,.2,0,Math.PI*2);ctx.fill();
    roundedRect(155,284,81,12,5,'#8a6748');roundedRect(163,298,8,24,3,'#765c43');roundedRect(221,298,8,24,3,'#765c43');
    // tree canopy layers
    tree(105,155,52,1);tree(337,210,39,4);tree(538,155,47,7);tree(745,200,40,8);tree(1021,191,62,2);tree(1082,435,43,9);tree(1020,575,35,3);tree(935,900,60,11);tree(687,860,48,14);tree(385,870,61,6);tree(144,836,56,12);tree(83,445,41,20);tree(288,515,33,17);tree(909,280,29,18);tree(1125,860,50,5);
    // low shrubs
    bush(328,348,43,7);bush(696,275,37,8);bush(958,416,46,3);bush(335,744,50,9);bush(602,806,48,5);bush(103,695,42,11);bush(872,710,38,7);bush(818,330,31,2);bush(540,258,28,4);
    // background daisies & specks
    for(let i=0;i<105;i++){const x=rand(i+900)*world.w,y=rand(i+990)*world.h;if((x>300&&x<870&&y>300&&y<700)||y<130)continue; if(i%3===0)flower(x,y,i%2?'#f2ebd1':'#e9c989',3.3,i);else{ctx.fillStyle='#e7e5b7';ctx.beginPath();ctx.arc(x,y,1.7,0,Math.PI*2);ctx.fill();}}
    // stepping stones beside the path
    for(let i=0;i<13;i++){let x=130+i*76,y=610+Math.sin(i*.65)*37;ctx.fillStyle='#d3c4a4';ctx.beginPath();ctx.ellipse(x,y,8,4,.2,0,Math.PI*2);ctx.fill();}
  }
  function drawPlant(item) {
    const x=item.x,y=item.y;
    if(item.found){ctx.fillStyle='#5e755038';ctx.beginPath();ctx.ellipse(x,y+5,14,5,0,0,Math.PI*2);ctx.fill();return;}
    ctx.fillStyle='#526e4a55';ctx.beginPath();ctx.ellipse(x,y+9,19,7,0,0,Math.PI*2);ctx.fill();
    if(item.id==='mint'){
      for(let i=0;i<7;i++){let a=i*2.4;ctx.strokeStyle='#668d62';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+4);ctx.lineTo(x+Math.cos(a)*10,y+Math.sin(a)*7-3);ctx.stroke();ctx.fillStyle=i%2?'#6fa270':'#85b277';ctx.beginPath();ctx.ellipse(x+Math.cos(a)*10,y+Math.sin(a)*7-3,6,3,a,0,Math.PI*2);ctx.fill();}
    } else if(item.id==='chamomile'){
      for(let i=0;i<4;i++){const ox=(i%2-.5)*12,oy=(Math.floor(i/2)-.5)*10;flower(x+ox,y+oy,'#fff6dc',5,i);}
    } else {
      for(let i=0;i<5;i++){let ox=(i-2)*5;ctx.strokeStyle='#728b61';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+ox,y+7);ctx.lineTo(x+ox,y-9);ctx.stroke();for(let j=0;j<4;j++){ctx.fillStyle=j%2?'#b8a5d2':'#9180af';ctx.beginPath();ctx.arc(x+ox,y-9+j*3,2.4,0,Math.PI*2);ctx.fill();}}
    }
    if(nearest===item){ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+1,23,17,0,0,Math.PI*2);ctx.stroke();}
  }
  function drawLitter(item){if(item.found)return;ctx.save();ctx.translate(item.x,item.y);ctx.rotate(item.id==='wrapper1'?.26:-.35);roundedRect(-8,-5,15,11,3,item.id==='wrapper1'?'#f5ede1':'#e7bd72','#ffffffaa',1);ctx.fillStyle='#d0c4ae';ctx.fillRect(-6,-2,10,2);if(nearest===item){ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();}ctx.restore();}
  function drawDog(item,t){
    const wag=Math.sin(t*9)*3;ctx.fillStyle='#35402f35';ctx.beginPath();ctx.ellipse(item.x,item.y+12,21,8,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle='#ad7956';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(item.x-15,item.y-2);ctx.quadraticCurveTo(item.x-23,item.y-12+wag,item.x-17,item.y-18+wag);ctx.stroke();
    ctx.fillStyle='#d3a174';ctx.beginPath();ctx.ellipse(item.x,item.y,19,12,-.1,0,Math.PI*2);ctx.fill();ctx.fillStyle='#b9815d';ctx.beginPath();ctx.ellipse(item.x+13,item.y-8,11,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#6e513f';ctx.beginPath();ctx.ellipse(item.x+7,item.y-15,4,8,-.4,0,Math.PI*2);ctx.ellipse(item.x+19,item.y-15,4,8,.4,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#fff4dc';ctx.beginPath();ctx.arc(item.x+17,item.y-9,2,0,Math.PI*2);ctx.fill();ctx.fillStyle='#392f29';ctx.beginPath();ctx.arc(item.x+18,item.y-9,1,0,Math.PI*2);ctx.arc(item.x+23,item.y-3,2,0,Math.PI*2);ctx.fill();
    if(nearest===item){ctx.strokeStyle='#fff9dc';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(item.x,item.y,28,23,0,0,Math.PI*2);ctx.stroke();}
  }
  function drawPerson(t){
    const bob=Math.sin(player.step)*2.1, x=player.x,y=player.y+bob;
    ctx.fillStyle='#34412e45';ctx.beginPath();ctx.ellipse(x,y+15,13,6,0,0,Math.PI*2);ctx.fill();
    // little boots
    ctx.strokeStyle='#5b5144';ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x-4,y+6);ctx.lineTo(x-5+Math.sin(player.step)*2,y+13);ctx.moveTo(x+4,y+6);ctx.lineTo(x+5-Math.sin(player.step)*2,y+13);ctx.stroke();
    // backpack and body
    ctx.fillStyle='#bf795b';ctx.beginPath();ctx.ellipse(x-player.facing*6,y-2,7,10,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f0bd83';ctx.beginPath();ctx.ellipse(x,y-2,9,12,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#e78a69';ctx.beginPath();ctx.moveTo(x-8,y-5);ctx.quadraticCurveTo(x,y+1,x+8,y-5);ctx.lineTo(x+6,y+5);ctx.quadraticCurveTo(x,y+9,x-7,y+4);ctx.closePath();ctx.fill();
    ctx.fillStyle='#e9b786';ctx.beginPath();ctx.arc(x,y-14,8,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#70563f';ctx.beginPath();ctx.ellipse(x-1,y-17,9,5,-.2,Math.PI,Math.PI*2);ctx.fill();ctx.ellipse(x+3,y-17,7,4,.2,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#544d3d';ctx.beginPath();ctx.arc(x+player.facing*3,y-14,1,0,Math.PI*2);ctx.fill();
    if(nearest){ctx.fillStyle='#fff8d8';ctx.font='700 18px sans-serif';ctx.textAlign='center';ctx.fillText('…',x,y-34);}
  }
  const particles=[];
  function sparkle(x,y,color){for(let i=0;i<12;i++){const a=i*Math.PI/6;particles.push({x,y,vx:Math.cos(a)*(35+rand(i+Date.now()%100)*40),vy:Math.sin(a)*(35+rand(i+30)*40),life:.8,max:.8,color});}}
  function draw(t,dt){
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);
    const viewW=width/scale,viewH=height/scale;
    camera.x=Math.max(0,Math.min(world.w-viewW,player.x-viewW/2));camera.y=Math.max(0,Math.min(world.h-viewH,player.y-viewH/2));
    ctx.save();ctx.scale(scale,scale);ctx.translate(-camera.x,-camera.y);
    drawPark();
    // Props sorted by y so they tuck naturally into the scene.
    const actors=[...items.filter(i=>i.type!=='plant'&&i.type!=='litter'),...items.filter(i=>i.type==='plant'),...items.filter(i=>i.type==='litter')].sort((a,b)=>a.y-b.y);
    actors.forEach(i=>i.type==='plant'?drawPlant(i):i.type==='litter'?drawLitter(i):drawDog(i,t));
    drawPerson(t);
    for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;p.life-=dt;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;if(p.life<=0)particles.splice(i,1);}
    ctx.restore();
  }

  function counts(){return {plants:items.filter(i=>i.type==='plant'&&i.found).length,litter:items.filter(i=>i.type==='litter'&&i.found).length,friends:items.filter(i=>i.type==='friend'&&i.found).length};}
  function updateQuest(){
    const c=counts();
    const rows=[['Gather three wild plants',c.plants,3],['Recycle two bits of litter',c.litter,2],['Say hello to Milo',c.friends,1]];
    questList.innerHTML=rows.map(([text,n,total])=>`<div class="quest-item ${n>=total?'done':''}"><span class="quest-check">${n>=total?'✓':''}</span><span class="quest-text">${text}</span><b>${n}/${total}</b></div>`).join('');
    $('journalCount').textContent=discovered.length;
    $('tabDiscoveries').textContent=discovered.length;
    if(c.plants===3&&c.litter===2&&c.friends===1&&!completed){completed=true;$('finishPlants').textContent=c.plants;$('finishLitter').textContent=c.litter;setTimeout(()=>$('completionBackdrop').hidden=false,750);}
  }
  function showToast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
  function refreshNear(){
    nearest=items.filter(i=>!i.found).map(i=>({item:i,d:Math.hypot(i.x-player.x,i.y-player.y)})).filter(a=>a.d<66).sort((a,b)=>a.d-b.d)[0]?.item||null;
    const hint=$('interactionHint'),button=$('actionButton');
    if(nearest){const label=nearest.type==='plant'?'Notice the '+nearest.name.toLowerCase():nearest.type==='litter'?'Pick up the litter':'Say hello to Milo';$('hintText').textContent=label;hint.classList.add('visible');button.disabled=false;$('actionLabel').innerHTML=nearest.type==='plant'?'TAKE A<br>CLOSER LOOK':nearest.type==='litter'?'RECYCLE<br>THIS':'SAY<br>HELLO';}
    else{hint.classList.remove('visible');button.disabled=false;$('actionLabel').innerHTML='LOOK<br>AROUND';}
  }
  function chime(){if(!soundOn)return;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;const ac=new AC(),osc=ac.createOscillator(),gain=ac.createGain();osc.type='sine';osc.frequency.setValueAtTime(660,ac.currentTime);osc.frequency.exponentialRampToValueAtTime(990,ac.currentTime+.12);gain.gain.setValueAtTime(.055,ac.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ac.currentTime+.32);osc.connect(gain);gain.connect(ac.destination);osc.start();osc.stop(ac.currentTime+.33);osc.onended=()=>ac.close();}catch(e){}}
  function interact(){if(!nearest){showToast('Wander a little closer to a plant, a wrapper, or Milo.');return;}const item=nearest;item.found=true;destination=null;player.step+=.5;sparkle(item.x,item.y-5,item.color||'#e9d477');
    if(item.type==='friend'){discovered.push({...item});showToast('Milo’s tail is going a mile a minute!');}
    else if(item.type==='litter'){discovered.push({...item});showToast(item.id==='wrapper1'?'A wrapper, recycled. Nice one!':'Carton recycled. The grass looks happier already.');}
    else{discovered.push({...item});showToast(item.name+' added to your field notes');}
    updateQuest();refreshNear();chime();
  }
  $('actionButton').addEventListener('click',interact);
  $('questToggle').addEventListener('click',()=>{$('questCard').classList.toggle('collapsed');$('questToggle').textContent=$('questCard').classList.contains('collapsed')?'⌄':'⌃';});
  $('journalButton').addEventListener('click',openJournal);
  $('closeModal').addEventListener('click',()=>{$('modalBackdrop').hidden=true;});
  $('modalBackdrop').addEventListener('click',e=>{if(e.target===$('modalBackdrop'))$('modalBackdrop').hidden=true;});
  $('keepExploring').addEventListener('click',()=>{$('completionBackdrop').hidden=true;showToast('There’s always another little thing to notice.');});
  $('soundButton').addEventListener('click',()=>{soundOn=!soundOn;$('soundButton').innerHTML=soundOn?'♫ <span>Sound on</span>':'♫ <span>Sound off</span>';if(soundOn)chime();});
  document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',()=>{journalTab=tab.dataset.tab;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===tab));renderJournal();}));
  function openJournal(){$('modalBackdrop').hidden=false;renderJournal();}
  function renderJournal(){const content=$('journalContent');if(journalTab==='postcards'){content.innerHTML='<div class="empty-note">🌤️<br><br><b>Maplewood, on a sunny morning</b><br>A quiet path, a few wild things, and nowhere else to be.<br><br><span style="color:#a1a995">Postcard tucked into your journal</span></div>';return;}if(!discovered.length){content.innerHTML='<div class="empty-note">Your pages are waiting for little discoveries.<br>Wander over to a plant, a bit of litter, or Milo<br>and tap <b>LOOK AROUND</b> to add a note.</div>';return;}content.innerHTML=discovered.map(i=>`<div class="discovery-row"><div class="discovery-icon">${i.icon}</div><div><b>${i.name}</b><small>${i.note}</small></div></div>`).join('');}

  // Joystick works with touch and mouse; canvas taps set a gentle walk-to destination.
  const joy=$('joystick'),knob=$('joyKnob');let joyPointer=null;
  function moveStick(e){const r=joy.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,max=22,len=Math.hypot(dx,dy),k=len>max?max/len:1;joystickVector={x:dx*k/max,y:dy*k/max};knob.style.transform=`translate(${dx*k}px,${dy*k}px)`;destination=null;}
  joy.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;joy.setPointerCapture(e.pointerId);moveStick(e);});
  joy.addEventListener('pointermove',e=>{if(e.pointerId===joyPointer)moveStick(e);});
  function releaseStick(e){if(e.pointerId!==joyPointer)return;joyPointer=null;joystickVector={x:0,y:0};knob.style.transform='translate(0,0)';}
  joy.addEventListener('pointerup',releaseStick);joy.addEventListener('pointercancel',releaseStick);
  canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;const r=canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top;destination={x:sx/scale+camera.x,y:sy/scale+camera.y};});
  window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d',' '].includes(k))e.preventDefault();keys[k]=true;if(k==='e'||k===' ')interact();if(k==='j')openJournal();});
  window.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;});
  function update(dt){let dx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joystickVector.x,dy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+joystickVector.y;
    if(!dx&&!dy&&destination){dx=destination.x-player.x;dy=destination.y-player.y;const d=Math.hypot(dx,dy);if(d<9)destination=null;else{dx/=d;dy/=d;}}
    const mag=Math.hypot(dx,dy);if(mag>0){dx/=Math.max(1,mag);dy/=Math.max(1,mag);player.x=Math.max(35,Math.min(world.w-35,player.x+dx*player.speed*dt));player.y=Math.max(35,Math.min(world.h-35,player.y+dy*player.speed*dt));player.facing=dx<-.1?-1:dx>.1?1:player.facing;player.step+=dt*10;}
    refreshNear();
  }
  function loop(now){const dt=Math.min(.035,(now-lastTime)/1000||0);lastTime=now;update(dt);draw(now/1000,dt);requestAnimationFrame(loop);}
  updateQuest();requestAnimationFrame(loop);
})();
