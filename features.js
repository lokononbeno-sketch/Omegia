/* OMEGIA — lot 1 d’activation : réglages fonctionnels, reels, statistiques du profil.
   Chargé après social.js ; s’appuie sur window.omegiaSocial (modal, toast, db, user, media, esc). */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const S=()=>window.omegiaSocial||{};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch{return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
};
const toast=s=>(S().toast?S().toast(s):alert(s));
const CLOSE='<div class="om-actions"><button type="button" class="om-cancel" data-close>Fermer</button></div>';
function openPanel(title,html){
  if(!S().modal){alert("Le module social est en cours de chargement. Réessaie dans un instant.");return null;}
  const w=S().modal(title,html+CLOSE);
  w.querySelectorAll("[data-close]").forEach(b=>{b.onclick=()=>w.remove();});
  return w;
}
const st=document.createElement("style");
st.textContent=".om-toggle{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #eee}.om-toggle input{width:auto!important;margin:0!important}.om-line{display:flex;justify-content:space-between;gap:10px;padding:8px 0;border-bottom:1px solid #eee}.om-panel select{width:100%;padding:10px;border-radius:10px;border:1px solid #d8d1e8;font:inherit;margin:7px 0}.om-legal p{margin:8px 0;line-height:1.5}.om-legal h3{margin:14px 0 4px;font-size:16px}.om-feed-actions{gap:4px;flex-wrap:wrap}.om-feed-actions button{font-size:13px;padding:7px 4px}.dark-mode .om-toggle,.dark-mode .om-line{border-color:#352f48}.dark-mode .om-panel select{background:#2d2840;color:#eee9f7;border-color:#453d5e}";
document.head.appendChild(st);

/* ---------- Notifications du navigateur ---------- */
const PREF_NOTIF="omegia.pref.browserNotif";
function notifSettings(){
  const supported="Notification" in window;
  const w=openPanel("Notifications",
    '<p class="om-note" id="omNState"></p>'
    +'<label class="om-toggle"><span>Alertes du navigateur (messages, invitations)</span><input type="checkbox" id="omNToggle"></label>'
    +'<p class="om-note">Les alertes s’affichent quand OMEGIA est ouvert en arrière-plan. Les notifications application fermée nécessiteront une étape serveur (Web Push), non incluse dans ce lot.</p>');
  if(!w)return;
  const t=w.querySelector("#omNToggle"),state=w.querySelector("#omNState");
  const paint=()=>{
    if(!supported){state.textContent="Ce navigateur ne gère pas les notifications.";t.disabled=true;t.checked=false;return;}
    const p=Notification.permission;
    state.textContent=p==="granted"?"Autorisation du navigateur : accordée.":p==="denied"?"Autorisation refusée : modifie-la dans les réglages du navigateur ou de l’appareil.":"Autorisation du navigateur : pas encore demandée.";
    t.checked=p==="granted"&&store.get(PREF_NOTIF,false);
    t.disabled=p==="denied";
  };
  t.onchange=async()=>{
    if(t.checked&&Notification.permission!=="granted"){try{await Notification.requestPermission();}catch{}}
    store.set(PREF_NOTIF,t.checked&&Notification.permission==="granted");
    paint();
  };
  paint();
}
if(window.omegiaSocial){
  window.omegiaSocial.onToast=s=>{
    if(!("Notification" in window)||Notification.permission!=="granted"||!store.get(PREF_NOTIF,false)||!document.hidden)return;
    if(!/^(💬|🤝)/.test(String(s)))return;
    try{new Notification("OMEGIA",{body:String(s).replace(/^\S+\s*/,""),icon:"assets/omega.svg",tag:"omegia-"+Date.now()});}catch{}
  };
}

