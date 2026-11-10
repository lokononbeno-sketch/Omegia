(() => {
  const VERSION_URLS=["https://gitlab.com/api/v4/projects/88621748/repository/files/version.json/raw?ref=main","https://omegia.netlify.app/version.json","https://gitlab.com/lokononbeno/omegia-social/-/raw/main/version.json"];
  const CURRENT_VERSION="1.0.17";
  const APK_URL="https://gitlab.com/api/v4/projects/88621748/jobs/artifacts/main/raw/dist/OMEGIA.apk?job=android-apk";
  const style=document.createElement("style");
  style.textContent="#om-update-chip{position:fixed;right:14px;bottom:calc(82px + env(safe-area-inset-bottom,0px));z-index:9998;border:0;border-radius:999px;padding:11px 15px;background:#7652d6;color:#fff;font-weight:700;box-shadow:0 5px 22px #0003}#om-update-panel{position:fixed;inset:0;z-index:9999;background:#090711bb;display:grid;place-items:center;padding:20px}#om-update-card{width:min(100%,380px);background:#fff;color:#211b30;border-radius:20px;padding:22px;box-shadow:0 18px 60px #0005;font:15px system-ui}#om-update-card h3{margin:0 0 8px;font-size:20px}#om-update-card p{line-height:1.5}#om-update-card button{border:0;border-radius:12px;padding:12px 15px;font-weight:700;margin:5px 5px 0 0}#om-update-install{background:#7652d6;color:white}#om-update-later{background:#eeeaf5;color:#302743}";
  document.head.appendChild(style);
  const chip=document.createElement("button");chip.id="om-update-chip";chip.type="button";chip.hidden=true;chip.textContent="v"+CURRENT_VERSION+" · Vérifier";
  const panel=document.createElement("div");panel.id="om-update-panel";panel.hidden=true;
  panel.innerHTML='<section id="om-update-card" role="dialog" aria-modal="true" aria-labelledby="om-update-title"><h3 id="om-update-title">Mise à jour OMEGIA</h3><p id="om-update-message">Vérification…</p><button id="om-update-install" type="button" hidden>Télécharger l’APK</button><button id="om-update-later" type="button">Fermer</button></section>';
  document.body.append(chip,panel);
  const msg=panel.querySelector("#om-update-message"),install=panel.querySelector("#om-update-install");
  function open(message,available){msg.textContent=message;install.hidden=!available;panel.hidden=false;}
  panel.querySelector("#om-update-later").addEventListener("click",()=>panel.hidden=true);
  install.addEventListener("click",()=>{const a=document.createElement("a");a.href=APK_URL;a.target="_blank";a.rel="noopener";a.download="OMEGIA.apk";document.body.appendChild(a);a.click();a.remove();});
  async function check(silent=false){
    chip.disabled=true;if(!silent)chip.hidden=false;chip.textContent="Vérification…";
    try{
      let latest=null,lastErr=null;
      for(const u of VERSION_URLS){try{const response=await fetch(u+(u.includes("?")?"&":"?")+"t="+Date.now(),{cache:"no-store"});if(!response.ok)throw new Error("Le serveur a répondu "+response.status+".");latest=await response.json();break;}catch(e){lastErr=e;}}
      if(!latest)throw lastErr||new Error("Serveur injoignable.");if(!latest.version)throw new Error("Numéro de version absent.");
      const newer=String(latest.version).localeCompare(CURRENT_VERSION,undefined,{numeric:true,sensitivity:"base"})>0;
      if(newer){open("La version "+latest.version+" est disponible. Télécharge l’APK, ouvre le fichier puis confirme l’installation Android.",true);chip.textContent="v"+CURRENT_VERSION+" · Mise à jour disponible";chip.hidden=false;}
      else{chip.textContent="v"+CURRENT_VERSION+" · À jour";chip.hidden=true;if(!silent)open("Tu utilises déjà la version "+CURRENT_VERSION+". Aucune mise à jour plus récente n’est publiée.",false);}
    }catch(error){
      chip.textContent="v"+CURRENT_VERSION+" · Télécharger l’APK";chip.hidden=silent;
      if(!silent)open("Je n’arrive pas à lire le numéro de la dernière version (réseau ou serveur de mises à jour injoignable : "+(error.message||"connexion indisponible")+"). Tu peux tout de même télécharger la dernière APK publiée sur GitLab.",true);
    }finally{chip.disabled=false;}
  }
  chip.addEventListener("click",()=>check(false));
  window.addEventListener("online",()=>check(true));
  setTimeout(()=>check(true),5000);
})();
/* Œil OMEGIA : suit le doigt, puis reprend son animation après 2,5 s */
(()=>{
  const eyes=[...document.querySelectorAll(".om-eye")];
  if(!eyes.length)return;
  const MAXX=3.5,MAXY=7;let timer=null;
  function look(x,y){
    eyes.forEach(eye=>{
      if(!eye.getClientRects().length)return;
      const r=eye.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;
      const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy)||1,k=Math.min(1,d/120);
      eye.style.setProperty("--ex",(dx/d*MAXX*k).toFixed(2)+"px");
      eye.style.setProperty("--ey",(dy/d*MAXY*k).toFixed(2)+"px");
      eye.classList.add("om-eye-follow");
    });
    clearTimeout(timer);
    timer=setTimeout(()=>eyes.forEach(e=>e.classList.remove("om-eye-follow")),2500);
  }
  const handler=e=>{const t=(e.touches&&e.touches[0])||e;if(typeof t.clientX==="number")look(t.clientX,t.clientY);};
  ["pointermove","pointerdown","touchstart","touchmove"].forEach(n=>window.addEventListener(n,handler,{passive:true}));
})();
