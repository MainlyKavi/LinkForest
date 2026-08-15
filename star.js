(function(){
  'use strict';

  var root=document.documentElement;
  var themeToggle=document.getElementById('themeToggle');
  var menuBtn=document.getElementById('menuBtn');
  var menuPanel=document.getElementById('menuPanel');
  var menuScrim=document.getElementById('menuScrim');
  var menuCloseBtn=document.getElementById('menuCloseBtn');
  var copyright=document.getElementById('copyrightYear');
  var discoveryNumberEl=document.getElementById('discoveryNumber');
  var discoveryCountLine=document.getElementById('discoveryCountLine');
  var counterError=document.getElementById('counterError');
  var returnLine=document.getElementById('returnLine');
  var starsFoundCount=document.getElementById('starsFoundCount');
  var starsVisual=document.getElementById('starsVisual');
  var secretStar=document.getElementById('secretStar');
  var secretStarReaction=document.getElementById('secretStarReaction');
  var makeStory=document.getElementById('makeStory');
  var remakeStory=document.getElementById('remakeStory');
  var shareStory=document.getElementById('shareStory');
  var saveStory=document.getElementById('saveStory');
  var storyCanvas=document.getElementById('storyCanvas');
  var storyOutput=document.getElementById('storyOutput');
  var storyReaction=document.getElementById('storyReaction');

  var NUMBER_KEY='mainlykavi-star-01-number';
  var COUNT_KEY='mainlykavi-star-01-count';
  var VISITOR_KEY='mainlykavi-star-visitor-id';
  var STAR_KEY='mainlykavi-stars-found-v1';
  var discoveryNumber=null;
  var currentCount=null;
  var currentBlob=null;
  var currentObjectUrl=null;
  var lastDesign=-1;

  if(copyright) copyright.textContent=new Date().getFullYear();

  function safeGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
  function safeSet(key,value){try{localStorage.setItem(key,value)}catch(e){}}

  function loadStars(){
    try{
      var parsed=JSON.parse(safeGet(STAR_KEY)||'[]');
      return Array.isArray(parsed)?parsed.filter(function(id){return typeof id==='string'}):[];
    }catch(e){return []}
  }
  function markFound(id){
    var stars=loadStars();
    if(stars.indexOf(id)===-1){stars.push(id);safeSet(STAR_KEY,JSON.stringify(stars))}
    renderStars(stars);
    return stars;
  }
  function renderStars(stars){
    var found=Math.max(1,stars.length);
    if(starsFoundCount) starsFoundCount.textContent=String(found);
    var slots=Math.max(5,found);
    var glyphs=[];
    for(var i=0;i<slots;i++) glyphs.push(i<found?'★':'☆');
    if(starsVisual) starsVisual.textContent=glyphs.join(' ');
  }
  markFound('01');

  if(window.MainlyKaviStars && typeof window.MainlyKaviStars.markFound==='function'){
    window.MainlyKaviStars.markFound('01');
  }

  function applyTheme(theme){
    root.setAttribute('data-theme',theme);
    if(themeToggle){
      var isLight=theme==='light';
      themeToggle.setAttribute('aria-pressed',String(isLight));
      themeToggle.setAttribute('aria-label',isLight?'Switch to dark mode':'Switch to light mode');
    }
    safeSet('mainlykavi-theme',theme);
  }
  applyTheme(root.getAttribute('data-theme')==='dark'?'dark':'light');
  if(themeToggle) themeToggle.addEventListener('click',function(){applyTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')});

  function openMenu(){
    if(!menuPanel||!menuScrim)return;
    menuPanel.classList.add('open');menuScrim.hidden=false;
    requestAnimationFrame(function(){menuScrim.classList.add('show')});
    menuPanel.setAttribute('aria-hidden','false');menuBtn&&menuBtn.setAttribute('aria-expanded','true');
    document.body.style.overflow='hidden';
  }
  function closeMenu(){
    if(!menuPanel||!menuScrim)return;
    menuPanel.classList.remove('open');menuScrim.classList.remove('show');menuPanel.setAttribute('aria-hidden','true');menuBtn&&menuBtn.setAttribute('aria-expanded','false');document.body.style.overflow='';
    setTimeout(function(){menuScrim.hidden=true},300);
  }
  menuBtn&&menuBtn.addEventListener('click',openMenu);menuCloseBtn&&menuCloseBtn.addEventListener('click',closeMenu);menuScrim&&menuScrim.addEventListener('click',closeMenu);
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&menuPanel&&menuPanel.classList.contains('open'))closeMenu()});

  var starClicks=0;
  secretStar&&secretStar.addEventListener('click',function(){
    starClicks+=1;
    if(starClicks>=5){secretStarReaction.textContent='what are you expecting to happen';secretStarReaction.classList.add('show')}
  });

  function makeVisitorId(){
    var cached=safeGet(VISITOR_KEY);
    if(cached&&/^[A-Za-z0-9_-]{16,96}$/.test(cached))return cached;
    var id='';
    if(window.crypto&&crypto.randomUUID) id=crypto.randomUUID().replace(/-/g,'_');
    else if(window.crypto&&crypto.getRandomValues){
      var bytes=new Uint8Array(24);crypto.getRandomValues(bytes);id=Array.prototype.map.call(bytes,function(n){return n.toString(16).padStart(2,'0')}).join('');
    }else id=String(Date.now())+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    safeSet(VISITOR_KEY,id);return id;
  }

  function renderDiscovery(number,count){
    discoveryNumber=number;currentCount=count;
    if(discoveryNumberEl) discoveryNumberEl.textContent='#'+number;
    if(discoveryCountLine) discoveryCountLine.textContent='apparently at least '+count+' people click random things too.';
    if(counterError){counterError.textContent='';counterError.classList.remove('show')}
  }

  var cachedNumber=Number(safeGet(NUMBER_KEY));
  var cachedCount=Number(safeGet(COUNT_KEY));
  if(Number.isInteger(cachedNumber)&&cachedNumber>0){
    renderDiscovery(cachedNumber,Number.isInteger(cachedCount)&&cachedCount>0?Math.max(cachedCount,cachedNumber):cachedNumber);
    if(returnLine) returnLine.textContent="oh. you're back.";
  }

  fetch('/api/discovery',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({visitorId:makeVisitorId()})
  }).then(function(response){
    return response.json().then(function(data){return {ok:response.ok,status:response.status,data:data}})
  }).then(function(result){
    if(!result.ok) throw result;
    var number=Number(result.data.discoveryNumber);var count=Number(result.data.count);
    if(!Number.isInteger(number)||number<1||!Number.isInteger(count)||count<1) throw result;
    safeSet(NUMBER_KEY,String(number));safeSet(COUNT_KEY,String(count));renderDiscovery(number,count);
  }).catch(function(result){
    if(discoveryNumber)return;
    if(discoveryNumberEl) discoveryNumberEl.textContent='#?';
    if(discoveryCountLine) discoveryCountLine.textContent='the number is hiding for a second.';
    if(counterError){
      var setup=result&&result.status===503;
      counterError.textContent=setup?'the counter is ready in code, but its tiny database still needs connecting.':'could not reach the counter. try again later.';
      counterError.classList.add('show');
    }
  });

  function roundedRect(ctx,x,y,w,h,r){
    var radius=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
  }
  function wrapText(ctx,text,maxWidth){
    var words=text.split(/\s+/);var lines=[];var line='';
    words.forEach(function(word){var test=line?line+' '+word:word;if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test});
    if(line)lines.push(line);return lines;
  }
  function drawLines(ctx,lines,x,y,lineHeight,align){ctx.textAlign=align||'left';lines.forEach(function(line,i){ctx.fillText(line,x,y+i*lineHeight)})}
  function glassPanel(ctx,x,y,w,h,r){
    ctx.save();roundedRect(ctx,x,y,w,h,r);ctx.fillStyle='rgba(255,255,255,.105)';ctx.fill();ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=2;ctx.stroke();
    var g=ctx.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,'rgba(255,255,255,.16)');g.addColorStop(.42,'rgba(255,255,255,.035)');g.addColorStop(1,'rgba(255,255,255,.01)');roundedRect(ctx,x+2,y+2,w-4,h-4,r-2);ctx.fillStyle=g;ctx.fill();ctx.restore();
  }
  function drawBackdrop(ctx,variant){
    var g=ctx.createLinearGradient(0,0,1080,1920);
    if(variant===0){g.addColorStop(0,'#315f91');g.addColorStop(.48,'#173b62');g.addColorStop(1,'#091827')}
    else if(variant===1){g.addColorStop(0,'#1c3554');g.addColorStop(.5,'#0b2038');g.addColorStop(1,'#060e19')}
    else{g.addColorStop(0,'#3d5876');g.addColorStop(.42,'#18314c');g.addColorStop(1,'#09131f')}
    ctx.fillStyle=g;ctx.fillRect(0,0,1080,1920);
    var orb=ctx.createRadialGradient(170,310,0,170,310,430);orb.addColorStop(0,'rgba(191,224,255,.22)');orb.addColorStop(1,'rgba(191,224,255,0)');ctx.fillStyle=orb;ctx.fillRect(0,0,600,760);
    var coral=ctx.createRadialGradient(940,1430,0,940,1430,430);coral.addColorStop(0,'rgba(255,148,102,.18)');coral.addColorStop(1,'rgba(255,148,102,0)');ctx.fillStyle=coral;ctx.fillRect(480,920,600,900);
    for(var i=0;i<220;i++){var a=Math.random()*.035+.012;ctx.fillStyle='rgba(255,255,255,'+a.toFixed(3)+')';var s=Math.random()*2+1;ctx.fillRect(Math.random()*1080,Math.random()*1920,s,s)}
  }
  function drawStory(design){
    var ctx=storyCanvas.getContext('2d');ctx.clearRect(0,0,1080,1920);drawBackdrop(ctx,design);
    ctx.fillStyle='rgba(255,255,255,.96)';ctx.textBaseline='alphabetic';
    var n=discoveryNumber||cachedNumber||'?';
    if(design===0){
      glassPanel(ctx,110,470,860,810,74);ctx.textAlign='center';ctx.font='600 92px Montserrat, Arial, sans-serif';ctx.fillText('★',540,670);ctx.font='600 78px Montserrat, Arial, sans-serif';ctx.fillText('i found it.',540,850);ctx.font='500 42px Montserrat, Arial, sans-serif';ctx.fillStyle='rgba(255,255,255,.76)';ctx.fillText('discovery #'+n,540,950);
    }else if(design===1){
      glassPanel(ctx,92,390,896,980,76);ctx.textAlign='left';ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='600 64px Montserrat, Arial, sans-serif';var lines=wrapText(ctx,'apparently mainlykavi.com has secrets.',740);drawLines(ctx,lines,170,610,84,'left');ctx.font='600 66px Montserrat, Arial, sans-serif';ctx.fillText('★ 01 found',170,910);ctx.font='500 39px Montserrat, Arial, sans-serif';ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillText('discovery #'+n,170,1010);
    }else{
      glassPanel(ctx,96,410,888,950,76);ctx.textAlign='left';ctx.fillStyle='rgba(255,255,255,.96)';ctx.font='600 58px Montserrat, Arial, sans-serif';var funny=wrapText(ctx,"i know something about mainlykavi.com that you don't.",742);drawLines(ctx,funny,168,615,78,'left');ctx.font='600 88px Montserrat, Arial, sans-serif';ctx.fillText('★',168,1000);ctx.font='500 39px Montserrat, Arial, sans-serif';ctx.fillStyle='rgba(255,255,255,.72)';ctx.fillText('discovery #'+n,168,1100);
    }
    ctx.textAlign='center';ctx.font='500 31px Montserrat, Arial, sans-serif';ctx.fillStyle='rgba(255,255,255,.58)';ctx.fillText('mainlykavi.com',540,1748);
  }
  function nextDesign(){var design=Math.floor(Math.random()*3);if(design===lastDesign)design=(design+1+Math.floor(Math.random()*2))%3;lastDesign=design;return design}
  function canvasBlob(){return new Promise(function(resolve){storyCanvas.toBlob(resolve,'image/png',1)})}
  function revokeStoryUrl(){if(currentObjectUrl){URL.revokeObjectURL(currentObjectUrl);currentObjectUrl=null}}
  function generateStory(){
    if(!discoveryNumber&&cachedNumber)discoveryNumber=cachedNumber;
    if(!discoveryNumber){storyReaction.textContent='i need your discovery number first.';return}
    drawStory(nextDesign());storyOutput.classList.add('show');storyReaction.textContent=Math.random()>.5?'okay now gatekeep it.':"don't ruin it for everyone else.";
    revokeStoryUrl();currentBlob=null;
    canvasBlob().then(function(blob){
      if(!blob)return;currentBlob=blob;
      var file=new File([blob],'mainlykavi-discovery-'+discoveryNumber+'.png',{type:'image/png'});
      var canShare=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));
      shareStory.hidden=!canShare;shareStory._storyFile=file;
    });
    storyOutput.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});
  }
  makeStory&&makeStory.addEventListener('click',generateStory);remakeStory&&remakeStory.addEventListener('click',generateStory);
  saveStory&&saveStory.addEventListener('click',function(){
    var save=function(blob){if(!blob)return;revokeStoryUrl();currentObjectUrl=URL.createObjectURL(blob);var a=document.createElement('a');a.href=currentObjectUrl;a.download='mainlykavi-discovery-'+discoveryNumber+'.png';document.body.appendChild(a);a.click();a.remove();setTimeout(revokeStoryUrl,1500)};
    if(currentBlob)save(currentBlob);else canvasBlob().then(save);
  });
  shareStory&&shareStory.addEventListener('click',function(){
    var file=shareStory._storyFile;if(!file||!navigator.share)return;
    navigator.share({files:[file],title:'mainlykavi.com',text:'i found it.'}).catch(function(error){if(error&&error.name!=='AbortError')storyReaction.textContent='share sheet said no. save image still works.'});
  });
  window.addEventListener('pagehide',revokeStoryUrl,{once:true});
})();
