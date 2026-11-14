/* Service worker sederhana: halaman dan gambar logo diambil dari internet lebih dulu,
   kalau sedang offline baru memakai salinan terakhir. Data (produk.json, stok, pesanan) tidak pernah disimpan di sini. */
var VERSI = "aroma-v1";
self.addEventListener("install", function(){ self.skipWaiting(); });
self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(k){ return Promise.all(k.filter(function(n){ return n!==VERSI; }).map(function(n){ return caches.delete(n); })); }).then(function(){ return self.clients.claim(); }));
});
self.addEventListener("fetch", function(e){
  var r = e.request, u = new URL(r.url);
  if (r.method!=="GET" || u.origin!==location.origin || u.search) return;       /* hanya file milik toko, tanpa ?parameter */
  var perlu = r.mode==="navigate" || /\.(png|jpg|jpeg|webp|svg|ico|webmanifest)$/i.test(u.pathname);
  if (!perlu) return;
  e.respondWith(
    fetch(r).then(function(res){
      if (res && res.ok) { var salinan = res.clone(); caches.open(VERSI).then(function(c){ c.put(r, salinan); }); }
      return res;
    }).catch(function(){
      return caches.match(r).then(function(c){ return c || (r.mode==="navigate" ? caches.match("./") : undefined); });
    })
  );
});
