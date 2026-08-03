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

// VERSION AFFICHÉE = "MAJEUR.MINEUR.PATCH" (ex : 2.5.1).
//  - MAJEUR.MINEUR = ENGINE_VERSION ci-dessous, PARTAGÉ par les 3 apps. On le
//    change quand on touche au MOTEUR (engine.js) : MAJEUR (2->3) pour une
//    grosse nouveauté / nouvelle fonctionnalité, MINEUR (2.4->2.5) pour une
//    mise à jour moyenne ou une correction de l'existant. Ce même numéro sert
//    aussi de jeton de cache "?v=..." sur les <script src="../engine.js?v=...">
//    des 3 index.html — il DOIT rester identique à ENGINE_VERSION et être
//    incrémenté avec lui à chaque changement de engine.js.
//  - PATCH = CONFIG.configVersion, PROPRE À CHAQUE PERSONNE. On l'incrémente
//    UNIQUEMENT quand on modifie SA config perso (ses exercices, ses journées,
//    ses réglages…), sans toucher au moteur. Chacun garde son PATCH quand le
//    moteur bouge : qui était en 2.4.1 passe en 2.5.1 lors d'une maj moteur.
var ENGINE_VERSION='4.1';

// Valeurs PARTAGÉES par défaut. Tout ce qui est identique d'une personne à
// l'autre vit ICI, pas dupliqué dans chaque config. Une config perso ne
// déclare QUE ce qui lui est propre (exercices, jours restants, réps, stats,
// nombre de journées) ou ce qui diffère du défaut (ex : le thème clair de
// Myriam). Un défaut n'est appliqué que si la clé est absente de la config.
// Le défaut correspond au thème "sombre" d'Anthony/Mikael ; Myriam surcharge
// les clés visuelles pour son thème clair.
var ENGINE_DEFAULTS={
  genderSymbol:'♂',
  genderSymbolColor:'#3d8bff',
  jleftUrgentColor:'#ff4d1c',
  jleftNormalColor:'#f5a623',
  restDay:{card:{emoji:'😴',title:'REPOS',subtitle:'Profites-en pour bien récupérer.'}},
  // La date de fin affichée est calculée depuis la deadline (et recule avec les
  // vacances). Une personne dont la date affichée est autre chose (ex : Myriam
  // affiche sa DATE DE DÉBUT) met dynamicDeadlineDate:false et garde son texte.
  dynamicDeadlineDate:true,
  cardioRepsText:'',
  // Échauffement et cardio ne comptent jamais dans la progression du jour
  // (X/N) : ce ne sont pas des exercices à cocher au même titre que le reste.
  excludedFromProgress:['warmup','cardio'],
  noWeightCategories:['cardio'],
  categoryColors:{cardio:'#2ecc71'},
  weightColors:{none:'#666',fresh:'#2ecc71',aging:'#f2d024',old:'#e53e3e'},
  noSideIconColor:'#555',
  exerciseNameColor:'#efefef',
  exckBorderColor:'#333',
  exckDoneColor:'#000',
  showRepsChip:false,
  supersetHeaderText:'🔗 SUPERSET · 2 exercices',
  supersetFooterText:'Repos 60s après les 2 exos · puis recommencer',
  supersetColor:function(block){return '#ffffff';},
  bonusBanner:{icon:null,defaultLabel:'AVANT LA SÉANCE',repsText:'4×12 reps'},
  absBanner:null,
  configVersion:0
};
// Remplit UNIQUEMENT les clés absentes (surface, pas de fusion profonde) :
// une config qui fournit sa propre valeur (même partielle, ex : restDay)
// garde la sienne entièrement.
function applyEngineDefaults(cfg){
  for(var k in ENGINE_DEFAULTS){ if(cfg[k]===undefined) cfg[k]=ENGINE_DEFAULTS[k]; }
}