/* ---------- Autorisations de l’appareil ---------- */
function devicePerms(){
  const w=openPanel("Autorisations de l’appareil",'<div id="omPerms"><p class="om-note">Vérification…</p></div><div class="om-actions"><button type="button" id="omAskMic">Autoriser le micro</button><button type="button" id="omAskCam">Autoriser la caméra</button></div><p class="om-note">Une autorisation refusée doit être modifiée dans les réglages du navigateur ou de l’appareil.</p>');
  if(!w)return;
  const labels={granted:"Autorisé",denied:"Refusé",prompt:"À demander"};
  const list=[["notifications","Notifications"],["microphone","Microphone"],["camera","Caméra"],["geolocation","Localisation"]];
  const paint=async()=>{
    const box=w.querySelector("#omPerms");box.innerHTML="";
    for(const [n,l] of list){
      let s="Non disponible";
      try{const r=await navigator.permissions.query({name:n});s=labels[r.state]||r.state;}catch{}
      const row=document.createElement("div");row.className="om-line";
      row.innerHTML="<span>"+esc(l)+"</span><strong>"+esc(s)+"</strong>";
      box.appendChild(row);
    }
  };
  const ask=kind=>async()=>{
    try{const stream=await navigator.mediaDevices.getUserMedia(kind==="mic"?{audio:true}:{video:true});stream.getTracks().forEach(t=>t.stop());}
    catch{toast("Autorisation non accordée.");}
    paint();
  };
  w.querySelector("#omAskMic").onclick=ask("mic");
  w.querySelector("#omAskCam").onclick=ask("cam");
  paint();
}

/* ---------- Contenu multimédia : économie de données ---------- */
const PREF_SAVER="omegia.pref.dataSaver";
let saverObs=null;
function applySaver(on){
  const set=m=>{m.preload=on?"none":"metadata";};
  document.querySelectorAll("video,audio").forEach(set);
  if(saverObs){saverObs.disconnect();saverObs=null;}
  if(!on)return;
  saverObs=new MutationObserver(list=>list.forEach(r=>r.addedNodes.forEach(n=>{
    if(n.nodeType!==1)return;
    if(n.matches("video,audio"))set(n);
    n.querySelectorAll("video,audio").forEach(set);
  })));
  saverObs.observe(document.body,{childList:true,subtree:true});
}
function mediaSettings(){
  const w=openPanel("Contenu multimédia",'<label class="om-toggle"><span>Économiser les données (ne pas précharger vidéos et audios)</span><input type="checkbox" id="omSaver"></label><p class="om-note">Les vidéos ne se chargent qu’au moment de la lecture. Réglage enregistré sur cet appareil.</p>');
  if(!w)return;
  const t=w.querySelector("#omSaver");
  t.checked=store.get(PREF_SAVER,false);
  t.onchange=()=>{store.set(PREF_SAVER,t.checked);applySaver(t.checked);toast(t.checked?"Économie de données activée.":"Économie de données désactivée.");};
}
applySaver(store.get(PREF_SAVER,false));

/* ---------- Gestion du temps ---------- */
const LIMIT_KEY="omegia.pref.dailyLimitMin";
const dayKey=(d=new Date())=>"omegia.time."+d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
(()=>{try{const cut=dayKey(new Date(Date.now()-14*86400000));Object.keys(localStorage).filter(k=>k.startsWith("omegia.time.")&&k<cut).forEach(k=>localStorage.removeItem(k));}catch{}})();
let warnedDay=null;
setInterval(()=>{
  const shell=$("appShell");
  if(document.hidden||!shell||shell.hidden)return;
  const k=dayKey(),used=store.get(k,0)+15;store.set(k,used);
  const limit=store.get(LIMIT_KEY,0);
  if(limit&&used>=limit*60&&warnedDay!==k){warnedDay=k;toast("⏰ Tu as atteint ta limite quotidienne de "+limit+" min sur OMEGIA.");}
},15000);
function timeSettings(){
  const limit=store.get(LIMIT_KEY,0);
  let rows="";
  for(let i=0;i<7;i++){const d=new Date();d.setDate(d.getDate()-i);const m=Math.round(store.get(dayKey(d),0)/60);rows+='<div class="om-line"><span>'+esc(i===0?"Aujourd’hui":d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"short"}))+'</span><strong>'+m+' min</strong></div>';}
  const opts=[[0,"Aucune limite"],[15,"15 minutes"],[30,"30 minutes"],[60,"1 heure"],[120,"2 heures"]].map(([v,l])=>'<option value="'+v+'"'+(v===limit?" selected":"")+'>'+l+'</option>').join("");
  const w=openPanel("Gestion du temps",'<label>Rappel quotidien<select id="omLimit">'+opts+'</select></label><h3>Temps passé (7 derniers jours)</h3>'+rows+'<p class="om-note">Le temps est mesuré uniquement quand OMEGIA est affiché, et conservé sur cet appareil.</p>');
  if(!w)return;
  w.querySelector("#omLimit").onchange=e=>{const v=Number(e.target.value)||0;store.set(LIMIT_KEY,v);warnedDay=null;toast(v?"Rappel réglé à "+v+" min par jour.":"Rappel désactivé.");};
}

