// ── MOTEUR COMMUN ────────────────────────────────────────────────────────────
// Une seule source de vérité pour les 3 apps (Anthony / Mikael / Myriam).
// Tout ce qui est écrit ICI est le comportement par défaut partagé par les 3.
// Une personne dont le programme a un besoin réel (et un seul) peut le
// redéfinir depuis SON PROPRE index.html via un des "hooks" du CONFIG
// (resolveDayIndex, renderWeightRow, extraBadge) — le moteur ne connaît
// alors rien du cas particulier, il délègue simplement.
//
// Chaque index.html fournit un objet CONFIG (voir les 3 dossiers) puis appelle
// startApp(CONFIG).

// Listes de poids partagées par les 3 programmes (mêmes machines/haltères de
// salle). Si une personne avait un jour un équipement différent, sa config
// pourrait fournir CONFIG.weightOptions pour remplacer ces valeurs.
var WEIGHT_OPTIONS_DB=['—','2','4','6','8','10','12','14','16','18','20','22','24','26','28','30','32','34','36','38','40','42','44','46','48','50'];
var WEIGHT_OPTIONS_MC=['—','4.5','9','11','14','18','23','25','27','32','36','39','41','45','50','52','54','59','64','66','68','73','77','79','82','86','91','93','100','107','113'];

// Numéro de version AFFICHÉ dans l'app (pied de page, sert aussi de bouton
// Import/Export). C'est purement cosmétique : on le fixe librement à la
// valeur qu'on veut montrer — ici 1.5, car depuis cette version il n'y a eu
// que des petits ajustements, pas de gros changement.
// ATTENTION : ce numéro affiché est INDÉPENDANT du jeton de cache "?v=..."
// des balises <script src="../engine.js?v=..."> dans les 3 index.html. Ce
// jeton-là, lui, doit être une valeur NEUVE et jamais réutilisée à chaque
// modif de engine.js (sinon le navigateur ressert l'ancien fichier en
// cache) — on utilise donc un compteur de build "b1, b2, b3..." qui n'a
// rien à voir avec le numéro affiché (réutiliser "1.5" comme jeton
// resservirait le vieux engine.js déjà mis en cache sous ?v=1.5).
var ENGINE_VERSION='1.5';

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

// ── STATS QUOTIDIENNES ───────────────────────────────────────────────────────
// Une photo est prise une fois par jour. Modèle de note : L'ASSIDUITÉ EST LA
// BASE, LA PROGRESSION DES CHARGES EST UN BONUS QUI S'AJOUTE (jamais un
// malus). But : suivre son programme est ce qui compte d'abord ; ne pas
// (encore) monter ses charges ne doit PAS faire chuter la note, mais en
// monter récompense et peut rattraper une séance manquée.
// - Assiduité (0-100, base) : exercices cochés / attendus SUR LES JOURS DÉJÀ
//   PASSÉS cette semaine (mercredi ne compte pas encore un lundi, sinon la
//   note retombe à chaque début de semaine). Chacun a une MARGE de séances
//   ratables sans pénalité (CONFIG.statsTarget.assiduityAllowedMisses) :
//   tant qu'on reste dans sa marge -> 100 %. Au-delà, la note descend
//   proportionnellement aux exercices ratés EN TROP. Plafonnée à 100 :
//   dépasser 100 % ne vient QUE du bonus de charges.
// - Bonus charges (0..weightBonusMax, ajouté) : selon la part d'exercices
//   dont le poids a monté depuis weightLookbackDays jours, rapportée à un
//   objectif perso (weightProgressTargetPct = part de hausses donnant le
//   bonus max). 0 si pas de recul ou pas de hausse — jamais négatif.
// Score du jour = assiduité + bonus. Tout est perso (config), le moteur ne
// connaît aucun chiffre en dur. Rien n'est recalculé pour le passé ni
// supprimé : tout l'historique est gardé.
var WEIGHT_PROGRESS_LOOKBACK_DAYS_DEFAULT=14;
var WEIGHT_PROGRESS_TARGET_PCT_DEFAULT=25;
var ASSIDUITY_ALLOWED_MISSES_DEFAULT=3;
var WEIGHT_BONUS_MAX_DEFAULT=25;

function statsTarget(name,dflt){
  return (CONFIG.statsTarget&&CONFIG.statsTarget[name]!=null)?CONFIG.statsTarget[name]:dflt;
}

// Nombre total d'exercices comptabilisables sur TOUTE la semaine (tous les
// jours du programme), pour convertir un nombre d'exercices "ratables" en
// pourcentage — reste correct même si le programme change de taille.
function computeWeekTotalCountable(){
  var tot=0;
  for(var i=0;i<CONFIG.days.length;i++){
    var day=CONFIG.days[i];
    for(var j=0;j<day.exercises.length;j++){
      if(countsTowardProgress(day.exercises[j]))tot++;
    }
  }
  return tot;
}

