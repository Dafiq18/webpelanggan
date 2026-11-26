/* Dipasang di pesanan.html lewat: <script src="pesanan-lacak.js"></script>
   1) Status yang dilihat pelanggan (halaman Pesanan Saya) SELALU disamakan dengan status di halaman pesanan ini.
      - Saat tombol status ditekan: catatan "status" ikut diperbarui, dan kalau gagal admin diberi tahu.
      - Saat halaman dibuka (admin sudah masuk): semua pesanan dicek, yang tidak sama otomatis diperbaiki.
   2) Saat pesanan ditandai "Selesai": mengurangi stok (dalam ML) parfum yang dihitung stoknya.
      Contoh: 2 botol ukuran 50 ML = stok berkurang 100 ML. Hanya sekali per pesanan. */
(function(){
  var SAH={baru:1,proses:1,kirim:1,selesai:1,batal:1};
  function idDoc(k){return String(k).replace(/\//g,"_");}
  function ml(u){var m=/(\d+(?:[.,]\d+)?)/.exec(String(u||""));return m?Number(m[1].replace(",",".")):0;}
  function info(t,gagal){
    try{
      var e=document.getElementById("lcInfo");
      if(!e){ e=document.createElement("div"); e.id="lcInfo"; e.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:99999;max-width:92vw;padding:12px 16px;border-radius:12px;font:700 13px system-ui,sans-serif;color:#fff;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5)"; document.body.appendChild(e); }
      e.style.background=gagal?"#b91c1c":"#15803d"; e.textContent=t; e.style.display="block";
      clearTimeout(info.h); info.h=setTimeout(function(){ e.style.display="none"; },gagal?7000:2500);
    }catch(x){}
  }
  function tulisStatus(db,id,st){
    var f=window.firebase;
    return db.collection("status").doc(id).set({ nomor:id, status:st, diperbarui:f.firestore.FieldValue.serverTimestamp() });
  }
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
  /* tombol status ditekan */
  document.addEventListener("click",function(e){
    var b=e.target.closest&&e.target.closest("[data-st]");
    if(!b||!b.dataset.id||!SAH[b.dataset.st]) return;
    try{
      var f=window.firebase, db=f.firestore(), id=b.dataset.id, st=b.dataset.st;
      tulisStatus(db,id,st).then(function(){ rekam(id,st); }).catch(function(er){
        info("⚠️ Status di halaman pelanggan GAGAL diperbarui ("+((er&&er.code)||"error")+"). Cek Rules database untuk 'status'.",true);
      });
      if(st==="selesai") kurangiStok(db,id).catch(function(){});
    }catch(x){}
  });
  /* cadangan ingatan: status terakhir yang sudah berhasil disalin per pesanan */
  var KUNCI="aromaSinkronStatus";
  function baca(){ try{ return JSON.parse(localStorage.getItem(KUNCI)||"{}")||{}; }catch(e){ return {}; } }
  function rekam(id,st){ try{ var a=baca(); a[id]=st; localStorage.setItem(KUNCI,JSON.stringify(a)); }catch(e){} }
  /* otomatis: samakan semua status pelanggan dengan data pesanan */
  function sinkron(){
    try{
      var f=window.firebase; if(!f||!f.auth||!f.apps||!f.apps.length) return setTimeout(sinkron,1000);
      var db=f.firestore(), mulai=false;
      f.auth().onAuthStateChanged(function(u){
        if(!u||mulai) return; mulai=true;
        db.collection("pesanan").orderBy("dibuat","desc").limit(300).onSnapshot(function(snap){
          var ingat=baca(), antri=[];
          snap.docs.forEach(function(d){ var x=d.data()||{}, st=x.status; if(SAH[st] && ingat[d.id]!==st) antri.push([d.id,st]); });
          if(!antri.length) return;
          var gagal=0, ok=0;
          Promise.all(antri.map(function(p){ return tulisStatus(db,p[0],p[1]).then(function(){ rekam(p[0],p[1]); ok++; }).catch(function(){ gagal++; }); })).then(function(){
            if(gagal) info("⚠️ "+gagal+" status pesanan gagal disamakan ke halaman pelanggan. Cek Rules database untuk 'status'.",true);
            else if(ok) info("✔ "+ok+" status pelanggan disamakan",false);
          });
        },function(){});
      });
    }catch(x){}
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",function(){ setTimeout(sinkron,800); }); else setTimeout(sinkron,800);
})();