/* ---------- Historique d’activité ---------- */
async function activity(){
  const {db,user}=S();
  if(!db||!user)return toast("Connecte-toi pour voir ton historique.");
  const w=openPanel("Historique d’activité",'<div id="omAct"><p class="om-note">Chargement…</p></div>');
  if(!w)return;
  const box=w.querySelector("#omAct");
  try{
    const [p,c,r]=await Promise.all([
      db.from("posts").select("body,created_at,media_type").eq("author_id",user.id).order("created_at",{ascending:false}).limit(20),
      db.from("post_comments").select("body,created_at").eq("author_id",user.id).order("created_at",{ascending:false}).limit(20),
      db.from("post_reactions").select("created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(20)]);
    const err=p.error||c.error||r.error;if(err)throw err;
    const items=[
      ...(p.data||[]).map(x=>({t:x.created_at,txt:"Publication : "+(x.body?x.body.slice(0,80):"("+(x.media_type||"média")+")")})),
      ...(c.data||[]).map(x=>({t:x.created_at,txt:"Commentaire : "+String(x.body||"").slice(0,80)})),
      ...(r.data||[]).map(x=>({t:x.created_at,txt:"Tu as aimé une publication"}))
    ].sort((a,b)=>Date.parse(b.t)-Date.parse(a.t)).slice(0,40);
    box.innerHTML=items.length?"":'<p class="om-note">Aucune activité pour le moment.</p>';
    items.forEach(i=>{const row=document.createElement("div");row.className="om-line";row.innerHTML="<span>"+esc(i.txt)+'</span><span class="om-note">'+esc(new Date(i.t).toLocaleString("fr-FR"))+"</span>";box.appendChild(row);});
  }catch(e){box.textContent=e.message||"Impossible de charger l’historique.";}
}

/* ---------- Historique des liens ---------- */
const LINKS="omegia.linkHistory";
document.addEventListener("click",e=>{
  const a=e.target.closest&&e.target.closest("a[href]");
  if(!a)return;
  let u;try{u=new URL(a.href,location.href);}catch{return;}
  if(!/^https?:$/.test(u.protocol)||u.origin===location.origin)return;
  const list=store.get(LINKS,[]);list.unshift({url:u.href,t:Date.now()});store.set(LINKS,list.slice(0,100));
},true);
function linkHistory(){
  const list=store.get(LINKS,[]);
  const w=openPanel("Historique des liens",(list.length?list.map(x=>'<div class="om-line"><span style="overflow-wrap:anywhere">'+esc(x.url)+'</span><span class="om-note">'+esc(new Date(x.t).toLocaleDateString("fr-FR"))+'</span></div>').join(""):'<p class="om-note">Aucun lien externe ouvert pour le moment.</p>')+'<div class="om-actions"><button type="button" id="omClearLinks">Effacer l’historique</button></div><p class="om-note">Les liens externes ouverts depuis OMEGIA sont mémorisés sur cet appareil uniquement.</p>');
  if(!w)return;
  w.querySelector("#omClearLinks").onclick=()=>{store.set(LINKS,[]);w.remove();toast("Historique effacé.");};
}

/* ---------- Pages légales (brouillons à faire relire) ---------- */
const LEGAL={
  terms:["Conditions de service",[
    ["Accès","OMEGIA est réservé aux membres. Tu dois avoir au moins 13 ans et utiliser un compte personnel. Garde ton mot de passe confidentiel."],
    ["Tes contenus","Tu restes responsable de ce que tu publies (textes, photos, vidéos, messages). Tu autorises OMEGIA à les afficher aux personnes que tu as choisies (public ou amis)."],
    ["Comportements interdits","Harcèlement, haine, menaces, usurpation d’identité, contenus illégaux, contenus sexuels impliquant des mineurs, spam et tentatives de piratage."],
    ["Suspension","OMEGIA peut retirer un contenu ou suspendre un compte qui ne respecte pas ces règles."],
    ["Service en développement","OMEGIA évolue et est fourni en l’état, sans garantie de disponibilité continue."]]],
  privacy:["Politique de confidentialité",[
    ["Données enregistrées","Adresse e-mail, nom, date de naissance, téléphone (facultatif), bio, lieu, travail et études (facultatifs), publications, commentaires, réactions, stories, statuts, messages et fichiers envoyés."],
    ["Où elles sont conservées","Compte, base de données et fichiers sont hébergés chez Supabase. L’application est servie par GitLab Pages. Certaines bibliothèques sont chargées depuis jsDelivr."],
    ["Fichiers envoyés","Les photos, vidéos et audios envoyés sont stockés avec une adresse web non devinable mais publique : toute personne qui possède l’adresse exacte peut les ouvrir."],
    ["Sur ton appareil","Préférences, enregistrements, statut de lecture des messages, historique des liens et temps d’usage restent dans le stockage local de ton navigateur."],
    ["Publicité et suivi","Cette version n’inclut ni publicité ni outil de suivi tiers."],
    ["Tes droits","Tu peux modifier ton profil dans l’application. Pour accéder à tes données ou demander leur suppression, contacte l’équipe OMEGIA."]]],
  cookies:["Politique d’utilisation des cookies",[
    ["Ce qui est utilisé","OMEGIA utilise le stockage local du navigateur pour garder ta session ouverte et mémoriser tes préférences (thème, accessibilité, économie de données, rappels)."],
    ["Ce qui n’est pas utilisé","Aucun cookie publicitaire ni de mesure d’audience tiers dans cette version."],
    ["Les effacer","Tu peux vider le stockage du site depuis les réglages de ton navigateur ; tu seras alors déconnecté."]]],
  community:["Standards de la communauté",[
    ["Respect","Traite les autres avec respect. Pas de harcèlement, d’intimidation ni de discours haineux."],
    ["Sécurité","Pas de menaces, de contenus violents, illégaux ou sexuels impliquant des mineurs."],
    ["Authenticité","Ne te fais pas passer pour quelqu’un d’autre et ne diffuse pas de fausses informations dangereuses."],
    ["Signalement","Si tu vois un contenu problématique, contacte l’équipe OMEGIA."]]],
  about:["À propos d’OMEGIA",[
    ["OMEGIA","One app. Infinite connections. Un espace unique pour échanger, partager et rester connecté."],
    ["Création","Créé par Beno Lokonon."]]]
};
function legal(key){
  const [title,sections]=LEGAL[key];
  openPanel(title,'<div class="om-legal"><p class="om-note">Version préliminaire : à faire relire par un juriste avant une ouverture publique.</p>'+sections.map(([h,t])=>"<h3>"+esc(h)+"</h3><p>"+esc(t)+"</p>").join("")+"</div>");
}

/* ---------- Aide ---------- */
function help(){
  const faq=[
    ["Ajouter un ami","Onglet Amis → Rechercher des membres → Inviter. Ton ami doit accepter l’invitation."],
    ["Publier","Depuis l’accueil, touche « Quoi de neuf ? ». Tu peux ajouter une image ou une vidéo et choisir Public ou Amis."],
    ["Stories et statuts","Ils disparaissent automatiquement après 24 heures."],
    ["Message vocal","Dans une conversation, touche le micro pour enregistrer, puis touche-le de nouveau pour envoyer."],
    ["Installer l’application","Utilise « Installer l’application » dans le menu."],
    ["Un problème ?","Contacte l’équipe OMEGIA en décrivant ce que tu faisais au moment du problème."]];
  openPanel("Aide et assistance",'<div class="om-legal">'+faq.map(([h,t])=>"<h3>"+esc(h)+"</h3><p>"+esc(t)+"</p>").join("")+"</div>");
}

/* ---------- Reels : vidéos publiées ---------- */
async function reels(){
  const {db,user,media}=S();
  if(!db||!user)return toast("Connecte-toi pour voir les reels.");
  const w=openPanel("Reels",'<div id="omReels"><p class="om-note">Chargement…</p></div>');
  if(!w)return;
  const box=w.querySelector("#omReels");
  const {data,error}=await db.from("posts").select("id,body,media_url,media_type,created_at,profiles:profiles!posts_author_id_fkey(first_name,last_name)").eq("media_type","video").order("created_at",{ascending:false}).limit(20);
  if(error){box.textContent=error.message;return;}
  box.innerHTML="";
  if(!data?.length){box.innerHTML='<p class="om-note">Aucune vidéo publiée pour le moment. Publie une vidéo depuis l’accueil pour la retrouver ici.</p>';return;}
  data.forEach(p=>{
    const el=document.createElement("article");el.className="om-post";
    const nm=((p.profiles?.first_name||"")+" "+(p.profiles?.last_name||"")).trim()||"Membre";
    el.innerHTML="<strong>"+esc(nm)+"</strong>"+(p.body?'<div class="om-post-body">'+esc(p.body)+"</div>":"")+(media?media(p.media_url,"video"):"");
    box.appendChild(el);
  });
}

/* ---------- Profil : onglets, statistiques, plus d’options ---------- */
function filterProfile(tab){
  const box=$("profilePosts");if(!box)return;
  document.querySelectorAll("[data-ptab]").forEach(b=>b.classList.toggle("active",b.dataset.ptab===tab));
  box.querySelector("#omEventsNote")?.remove();
  box.querySelectorAll(".om-post").forEach(p=>{
    const has=tab==="all"||(tab==="photos"&&p.querySelector("img.om-media"))||(tab==="reels"&&p.querySelector("video.om-media"));
    p.hidden=!has;
  });
  const visible=[...box.querySelectorAll(".om-post")].filter(p=>!p.hidden).length;
  if(tab==="events"||(!visible&&box.querySelector(".om-post"))){
    const n=document.createElement("p");n.id="omEventsNote";n.className="om-note";
    n.textContent=tab==="events"?"Les événements arriveront avec une prochaine étape.":"Aucun contenu dans cette catégorie.";
    box.appendChild(n);
  }
}
document.querySelectorAll("[data-ptab]").forEach(b=>b.addEventListener("click",()=>filterProfile(b.dataset.ptab)));
async function updateStats(){
  const {db,user}=S(),el=$("profileStats");
  if(!db||!user||!el)return;
  try{
    const [f,p]=await Promise.all([
      db.from("friend_requests").select("id",{count:"exact",head:true}).eq("status","accepted").or("sender_id.eq."+user.id+",recipient_id.eq."+user.id),
      db.from("posts").select("id",{count:"exact",head:true}).eq("author_id",user.id)]);
    if(f.error||p.error)return;
    const nf=f.count||0,np=p.count||0;
    el.textContent=nf+" ami(e)"+(nf>1?"s":"")+" · "+np+" publication"+(np>1?"s":"");
  }catch{}
}
document.querySelectorAll("[data-nav='profile'],[data-goto='profile']").forEach(b=>b.addEventListener("click",()=>setTimeout(()=>{filterProfile("all");updateStats();},350)));
function profileMore(){
  const w=openPanel("Plus d’options",'<div class="om-actions" style="flex-direction:column"><button type="button" data-act="saved">🔖 Mes enregistrements</button><button type="button" data-act="memories">🕐 Souvenirs</button><button type="button" data-act="activity">📋 Historique d’activité</button><button type="button" data-act="settings">⚙️ Paramètres et confidentialité</button></div>');
  if(!w)return;
  const run={saved:()=>S().openSavedPosts?.(),memories:()=>S().openMemories?.(),activity,settings:()=>{if(typeof showView==="function")showView("settings");}};
  w.querySelectorAll("[data-act]").forEach(b=>{b.onclick=()=>{w.remove();run[b.dataset.act]();};});
}

/* ---------- Branchement (phase de capture : passe avant les anciennes alertes de app.js) ---------- */
const settingHandlers={
  notifications:notifSettings,"device-perms":devicePerms,media:mediaSettings,time:timeSettings,activity,"link-history":linkHistory,
  terms:()=>legal("terms"),"privacy-policy":()=>legal("privacy"),cookies:()=>legal("cookies"),community:()=>legal("community"),about:()=>legal("about")
};
document.addEventListener("click",e=>{
  const t=e.target.closest?e.target:e.target.parentElement;
  if(!t)return;
  const item=t.closest("[data-setting-item]");
  if(item&&settingHandlers[item.dataset.settingItem]){e.preventDefault();e.stopImmediatePropagation();settingHandlers[item.dataset.settingItem]();return;}
  const side=t.closest("[data-setting]");
  if(side&&(side.dataset.setting==="reels"||side.dataset.setting==="help")){
    e.preventDefault();e.stopImmediatePropagation();
    const menu=$("sideMenu");if(menu)menu.hidden=true;
    (side.dataset.setting==="reels"?reels:help)();
    return;
  }
  if(t.closest("#profileMoreBtn")){e.preventDefault();e.stopImmediatePropagation();profileMore();}
},true);
})();