// Compte, sur les jours DÉJÀ passés cette semaine, combien d'exercices sont
// attendus et combien sont faits (bannières/échauffements exclus, comme la
// barre de progression). Renvoie {done,total}.
function computeLiveCounts(){
  var weekday=getWeekday();
  var expectedIdx={};
  for(var w=0;w<=weekday;w++){
    var idx=computeDayIndex(w);
    if(idx>=0)expectedIdx[idx]=true;
  }
  var tot=0,dc=0;
  for(var idxKey in expectedIdx){
    var day=CONFIG.days[idxKey];
    for(var j=0;j<day.exercises.length;j++){
      var ex=day.exercises[j];
      if(!countsTowardProgress(ex))continue;
      tot++;
      if(S.done[ex.id])dc++;
    }
  }
  return {done:dc,total:tot};
}
// Assiduité : note de BASE, 0-100. Tant qu'on reste dans sa marge de séances
// ratables (assiduityAllowedMisses, définie par semaine) -> 100 %. Au-delà,
// la note baisse au prorata des exercices ratés EN TROP. La marge est
// proratisée à la part de la semaine déjà écoulée (sinon, en début de
// semaine, la marge complète rendrait n'importe quoi = 100 %). Plafonnée à
// 100 : le dépassement ne vient que du bonus de charges (computeWeightBonus).
function computeAssiduityScore(){
  var c=computeLiveCounts();
  if(c.total===0)return 100; // rien attendu encore -> neutre
  var allowedWeek=statsTarget('assiduityAllowedMisses',ASSIDUITY_ALLOWED_MISSES_DEFAULT);
  var weekTotal=computeWeekTotalCountable();
  var allowedNow=weekTotal>0?allowedWeek*(c.total/weekTotal):allowedWeek;
  var missed=c.total-c.done;
  var effectiveMissed=Math.max(0,missed-allowedNow);
  return Math.round((c.total-effectiveMissed)/c.total*100);
}
// Bonus de charges : points AJOUTÉS à l'assiduité (jamais retirés). Renvoie
// toujours un nombre >= 0. 0 quand il n'y a pas encore assez de recul, ou
// aucun poids comparable, ou aucune hausse — ne pas progresser ne coûte donc
// rien. Sinon, proportionnel à la part d'exercices dont le poids a monté
// depuis weightLookbackDays jours, rapportée à weightProgressTargetPct (part
// de hausses qui donne le bonus MAXIMUM), plafonné à weightBonusMax.
function computeWeightBonus(history){
  var lookback=statsTarget('weightLookbackDays',WEIGHT_PROGRESS_LOOKBACK_DAYS_DEFAULT);
  var target=statsTarget('weightProgressTargetPct',WEIGHT_PROGRESS_TARGET_PCT_DEFAULT);
  var maxBonus=statsTarget('weightBonusMax',WEIGHT_BONUS_MAX_DEFAULT);
  var targetDate=new Date(getParisNow().getTime()-lookback*86400000);
  var ref=null;
  for(var i=history.length-1;i>=0;i--){
    if(new Date(history[i].date+'T12:00:00')<=targetDate){ref=history[i];break;}
  }
  if(!ref)return 0; // pas encore de recul -> pas de bonus (mais aucun malus)
  var refWeights=ref.weights||{};
  var up=0,total=0;
  for(var id in S.weights){
    var cur=S.weights[id],prev=refWeights[id];
    if(!cur||cur==='—'||prev===undefined)continue;
    total++;
    if(parseFloat(cur)>parseFloat(prev))up++;
  }
  if(total===0)return 0;
  var pctUp=up/total*100;
  return Math.min(maxBonus,Math.round(pctUp/target*maxBonus));
}
// Met à jour la photo du jour en cours à chaque appel (elle reste "vivante"
// tant qu'on est le même jour — sinon cocher un exercice l'après-midi
// n'apparaîtrait dans les stats que le lendemain). Une fois le jour passé,
// son entrée devient définitive et n'est plus jamais retouchée.
// Score du jour = assiduité (base 0-100) + bonus de charges (>=0). Le bonus
// peut donc rattraper des séances manquées et faire dépasser 100 %.
function recordDailySnapshotIfNeeded(){
  if(isVacationOn())return; // programme en pause -> aucune photo, pas de pénalité
  var today=getParisDate();
  var history=ld(K('statsHistory'),[]);
  var completion=computeAssiduityScore();
  var weightBonus=computeWeightBonus(history);
  var score=completion+weightBonus;
  var entry={date:today,completion:completion,weightBonus:weightBonus,score:score,weights:S.weights};
  if(history.length&&history[history.length-1].date===today){
    history[history.length-1]=entry;
  }else{
    history.push(entry); // pas de troncature : historique complet gardé
  }
  sv(K('statsHistory'),history);
}

