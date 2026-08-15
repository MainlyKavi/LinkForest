(function(){
  'use strict';

  var root=document.documentElement;
  var body=document.body;
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
  var secretStar=document.getElementById('secretStar');
  var secretStarReaction=document.getElementById('secretStarReaction');
  var poemSection=document.getElementById('poemSection');
  var poemShell=document.getElementById('poemShell');
  var evidenceSection=document.getElementById('evidenceSection');
  var makeStory=document.getElementById('makeStory');
  var remakeStory=document.getElementById('remakeStory');
  var shareStory=document.getElementById('shareStory');
  var saveStory=document.getElementById('saveStory');
  var storyCanvas=document.getElementById('storyCanvas');
  var storyOutput=document.getElementById('storyOutput');
  var storyReaction=document.getElementById('storyReaction');
  var reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');

  var NUMBER_KEY='mainlykavi-star-01-number';
  var COUNT_KEY='mainlykavi-star-01-count';
  var VISITOR_KEY='mainlykavi-star-visitor-id';
  var STAR_KEY='mainlykavi-stars-found-v1';
  var discoveryNumber=null;
  var currentCount=null;
  var currentBlob=null;
  var currentObjectUrl=null;
  var lastDesign=-1;
  var raf=0;

  if(copyright)copyright.textContent=new Date().getFullYear();

  function safeGet(key){try{return localStorage.getItem(key)}catch(e){return null}}
  function safeSet(key,value){try{localStorage.setItem(key,value)}catch(e){}}

  function markFound(id){
    var stars=[];
    try{
      var parsed=JSON.parse(safeGet(STAR_KEY)||'[]');
      if(Array.isArray(parsed))stars=parsed.filter(function(item){return typeof item==='string'});
    }catch(e){}
    if(stars.indexOf(id)===-1){stars.push(id);safeSet(STAR_KEY,JSON.stringify(stars))}
    if(window.MainlyKaviStars&&typeof window.MainlyKaviStars.markFound==='function')window.MainlyKaviStars.markFound(id);
  }
  markFound('01');

  function applyTheme(theme){
    root.setAttribute('data-theme',theme);
    if(themeToggle){
      var isLight=theme==='light';
      themeToggle.setAttribute('aria-pressed',String(isLight));
      themeToggle.setAttribute('aria-label',isLight?'Switch to dark mode':'Switch to light mode');
    }
    safeSet('mainlykavi-theme',theme);
  }
  applyTheme(root.getAttribute('data-theme')==='light'?'light':'dark');
  if(themeToggle)themeToggle.addEventListener('click',function(){applyTheme(root.getAttribute('data-theme')==='dark'?'light':'dark')});

  function openMenu(){
    if(!menuPanel||!menuScrim)return;
    menuPanel.classList.add('open');
    menuScrim.hidden=false;
    requestAnimationFrame(function(){menuScrim.classList.add('show')});
    menuPanel.setAttribute('aria-hidden','false');
    if(menuBtn)menuBtn.setAttribute('aria-expanded','true');
    body.style.overflow='hidden';
  }
  function closeMenu(){
    if(!menuPanel||!menuScrim)return;
    menuPanel.classList.remove('open');
    menuScrim.classList.remove('show');
    menuPanel.setAttribute('aria-hidden','true');
    if(menuBtn)menuBtn.setAttribute('aria-expanded','false');
    body.style.overflow='';
    setTimeout(function(){menuScrim.hidden=true},300);
  }
  if(menuBtn)menuBtn.addEventListener('click',openMenu);
  if(menuCloseBtn)menuCloseBtn.addEventListener('click',closeMenu);
  if(menuScrim)menuScrim.addEventListener('click',closeMenu);
  document.addEventListener('keydown',function(event){if(event.key==='Escape'&&menuPanel&&menuPanel.classList.contains('open'))closeMenu()});

  function updateNavState(event){
    if(window.scrollY>42){body.classList.add('has-scrolled');body.classList.remove('nav-awake');return}
    body.classList.remove('has-scrolled');
    if(event&&event.clientY<125)body.classList.add('nav-awake');
    else body.classList.remove('nav-awake');
  }
  window.addEventListener('pointermove',updateNavState,{passive:true});
  window.addEventListener('scroll',function(){updateNavState();scheduleAtmosphere()},{passive:true});
  updateNavState();

  var starClicks=0;
  var reactionTimer=0;
  function reactToStar(message){
    if(!secretStarReaction)return;
    clearTimeout(reactionTimer);
    secretStarReaction.textContent=message;
    secretStarReaction.classList.add('show');
    reactionTimer=setTimeout(function(){secretStarReaction.classList.remove('show')},2600);
  }
  if(secretStar)secretStar.addEventListener('click',function(){
    starClicks+=1;
    if(starClicks===3){
      secretStar.classList.add('is-tweaked');
      setTimeout(function(){secretStar.classList.remove('is-tweaked')},560);
    }else if(starClicks===5){
      reactToStar('what are you expecting to happen');
    }else if(starClicks===8){
      reactToStar('seriously');
    }else if(starClicks===12){
      reactToStar('go scroll 😭');
    }
  });

  function makeVisitorId(){
    var cached=safeGet(VISITOR_KEY);
    if(cached&&/^[A-Za-z0-9_-]{16,96}$/.test(cached))return cached;
    var id='';
    if(window.crypto&&crypto.randomUUID)id=crypto.randomUUID().replace(/-/g,'_');
    else if(window.crypto&&crypto.getRandomValues){
      var bytes=new Uint8Array(24);crypto.getRandomValues(bytes);
      id=Array.prototype.map.call(bytes,function(n){return n.toString(16).padStart(2,'0')}).join('');
    }else id=String(Date.now())+'_'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
    safeSet(VISITOR_KEY,id);
    return id;
  }

  function renderDiscovery(number,count){
    discoveryNumber=number;
    currentCount=count;
    if(discoveryNumberEl){
      discoveryNumberEl.textContent='#'+number;
      discoveryNumberEl.classList.remove('is-loading');
      requestAnimationFrame(function(){discoveryNumberEl.classList.add('is-ready')});
    }
    if(discoveryCountLine)discoveryCountLine.textContent='apparently '+count+' people click random things too.';
    if(counterError){counterError.textContent='';counterError.classList.remove('show')}
  }

  var cachedNumber=Number(safeGet(NUMBER_KEY));
  var cachedCount=Number(safeGet(COUNT_KEY));
  if(Number.isInteger(cachedNumber)&&cachedNumber>0){
    renderDiscovery(cachedNumber,Number.isInteger(cachedCount)&&cachedCount>0?Math.max(cachedCount,cachedNumber):cachedNumber);
    if(returnLine)returnLine.textContent="oh. you're back.";
  }

  fetch('/api/discovery',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({visitorId:makeVisitorId()})
  }).then(function(response){
    return response.json().then(function(data){return {ok:response.ok,status:response.status,data:data}})
  }).then(function(result){
    if(!result.ok)throw result;
    var number=Number(result.data.discoveryNumber);
    var count=Number(result.data.count);
    if(!Number.isInteger(number)||number<1||!Number.isInteger(count)||count<1)throw result;
    safeSet(NUMBER_KEY,String(number));
    safeSet(COUNT_KEY,String(count));
    renderDiscovery(number,count);
  }).catch(function(result){
    if(discoveryNumber)return;
    if(discoveryNumberEl){
      discoveryNumberEl.textContent='#?';
      discoveryNumberEl.classList.remove('is-loading');
      discoveryNumberEl.classList.add('is-ready');
    }
    if(discoveryCountLine)discoveryCountLine.textContent='the number is hiding for a second.';
    if(counterError){
      var setup=result&&result.status===503;
      counterError.textContent=setup?'the counter is ready. its tiny database still needs connecting.':'could not reach the counter. try again later.';
      counterError.classList.add('show');
    }
  });

  function updateAtmosphere(){
    raf=0;
    if(reducedMotion.matches)return;
    var doc=document.documentElement;
    var maxScroll=Math.max(1,doc.scrollHeight-window.innerHeight);
    var progress=Math.max(0,Math.min(1,window.scrollY/maxScroll));
    var shift=(progress-.5)*22;
    root.style.setProperty('--star-bg-shift',shift.toFixed(2)+'px');

    var overlay=.66;
    if(poemSection){
      var rect=poemSection.getBoundingClientRect();
      var poemCenter=rect.top+rect.height*.5;
      var viewportCenter=window.innerHeight*.5;
      var distance=Math.abs(poemCenter-viewportCenter);
      var focus=Math.max(0,1-distance/(window.innerHeight*1.45));
      overlay+=focus*.18;
    }
    if(progress>.82)overlay-=((progress-.82)/.18)*.07;
    overlay=Math.max(.60,Math.min(.84,overlay));
    root.style.setProperty('--star-overlay-opacity',overlay.toFixed(3));

    if(poemShell&&poemSection){
      var poemRect=poemSection.getBoundingClientRect();
      var local=Math.max(-1,Math.min(1,(poemRect.top+poemRect.height*.5-window.innerHeight*.5)/window.innerHeight));
      poemShell.style.setProperty('--poem-shift',(local*-7).toFixed(2)+'px');
    }
  }
  function scheduleAtmosphere(){if(!raf)raf=requestAnimationFrame(updateAtmosphere)}
  window.addEventListener('resize',scheduleAtmosphere,{passive:true});
  scheduleAtmosphere();

  function roundedRect(ctx,x,y,w,h,r){
    var radius=Math.min(r,w/2,h/2);
    ctx.beginPath();ctx.moveTo(x+radius,y);ctx.arcTo(x+w,y,x+w,y+h,radius);ctx.arcTo(x+w,y+h,x,y+h,radius);ctx.arcTo(x,y+h,x,y,radius);ctx.arcTo(x,y,x+w,y,radius);ctx.closePath();
  }
  function wrapText(ctx,text,maxWidth){
    var words=text.split(/\s+/),lines=[],line='';
    words.forEach(function(word){
      var test=line?line+' '+word:word;
      if(ctx.measureText(test).width>maxWidth&&line){lines.push(line);line=word}else line=test;
    });
    if(line)lines.push(line);
    return lines;
  }
  function drawLines(ctx,lines,x,y,lineHeight,align){
    ctx.textAlign=align||'left';
    lines.forEach(function(line,i){ctx.fillText(line,x,y+i*lineHeight)});
  }
  function glassPanel(ctx,x,y,w,h,r){
    ctx.save();
    roundedRect(ctx,x,y,w,h,r);
    ctx.fillStyle='rgba(255,255,255,.095)';
    ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.31)';
    ctx.lineWidth=2;
    ctx.stroke();
    var g=ctx.createLinearGradient(x,y,x+w,y+h);
    g.addColorStop(0,'rgba(255,255,255,.15)');
    g.addColorStop(.42,'rgba(255,255,255,.028)');
    g.addColorStop(1,'rgba(255,255,255,.008)');
    roundedRect(ctx,x+2,y+2,w-4,h-4,r-2);
    ctx.fillStyle=g;
    ctx.fill();
    ctx.restore();
  }
  function drawBackdrop(ctx,variant){
    var g=ctx.createLinearGradient(0,0,1080,1920);
    if(variant===0){g.addColorStop(0,'#2c4d6c');g.addColorStop(.48,'#152f49');g.addColorStop(1,'#090f17')}
    else if(variant===1){g.addColorStop(0,'#17283b');g.addColorStop(.5,'#0b1927');g.addColorStop(1,'#060a10')}
    else{g.addColorStop(0,'#32485c');g.addColorStop(.42,'#17293a');g.addColorStop(1,'#090e15')}
    ctx.fillStyle=g;ctx.fillRect(0,0,1080,1920);
    var glow=ctx.createRadialGradient(185,310,0,185,310,430);
    glow.addColorStop(0,'rgba(210,228,245,.16)');glow.addColorStop(1,'rgba(210,228,245,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,650,780);
    for(var i=0;i<180;i++){
      var a=Math.random()*.026+.009;
      ctx.fillStyle='rgba(255,255,255,'+a.toFixed(3)+')';
      var s=Math.random()*1.8+1;
      ctx.fillRect(Math.random()*1080,Math.random()*1920,s,s);
    }
  }
  function drawStory(design){
    var ctx=storyCanvas.getContext('2d');
    ctx.clearRect(0,0,1080,1920);
    drawBackdrop(ctx,design);
    ctx.textBaseline='alphabetic';
    var n=discoveryNumber||cachedNumber||'?';

    if(design===0){
      glassPanel(ctx,112,490,856,760,72);
      ctx.textAlign='center';
      ctx.fillStyle='rgba(255,255,255,.96)';
      ctx.font='600 84px Montserrat, Arial, sans-serif';
      ctx.fillText('★',540,682);
      ctx.font='600 78px Montserrat, Arial, sans-serif';
      ctx.fillText('i found it.',540,862);
      ctx.font='500 40px Montserrat, Arial, sans-serif';
      ctx.fillStyle='rgba(255,255,255,.72)';
      ctx.fillText('discovery #'+n,540,962);
    }else if(design===1){
      glassPanel(ctx,96,430,888,900,74);
      ctx.textAlign='left';
      ctx.fillStyle='rgba(255,255,255,.96)';
      ctx.font='600 72px Montserrat, Arial, sans-serif';
      ctx.fillText('★ 01',166,642);
      ctx.font='600 56px Montserrat, Arial, sans-serif';
      var lines=wrapText(ctx,"apparently i wasn't supposed to see this.",748);
      drawLines(ctx,lines,166,808,76,'left');
      ctx.font='500 38px Montserrat, Arial, sans-serif';
      ctx.fillStyle='rgba(255,255,255,.70)';
      ctx.fillText('discovery #'+n,166,1110);
    }else{
      glassPanel(ctx,96,440,888,880,74);
      ctx.textAlign='left';
      ctx.fillStyle='rgba(255,255,255,.96)';
      ctx.font='600 61px Montserrat, Arial, sans-serif';
      var funny=wrapText(ctx,"i know something you don't.",740);
      drawLines(ctx,funny,166,680,82,'left');
      ctx.font='500 38px Montserrat, Arial, sans-serif';
      ctx.fillStyle='rgba(255,255,255,.70)';
      ctx.fillText('discovery #'+n,166,1045);
    }

    ctx.textAlign='center';
    ctx.font='500 31px Montserrat, Arial, sans-serif';
    ctx.fillStyle='rgba(255,255,255,.56)';
    ctx.fillText('mainlykavi.com',540,1748);
  }
  function nextDesign(){
    var design=Math.floor(Math.random()*3);
    if(design===lastDesign)design=(design+1+Math.floor(Math.random()*2))%3;
    lastDesign=design;
    return design;
  }
  function canvasBlob(){return new Promise(function(resolve){storyCanvas.toBlob(resolve,'image/png',1)})}
  function revokeStoryUrl(){if(currentObjectUrl){URL.revokeObjectURL(currentObjectUrl);currentObjectUrl=null}}
  function generateStory(){
    if(!discoveryNumber&&cachedNumber)discoveryNumber=cachedNumber;
    if(!discoveryNumber){storyReaction.textContent='i need your discovery number first.';return}
    drawStory(nextDesign());
    storyOutput.classList.add('show');
    if(evidenceSection)evidenceSection.classList.add('has-story');
    storyReaction.textContent=Math.random()>.5?'okay now gatekeep it.':"don't ruin it for everyone else.";
    revokeStoryUrl();
    currentBlob=null;
    canvasBlob().then(function(blob){
      if(!blob)return;
      currentBlob=blob;
      var file=new File([blob],'mainlykavi-discovery-'+discoveryNumber+'.png',{type:'image/png'});
      var canShare=!!(navigator.share&&navigator.canShare&&navigator.canShare({files:[file]}));
      shareStory.hidden=!canShare;
      shareStory._storyFile=file;
    });
    storyOutput.scrollIntoView({behavior:reducedMotion.matches?'auto':'smooth',block:'center'});
  }

  if(makeStory)makeStory.addEventListener('click',generateStory);
  if(remakeStory)remakeStory.addEventListener('click',generateStory);
  if(saveStory)saveStory.addEventListener('click',function(){
    var save=function(blob){
      if(!blob)return;
      revokeStoryUrl();
      currentObjectUrl=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=currentObjectUrl;
      a.download='mainlykavi-discovery-'+discoveryNumber+'.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(revokeStoryUrl,1500);
    };
    if(currentBlob)save(currentBlob);else canvasBlob().then(save);
  });
  if(shareStory)shareStory.addEventListener('click',function(){
    var file=shareStory._storyFile;
    if(!file||!navigator.share)return;
    navigator.share({files:[file],title:'mainlykavi.com',text:'i found it.'}).catch(function(error){
      if(error&&error.name!=='AbortError')storyReaction.textContent='share sheet said no. save image still works.';
    });
  });

  window.addEventListener('pagehide',function(){
    revokeStoryUrl();
    if(raf)cancelAnimationFrame(raf);
  },{once:true});
})();
