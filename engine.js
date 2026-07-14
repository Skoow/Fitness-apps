// ── MOTEUR COMMUN ────────────────────────────────────────────────────────────
// Une seule source de vérité pour les 3 apps (Anthony / Mikael / Myriam).
// Tout ce qui est écrit ICI est le comportement par défaut partagé par les 3.
// Une personne dont le programme a un besoin réel (et un seul) peut le
// redéfinir depuis SON PROPRE index.html via un des "hooks" du CONFIG
// (resolveDayIndex, computeNextWeight, renderWeightRow, extraBadge) —
// le moteur ne connaît alors rien du cas particulier, il délègue simplement.
//
// Chaque index.html fournit un objet CONFIG (voir les 3 dossiers) puis appelle
// startApp(CONFIG).

// Listes de poids partagées par les 3 programmes (mêmes machines/haltères de
// salle). Si une personne avait un jour un équipement différent, sa config
// pourrait fournir CONFIG.weightOptions pour remplacer ces valeurs.
var WEIGHT_OPTIONS_DB=['—','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50'];
var WEIGHT_OPTIONS_MC=['—','4.5','9','11','14','18','23','25','27','32','36','39','41','45','50','52','54','59','64','66','68','73','77','79','82','86','91','93','100','107','113'];

function startApp(CONFIG){

var WOPT=CONFIG.weightOptions||{db:WEIGHT_OPTIONS_DB,mc:WEIGHT_OPTIONS_MC};

// ── ICONS (thème personnel) ──────────────────────────────────────────────────
function mkIcon(n,c,sz){
  sz=sz||52;c=c||'#fff';
  var shapes=CONFIG.icons;
  var s=shapes[n]||shapes.abMachine;
  s=s.split('C').join(c);
  return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 64 64" fill="none">'+s+'</svg>';
}

// ── DATE / SEMAINE (Europe/Paris) ────────────────────────────────────────────
function getParisNow(){
  var ds=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});
  return new Date(ds+'T12:00:00');
}
function getParisDate(){return new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Paris'});}
function getISO(){var d=getParisNow(),f=new Date(d.getFullYear(),0,1),x=Math.floor((d-f)/86400000);return Math.ceil((x+f.getDay()+1)/7);}
function getWK(){var d=getParisNow();return d.getFullYear()+'-W'+getISO();}
function getWeekday(){var d=getParisNow().getDay();return d===0?6:d-1;} // 0=Lun..6=Dim

// ── RÉSOLUTION DU JOUR ACTIF ─────────────────────────────────────────────────
// Comportement par défaut (partagé) : on cherche, dans CONFIG.days, le jour
// dont le champ .dow correspond au jour de semaine (-1 = repos).
// Une personne dont le programme ne suit pas une simple correspondance
// jour->séance (ex : un jour qui affiche par avance la séance du lendemain)
// fournit sa propre fonction CONFIG.resolveDayIndex(weekday) qui remplace
// entièrement ce calcul — cette logique n'existe alors que dans SON fichier.
function defaultResolveDayIndex(weekday){
  for(var i=0;i<CONFIG.days.length;i++){if(CONFIG.days[i].dow===weekday)return i;}
  return -1;
}
function computeDayIndex(weekday){
  return (CONFIG.resolveDayIndex||defaultResolveDayIndex)(weekday);
}

// ── HELPERS ────────────────────────────────────────────────────────────────
function ld(k,d){try{var v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch(e){return d;}}
function sv(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
function K(name){return CONFIG.storagePrefix+name;}

function getReps(ex){
  if(ex.reps)return ex.reps;
  if(ex.cat==='cardio')return CONFIG.cardioRepsText!=null?CONFIG.cardioRepsText:CONFIG.defaultReps;
  if(ex.cat==='warmup')return CONFIG.warmupRepsText!=null?CONFIG.warmupRepsText:CONFIG.defaultReps;
  return CONFIG.defaultReps;
}

function buildBlocks(exs){
  var blocks=[],cur=null;
  for(var i=0;i<exs.length;i++){
    var ex=exs[i];
    if(!ex.pair){
      if(cur){blocks.push(cur);cur=null;}
      blocks.push({type:'solo',exercises:[ex]});
      continue;
    }
    if(cur&&cur.pair===ex.pair&&cur.exercises.length<2){cur.exercises.push(ex);}
    else{if(cur)blocks.push(cur);cur={type:'group',cat:ex.cat,pair:ex.pair,exercises:[ex]};}
  }
  if(cur)blocks.push(cur);
  return blocks.map(function(b){return b.exercises.length===1?{type:'solo',cat:b.cat,exercises:b.exercises}:b;});
}

// Couleur d'icône par catégorie (ex : cardio/échauffement) — pure donnée de
// config ; le moteur ne connaît le nom d'aucune catégorie en particulier.
function exCol(ex,dc){
  if(CONFIG.categoryColors&&CONFIG.categoryColors[ex.cat])return CONFIG.categoryColors[ex.cat];
  return dc;
}

function getWCol(id){
  var w=S.weights[id];
  if(!w||w==='—')return CONFIG.weightColors.none;
  var d=S.weightDates[id];
  if(!d)return CONFIG.weightColors.fresh;
  var days=Math.floor((getParisNow()-new Date(d+'T12:00:00'))/86400000);
  if(days<=7)return CONFIG.weightColors.fresh;
  if(days<=14)return CONFIG.weightColors.aging;
  return CONFIG.weightColors.old;
}

// Exercices qui comptent dans la barre de progression du jour. Les bannières
// (avant/après) n'y participent jamais ; certaines catégories personnelles
// (ex : échauffement) peuvent aussi en être exclues via la config.
function countsTowardProgress(ex){
  if(ex.banner)return false;
  if(CONFIG.excludedFromProgress&&CONFIG.excludedFromProgress.indexOf(ex.cat)>=0)return false;
  return true;
}

// Suggestion de progression : par défaut on propose la valeur suivante dans
// la liste de poids. Une personne peut fournir CONFIG.computeNextWeight pour
// un autre calcul (ex : +2,5 kg fixe).
function defaultComputeNextWeight(w,opts){
  var idx=opts.indexOf(w);
  return (idx>0&&idx<opts.length-1)?opts[idx+1]:'';
}
function computeNextWeight(w,opts){
  return (CONFIG.computeNextWeight||defaultComputeNextWeight)(w,opts);
}

// ── STATE ──────────────────────────────────────────────────────────────────
var TI=computeDayIndex(getWeekday());
var DL=new Date(CONFIG.deadline+'T12:00:00');
var JLEFT=Math.max(0,Math.floor((DL-getParisNow())/86400000));
var WK=getWK();
var S={
  mode:'today',
  openDays:{},
  weights:ld(K('weights'),{}),
  weightDates:ld(K('weightDates'),{}),
  hist:ld(K('hist'),{}),
  done:ld(K('doneWeek'),null)===WK?ld(K('done'),{}):{},
};
S.openDays[TI]=true;
if(ld(K('doneWeek'),null)!==WK){sv(K('doneWeek'),WK);sv(K('done'),{});}

// ── RENDER ─────────────────────────────────────────────────────────────────
function render(){
  var el=document.getElementById('app');
  if(!el)return;
  el.innerHTML=buildHTML();
  bindEvents();
}

function bindEvents(){
  var btnToday=document.getElementById('btn-today');
  var btnWeek=document.getElementById('btn-week');
  if(btnToday)btnToday.addEventListener('click',function(){S.mode='today';S.openDays={};S.openDays[TI]=true;render();});
  if(btnWeek)btnWeek.addEventListener('click',function(){S.mode='week';S.openDays={};render();});
  var dhs=document.querySelectorAll('.dh');
  dhs.forEach(function(dh){
    dh.addEventListener('click',function(){
      var i=parseInt(this.getAttribute('data-i'));
      if(S.openDays[i])delete S.openDays[i];else S.openDays[i]=true;
      render();
    });
  });
  var taps=document.querySelectorAll('.extap');
  taps.forEach(function(tap){
    tap.addEventListener('click',function(){
      var id=this.getAttribute('data-id');
      S.done[id]=!S.done[id];
      sv(K('done'),S.done);
      render();
    });
  });
  var sels=document.querySelectorAll('.wsel');
  sels.forEach(function(sel){
    sel.addEventListener('change',function(e){
      e.stopPropagation();
      var id=this.getAttribute('data-id');
      var val=this.value;
      var prevW=S.weights[id]||'';
      S.weights[id]=val;
      sv(K('weights'),S.weights);
      if(val&&val!=='—'&&val!==prevW){
        S.weightDates[id]=getParisDate();
        sv(K('weightDates'),S.weightDates);
      }
      var hist=S.hist[id]||[];
      var last=hist.length>0?hist[hist.length-1]:null;
      if(last&&last.weight===val){hist[hist.length-1].completedCount=(last.completedCount||1)+1;}
      else{hist.push({weight:val,completedCount:1});if(hist.length>20)hist.shift();}
      S.hist[id]=hist;
      sv(K('hist'),S.hist);
      render();
    });
    sel.addEventListener('click',function(e){e.stopPropagation();});
  });
}

function jleftHTML(){
  if(CONFIG.deadlineZero&&JLEFT===0){
    var z=CONFIG.deadlineZero;
    return '<div class="dlc" style="color:'+z.color+';font-size:'+z.size+';line-height:1.1">'+z.icon+' '+z.title+'</div><div class="dls" style="color:'+z.color+';font-weight:700">'+z.sub+'</div>';
  }
  return '<div class="dlc" style="color:'+(JLEFT<14?CONFIG.jleftUrgentColor:CONFIG.jleftNormalColor)+'">J–'+JLEFT+'</div><div class="dls">jours restants</div>';
}

function programBadgeHTML(){
  if(!CONFIG.programBadge)return'';
  var b=CONFIG.programBadge;
  return '<div class="wbadge" style="background:'+CONFIG.accentColor+'26;border:1.5px solid '+CONFIG.accentColor+'">'
    +'<div class="wl">'+b.label+'</div>'
    +'<div class="wv" style="color:'+CONFIG.accentColor+'">'+b.value+'</div>'
    +'<div class="wr" style="color:'+CONFIG.accentColor+'">'+b.sub+'</div>'
    +'</div>';
}

function buildHTML(){
  var isRest=TI<0;
  var td=isRest?(CONFIG.restDay.fallbackDay?CONFIG.days[0]:null):CONFIG.days[TI];
  var daysHTML;
  if(S.mode==='today'){
    if(isRest){
      daysHTML=CONFIG.restDay.html+(CONFIG.restDay.showNextDayPreview?dayHTML(CONFIG.days[0],0,false):'');
    }else{
      daysHTML=dayHTML(td,TI,true);
    }
  }else{
    daysHTML=CONFIG.days.map(function(d,i){return dayHTML(d,i,false);}).join('');
  }
  var todayBtnStyle=S.mode==='today'
    ?(td?('background:'+td.color+'18;border-color:'+td.color+';color:'+td.color):'background:rgba(107,107,120,.2);border-color:#6b6b78;color:#6b6b78')
    :'';
  var weekBtnStyle=S.mode==='week'?('background:'+CONFIG.accentColor+'26;border-color:'+CONFIG.accentColor+';color:'+CONFIG.accentColor):'';
  return '<div class="hdr">'
    +'<div class="hdr-top">'
    +'<div class="ttl">'+CONFIG.title+' <span style="color:'+CONFIG.genderSymbolColor+'">'+CONFIG.genderSymbol+'</span></div>'
    +programBadgeHTML()
    +'</div>'
    +'<div class="dlbar">'
    +'<div><div class="dll">&#128197; '+CONFIG.deadlineLabel+'</div><div class="dld">'+CONFIG.deadlineDateText+'</div></div>'
    +'<div style="text-align:right">'+jleftHTML()+'</div>'
    +'</div></div>'
    +'<div class="mtog">'
    +'<button class="mbtn" id="btn-today" style="'+todayBtnStyle+'">&#128205; AUJOURD’HUI</button>'
    +'<button class="mbtn" id="btn-week" style="'+weekBtnStyle+'">&#128198; SEMAINE</button>'
    +'</div>'
    +'<div class="days">'+daysHTML+'</div>';
}

function dayHTML(day,idx,forceOpen){
  var open=forceOpen||!!S.openDays[idx];
  var isToday=idx===TI;
  var dc=0,tot=0;
  for(var i=0;i<day.exercises.length;i++){
    var ex_i=day.exercises[i];
    if(!countsTowardProgress(ex_i))continue;
    tot++;
    if(S.done[ex_i.id])dc++;
  }
  var pct=tot>0?Math.round(dc/tot*100):0;
  var fc=pct===100?CONFIG.weightColors.fresh:day.color;
  return '<div class="dc" style="border-color:'+(open?day.color+'50':'#252528')+'">'
    +'<div class="dh" data-i="'+idx+'" style="'+(pct===100?'background:rgba(46,204,113,.08);':'')+'">'
    +'<div class="dbox" style="background:'+day.color+'18">'
    +'<span class="dlbl" style="color:'+day.color+'">'+day.label+'</span>'
    +(isToday?'<span class="tdot" style="background:'+day.color+'"></span>':'')
    +'</div>'
    +'<div class="di">'
    +'<div class="dn" style="color:'+day.color+'">'+day.name+'</div>'
    +'<div class="ds">'+day.sub+'</div>'
    +'<div class="dpb"><div class="dpf" style="width:'+pct+'%;background:'+fc+'"></div></div>'
    +'</div>'
    +'<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">'
    +(pct===100?'<span style="font-size:18px;color:'+CONFIG.weightColors.fresh+'">&#10003;</span>':'<span class="dchev" style="'+(open?'transform:rotate(90deg)':'')+'">&#8250;</span>')
    +'<span class="dcnt" style="color:'+(pct===100?CONFIG.weightColors.fresh:'#6b6b78')+'">'+dc+'/'+tot+'</span>'
    +'</div>'
    +'</div>'
    +(open?'<div class="dbody">'+bodyHTML(day)+'</div>':'')
    +'</div>';
}

function bannerHTML(ex){
  if(ex.bannerStyle==='abs'){
    var t=CONFIG.absBanner;
    return '<div class="wbanner" style="'+t.style+'">'
      +'<div class="wbico">'+t.icon+'</div>'
      +'<div><div class="wbtitle" style="color:'+t.titleColor+'">'+t.title+'</div>'
      +'<div class="wbsub" style="color:'+t.subColor+'">'+ex.name+' · '+getReps(ex)+' — '+ex.tip+'</div>'
      +'</div></div>';
  }
  var iconHTML=CONFIG.bonusBanner.icon||mkIcon(ex.icon,'#a855f7',24);
  return '<div class="exrow"><div class="abanner">'+iconHTML
    +'<span class="abtxt">'+(ex.bannerLabel||CONFIG.bonusBanner.defaultLabel)+' · '+(ex.bannerName||ex.name)+' · '+CONFIG.bonusBanner.repsText+'</span>'
    +'</div></div>';
}

function bodyHTML(day){
  var before=[],main=[],after=[],cardio=[];
  for(var i=0;i<day.exercises.length;i++){
    var ex=day.exercises[i];
    if(ex.cat==='warmup')continue;
    else if(ex.banner==='before')before.push(ex);
    else if(ex.banner==='after')after.push(ex);
    else if(ex.cat==='cardio')cardio.push(ex);
    else main.push(ex);
  }
  var html=before.map(bannerHTML).join('');
  html+=buildBlocks(main).map(function(b){return blkHTML(b,day);}).join('');
  html+=after.map(bannerHTML).join('');
  html+=cardio.map(function(ex){return exHTML(ex,day);}).join('');
  return html;
}

function blkHTML(block,day){
  if(block.type==='solo')return exHTML(block.exercises[0],day);
  var gc=CONFIG.supersetColor(block);
  return '<div class="ssblk" style="border:1px solid '+gc+'">'
    +'<div class="sshdr" style="background:'+gc+'25"><span class="sslbl" style="color:'+gc+'">'+CONFIG.supersetHeaderText+'</span></div>'
    +block.exercises.map(function(ex,i){
      var last=i===block.exercises.length-1;
      return '<div class="sswrap"><div class="ssnum" style="background:'+gc+'">'+(i+1)+'</div>'
        +exHTML(ex,day)+'</div>'
        +(!last?'<div class="ssbetween"><span class="ssarr" style="color:'+gc+'">↓ SANS REPOS, PASSE AU 2ÈME</span></div>':'');
    }).join('')
    +'<div class="ssftr" style="border-top:1px dashed '+gc+'30"><span style="color:'+gc+'">&#9201; '+CONFIG.supersetFooterText+'</span></div>'
    +'</div>';
}

// Rendu d'un contrôle de poids (une charge). Exposé aux hooks de config
// (voir renderWeightRow) pour qu'une personne puisse composer plusieurs
// contrôles (ex : un par côté) sans dupliquer cette logique.
function weightCtrl(key,ec,sideLabel,isDB){
  var w=S.weights[key]||'';
  var hist=S.hist[key]||[];
  var last=hist.length>0?hist[hist.length-1]:null;
  var opts=isDB?WOPT.db:WOPT.mc;
  var hasW=!!(w&&w!=='—');
  var wc=hasW?getWCol(key):CONFIG.weightColors.none;
  var newW=computeNextWeight(w,opts);
  var showSugg=hasW&&newW&&last&&last.completedCount>=3&&last.weight===w;
  var selOpts=opts.map(function(o){return '<option value="'+o+'"'+(o===(w||'—')?' selected':'')+'>'+(o==='—'?'Sélectionner kg':o+' kg')+'</option>';}).join('');
  return '<div class="wrow">'
    +(sideLabel?'<span class="wside" style="color:'+ec+'">'+sideLabel+'</span>':'<span style="font-size:11px;color:'+CONFIG.noSideIconColor+'">&#9878;</span>')
    +'<select class="wsel" data-id="'+key+'" style="color:'+(hasW?wc:CONFIG.noSideIconColor)+';border-color:'+(hasW?wc+'60':'#2a2a30')+'">'+selOpts+'</select>'
    +(hasW?'<span class="wval" style="color:'+wc+';background:'+wc+'18;border-color:'+wc+'40">'+w+' kg</span>':'')
    +'</div>'
    +(showSugg?'<div class="sugg">&#128200; '+(sideLabel?sideLabel+' : ':'')+'Tu tiens '+w+'kg depuis 3 fois &mdash; essaie <strong>'+newW+' kg</strong></div>':'');
}

// Par défaut : un seul contrôle de poids par exercice. Une personne dont
// certains exercices se chargent différemment à gauche/droite fournit
// CONFIG.renderWeightRow(ex, ec, weightCtrl) pour composer plusieurs
// contrôles — cette logique n'existe alors que dans SON fichier.
function defaultRenderWeightRow(ex,ec){
  return weightCtrl(ex.id,ec,'',ex.isDB);
}
function renderWeightRow(ex,ec){
  return (CONFIG.renderWeightRow||defaultRenderWeightRow)(ex,ec,weightCtrl);
}

// Badges additionnels propres à une personne (ex : "Unilatéral" chez
// Anthony, "Bras/Jambe G/D" chez Mikael). Rien par défaut.
function extraBadgeHTML(ex){
  return CONFIG.extraBadge?(CONFIG.extraBadge(ex)||''):'';
}

function exHTML(ex,day){
  var done=!!S.done[ex.id];
  var ec=exCol(ex,day.color);
  var reps=getReps(ex);
  var catB=ex.cat==='assist'?'<span class="bdg ba">🔵 Assistée</span>'
    :ex.cat==='semi'?'<span class="bdg bs">🟡 Semi-guidée</span>'
    :ex.cat==='free'?'<span class="bdg bf">🔴 Libre</span>'
    :ex.cat==='cardio'?'<span class="bdg bc">🏃 Cardio</span>':'';
  var isoB=ex.isIso?'<span class="bdg bi">🎯 Isolation</span>':'';
  var doneB=done?'<span class="bdg bd">✓ Fait</span>':'';
  var repsChip=CONFIG.showRepsChip
    ?'<div style="margin-top:5px"><span style="display:inline-block;padding:4px 12px;border-radius:8px;border:2px solid '+(done?'rgba(46,204,113,.5)':ec+'80')+';background:'+(done?'rgba(46,204,113,.12)':ec+'18')+';color:'+(done?CONFIG.weightColors.fresh:ec)+';font-size:11.5px;font-weight:900;letter-spacing:.3px">'+reps+'</span></div>'
    :'';
  var noWeight=ex.isBW||(CONFIG.noWeightCategories&&CONFIG.noWeightCategories.indexOf(ex.cat)>=0);
  var wRow=noWeight?'':renderWeightRow(ex,ec);
  return '<div class="exrow">'
    +'<div class="extap" data-id="'+ex.id+'" style="background:'+(done?'rgba(46,204,113,.06)':'transparent')+'">'
    +'<div class="exicon" style="background:'+(done?'rgba(46,204,113,.1)':'#111113')+';border-color:'+(done?'rgba(46,204,113,.3)':'#252528')+'">'+mkIcon(ex.icon,done?CONFIG.weightColors.fresh:ec,52)+'</div>'
    +'<div class="excnt">'
    +'<div class="exnm" style="color:'+(done?CONFIG.weightColors.fresh:CONFIG.exerciseNameColor)+'">'+ex.name+'</div>'
    +repsChip
    +'<div class="extip">'+ex.tip+'</div>'
    +'<div class="exbadges">'+catB+isoB+extraBadgeHTML(ex)+doneB+'</div>'
    +'</div>'
    +'<div class="exck" style="background:'+(done?CONFIG.weightColors.fresh:'transparent')+';border-color:'+(done?CONFIG.weightColors.fresh:CONFIG.exckBorderColor)+';color:'+(done?CONFIG.exckDoneColor:'transparent')+'">✓</div>'
    +'</div>'+wRow+'</div>';
}

setInterval(function(){
  var nwk=getWK();
  if(ld(K('doneWeek'),null)!==nwk){S.done={};sv(K('doneWeek'),nwk);sv(K('done'),{});render();}
},300000);

window.addEventListener('DOMContentLoaded',function(){render();});

}