// ── MODE VACANCES ────────────────────────────────────────────────────────────
// Met le programme en pause : pendant les vacances (1) aucune photo stat
// n'est prise -> l'assiduité n'est pas pénalisée (voir recordDailySnapshot),
// et (2) le compte à rebours J–N est gelé. Au retour, la date de révision du
// programme est repoussée du nombre de jours d'absence.
// Persistance : vacationOn (bool), vacationStart (date du départ), et
// vacationOffsetDays (jours de vacances déjà accumulés, ajoutés à la
// deadline). Tant qu'on est en vacances, les jours écoulés depuis le départ
// s'ajoutent "en direct" -> la deadline avance au même rythme que le temps,
// donc le J–N reste figé. À l'arrêt, ces jours sont versés définitivement
// dans vacationOffsetDays.
function isVacationOn(){return !!ld(K('vacationOn'),false);}
function ongoingVacationDays(){
  if(!isVacationOn())return 0;
  var start=ld(K('vacationStart'),null);
  if(!start)return 0;
  var d=Math.floor((getParisNow()-new Date(start+'T12:00:00'))/86400000);
  return d>0?d:0;
}
function totalVacationDays(){
  return ld(K('vacationOffsetDays'),0)+ongoingVacationDays();
}
function effectiveDeadlineMs(){
  return new Date(CONFIG.deadline+'T12:00:00').getTime()+totalVacationDays()*86400000;
}
function recomputeJLeft(){
  JLEFT_RAW=Math.floor((effectiveDeadlineMs()-getParisNow().getTime())/86400000);
  JLEFT=Math.max(0,JLEFT_RAW);
}
function toggleVacation(){
  if(isVacationOn()){
    // Fin des vacances : on verse les jours écoulés dans l'offset définitif.
    sv(K('vacationOffsetDays'),ld(K('vacationOffsetDays'),0)+ongoingVacationDays());
    sv(K('vacationOn'),false);
    sv(K('vacationStart'),null);
  }else{
    sv(K('vacationOn'),true);
    sv(K('vacationStart'),getParisDate());
  }
  recomputeJLeft();
  render();
}

// ── STATE ──────────────────────────────────────────────────────────────────
var TI=computeDayIndex(getWeekday());
// JLEFT_RAW garde le signe (négatif une fois la deadline passée) pour pouvoir
// afficher un décompte de retard ; JLEFT (jamais négatif) sert à l'affichage
// normal "J–N jours restants". La deadline effective inclut le décalage
// vacances (voir effectiveDeadlineMs).
var JLEFT_RAW,JLEFT;
recomputeJLeft();
var WK=getWK();
var storedWK=ld(K('doneWeek'),null);
var storedDone=ld(K('done'),{});
var S={
  mode:'today',
  openDays:{},
  weights:ld(K('weights'),{}),
  weightDates:ld(K('weightDates'),{}),
  done:storedWK===WK?storedDone:{},
};
S.openDays[TI]=true;
if(storedWK!==WK){
  sv(K('doneWeek'),WK);sv(K('done'),{});
}
recordDailySnapshotIfNeeded();

// ── RENDER ─────────────────────────────────────────────────────────────────
function render(){
  var el=document.getElementById('app');
  if(!el)return;
  el.innerHTML=buildHTML();
  bindEvents();
  var scrollEl=document.getElementById('stats-scroll');
  if(scrollEl)scrollEl.scrollLeft=scrollEl.scrollWidth;
}

function bindEvents(){
  var btnToday=document.getElementById('btn-today');
  var btnWeek=document.getElementById('btn-week');
  if(btnToday)btnToday.addEventListener('click',function(){S.mode='today';S.openDays={};S.openDays[TI]=true;render();});
  if(btnWeek)btnWeek.addEventListener('click',function(){S.mode='week';S.openDays={};render();});
  var btnStats=document.getElementById('btn-stats');
  if(btnStats)btnStats.addEventListener('click',function(){S.mode='stats';render();});
  var btnVacation=document.getElementById('btn-vacation');
  if(btnVacation)btnVacation.addEventListener('click',function(){toggleVacation();});
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
      recordDailySnapshotIfNeeded();
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
      recordDailySnapshotIfNeeded();
      render();
    });
    sel.addEventListener('click',function(e){e.stopPropagation();});
  });
  // Le numéro de version (pied de page) remplace l'ancien bouton ☰ + tiroir :
  // le toucher ouvre directement la page Import/Export.
  var btnVersion=document.getElementById('btn-version');
  if(btnVersion)btnVersion.addEventListener('click',function(){S.mode='data';window.scrollTo(0,0);render();});
  var hdrBand=document.getElementById('hdr-band');
  if(hdrBand)hdrBand.addEventListener('click',function(){
    if(S.mode==='data'){S.mode='today';S.openDays={};S.openDays[TI]=true;render();}
  });
  var btnExport=document.getElementById('btn-export');
  if(btnExport)btnExport.addEventListener('click',exportData);
  var btnImport=document.getElementById('btn-import');
  var fileInput=document.getElementById('import-file');
  if(btnImport&&fileInput){
    btnImport.addEventListener('click',function(){fileInput.click();});
    fileInput.addEventListener('change',function(){
      var file=fileInput.files[0];
      if(!file)return;
      var reader=new FileReader();
      reader.onload=function(){importData(reader.result);};
      reader.readAsText(file);
      fileInput.value='';
    });
  }
}

