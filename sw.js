// Service worker partagé par les 3 apps (Anthony/Mikael/Myriam), enregistré
// depuis engine.js avec le scope du dossier parent (../) pour couvrir les
// 3 sous-dossiers. Stratégie "stale-while-revalidate" : sert la version en
// cache immédiatement si elle existe (fonctionne hors-ligne), et la met à
// jour en arrière-plan pour la prochaine visite. Le cache-busting existant
// (?v=1, ?v=2...) sur engine.js continue de fonctionner normalement car
// chaque version a une URL différente.
var CACHE_NAME='fitness-cache-v1';

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
