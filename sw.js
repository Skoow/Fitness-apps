// Service worker partagé par les 3 apps (Anthony/Mikael/Myriam), enregistré
// depuis engine.js avec le scope du dossier parent (../) pour couvrir les
// 3 sous-dossiers.
//
// Deux stratégies selon le type de requête :
// - Pages HTML (navigation, ex : ouvrir l'app) : réseau en premier, cache en
//   secours seulement si hors-ligne. Comme index.html contient le programme
//   (exercices, thème) et n'a pas de cache-busting comme engine.js, on veut
//   toujours la dernière version dès qu'il y a du réseau.
// - Tout le reste (engine.js, manifest.json, icônes) : cache en premier avec
//   mise à jour en arrière-plan ("stale-while-revalidate") — plus rapide,
//   et engine.js a de toute façon son propre ?v=1/?v=2 pour forcer le
//   rechargement quand il change.
// Nom du cache : à INCRÉMENTER pour purger d'un coup tout l'ancien contenu
// mis en cache (index.html/engine.js périmés) — l'ancien cache est supprimé
// dans l'événement "activate" ci-dessous. Utile quand une vieille version
// reste collée sur un téléphone malgré le cache-busting ?v=X.Y.
var CACHE_NAME='fitness-cache-v29';

self.addEventListener('install',function(event){
  self.skipWaiting();
});

self.addEventListener('activate',function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){return k!==CACHE_NAME;}).map(function(k){return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});

self.addEventListener('fetch',function(event){
  if(event.request.method!=='GET')return;

  var isPage=event.request.mode==='navigate'||(event.request.headers.get('accept')||'').indexOf('text/html')!==-1;

  if(isPage){
    // "reload" force à contourner le cache HTTP classique du navigateur (pas
    // celui du service worker) — sans ça, fetch() peut se contenter d'une
    // réponse déjà en cache navigateur sans vraiment revalider avec le
    // serveur, et une mise à jour peut mettre du temps à apparaître.
    event.respondWith(
      fetch(event.request,{cache:'reload'}).then(function(response){
        if(response&&response.ok){
          caches.open(CACHE_NAME).then(function(cache){cache.put(event.request,response.clone());});
        }
        return response;
      }).catch(function(){
        return caches.open(CACHE_NAME).then(function(cache){return cache.match(event.request);});
      })
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.match(event.request).then(function(cached){
        var networkFetch=fetch(event.request).then(function(response){
          if(response&&response.ok){cache.put(event.request,response.clone());}
          return response;
        }).catch(function(){return cached;});
        return cached||networkFetch;
      });
    })
  );
});