function startApp(CONFIG){

applyEngineDefaults(CONFIG);
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
// Clé de semaine ancrée sur le LUNDI (Europe/Paris) : c'est la date du lundi de
// la semaine en cours. Elle ne change donc qu'au passage minuit dimanche->lundi.
// La remise à zéro des cases cochées (voir doneWeek) est calée dessus : la
// semaine en cours reste visible dans "Semaine" jusqu'au dimanche 23h59, et ne
// repart à zéro que le lundi. (Avant, un "numéro de semaine" à l'américaine
// basculait le dimanche -> remise à zéro un jour trop tôt.)
function getWK(){
  var d=getParisNow();
  var wd=getWeekday(); // 0=Lun .. 6=Dim
  var monday=new Date(d.getTime()-wd*86400000);
  return monday.getFullYear()+'-'+(monday.getMonth()+1)+'-'+monday.getDate();
}
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
  // Évolution lente : vert les 2 premières semaines (trop court pour monter la
  // charge utilement avant), jaune la 3e semaine (approche de la limite), puis
  // rouge au-delà (il est temps d'augmenter).
  if(days<=14)return CONFIG.weightColors.fresh;
  if(days<=21)return CONFIG.weightColors.aging;
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
// - Assiduité (base = 100 − pénalités, 0-100) : sur les jours DÉJÀ passés
//   cette semaine (mercredi ne compte pas encore un lundi). Tout fait -> 100.
//   Chaque exercice non fait coûte missPenalty, proportionnellement ; au-delà
//   de missThreshold ratés, chaque exo en plus coûte missExtraPenalty EN PLUS ;
//   une journée entière non faite coûte missedDayPenalty de plus. Réglé par
//   personne (le sain perd plus, la personne fragile perd moins). Plafonné à
//   100 : dépasser 100 % ne vient QUE des bonus ci-dessous.
// - Bonus charges (0..weightBonusMax, ajouté) : selon la part d'exercices
//   dont le poids a monté depuis weightLookbackDays jours, rapportée à un
//   objectif perso (weightProgressTargetPct = part de hausses donnant le
//   bonus max). 0 si pas de recul ou pas de hausse — jamais négatif.
// - Bonus régularité (0..regularityBonusMax, ajouté, MÊME pour tous) : part
//   des derniers jours qui étaient bien assidus. Permet à la constance SEULE
//   de dépasser 100 (atteindre la ligne verte) sans dépendre de la charge.
// Score du jour = assiduité + bonus charges + bonus régularité. Tout est
// perso (config) sauf la régularité (vertu universelle). Rien n'est recalculé
// pour le passé ni supprimé : tout l'historique est gardé.
var WEIGHT_PROGRESS_LOOKBACK_DAYS_DEFAULT=14;
var WEIGHT_PROGRESS_TARGET_PCT_DEFAULT=25;
var WEIGHT_BONUS_MAX_DEFAULT=25;
// Pénalités d'assiduité (base 100 - pénalités). Douces et proportionnelles :
// chaque exo non fait coûte missPenalty ; au-delà de missThreshold ratés,
// chaque exo supplémentaire coûte missExtraPenalty EN PLUS (ça pique un peu
// plus quand ça s'accumule) ; une journée entière non faite coûte
// missedDayPenalty de plus (pour encourager à au moins venir). Tout est
// réglable par personne (statsTarget).
var MISS_PENALTY_DEFAULT=2;
var MISS_THRESHOLD_DEFAULT=3;
var MISS_EXTRA_PENALTY_DEFAULT=2;
var MISSED_DAY_PENALTY_DEFAULT=3;
// Fourchette affichée sur le graphique STAT : ligne verte "objectif haut"
// (au-dessus de 100, sympa à viser) et ligne rouge "plancher" (en dessous
// de 100, à rester au-dessus). Réglables par personne.
var GOOD_LEVEL_DEFAULT=110;
var MIN_LEVEL_DEFAULT=85;
// Bonus de RÉGULARITÉ : récompense la constance (l'habitude, le vrai
// objectif), pour que l'assiduité SEULE puisse dépasser 100 et atteindre la
// ligne verte — sans dépendre de la charge. C'est la même valeur pour tous
// (venir régulièrement est la vertu universelle, pas un réglage santé). On
// regarde les REGULARITY_WINDOW_DAYS derniers jours enregistrés : la part de
// ceux qui étaient "bons" (assiduité >= REGULARITY_GOOD_DAY) donne le bonus,
// jusqu'à regularityBonusMax. Pas de "série qui casse à zéro" au moindre
// jour off (trop dur) : une proportion, plus douce et plus juste.
var REGULARITY_BONUS_MAX_DEFAULT=15;
var REGULARITY_WINDOW_DAYS=14;
var REGULARITY_GOOD_DAY=90;
var REGULARITY_MIN_ENTRIES=5;

function statsTarget(name,dflt){
  return (CONFIG.statsTarget&&CONFIG.statsTarget[name]!=null)?CONFIG.statsTarget[name]:dflt;
}

// Compte, sur les jours DÉJÀ passés cette semaine : exercices attendus /
// faits (bannières/échauffements exclus), et le nombre de JOURS de programme
// entièrement ratés (0 exo fait ce jour-là). Renvoie {done,total,daysMissed}.
function computeLiveCounts(){
  var weekday=getWeekday();
  var expectedIdx={};
  for(var w=0;w<=weekday;w++){
    var idx=computeDayIndex(w);
    if(idx>=0)expectedIdx[idx]=true;
  }
  var tot=0,dc=0,daysMissed=0;
  for(var idxKey in expectedIdx){
    var day=CONFIG.days[idxKey];
    var dayTot=0,dayDone=0;
    for(var j=0;j<day.exercises.length;j++){
      var ex=day.exercises[j];
      if(!countsTowardProgress(ex))continue;
      dayTot++;tot++;
      if(S.done[ex.id]){dayDone++;dc++;}
    }
    if(dayTot>0&&dayDone===0)daysMissed++; // journée entière non faite
  }
  return {done:dc,total:tot,daysMissed:daysMissed};
}
// Assiduité : note de BASE = 100 − pénalités (jamais au-dessus de 100 ; le
// dépassement ne vient que du bonus de charges, computeWeightBonus). Chaque
// exercice non fait coûte missPenalty, proportionnellement (2 ratés coûtent
// 2× plus qu'1) ; au-delà de missThreshold ratés, chaque exo en plus coûte
// missExtraPenalty EN PLUS ; chaque journée entière ratée coûte
// missedDayPenalty de plus. Réglé par personne (le sain perd plus, la
// personne fragile perd moins). Plancher à 0.
function computeAssiduityScore(){
  var c=computeLiveCounts();
  if(c.total===0)return 100; // rien attendu encore -> neutre
  var missed=c.total-c.done;
  var missPen=statsTarget('missPenalty',MISS_PENALTY_DEFAULT);
  var threshold=statsTarget('missThreshold',MISS_THRESHOLD_DEFAULT);
  var extraPen=statsTarget('missExtraPenalty',MISS_EXTRA_PENALTY_DEFAULT);
  var dayPen=statsTarget('missedDayPenalty',MISSED_DAY_PENALTY_DEFAULT);
  var pen=missPen*missed
    +extraPen*Math.max(0,missed-threshold)
    +dayPen*c.daysMissed;
  return Math.max(0,Math.round(100-pen));
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
// Bonus de régularité (>=0) : part des derniers jours enregistrés qui étaient
// "bons" (assiduité >= REGULARITY_GOOD_DAY) sur les REGULARITY_WINDOW_DAYS
// derniers jours, × regularityBonusMax. 0 tant qu'il n'y a pas au moins
// REGULARITY_MIN_ENTRIES jours de recul (sinon 1 bon jour donnerait le max).
// Permet à l'assiduité constante de dépasser 100 même sans monter les poids.
function computeRegularityBonus(history){
  var maxB=statsTarget('regularityBonusMax',REGULARITY_BONUS_MAX_DEFAULT);
  var cutoff=getParisNow().getTime()-REGULARITY_WINDOW_DAYS*86400000;
  var total=0,good=0;
  for(var i=history.length-1;i>=0;i--){
    var t=new Date(history[i].date+'T12:00:00').getTime();
    if(t<cutoff)break;
    total++;
    var comp=history[i].completion!=null?history[i].completion:history[i].score;
    if(comp>=REGULARITY_GOOD_DAY)good++;
  }
  if(total<REGULARITY_MIN_ENTRIES)return 0;
  return Math.round(good/total*maxB);
}
// Met à jour la photo du jour en cours à chaque appel (elle reste "vivante"
// tant qu'on est le même jour — sinon cocher un exercice l'après-midi
// n'apparaîtrait dans les stats que le lendemain). Une fois le jour passé,
// son entrée devient définitive et n'est plus jamais retouchée.
// Score du jour = assiduité (base 0-100) + bonus charges + bonus régularité
// (les deux >=0). Ces bonus peuvent rattraper une absence et faire dépasser
// 100 % ; la régularité permet d'y arriver par la seule constance.
function recordDailySnapshotIfNeeded(){
  if(isVacationOn())return; // programme en pause -> aucune photo, pas de pénalité
  var today=getParisDate();
  var history=ld(K('statsHistory'),[]);
  var completion=computeAssiduityScore();
  var weightBonus=computeWeightBonus(history);
  var regularityBonus=computeRegularityBonus(history);
  var score=completion+weightBonus+regularityBonus;
  var entry={date:today,completion:completion,weightBonus:weightBonus,regularityBonus:regularityBonus,score:score,weights:S.weights};
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
// Date de fin AFFICHÉE, calculée depuis la deadline EFFECTIVE (base + jours de
// vacances). Elle reste donc toujours cohérente avec le J–N ET recule
// visiblement quand on met le programme en pause. Format français.
var FR_MONTHS=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
function effectiveDeadlineDateText(){
  var d=new Date(effectiveDeadlineMs());
  return d.getDate()+' '+FR_MONTHS[d.getMonth()]+' '+d.getFullYear();
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
  // Reset des stats : efface TOUT l'historique du graphique (repart de zéro).
  // Confirmation oui/non explicite avant, car c'est irréversible. Les poids
  // enregistrés et les cases cochées ne sont PAS touchés.
  var btnReset=document.getElementById('btn-reset');
  if(btnReset)btnReset.addEventListener('click',function(){
    if(confirm('Réinitialiser les statistiques ?\n\nTout l\'historique du graphique (la courbe et les moyennes) sera définitivement effacé et repartira de zéro.\n\nTes poids enregistrés et tes cases cochées ne sont PAS touchés.\n\nEffacer ?')){
      sv(K('statsHistory'),[]);
      render();
    }
  });
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
// En mode vacances, le compte à rebours est GELÉ : on l'affiche en gris/
// atténué avec "⏸ en pause" au lieu de "jours restants", pour montrer
// visuellement que les jours ne défilent plus.
function jleftHTML(){
  if(isVacationOn()){
    var m=CONFIG.noSideIconColor;
    return '<div class="dlc" style="color:'+m+'">J&#8211;'+JLEFT+'</div><div class="dls" style="color:'+m+';font-weight:700">en pause</div>';
  }
  if(JLEFT_RAW<=0){
    var red=CONFIG.weightColors.old;
    return '<div class="dlc" style="color:'+red+'">J+'+(-JLEFT_RAW)+'</div><div class="dls" style="color:'+red+';font-weight:700">CHANGER LE PROGRAMME</div>';
  }
  return '<div class="dlc" style="color:'+(JLEFT<14?CONFIG.jleftUrgentColor:CONFIG.jleftNormalColor)+'">J&#8211;'+JLEFT+'</div><div class="dls">jours restants</div>';
}

// Carte "pause" partagée : même charte pour le REPOS et les VACANCES (voir
// restBodyHTML et le mode vacances dans buildHTML). opts = {emoji, title,
// subtitle, color}. Structure unique (gros emoji + titre Impact + sous-titre
// atténué) ; seuls l'emoji, le titre et la couleur changent d'un cas à
// l'autre -> charte graphique uniforme, avec juste ce qu'il faut de
// différence entre repos et vacances.
function pauseCardHTML(opts){
  var col=opts.color||CONFIG.noSideIconColor;
  return '<div class="dc" style="padding:38px 20px;text-align:center;border-color:'+col+'55">'
    +'<div style="font-size:3rem;line-height:1">'+opts.emoji+'</div>'
    +'<div style="font-family:Impact,sans-serif;font-size:1.5rem;letter-spacing:2px;margin-top:14px;color:'+col+'">'+opts.title+'</div>'
    +'<div style="font-size:12.5px;margin-top:10px;color:'+CONFIG.noSideIconColor+';line-height:1.45;max-width:280px;margin-left:auto;margin-right:auto">'+opts.subtitle+'</div>'
    +'</div>';
}
// Rendu du jour de repos : via la carte partagée (pauseCardHTML) si la config
// fournit restDay.card {emoji,title,subtitle} ; sinon repli sur l'ancien
// restDay.html (compat).
function restBodyHTML(){
  var card=CONFIG.restDay&&CONFIG.restDay.card;
  return card?pauseCardHTML({emoji:card.emoji,title:card.title,subtitle:card.subtitle,color:card.color||CONFIG.noSideIconColor}):CONFIG.restDay.html;
}

// Prochain exercice à faire de la séance du jour = le premier de la liste
// encore non coché (on saute les bannières et l'échauffement). Sert au badge
// d'en-tête dynamique. Retourne null si repos ou séance terminée.
function nextGuidedExercise(){
  if(TI<0)return null;
  var day=CONFIG.days[TI];
  for(var i=0;i<day.exercises.length;i++){
    var ex=day.exercises[i];
    if(ex.banner||ex.cat==='warmup')continue;
    if(!S.done[ex.id])return ex;
  }
  return null;
}
// Badge d'en-tête DYNAMIQUE (partagé par les 3) : au lieu d'un « 4×12 » figé,
// il annonce le PROCHAIN exercice à faire et son objectif séries×reps
// (getReps de l'exercice), et se met à jour tout seul à chaque validation
// (buildHTML reconstruit tout l'écran). Repos / vacances / séance finie : un
// message court à la place. Styles en ligne -> aucune dépendance CSS par app.
function programBadgeHTML(){
  var ac=CONFIG.accentColor;
  var value;
  if(isVacationOn())value='Vacances';
  else if(TI<0)value='Repos';
  else{
    var nx=nextGuidedExercise();
    value=nx?((getReps(nx)||'').replace(/\s*reps?\.?$/i,'')||'—'):'Terminé';
  }
  // Label « PROGRAMME » figé en haut ; en dessous, CENTRÉ, l'objectif
  // séries×reps du prochain exercice à faire (aucun nom d'exo). Dynamique : il
  // avance au suivant à chaque validation. Repos/Vacances/Terminé -> mot court.
  return '<div style="background:'+ac+'26;border:1.5px solid '+ac+';border-radius:14px;padding:8px 16px;min-width:96px;text-align:center">'
    +'<div style="font-size:8px;font-weight:800;letter-spacing:1.5px;color:'+ac+';opacity:.85;text-transform:uppercase">PROGRAMME</div>'
    +'<div style="font-size:24px;font-weight:900;color:'+ac+';line-height:1.05;margin-top:2px">'+value+'</div>'
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
    var td=isRest?null:CONFIG.days[TI];
    var bodyHTML2;
    if(isStats){
      bodyHTML2=statsPageHTML();
    }else if(S.mode==='week'){
      // SEMAINE : TOUJOURS toutes les journées d'entraînement, pour tout le
      // monde. Jamais de carte "repos" ni "vacances" ici — on doit pouvoir
      // consulter tout le programme (jours d'avant/d'après) à tout moment.
      // Le repos et les vacances ne s'affichent QUE sur AUJOURD'HUI.
      bodyHTML2='<div class="days">'+CONFIG.days.map(function(d,i){return dayHTML(d,i,false);}).join('')+'</div>';
    }else if(isVacationOn()){
      // AUJOURD'HUI en mode vacances : carte "en pause" à la place de la séance
      // (le compte à rebours et les stats sont gelés). STAT reste accessible.
      bodyHTML2='<div class="days">'+pauseCardHTML({
        emoji:'&#127958;&#65039;',
        title:'VACANCES',
        subtitle:'Programme en pause. Reprends quand tu rentres — le compte à rebours et tes stats sont gelés.',
        color:CONFIG.accentColor
      })+'</div>';
    }else{
      // AUJOURD'HUI : jour de repos -> carte repos ; sinon la séance du jour.
      // (Jamais de prévisualisation du lendemain.)
      bodyHTML2='<div class="days">'+(isRest?restBodyHTML():dayHTML(td,TI,true))+'</div>';
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
    +'<div><div class="dll">&#128197; '+CONFIG.deadlineLabel+'</div><div class="dld">'+(CONFIG.dynamicDeadlineDate?effectiveDeadlineDateText():CONFIG.deadlineDateText)+'</div></div>'
    +'<div style="text-align:right">'+jleftHTML()+'</div>'
    +'</div>'
    +'</div>'
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
    +'<button id="btn-version" style="background:transparent;border:none;color:'+c+';cursor:pointer;padding:10px 12px;text-align:right;font-size:15px;font-weight:800;line-height:1">v'+ENGINE_VERSION+'.'+(CONFIG.configVersion==null?0:CONFIG.configVersion)+'</button>'
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
// Couleur du score, calée sur la fourchette : >=100 (au moins à l'objectif)
// vert, au-dessus du plancher rouge orange, en dessous rouge.
function scoreColorFor(score){
  if(score>=100)return CONFIG.weightColors.fresh;
  if(score>=statsTarget('minLevel',MIN_LEVEL_DEFAULT))return CONFIG.weightColors.aging;
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
  if(diff<=-6)return {text:'&#128201; En baisse',color:CONFIG.weightColors.old};
  return {text:'&#8594; Stable',color:c};
}

function statsPageHTML(){
  var history=ld(K('statsHistory'),[]);
  var c=CONFIG.noSideIconColor;
  var ac=CONFIG.accentColor;
  var onVac=isVacationOn();
  var last=history.length?history[history.length-1]:null;
  var centerHTML;
  if(last){
    var status=statsStatusLine(history);
    var elapsed=daysSinceFirstEntry(history);
    var today=last.score;
    // Le gros chiffre = la note du jour. En dessous, les moyennes glissantes
    // — mais on n'affiche QUE celles qui DIFFÈRENT de la note du jour :
    // quand il y a peu d'historique, 7j/30j valent la même chose que le jour,
    // c'est répétitif et ça n'apporte rien. Chaque fenêtre longue (3/6/12
    // mois) n'apparaît en plus qu'une fois ce recul réellement écoulé.
    var windows=[{label:'moy. 7j',n:7,min:0},{label:'moy. 30j',n:30,min:0},
      {label:'moy. 3 mois',n:90,min:90},{label:'moy. 6 mois',n:180,min:180},{label:'moy. 1 an',n:365,min:365}];
    var chips=[];
    windows.forEach(function(w){
      if(elapsed<w.min)return;
      var v=rollingAverage(history,w.n);
      if(v!==today)chips.push({label:w.label,val:v}); // seulement si différent
    });
    centerHTML='<div style="text-align:center"><span style="font-family:Impact,sans-serif;font-size:3.2rem;line-height:1;color:'+scoreColorFor(today)+'">'+today+'%</span></div>'
      +'<div style="text-align:center;font-size:11.5px;font-weight:700;color:'+status.color+';margin-top:4px">'+status.text+'</div>'
      +(chips.length?'<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-top:8px">'
        +chips.map(function(ch){return '<div style="text-align:center"><div style="font-size:14px;font-weight:800;color:'+scoreColorFor(ch.val)+'">'+ch.val+'%</div><div style="font-size:9px;color:'+c+'">'+ch.label+'</div></div>';}).join('')
      +'</div>':'');
  }else{
    centerHTML='<div style="text-align:center;font-size:12px;color:'+c+';padding:14px 0;line-height:1.4">Pas encore d’historique.<br>Reviens après quelques séances.</div>';
  }
  // Les deux petits boutons encadrent la note, dans les zones vides à gauche
  // et à droite : Vacances (met le programme en pause) à gauche, Reset (efface
  // l'historique du graphique) à droite. Toujours visibles en haut de STAT,
  // sans avoir à descendre.
  var vacBtn='<button id="btn-vacation" style="flex:0 0 auto;font-size:10px;font-weight:800;letter-spacing:.2px;padding:7px 9px;border-radius:10px;cursor:pointer;line-height:1.15;text-align:center;background:'+ac+(onVac?'33':'14')+';border:1.5px solid '+ac+(onVac?'':'55')+';color:'+ac+'">'+(onVac?'&#9208;&#65039;<br>En pause':'&#127958;&#65039;<br>Vacances')+'</button>';
  var resetBtn='<button id="btn-reset" style="flex:0 0 auto;font-size:10px;font-weight:800;letter-spacing:.2px;padding:7px 9px;border-radius:10px;cursor:pointer;line-height:1.15;text-align:center;background:transparent;border:1.5px solid '+c+'55;color:'+c+'">&#8635;<br>Reset</button>';
  var topRow='<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">'
    +vacBtn+'<div style="flex:1;min-width:0">'+centerHTML+'</div>'+resetBtn
    +'</div>';
  return '<div class="days" style="padding-top:14px">'
    +'<div class="dc" style="padding:14px 14px 12px">'
    +topRow
    +'<div style="height:10px"></div>'
    +statsChartSVG(history)
    +'<div style="font-size:9.5px;color:'+c+';text-align:center;margin-top:8px"><span style="color:'+CONFIG.weightColors.fresh+'">&#9473; vise haut</span> &#8226; <span style="color:'+CONFIG.weightColors.old+'">&#9473; plancher</span> &#8226; régularité + charges = bonus</div>'
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
  var stepX=18,axisW=26,padR=16,padT=12,padB=28,h=330;
  var innerH=h-padT-padB;
  var innerW=Math.max(1,n-1)*stepX;
  var svgW=innerW+padR+8;
  // Fourchette : ligne verte "objectif haut" (au-dessus de 100) et ligne
  // rouge "plancher" (en dessous de 100). Osciller entre les deux est normal ;
  // au-dessus du vert = très bien, sous le rouge = vraiment négatif.
  var goodLevel=statsTarget('goodLevel',GOOD_LEVEL_DEFAULT);
  var minLevel=statsTarget('minLevel',MIN_LEVEL_DEFAULT);
  var greenCol=CONFIG.weightColors.fresh;
  var redCol=CONFIG.weightColors.old;
  var maxScore=goodLevel; // l'axe monte au moins jusqu'à la ligne verte
  for(var i=0;i<n;i++){if(history[i].score>maxScore)maxScore=history[i].score;}
  var yMax=Math.max(100,Math.ceil((maxScore+10)/25)*25);
  function xAt(i){return 8+i*stepX;}
  function yAt(score){return padT+innerH-(score/yMax*innerH);}
  var pts=[];for(var i=0;i<n;i++)pts.push(xAt(i)+','+yAt(history[i].score));
  var pointsStr=pts.join(' ');
  var areaStr=pointsStr+' '+xAt(n-1)+','+(padT+innerH)+' '+xAt(0)+','+(padT+innerH);
  var gridVals=[];for(var v=0;v<=yMax;v+=25)gridVals.push(v);
  var gridlines=gridVals.map(function(v){
    // La ligne 100 n'a plus de traitement spécial (pointillé violet retiré) :
    // c'est une ligne de grille neutre comme les autres. La fourchette
    // verte/rouge suffit à situer le niveau.
    return '<line x1="0" y1="'+yAt(v)+'" x2="'+svgW+'" y2="'+yAt(v)+'" stroke="'+c+'" stroke-opacity=".15" stroke-width="1"/>';
  }).join('');
  // Les deux lignes repères de la fourchette (pointillés verts/rouges).
  var bandLines=''
    +'<line x1="0" y1="'+yAt(goodLevel)+'" x2="'+svgW+'" y2="'+yAt(goodLevel)+'" stroke="'+greenCol+'" stroke-opacity=".8" stroke-width="1.2" stroke-dasharray="5,3"/>'
    +'<line x1="0" y1="'+yAt(minLevel)+'" x2="'+svgW+'" y2="'+yAt(minLevel)+'" stroke="'+redCol+'" stroke-opacity=".8" stroke-width="1.2" stroke-dasharray="5,3"/>';
  // Espace mini entre deux étiquettes (~34px) pour qu'elles ne se chevauchent
  // pas : on saute des points selon la largeur d'un label rapportée à stepX.
  var labelEvery=Math.max(1,Math.ceil(n/25),Math.ceil(34/stepX));
  var marks=history.map(function(hpt,i){
    var showLabel=(i%labelEvery===0)||i===n-1;
    return '<circle cx="'+xAt(i)+'" cy="'+yAt(hpt.score)+'" r="3" fill="'+ac+'"/>'
      +(showLabel?('<text x="'+xAt(i)+'" y="'+(yAt(hpt.score)-8)+'" font-size="8" font-weight="700" fill="'+ac+'" text-anchor="middle">'+hpt.score+'</text>'
        +'<text x="'+xAt(i)+'" y="'+(padT+innerH+16)+'" font-size="7.5" fill="'+c+'" text-anchor="middle">'+shortDateFR(hpt.date)+'</text>'):'');
  }).join('');
  var axisLabels=gridVals.map(function(v){
    return '<div style="position:absolute;left:0;top:'+(yAt(v)-6)+'px;font-size:8px;color:'+c+';font-weight:400">'+v+'</div>';
  }).join('')
    // Étiquettes des lignes de la fourchette, dans leur couleur.
    +'<div style="position:absolute;left:0;top:'+(yAt(goodLevel)-6)+'px;font-size:8px;font-weight:700;color:'+greenCol+'">'+goodLevel+'</div>'
    +'<div style="position:absolute;left:0;top:'+(yAt(minLevel)-6)+'px;font-size:8px;font-weight:700;color:'+redCol+'">'+minLevel+'</div>';
  return '<div style="display:flex;align-items:stretch;gap:2px">'
    +'<div style="width:'+axisW+'px;flex-shrink:0;position:relative;height:'+h+'px">'+axisLabels+'</div>'
    +'<div id="stats-scroll" style="overflow-x:auto;-webkit-overflow-scrolling:touch;flex:1">'
    +'<svg width="'+svgW+'" height="'+h+'" viewBox="0 0 '+svgW+' '+h+'" style="display:block">'
    +'<defs><linearGradient id="statsGrad" x1="0" y1="0" x2="0" y2="1">'
    +'<stop offset="0%" stop-color="'+ac+'" stop-opacity=".35"/>'
    +'<stop offset="100%" stop-color="'+ac+'" stop-opacity="0"/>'
    +'</linearGradient></defs>'
    +gridlines
    +bandLines
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
// La couleur (vert/jaune/rouge selon l'ancienneté, cf. getWCol) est le seul
// rappel de progression : pas de suggestion de poids chiffrée.
// Le poids n'est affiché qu'une seule fois, dans le menu déroulant lui-même
// (couleur du texte/bordure = fraîcheur, vert/jaune/rouge) — pas de badge
// répétant "X kg" à côté, qui n'ajoutait rien de plus que de la répétition.
function weightCtrl(key,ec,sideLabel,isDB){
  var w=S.weights[key]||'';
  var opts=isDB?WOPT.db:WOPT.mc;
  var hasW=!!(w&&w!=='—');
  var wc=hasW?getWCol(key):CONFIG.weightColors.none;
  var selOpts=opts.map(function(o){return '<option value="'+o+'"'+(o===(w||'—')?' selected':'')+'>'+(o==='—'?'Sélectionner kg':o+' kg')+'</option>';}).join('');
  // Rectangle de poids :
  //  - padding gauche 86 / droite 50 = largeurs icône+marges / coche+marges :
  //    il est donc aligné sur la COLONNE DE TEXTE, centré sur le même axe que
  //    le titre / le texte / les badges.
  //  - padding vertical 16/16 : il est CENTRÉ dans la bande grise sous
  //    l'exercice (plus collé à la ligne du dessus).
  //  - largeur ~85 % (≈ deux badges) sans dépasser la description ; réduite à
  //    58 % sur les lignes à libellé (Bras/Jambe G/D de Mikael) pour que le
  //    libellé + le sélecteur tiennent sur la même ligne.
  var selW=sideLabel?'58%':'85%';
  return '<div class="wrow" style="padding:6px 50px 8px 86px;justify-content:center">'
    +(sideLabel?'<span class="wside" style="color:'+ec+'">'+sideLabel+'</span>':'')
    +'<select class="wsel" data-id="'+key+'" style="width:'+selW+';color:'+(hasW?wc:CONFIG.noSideIconColor)+';border-color:'+(hasW?wc+'60':'#2a2a30')+'">'+selOpts+'</select>'
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
  var repsChip=CONFIG.showRepsChip
    ?'<div style="margin-top:5px"><span style="display:inline-block;padding:4px 12px;border-radius:8px;border:2px solid '+(done?'rgba(46,204,113,.5)':ec+'80')+';background:'+(done?'rgba(46,204,113,.12)':ec+'18')+';color:'+(done?CONFIG.weightColors.fresh:ec)+';font-size:11.5px;font-weight:900;letter-spacing:.3px">'+reps+'</span></div>'
    :'';
  var noWeight=ex.isBW||(CONFIG.noWeightCategories&&CONFIG.noWeightCategories.indexOf(ex.cat)>=0);
  var wRow=noWeight?'':renderWeightRow(ex,ec);
  // Exercice fait : TOUT le bloc passe en vert (contenu + zone du poids), pour
  // que le rectangle de poids ne soit plus isolé sur le fond. Une ligne de
  // séparation verte, un peu plus épaisse, délimite deux exercices faits
  // d'affilée (sinon tout serait vert d'un bloc).
  return '<div class="exrow" style="'+(done?'background:rgba(46,204,113,.08);border-bottom:2px solid rgba(46,204,113,.38)':'')+'">'
    +'<div class="extap" data-id="'+ex.id+'" style="background:transparent">'
    +'<div class="exicon" style="align-self:center;background:'+(done?'rgba(46,204,113,.1)':'#111113')+';border-color:'+(done?'rgba(46,204,113,.3)':'#252528')+'">'+mkIcon(ex.icon,done?CONFIG.weightColors.fresh:ec,52)+'</div>'
    +'<div class="excnt">'
    +'<div class="exnm" style="text-align:center;color:'+(done?CONFIG.weightColors.fresh:CONFIG.exerciseNameColor)+'">'+ex.name+'</div>'
    +repsChip
    +'<div class="extip" style="text-align:center">'+ex.tip+'</div>'
    +'<div class="exbadges" style="justify-content:center">'+catB+isoB+extraBadgeHTML(ex)+'</div>'
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
