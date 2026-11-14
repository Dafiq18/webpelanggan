/* Dipasang di pesanan.html lewat: <script src="pesanan-lacak.js"></script>
   1) Menyalin perubahan status pesanan ke catatan "status" (untuk halaman Lacak Pesanan pelanggan).
   2) Saat pesanan ditandai "Selesai": mengurangi stok (dalam ML) parfum yang dihitung stoknya.
      Contoh: 2 botol ukuran 50 ML = stok berkurang 100 ML. Hanya sekali per pesanan. */
(function(){
  function idDoc(k){return String(k).replace(/\//g,"_");}
  function ml(u){var m=/(\d+(?:[.,]\d+)?)/.exec(String(u||""));return m?Number(m[1].replace(",",".")):0;}
  function kurangiStok(db,id){
    var ref=db.collection("pesanan").doc(id);
    return ref.get().then(function(s){
      if(!s.exists) return;
      var p=s.data(); if(p.stokDipotong) return;
      var jml={}; (p.items||[]).forEach(function(i){
        var k=i.kode&&idDoc(i.kode), v=ml(i.ukuran)*(Number(i.qty)||1);
        if(k&&v>0) jml[k]=(jml[k]||0)+v;
      });
      return Promise.all(Object.keys(jml).map(function(k){
        var r=db.collection("stok").doc(k);
        return r.get().then(function(d){
          if(!d.exists||typeof d.data().jumlah!=="number") return;
          return r.set({jumlah:Math.max(0,d.data().jumlah-jml[k])});
        });
      })).then(function(){ return ref.update({stokDipotong:true}); });
    });
  }
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-st]");
    if(!b||!b.dataset.id) return;
    try{
      var f=window.firebase, db=f.firestore();
      db.collection("status").doc(b.dataset.id).set({
        nomor:b.dataset.id, status:b.dataset.st, diperbarui:f.firestore.FieldValue.serverTimestamp()
      }).catch(function(){});
      if(b.dataset.st==="selesai") kurangiStok(db,b.dataset.id).catch(function(){});
    }catch(x){}
  });
})();