// Une fois la deadline dépassée (pour les 3), on affiche un décompte de
// retard (J+1, J+2...) et un rappel fixe en rouge/gras/majuscules, jusqu'à
// ce que la personne mette à jour `deadline` avec le nouveau programme.
function jleftHTML(){
  if(JLEFT_RAW<=0){
    var red=CONFIG.weightColors.old;
    return '<div class="dlc" style="color:'+red+'">J+'+(-JLEFT_RAW)+'</div><div class="dls" style="color:'+red+';font-weight:700">CHANGER LE PROGRAMME</div>';
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
  var isData=S.mode==='data';
  var isStats=S.mode==='stats';
  var mainContent;
  if(isData){
    mainContent=dataPageHTML();
  }else{
    var isRest=TI<0;
    var td=isRest?(CONFIG.restDay.fallbackDay?CONFIG.days[0]:null):CONFIG.days[TI];
    var bodyHTML2;
    if(isStats){
      bodyHTML2=statsPageHTML();
    }else if(S.mode==='today'){
      bodyHTML2='<div class="days">'+(isRest?(CONFIG.restDay.html+(CONFIG.restDay.showNextDayPreview?dayHTML(CONFIG.days[0],0,false):'')):dayHTML(td,TI,true))+'</div>';
    }else{
      bodyHTML2='<div class="days">'+CONFIG.days.map(function(d,i){return dayHTML(d,i,false);}).join('')+'</div>';
    }
    // Les 3 boutons gardent toujours leur couleur d'identité (bleu/orange/
    // violet), même non sélectionnés (bordure/texte à faible opacité) — et
    // ressortent en couleur pleine (fond + bordure + texte vifs) une fois
    // sélectionnés. Couleurs fixes, partagées par les 3 personnes (comme
    // pour STAT), pas une donnée personnelle.
    var todayColor='#3d8bff';
    var weekColor='#f5a623';
    var statsColor='#a855f7';
    var todayBtnStyle=S.mode==='today'?('background:'+todayColor+'26;border-color:'+todayColor+';color:'+todayColor):('border-color:'+todayColor+'50;color:'+todayColor);
    var weekBtnStyle=S.mode==='week'?('background:'+weekColor+'26;border-color:'+weekColor+';color:'+weekColor):('border-color:'+weekColor+'50;color:'+weekColor);
    var statsBtnStyle=isStats?('background:'+statsColor+'26;border-color:'+statsColor+';color:'+statsColor):('border-color:'+statsColor+'50;color:'+statsColor);
    mainContent='<div class="mtog">'
      +'<button class="mbtn" id="btn-today" style="'+todayBtnStyle+'">&#128205; AUJOURD’HUI</button>'
      +'<button class="mbtn" id="btn-week" style="'+weekBtnStyle+'">&#128198; SEMAINE</button>'
      +'<button class="mbtn" id="btn-stats" style="'+statsBtnStyle+'">&#128200; STAT</button>'
      +'</div>'
      +bodyHTML2;
  }
  // Plus AUCUN bouton flottant (☰) ni tiroir : après de nombreuses
  // tentatives, un élément qui doit rester immobile pendant le défilement
  // s'est avéré impossible à fiabiliser sur iOS. L'accès Import/Export passe
  // désormais par le NUMÉRO DE VERSION affiché tout en bas de la page (voir
  // versionFooterHTML) : on le touche, ça ouvre la page données (S.mode=
  // 'data'). Résultat : que du flux normal, rien de flottant, rien qui
  // puisse déraper au scroll.
  // L'en-tête n'a plus besoin de réserver 64px à droite (c'était pour le
  // bouton) : le badge programme et l'encart deadline reprennent toute la
  // largeur.
  var shellContent='<div class="hdr" id="hdr-band" style="'+(isData?'cursor:pointer':'')+'">'
    +'<div class="hdr-top">'
    +'<div class="ttl">'+CONFIG.title+' <span style="color:'+CONFIG.genderSymbolColor+'">'+CONFIG.genderSymbol+'</span></div>'
    +programBadgeHTML()
    +'</div>'
    +'<div class="dlbar">'
    +'<div><div class="dll">&#128197; '+CONFIG.deadlineLabel+'</div><div class="dld">'+CONFIG.deadlineDateText+'</div></div>'
    +'<div style="text-align:right">'+jleftHTML()+'</div>'
    +'</div>'
    +'</div>'
    // Bandeau vacances : visible partout (sauf page données) quand le
    // programme est en pause, pour qu'on sache d'un coup d'œil que rien n'est
    // compté et que le compte à rebours est gelé.
    +((!isData&&isVacationOn())?'<div style="margin:12px 14px 0;padding:12px 14px;border-radius:12px;background:'+CONFIG.accentColor+'1f;border:1px solid '+CONFIG.accentColor+';text-align:center;font-size:12.5px;font-weight:700;color:'+CONFIG.accentColor+'">&#127958;&#65039; Vacances — programme en pause</div>':'')
    +(isData?'<div style="text-align:center;padding:10px 14px 0;font-size:11px;color:'+CONFIG.noSideIconColor+'">&#8249; Touche ton prénom pour revenir en arrière</div>':'')
    +mainContent
    // Sur la page données elle-même, pas de pied de version (on y est déjà) ;
    // partout ailleurs, le numéro de version tout en bas sert d'accès
    // Import/Export.
    +(isData?'':versionFooterHTML());
  return shellContent;
}

// Numéro de version en pied de page, en BAS À DROITE, sans bordure ni texte
// "Importer/Exporter" (on sait que le toucher ouvre cette page — voir
// bindEvents, S.mode='data'). Juste le numéro, avec un padding qui garde une
// zone au doigt confortable sans être trop grande.
function versionFooterHTML(){
  var c=CONFIG.noSideIconColor;
  return '<div style="display:flex;justify-content:flex-end;padding:2px 14px 12px">'
    +'<button id="btn-version" style="background:transparent;border:none;color:'+c+';cursor:pointer;padding:10px 12px;text-align:right;font-size:15px;font-weight:800;line-height:1">v'+ENGINE_VERSION+'</button>'
    +'</div>';
}

// Page dédiée (remplace la liste des jours) : import en haut, export en bas.
function dataPageHTML(){
  var c=CONFIG.noSideIconColor;
  var ac=CONFIG.accentColor;
  var actionBtn='font-size:13px;font-weight:700;width:100%;justify-content:center;background:'+ac+'18;border-color:'+ac+';color:'+ac+';padding:12px';
  return '<div class="days" style="padding-top:14px">'
    +'<div class="dc" style="padding:18px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">&#11014;&#65039;</span><span style="font-size:12px;font-weight:800;letter-spacing:1px;color:'+c+'">IMPORTER MES DONNÉES</span></div>'
      +'<div style="font-size:11px;color:'+c+';margin-bottom:12px;line-height:1.4">Restaure une sauvegarde, ou récupère tes données depuis une ancienne version de l’app.</div>'
      +'<button class="mbtn" id="btn-import" style="'+actionBtn+'">Choisir un fichier</button>'
      // Pas de filtre "accept" : sur iOS, le sélecteur de fichiers grise (rend
      // impossible à sélectionner) tout fichier qui ne correspond pas
      // exactement au type attendu — un export JSON peut ne pas être reconnu
      // pile comme "application/json" selon comment il a été enregistré, et
      // ça bloquait tout. On accepte donc n'importe quel fichier ici, et
      // importData() valide déjà le contenu (JSON.parse + alerte si invalide)
      // — plus robuste que de filtrer côté sélecteur. "display:none" est
      // remplacé par une technique "invisible mais toujours cliquable"
      // (opacity:0 + taille 1px), plus sûre pour déclencher le sélecteur
      // natif sur certains iOS.
      +'<input type="file" id="import-file" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden">'
    +'</div>'
    +'<div class="dc" style="padding:18px">'
      +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">&#11015;&#65039;</span><span style="font-size:12px;font-weight:800;letter-spacing:1px;color:'+c+'">EXPORTER MES DONNÉES</span></div>'
      +'<div style="font-size:11px;color:'+c+';margin-bottom:12px;line-height:1.4">Télécharge une sauvegarde de tous tes poids, à garder de ton côté.</div>'
      +'<button class="mbtn" id="btn-export" style="'+actionBtn+'">Télécharger</button>'
    +'</div>'
    +'</div>';
}

// Page "STAT" : tout l'historique depuis le début (une photo par jour, voir
// recordDailySnapshotIfNeeded), sous forme de graphique qui défile
// horizontalement — ouvert par défaut sur les données les plus récentes,
// on glisse vers la gauche pour remonter dans l'historique. Rien n'est
// jamais coupé : le score peut dépasser 100 % (bonus charges, computeWeightBonus).
function scoreColorFor(score){
  if(score>=100)return CONFIG.weightColors.fresh;
  if(score>=70)return CONFIG.weightColors.aging;
  return CONFIG.weightColors.old;
}

// Moyenne simple du score sur les N derniers jours d'historique disponibles
// (pas forcément N jours calendaires si l'app n'a pas été ouverte tous les
// jours — sur ce que l'on a réellement). Sert à donner une vue plus posée
// que le score du jour seul, qui peut être bruité (voir statsStatusLine).
function rollingAverage(history,n){
  if(history.length===0)return null;
  var slice=history.slice(-n);
  var sum=0;
  for(var i=0;i<slice.length;i++)sum+=slice[i].score;
  return Math.round(sum/slice.length);
}

// Nombre de jours calendaires écoulés depuis la toute première photo — pas
// juste le nombre d'entrées (l'app n'est pas forcément ouverte tous les
// jours). Sert à savoir si une moyenne sur une longue fenêtre (6 mois, 1 an)
// a vraiment du sens à afficher, ou si elle serait identique à une moyenne
// plus courte faute de recul suffisant.
function daysSinceFirstEntry(history){
  if(history.length===0)return 0;
  var first=new Date(history[0].date+'T12:00:00');
  return Math.floor((getParisNow()-first)/86400000);
}

// Compare le score du jour à celui d'il y a ~7 jours pour une phrase courte
// et colorée (verte/orange/grise) plutôt qu'un paragraphe.
function statsStatusLine(history){
  var c=CONFIG.noSideIconColor;
  if(history.length<2)return {text:'Continue, l’historique se construit.',color:c};
  var last=history[history.length-1];
  var targetDate=new Date(getParisNow().getTime()-7*86400000);
  var ref=null;
  for(var i=history.length-2;i>=0;i--){
    if(new Date(history[i].date+'T12:00:00')<=targetDate){ref=history[i];break;}
  }
  if(!ref)ref=history[0];
  var diff=last.score-ref.score;
  if(diff>=6)return {text:'&#128200; En progression',color:CONFIG.weightColors.fresh};
  if(diff<=-6)return {text:'&#128201; En baisse — viens un peu plus souvent ou monte tes charges',color:CONFIG.weightColors.old};
  return {text:'&#8594; Stable',color:c};
}

function statsPageHTML(){
  var history=ld(K('statsHistory'),[]);
  var c=CONFIG.noSideIconColor;
  var ac=CONFIG.accentColor;
  var onVac=isVacationOn();
  var last=history.length?history[history.length-1]:null;
  var bigScore='';
  if(last){
    var status=statsStatusLine(history);
    var elapsed=daysSinceFirstEntry(history);
    // 3 mois / 6 mois / 1 an ne s'affichent que quand il y a vraiment eu ce
    // recul — sinon la moyenne serait identique à "depuis le début" et
    // donnerait un faux sentiment de recul historique qui n'existe pas
    // encore. Chaque nouvelle fenêtre s'ajoute donc progressivement au fil
    // du temps.
    var chips=[
      {label:'moy. 7j',val:rollingAverage(history,7)},
      {label:'moy. 30j',val:rollingAverage(history,30)}
    ];
    if(elapsed>=90)chips.push({label:'moy. 3 mois',val:rollingAverage(history,90)});
    if(elapsed>=180)chips.push({label:'moy. 6 mois',val:rollingAverage(history,180)});
    if(elapsed>=365)chips.push({label:'moy. 1 an',val:rollingAverage(history,365)});
    // Le score affiché en grand est la moyenne des fenêtres actuellement
    // visibles ci-dessous (2 au début, jusqu'à 5 une fois un an
    // d'historique écoulé) plutôt que le score brut du jour seul — moins
    // bruité d'un jour à l'autre, et directement cohérent avec le détail
    // affiché juste en dessous.
    var displayedScore=Math.round(chips.reduce(function(sum,ch){return sum+ch.val;},0)/chips.length);
    bigScore='<div style="text-align:center;margin-bottom:2px"><span style="font-family:Impact,sans-serif;font-size:2.6rem;color:'+scoreColorFor(displayedScore)+'">'+displayedScore+'%</span></div>'
      +'<div style="text-align:center;font-size:11.5px;font-weight:700;color:'+status.color+';margin-bottom:10px">'+status.text+'</div>'
      +'<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:18px;margin-bottom:14px">'
        +chips.map(function(ch){return '<div style="text-align:center"><div style="font-size:15px;font-weight:800;color:'+scoreColorFor(ch.val)+'">'+ch.val+'%</div><div style="font-size:9px;color:'+c+'">'+ch.label+'</div></div>';}).join('')
      +'</div>';
  }
  return '<div class="days" style="padding-top:14px">'
    +'<div class="dc" style="padding:18px">'
    +'<div style="font-size:11px;font-weight:800;letter-spacing:1px;color:'+c+';margin-bottom:6px">&#128200; TA PROGRESSION</div>'
    +bigScore
    +'<div style="font-size:10px;color:'+c+';margin-bottom:12px">Glisse pour l’historique &#8226; pointillé = ton objectif</div>'
    +statsChartSVG(history)
    +'<div style="font-size:10px;color:'+c+';margin-top:14px;line-height:1.4">La note vient de ton assiduité (100&#37; si tu respectes ta marge). Monter tes charges ajoute un bonus qui peut rattraper une séance manquée et dépasser 100&#37;. Ne pas progresser n&rsquo;enlève rien.</div>'
    +'</div>'
    // Carte "Mode vacances" : met le programme en pause (stats gelées +
    // compte à rebours gelé, deadline repoussée au retour, voir toggleVacation).
    +'<div class="dc" style="padding:18px">'
      +'<div style="font-size:11px;font-weight:800;letter-spacing:1px;color:'+c+';margin-bottom:6px">&#127958;&#65039; MODE VACANCES</div>'
      +'<div style="font-size:11px;color:'+c+';margin-bottom:12px;line-height:1.4">'
        +(onVac
          ?'Programme en pause : aucun jour n’est compté et le compte à rebours est gelé. Reprends quand tu rentres.'
          :'Pars tranquille : mets le programme en pause. Aucun jour ne sera compté comme raté, le compte à rebours s’arrête, et la date de révision sera repoussée d’autant à ton retour.')
      +'</div>'
      +'<button class="mbtn" id="btn-vacation" style="font-size:13px;font-weight:700;width:100%;justify-content:center;padding:12px;background:'+ac+(onVac?'26':'18')+';border-color:'+ac+';color:'+ac+'">'
        +(onVac?'Reprendre le programme':'Activer le mode vacances')
      +'</button>'
    +'</div>'
    +'</div>';
}

function shortDateFR(iso){
  var p=iso.split('-');
  return p[2]+'/'+p[1];
}

function statsChartSVG(history){
  var c=CONFIG.noSideIconColor;
  if(history.length===0){
    return '<div style="text-align:center;padding:24px 10px;color:'+c+';font-size:12px">Pas encore de données — reviens demain, une photo est prise chaque jour.</div>';
  }
  var ac='#a855f7';
  var n=history.length;
  var stepX=16,axisW=26,padR=16,padT=10,padB=26,h=170;
  var innerH=h-padT-padB;
  var innerW=Math.max(1,n-1)*stepX;
  var svgW=innerW+padR+8;
  var maxScore=100;
  for(var i=0;i<n;i++){if(history[i].score>maxScore)maxScore=history[i].score;}
  var yMax=Math.max(100,Math.ceil((maxScore+10)/25)*25);
  function xAt(i){return 8+i*stepX;}
  function yAt(score){return padT+innerH-(score/yMax*innerH);}
  var pts=[];for(var i=0;i<n;i++)pts.push(xAt(i)+','+yAt(history[i].score));
  var pointsStr=pts.join(' ');
  var areaStr=pointsStr+' '+xAt(n-1)+','+(padT+innerH)+' '+xAt(0)+','+(padT+innerH);
  var gridVals=[];for(var v=0;v<=yMax;v+=25)gridVals.push(v);
  var gridlines=gridVals.map(function(v){
    var is100=v===100;
    return '<line x1="0" y1="'+yAt(v)+'" x2="'+svgW+'" y2="'+yAt(v)+'" stroke="'+(is100?ac:c)+'" stroke-opacity="'+(is100?'.5':'.15')+'" stroke-width="1"'+(is100?' stroke-dasharray="4,3"':'')+'/>';
  }).join('');
  var labelEvery=Math.max(1,Math.ceil(n/25));
  var marks=history.map(function(hpt,i){
    var showLabel=(i%labelEvery===0)||i===n-1;
    return '<circle cx="'+xAt(i)+'" cy="'+yAt(hpt.score)+'" r="3" fill="'+ac+'"/>'
      +(showLabel?('<text x="'+xAt(i)+'" y="'+(yAt(hpt.score)-8)+'" font-size="8" font-weight="700" fill="'+ac+'" text-anchor="middle">'+hpt.score+'</text>'
        +'<text x="'+xAt(i)+'" y="'+(padT+innerH+16)+'" font-size="7.5" fill="'+c+'" text-anchor="middle">'+shortDateFR(hpt.date)+'</text>'):'');
  }).join('');
  var axisLabels=gridVals.map(function(v){
    var is100=v===100;
    return '<div style="position:absolute;left:0;top:'+(yAt(v)-6)+'px;font-size:8px;color:'+(is100?ac:c)+';font-weight:'+(is100?'700':'400')+'">'+v+'</div>';
  }).join('');
  return '<div style="display:flex;align-items:stretch;gap:2px">'
    +'<div style="width:'+axisW+'px;flex-shrink:0;position:relative;height:'+h+'px">'+axisLabels+'</div>'
    +'<div id="stats-scroll" style="overflow-x:auto;-webkit-overflow-scrolling:touch;flex:1">'
    +'<svg width="'+svgW+'" height="'+h+'" viewBox="0 0 '+svgW+' '+h+'" style="display:block">'
    +'<defs><linearGradient id="statsGrad" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="'+ac+'" stop-opacity=".35"/>'
    +'<stop offset="100%" stop-color="'+ac+'" stop-opacity="0"/>'
    +'</linearGradient></defs>'
    +gridlines
    +(n>1?'<polygon points="'+areaStr+'" fill="url(#statsGrad)"/>':'')
    +(n>1?'<polyline points="'+pointsStr+'" fill="none" stroke="'+ac+'" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>':'')
    +marks
    +'</svg>'
    +'</div>'
    +'</div>';
}

// Export complet : poids, dates, cases cochées de la semaine et tout
// l'historique STAT — pas juste les poids. Chaque poids exporté a toujours
// une date : la vraie si on la connaît, sinon celle du jour de l'export —
// jamais laissée vide. L'export ne change rien à l'affichage (pas de
// rechargement, on reste sur la page).
// En PWA installée sur iPhone (mode "standalone", sans barre d'adresse), un
// lien <a download> vers un blob: ne déclenche pas toujours un vrai
// téléchargement — Safari peut tenter de naviguer directement vers l'URL
// blob (rien ne se passe visiblement, ou l'app a l'air de planter). On
// utilise donc en priorité le partage natif (Web Share API avec fichier,
// supporté depuis iOS 15) qui ouvre la feuille de partage standard
// (Fichiers, AirDrop, Messages...) — bien plus fiable pour "sortir" un
// fichier d'une PWA. IMPORTANT : partager un "title"/"text" EN PLUS du
// fichier est un bug connu de Safari iOS — l'app cible reçoit parfois ce
// texte à la place du fichier (nom du fichier écrit en texte, sauvegardé en
// ".txt"). On ne partage donc QUE "files", rien d'autre. Le lien <a
// download> classique reste en repli pour les navigateurs qui ne
// supportent pas le partage de fichiers (desktop...).
function exportData(){
  var today=getParisDate();
  var dates={};
  for(var id in S.weights){dates[id]=S.weightDates[id]||today;}
  var data={
    app:CONFIG.personId,
    exportedAt:today,
    weights:S.weights,
    weightDates:dates,
    done:S.done,
    doneWeek:ld(K('doneWeek'),null),
    statsHistory:ld(K('statsHistory'),[])
  };
  var filename=CONFIG.personId+'.json';
  var json=JSON.stringify(data,null,2);
  if(navigator.share&&navigator.canShare&&typeof File!=='undefined'){
    try{
      var file=new File([json],filename,{type:'application/json'});
      if(navigator.canShare({files:[file]})){
        navigator.share({files:[file]}).catch(function(){});
        return;
      }
    }catch(e){}
  }
  var blob=new Blob([json],{type:'application/json'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Même règle à l'import, en filet de sécurité : si le fichier a une date
// connue pour un exercice, elle est gardée telle quelle ; sinon (fichier
// d'une ancienne version qui n'enregistrait pas les dates) on prend la
// date du jour de l'import — jamais pour écraser une vraie date. Les champs
// ajoutés après coup (done, doneWeek, statsHistory) sont restaurés s'ils
// sont présents, ignorés sinon (fichier exporté par une ancienne version).
function importData(jsonText){
  var data;
  try{data=JSON.parse(jsonText);}catch(e){alert('Fichier invalide.');return;}
  if(!data||typeof data.weights!=='object'){alert('Fichier invalide.');return;}
  if(!confirm('Importer ce fichier remplacera tes données actuelles par celles du fichier. Continuer ?'))return;
  var today=getParisDate();
  var importedDates=data.weightDates||{};
  for(var id in data.weights){
    S.weights[id]=data.weights[id];
    S.weightDates[id]=importedDates[id]||today;
  }
  sv(K('weights'),S.weights);
  sv(K('weightDates'),S.weightDates);
  if(data.done&&typeof data.done==='object'){
    S.done=data.done;
    sv(K('done'),S.done);
  }
  if(data.doneWeek)sv(K('doneWeek'),data.doneWeek);
  if(Array.isArray(data.statsHistory))sv(K('statsHistory'),data.statsHistory);
  alert('Import terminé, l\'app va se relancer.');
  window.location.reload();
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
// La couleur (vert/orange/rouge selon l'ancienneté, cf. getWCol) est le seul
// rappel de progression : pas de suggestion de poids chiffrée.
// Le poids n'est affiché qu'une seule fois, dans le menu déroulant lui-même
// (couleur du texte/bordure = fraîcheur, vert/orange/rouge) — pas de badge
// répétant "X kg" à côté, qui n'ajoutait rien de plus que de la répétition.
function weightCtrl(key,ec,sideLabel,isDB){
  var w=S.weights[key]||'';
  var opts=isDB?WOPT.db:WOPT.mc;
  var hasW=!!(w&&w!=='—');
  var wc=hasW?getWCol(key):CONFIG.weightColors.none;
  var selOpts=opts.map(function(o){return '<option value="'+o+'"'+(o===(w||'—')?' selected':'')+'>'+(o==='—'?'Sélectionner kg':o+' kg')+'</option>';}).join('');
  return '<div class="wrow">'
    +(sideLabel?'<span class="wside" style="color:'+ec+'">'+sideLabel+'</span>':'<span style="font-size:11px;color:'+CONFIG.noSideIconColor+'">&#9878;</span>')
    +'<select class="wsel" data-id="'+key+'" style="color:'+(hasW?wc:CONFIG.noSideIconColor)+';border-color:'+(hasW?wc+'60':'#2a2a30')+'">'+selOpts+'</select>'
    +'</div>';
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
    // align-self:center : centre la coche sur toute la hauteur de la rangée
    // (sinon collée en haut quand le nom/tip/badges prennent plusieurs
    // lignes) — comportement identique pour les 3, donc ici plutôt que
    // dupliqué dans le CSS de chaque personne.
    +'<div class="exck" style="align-self:center;background:'+(done?CONFIG.weightColors.fresh:'transparent')+';border-color:'+(done?CONFIG.weightColors.fresh:CONFIG.exckBorderColor)+';color:'+(done?CONFIG.exckDoneColor:'transparent')+'">✓</div>'
    +'</div>'+wRow+'</div>';
}

// Revérifie périodiquement tout ce qui dépend de la date/heure (jour affiché,
// décompte de deadline, reset hebdomadaire des cases, photo stat du jour)
// pour que l'app se mette à jour toute seule si le téléphone reste ouvert
// dessus sans rechargement.
setInterval(function(){
  var changed=false;
  var newTI=computeDayIndex(getWeekday());
  if(newTI!==TI){TI=newTI;S.openDays[TI]=true;changed=true;}
  var prevJLEFT_RAW=JLEFT_RAW;
  recomputeJLeft(); // tient compte du décalage vacances (deadline effective)
  if(JLEFT_RAW!==prevJLEFT_RAW)changed=true;
  var nwk=getWK();
  if(ld(K('doneWeek'),null)!==nwk){S.done={};sv(K('doneWeek'),nwk);sv(K('done'),{});changed=true;}
  recordDailySnapshotIfNeeded();
  if(changed)render();
},300000);

window.addEventListener('DOMContentLoaded',function(){render();});

// PWA hors-ligne : un seul service worker partagé (à la racine du dépôt)
// pour les 3 apps, mis en cache "stale-while-revalidate".
// MISE À JOUR AUTOMATIQUE : quand une nouvelle version du service worker
// prend le contrôle (parce que sw.js a changé), l'événement
// "controllerchange" se déclenche et on recharge la page UNE fois pour
// appliquer le nouveau code sans manip de l'utilisateur. Le garde-fou
// "refreshing" évite toute boucle de rechargement. Sans ça, une PWA
// installée déjà ouverte gardait l'ancien JS chargé en mémoire tant qu'on
// ne la fermait pas complètement à la main — c'était la cause du « ça ne se
// met pas à jour » sur le téléphone.
if('serviceWorker' in navigator){
  var swRefreshing=false;
  navigator.serviceWorker.addEventListener('controllerchange',function(){
    if(swRefreshing)return;
    swRefreshing=true;
    window.location.reload();
  });
  window.addEventListener('load',function(){
    navigator.serviceWorker.register('../sw.js',{scope:'../'}).then(function(reg){
      // Vérifie tout de suite s'il existe une version plus récente de sw.js
      // sur le serveur (au lieu d'attendre le contrôle périodique du
      // navigateur, qui peut tarder sur une PWA installée).
      reg.update();
    }).catch(function(){});
  });
}

}
