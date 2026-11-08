/* OMEGIA — fonctionnalités du menu, des paramètres, des appels et du profil.
   Ce fichier remplace les messages « bientôt disponible ». Il se branche sur social.js (window.omegiaSocial). */
(()=>{"use strict";
const S=()=>window.omegiaSocial||{},$=id=>document.getElementById(id);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const db=()=>S().db,me=()=>S().user,toast=m=>S().toast?S().toast(m):alert(m);
const nm=p=>S().name?S().name(p):"Membre",av=p=>S().av?S().av(p):"";
const ago=iso=>new Date(iso).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
const ready=()=>{if(db()&&me())return true;toast("L’application se charge, réessaie dans un instant.");return false;};
const missing=e=>e&&(e.code==="42P01"||e.code==="PGRST205"||/does not exist|schema cache|Could not find the table/i.test(e.message||""));
const errBox=e=>missing(e)?'<div class="om2-card"><strong>Configuration requise</strong><p class="om2-note">Cette fonctionnalité a besoin des tables Supabase. Ouvre Supabase → SQL Editor, colle le contenu du fichier <b>supabase/features.sql</b> du dépôt, clique sur Run, puis reviens ici.</p></div>':'<p class="om2-note">'+esc(e?.message||e)+"</p>";
const safeUrl=u=>{try{const x=new URL(u);return /^https?:$/.test(x.protocol)?x.href:"";}catch{return "";}};

/* ---------- Styles ---------- */
const css=`.om2-page{position:fixed;inset:0;z-index:9000;background:#f6f4fb;color:#211d2b;display:flex;flex-direction:column;overflow:hidden}
.om2-bar{display:flex;align-items:center;gap:8px;padding:calc(env(safe-area-inset-top,0px) + 10px) 12px 10px;background:#7652d6;color:#fff}
.om2-bar h2{margin:0;font-size:18px;flex:1}.om2-back{border:0;background:#ffffff26;color:#fff;border-radius:50%;width:38px;height:38px;font-size:26px;line-height:1}
.om2-body{flex:1;overflow:auto;padding:12px 14px calc(env(safe-area-inset-bottom,0px) + 24px)}
.om2-tabs{display:flex;gap:8px;overflow-x:auto;margin-bottom:12px}.om2-tabs button{flex:none;border:0;border-radius:99px;padding:9px 16px;background:#e9e3f7;color:#392b55;font-weight:650}.om2-tabs button.on{background:#7652d6;color:#fff}
.om2-card{background:#fff;border-radius:16px;padding:14px;margin:10px 0;box-shadow:0 3px 14px #0000000d;overflow-wrap:anywhere}
.om2-primary{border:0;border-radius:12px;padding:11px 16px;background:#7652d6;color:#fff;font-weight:650;margin:4px 0}
.om2-note{font-size:13px;color:#81788f}.om2-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#7652d6;margin-right:6px}
.om2-row{display:flex;align-items:center;justify-content:space-between;gap:12px;background:#fff;border-radius:14px;padding:13px 14px;margin:8px 0}
.om2-row small{display:block;color:#81788f;font-size:12px;margin-top:2px}.om2-row input[type=checkbox]{width:22px;height:22px;accent-color:#7652d6;flex:none}
.om2-row select{padding:8px;border-radius:10px;border:1px solid #d8d1e8;font:inherit;max-width:45%}
.om2-grid3,.om2-grid4{display:grid;gap:8px;margin:12px 0}.om2-grid3{grid-template-columns:repeat(3,1fr)}.om2-grid4{grid-template-columns:repeat(4,1fr)}
.om2-grid3 button,.om2-grid4 button{aspect-ratio:1;font-size:30px;border:0;border-radius:14px;background:#fff;box-shadow:0 2px 8px #0001}
.om2-reels{padding:0!important;overflow:hidden!important}.om2-reels-bar{padding:8px 14px}.om2-reels-feed{height:calc(100% - 52px);overflow-y:scroll;scroll-snap-type:y mandatory}
.om2-reel{position:relative;height:100%;scroll-snap-align:start;background:#000}.om2-reel video{width:100%;height:100%;object-fit:contain}
.om2-reel-info{position:absolute;left:0;right:0;bottom:0;padding:16px;color:#fff;background:linear-gradient(transparent,#000a)}.om2-reel-del{position:absolute;top:10px;right:10px;border:0;border-radius:50%;width:40px;height:40px;background:#0008;color:#fff}
.om2-call{position:fixed;inset:0;z-index:12000;background:#120f1c;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
.om2-call #om2Remote{width:100%;max-height:68%;object-fit:contain;background:#000}.om2-call #om2Local{position:absolute;right:12px;top:calc(env(safe-area-inset-top,0px) + 12px);width:92px;border-radius:12px;background:#000}
.om2-ctl{display:flex;gap:18px}.om2-ctl button{border:0;border-radius:50%;width:60px;height:60px;font-size:24px;background:#ffffff26;color:#fff}.om2-ctl button.end{background:#d63a3a}
.om2-av-prev{display:block;margin:0 auto 12px;width:180px;height:180px;border-radius:50%;overflow:hidden}.om2-av-prev svg{width:100%;height:100%}
.om2-opts{display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 12px}.om2-opts button{border:2px solid transparent;border-radius:12px;padding:8px 12px;background:#fff;font:inherit}
.om2-opts button.on{border-color:#7652d6}.om2-opts button.sw{width:36px;height:36px;border-radius:50%;padding:0;box-shadow:inset 0 0 0 1px #0002}
.om2-legal h3{margin:16px 0 4px}.om2-legal p,.om2-legal li{line-height:1.5}
.dark-mode .om2-page{background:#151320;color:#eee9f7}.dark-mode .om2-card,.dark-mode .om2-row,.dark-mode .om2-opts button:not(.sw),.dark-mode .om2-grid3 button,.dark-mode .om2-grid4 button{background:#211d30;color:#eee9f7}
.dark-mode .om2-tabs button{background:#2d2840;color:#eee9f7}.dark-mode .om2-tabs button.on{background:#7652d6;color:#fff}.dark-mode .om2-row select{background:#2d2840;color:#eee9f7;border-color:#453d5e}`;
{const s=document.createElement("style");s.textContent=css;document.head.appendChild(s);}

/* ---------- Briques d’interface ---------- */
function openPage(title,render){
  const p=document.createElement("div");p.className="om2-page";
  p.innerHTML='<header class="om2-bar"><button type="button" class="om2-back" aria-label="Retour">‹</button><h2>'+esc(title)+'</h2></header><div class="om2-body"></div>';
  p.querySelector(".om2-back").onclick=()=>{p._close&&p._close();p.remove();};
  document.body.appendChild(p);
  const body=p.querySelector(".om2-body");
  Promise.resolve().then(()=>render(body,p)).catch(e=>{body.innerHTML=errBox(e);});
  return p;
}
const closePages=()=>document.querySelectorAll(".om2-page").forEach(x=>{x._close&&x._close();x.remove();});
function card(html,acts=[]){
  const el=document.createElement("div");el.className="om2-card";el.innerHTML=html;
  if(acts.length){const r=document.createElement("div");r.className="om-actions";
    acts.forEach(([t,f,sec])=>{const b=document.createElement("button");b.type="button";b.textContent=t;if(sec)b.className="om-cancel";b.onclick=async()=>{b.disabled=true;try{await f(b);}catch(e){toast(e.message||String(e));}finally{b.disabled=false;}};r.appendChild(b);});
    el.appendChild(r);}
  return el;
}
function bigBtn(label,fn){const b=document.createElement("button");b.type="button";b.className="om2-primary";b.textContent=label;b.onclick=fn;return b;}
function tabs(body,defs,render){
  body.innerHTML='<div class="om2-tabs">'+defs.map((d,i)=>'<button type="button" data-t="'+d[0]+'" class="'+(i?"":"on")+'">'+esc(d[1])+"</button>").join("")+'</div><div class="om2-view"></div>';
  const view=body.querySelector(".om2-view");let cur=defs[0][0];
  const go=async k=>{cur=k;body.querySelectorAll(".om2-tabs button").forEach(b=>b.classList.toggle("on",b.dataset.t===k));view.innerHTML='<p class="om2-note">Chargement…</p>';try{await render(k,view);}catch(e){view.innerHTML=errBox(e);}};
  view.reload=()=>go(cur);
  body.querySelectorAll(".om2-tabs button").forEach(b=>b.onclick=()=>go(b.dataset.t));
  return go(cur);
}
function formModal(title,html,label,fn){
  const w=S().modal(title,html+'<p class="om-note" id="om2msg"></p><div class="om-actions"><button class="om-cancel" type="button" id="om2c">Annuler</button><button type="button" id="om2ok">'+esc(label)+"</button></div>");
  w.querySelector("#om2c").onclick=()=>w.remove();
  const ok=w.querySelector("#om2ok"),msg=w.querySelector("#om2msg");
  ok.onclick=async()=>{ok.disabled=true;msg.textContent="";try{await fn(w);}catch(e){msg.textContent=e.message||String(e);ok.disabled=false;}};
  return w;
}
async function profs(ids){
  ids=[...new Set((ids||[]).filter(Boolean))];if(!ids.length)return {};
  const {data}=await db().from("profiles").select("id,first_name,last_name,username,avatar_url,bio,location,work,school").in("id",ids);
  const m={};(data||[]).forEach(p=>m[p.id]=p);return m;
}
function pickMember(title,cb){
  const w=S().modal(title,'<input id="om2q" placeholder="Nom ou nom d’utilisateur"><div id="om2r"></div>');let t;
  w.querySelector("#om2q").oninput=e=>{clearTimeout(t);t=setTimeout(async()=>{
    const q=e.target.value.replace(/[,()%*\\]/g," ").trim(),box=w.querySelector("#om2r");if(q.length<2){box.innerHTML="";return;}
    const {data,error}=await db().rpc("omegia_search_members",{q});
    if(error){box.textContent=error.message;return;}box.innerHTML="";
    (data||[]).forEach(p=>{const el=document.createElement("div");el.className="om-user";el.innerHTML=av(p)+'<div class="om-grow"><strong>'+esc(nm(p))+'</strong><div class="om-note">@'+esc(p.username||"membre")+"</div></div>";
      const b=document.createElement("button");b.type="button";b.textContent="Choisir";b.onclick=()=>{w.remove();cb(p);};el.appendChild(b);box.appendChild(el);});
    if(!data?.length)box.innerHTML='<p class="om-note">Aucun membre trouvé.</p>';},300);};
}
const mediaHtml=(u,t)=>!u?"":t==="image"?'<img class="om-media" loading="lazy" src="'+esc(u)+'" alt="">':t==="video"?'<video class="om-media" controls playsinline preload="metadata" src="'+esc(u)+'"></video>':t==="audio"?'<audio controls src="'+esc(u)+'"></audio>':"";
function postCard(p,text,date,extra=""){const el=document.createElement("article");el.className="om-post";el.innerHTML='<div class="om-post-head">'+av(p)+"<div><strong>"+esc(nm(p))+'</strong><div class="om-note">'+ago(date)+"</div></div></div>"+(text?'<div class="om-post-body">'+esc(text)+"</div>":"")+extra;return el;}
function composer(ph,fn){
  const d=document.createElement("div");d.className="om2-card";
  d.innerHTML='<textarea maxlength="2000" placeholder="'+esc(ph)+'" style="width:100%;min-height:70px;padding:10px;border:1px solid #d8d1e8;border-radius:12px;font:inherit"></textarea><div class="om-actions"><button type="button">Publier</button></div>';
  const t=d.querySelector("textarea"),b=d.querySelector("button");
  b.onclick=async()=>{const x=t.value.trim();if(!x)return;b.disabled=true;try{await fn(x);}catch(e){toast(e.message||String(e));b.disabled=false;}};
  return d;
}

/* ---------- Préférences (compte + appareil) ---------- */
const PK="omegia.prefs";let prefs={};try{prefs=JSON.parse(localStorage.getItem(PK)||"{}");}catch{}
const applyPrefs=()=>{window.omegiaHideOnline=!!prefs.hideOnline;document.documentElement.lang=prefs.lang||"fr";};
applyPrefs();
const SRV={profileLocked:["profile_locked",v=>!!v,false],discoverable:["discoverable",v=>!!v,true],allowRequests:["allow_requests",v=>!!v,true],allowMessages:["allow_messages",v=>v==="friends"?"friends":"everyone","all"],storiesAudience:["stories_audience",v=>v==="friends"?"friends":"everyone","public"]};
function syncServer(k){const m=SRV[k];if(!m||!db()||!me())return;const row={user_id:me().id,updated_at:new Date().toISOString()};Object.keys(SRV).forEach(key=>{const d=SRV[key];row[d[0]]=d[1](prefs[key]??d[2]);});db().from("profile_settings").upsert(row,{onConflict:"user_id"}).then(({error})=>{if(error)toast(missing(error)?"Réglage gardé sur cet appareil seulement.":error.message);});}
function setPref(k,v){prefs={...prefs,[k]:v};syncServer(k);try{localStorage.setItem(PK,JSON.stringify(prefs));}catch{}applyPrefs();if(db()&&me())db().auth.updateUser({data:{settings:prefs}}).catch(()=>{});toast("Enregistré.");}
const T=(k,label,desc,def)=>({k,type:"toggle",label,desc,def}),SEL=(k,label,opts,def,desc)=>({k,type:"select",label,opts,def,desc});
const prefPanel=(intro,defs)=>body=>{
  body.innerHTML='<p class="om2-note">'+esc(intro)+"</p>"+defs.map(d=>{
    const lab="<span>"+esc(d.label)+(d.desc?"<small>"+esc(d.desc)+"</small>":"")+"</span>",v=prefs[d.k]??d.def;
    return d.type==="select"?'<label class="om2-row">'+lab+'<select data-k="'+d.k+'">'+d.opts.map(o=>'<option value="'+o[0]+'"'+(String(v)===o[0]?" selected":"")+">"+esc(o[1])+"</option>").join("")+"</select></label>":'<label class="om2-row">'+lab+'<input type="checkbox" data-k="'+d.k+'"'+(v?" checked":"")+"></label>";}).join("");
  body.querySelectorAll("[data-k]").forEach(i=>i.onchange=()=>setPref(i.dataset.k,i.type==="checkbox"?i.checked:i.value));
};
const PANEL={
  audience:prefPanel("Choisis l’audience proposée par défaut quand tu publies.",[SEL("audience","Audience des publications",[["public","Public"],["friends","Mes amis"]],"public")]),
  stories:prefPanel("Choisis qui peut voir tes stories et tes statuts.",[SEL("storiesAudience","Audience",[["public","Tout le monde"],["friends","Mes amis"]],"public")]),
  notif:prefPanel("Choisis les alertes affichées dans l’application.",[T("notifMsg","Nouveaux messages","Bannière 💬 à chaque message reçu",true),T("notifFriends","Invitations d’amis","Bannière 🤝 à chaque invitation",true)]),
  lang:prefPanel("Langue et région de ton compte.",[SEL("lang","Langue",[["fr","Français"]],"fr","D’autres langues seront ajoutées."),SEL("region","Région",[["BJ","Bénin"],["CI","Côte d’Ivoire"],["TG","Togo"],["SN","Sénégal"],["FR","France"],["OT","Autre"]],"BJ")]),
  media:prefPanel("Contrôle la lecture des vidéos et la consommation de données.",[T("dataSaver","Économiseur de données","Les vidéos ne se chargent qu’au toucher",false),T("autoplayVideos","Lecture automatique des vidéos","Sans le son, dans le fil et les statuts",false)]),
  lock:prefPanel("Protège ton profil.",[T("profileLocked","Verrouiller mon profil","Seuls tes amis voient tes informations et tes publications",false)]),
  find:prefPanel("Contrôle comment les autres te trouvent.",[T("discoverable","Apparaître dans la recherche","",true),SEL("allowMessages","Qui peut m’écrire",[["all","Tout le monde"],["friends","Mes amis"]],"all"),T("allowRequests","Recevoir des invitations d’amis","",true)]),
  followers:prefPanel("Contrôle ce qui est public sur ton profil.",[T("publicProfile","Profil visible publiquement","",true),T("showFriends","Afficher ma liste d’amis","",true)]),
  tagging:prefPanel("Contrôle les identifications.",[T("allowTags","Autoriser les identifications","",true),T("reviewTags","Valider avant l’affichage sur mon profil","",false)]),
  online:prefPanel("Contrôle ta présence.",[T("hideOnline","Masquer mon statut En ligne","Les autres ne verront plus 🟢 En ligne (effet à la prochaine ouverture de l’application)",false)])
};

/* ---------- Observateurs : audience par défaut, économie de données, bannières ---------- */
new MutationObserver(ms=>{
  ms.forEach(m=>m.addedNodes.forEach(n=>{
    if(n.nodeType!==1)return;
    const sel=n.id==="omVis"?n:n.querySelector&&n.querySelector("#omVis");if(sel&&prefs.audience)sel.value=prefs.audience;
    const vids=n.tagName==="VIDEO"?[n]:[...(n.querySelectorAll?n.querySelectorAll("video"):[])];
    vids.forEach(v=>{if(v.closest(".om2-reel"))return;if(prefs.dataSaver)v.preload="none";if(prefs.autoplayVideos){v.muted=true;v.play&&v.play().catch(()=>{});}});
  }));
  const t=$("omToast");if(t&&!t.hidden){const x=t.textContent||"";if((prefs.notifMsg===false&&x.startsWith("💬"))||(prefs.notifFriends===false&&x.startsWith("🤝")))t.hidden=true;}
}).observe(document.body,{childList:true,subtree:true});

/* ---------- Gestion du temps ---------- */
const dayKey=d=>"omegia.time."+(d||new Date()).toISOString().slice(0,10);
setInterval(()=>{if(document.hidden||!me())return;const k=dayKey();const n=(+localStorage.getItem(k)||0)+1;try{localStorage.setItem(k,String(n));}catch{}const lim=+prefs.dailyLimit||0;if(lim&&n===lim*60)toast("⏰ Tu as atteint ta limite quotidienne de "+lim+" min.");},1000);
function timePage(body){
  const mins=d=>Math.round((+localStorage.getItem(dayKey(d))||0)/60);
  const days=[...Array(7)].map((_,i)=>new Date(Date.now()-i*864e5));
  body.innerHTML='<div class="om2-card"><strong>Aujourd’hui : '+mins()+' min</strong><div class="om2-note">Temps passé sur OMEGIA sur cet appareil.</div></div>';
  const host=document.createElement("div");body.appendChild(host);
  PANEL.limit(host);
  body.insertAdjacentHTML("beforeend",'<div class="om2-card"><strong>7 derniers jours</strong>'+days.map(d=>'<div class="om2-note">'+d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"short"})+" : "+mins(d)+" min</div>").join("")+"</div>");
}
PANEL.limit=prefPanel("Reçois un rappel quand tu atteins ta limite du jour.",[SEL("dailyLimit","Limite quotidienne",[["0","Aucune"],["30","30 min"],["60","1 h"],["120","2 h"],["180","3 h"]],"0")]);

/* ---------- Blocage ---------- */
async function blockUser(id){const {error}=await db().from("user_blocks").upsert({blocker_id:me().id,blocked_id:id},{onConflict:"blocker_id,blocked_id"});if(error)throw error;}
async function blockPage(body){
  const load=async()=>{
    const {data,error}=await db().from("user_blocks").select("blocked_id").eq("blocker_id",me().id);if(error){body.innerHTML=errBox(error);return;}
    const P=await profs((data||[]).map(b=>b.blocked_id));body.innerHTML='<p class="om2-note">Les comptes bloqués ne peuvent plus t’envoyer d’invitation d’ami.</p>';
    body.appendChild(bigBtn("🚫 Bloquer un membre",()=>pickMember("Bloquer un membre",async p=>{try{await blockUser(p.id);toast(nm(p)+" est bloqué(e).");load();}catch(e){toast(e.message);}})));
    (data||[]).forEach(b=>body.appendChild(card(av(P[b.blocked_id])+"<strong> "+esc(nm(P[b.blocked_id]))+"</strong>",[["Débloquer",async()=>{const {error:e}=await db().from("user_blocks").delete().eq("blocker_id",me().id).eq("blocked_id",b.blocked_id);if(e)throw e;load();},true]])));
    if(!data?.length)body.insertAdjacentHTML("beforeend",'<p class="om-note">Aucun compte bloqué.</p>');
  };
  await load();
}

/* ---------- Activité, autorisations, liens ---------- */
async function activityPage(body){
  const uid=me().id,lim=30,o={ascending:false};
  const [p,c,r]=await Promise.all([db().from("posts").select("body,created_at").eq("author_id",uid).order("created_at",o).limit(lim),db().from("post_comments").select("body,created_at").eq("author_id",uid).order("created_at",o).limit(lim),db().from("post_reactions").select("created_at").eq("user_id",uid).order("created_at",o).limit(lim)]);
  const items=[...(p.data||[]).map(x=>({t:x.created_at,s:"📝 Tu as publié : "+(x.body||"(média)")})),...(c.data||[]).map(x=>({t:x.created_at,s:"💬 Tu as commenté : "+x.body})),...(r.data||[]).map(x=>({t:x.created_at,s:"👍 Tu as aimé une publication."}))].sort((a,b)=>Date.parse(b.t)-Date.parse(a.t)).slice(0,60);
  body.innerHTML=items.length?"":'<p class="om-note">Aucune activité pour le moment.</p>';
  items.forEach(i=>body.appendChild(card(esc(i.s.slice(0,160))+'<div class="om2-note">'+ago(i.t)+"</div>")));
}
async function devicePage(body){
  const defs=[["camera","📷","Caméra",()=>navigator.mediaDevices.getUserMedia({video:true}).then(s=>s.getTracks().forEach(t=>t.stop()))],["microphone","🎙","Microphone",()=>navigator.mediaDevices.getUserMedia({audio:true}).then(s=>s.getTracks().forEach(t=>t.stop()))],["notifications","🔔","Notifications",()=>Notification.requestPermission()],["geolocation","📍","Localisation",()=>new Promise((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej))]];
  const render=async()=>{
    body.innerHTML='<p class="om2-note">Autorisations accordées à OMEGIA sur cet appareil. Pour retirer une autorisation, utilise les réglages du navigateur.</p>';
    for(const [key,ico,label,ask] of defs){
      let st="prompt";
      try{if(key==="notifications"&&"Notification" in window)st=Notification.permission==="default"?"prompt":Notification.permission;else st=(await navigator.permissions.query({name:key})).state;}catch{st="unknown";}
      const txt={granted:"✅ Autorisé",denied:"⛔ Refusé (modifie-le dans les réglages du navigateur)",prompt:"Pas encore demandé",unknown:"État inconnu"}[st];
      body.appendChild(card(ico+" <strong>"+label+'</strong><div class="om2-note">'+txt+"</div>",st==="granted"||st==="denied"?[]:[["Autoriser",async()=>{try{await ask();}catch{}render();}]]));
    }
  };
  await render();
}
const LK="omegia.links",links=()=>{try{return JSON.parse(localStorage.getItem(LK)||"[]");}catch{return [];}};
document.addEventListener("click",e=>{const a=e.target.closest&&e.target.closest("a[href]");if(!a)return;let u;try{u=new URL(a.href);}catch{return;}if(u.origin===location.origin||!/^https?:$/.test(u.protocol))return;const l=links().filter(x=>x.u!==u.href);l.unshift({u:u.href,t:Date.now()});try{localStorage.setItem(LK,JSON.stringify(l.slice(0,50)));}catch{}},true);
function linksPage(body){
  const draw=()=>{const l=links();body.innerHTML='<p class="om2-note">Les liens externes que tu as ouverts depuis OMEGIA sur cet appareil.</p>';
    if(l.length)body.appendChild(bigBtn("Tout effacer",()=>{try{localStorage.removeItem(LK);}catch{}draw();}));else body.insertAdjacentHTML("beforeend",'<p class="om-note">Aucun lien ouvert pour le moment.</p>');
    l.forEach(x=>body.appendChild(card('<a href="'+esc(x.u)+'" target="_blank" rel="noopener noreferrer">'+esc(x.u.slice(0,90))+'</a><div class="om2-note">'+ago(x.t)+"</div>")));};
  draw();
}
function assistPage(body){
  const row=(label,val,title,fn)=>card("<strong>"+esc(label)+'</strong><div class="om2-note">'+esc(val)+"</div>",[["Modifier",()=>openPage(title,fn)]]);
  body.innerHTML='<p class="om2-note">Vérifie en quelques secondes tes réglages de confidentialité.</p>';
  body.appendChild(row("Audience par défaut",prefs.audience==="friends"?"Mes amis":"Public","Audience par défaut",PANEL.audience));
  body.appendChild(row("Profil verrouillé",prefs.profileLocked?"Oui":"Non","Verrouillage du profil",PANEL.lock));
  body.appendChild(row("Statut En ligne",prefs.hideOnline?"Masqué":"Visible","Statut En ligne",PANEL.online));
  body.appendChild(row("Recherche",prefs.discoverable===false?"Je n’apparaís pas":"Je peux être trouvé(e)","Comment les autres peuvent vous trouver",PANEL.find));
  body.appendChild(row("Comptes bloqués","Gérer la liste","Blocage",blockPage));
  body.appendChild(card("<strong>Mot de passe</strong>",[["Changer",passwordModal]]));
}
function passwordModal(){if(!ready())return;formModal("Changer le mot de passe",'<input id="pw1" type="password" autocomplete="new-password" placeholder="Nouveau mot de passe (8 caractères min.)"><input id="pw2" type="password" autocomplete="new-password" placeholder="Confirmer">',"Enregistrer",async w=>{const a=w.querySelector("#pw1").value,b=w.querySelector("#pw2").value;if(a.length<8)throw Error("8 caractères minimum.");if(a!==b)throw Error("Les mots de passe ne correspondent pas.");const {error}=await db().auth.updateUser({password:a});if(error)throw error;w.remove();toast("Mot de passe modifié.");});}

/* ---------- Textes légaux ---------- */
const LEGAL={
  terms:'<h3>1. Utilisation</h3><p>OMEGIA est un réseau social. Tu dois avoir au moins 13 ans et fournir des informations exactes.</p><h3>2. Ton compte</h3><p>Tu es responsable de ton mot de passe et de ce que tu publies.</p><h3>3. Contenus</h3><p>Tu gardes tes droits sur tes contenus et tu autorises OMEGIA à les afficher aux personnes que tu choisis. Ne publie pas de contenu illégal, haineux, violent ou qui porte atteinte à autrui.</p><h3>4. Suspension</h3><p>Un compte qui ne respecte pas ces conditions ou les standards de la communauté peut être limité ou supprimé.</p><h3>5. Contact</h3><p>Pour toute question, utilise « Aide et assistance » dans le menu.</p>',
  privacy:'<h3>Données collectées</h3><p>Nom, e-mail, date de naissance, photo, bio, publications, messages et médias que tu envoies.</p><h3>Utilisation</h3><p>Ces données servent à faire fonctionner OMEGIA : profil, fil d’actualité, messages, notifications et sécurité.</p><h3>Partage</h3><p>Tes contenus sont visibles selon l’audience que tu choisis. Tes données ne sont pas vendues.</p><h3>Hébergement</h3><p>Les données sont stockées chez notre prestataire Supabase.</p><h3>Tes droits</h3><p>Tu peux modifier tes informations dans ton profil et demander la suppression de ton compte via « Aide et assistance ».</p>',
  cookies:'<h3>Stockage sur ton appareil</h3><p>OMEGIA utilise le stockage local de ton navigateur pour te garder connecté(e), mémoriser le mode sombre, tes préférences et ton historique de liens.</p><h3>Pas de pistage publicitaire</h3><p>OMEGIA n’utilise pas de cookies publicitaires tiers.</p><h3>Les supprimer</h3><p>Tu peux effacer ces données dans les réglages de ton navigateur ; tu seras alors déconnecté(e).</p>',
  community:'<h3>Respect</h3><p>Pas de harcèlement, d’insultes ni de discours de haine.</p><h3>Sécurité</h3><p>Pas de menaces, de violence ni de contenu dangereux.</p><h3>Authenticité</h3><p>Pas d’usurpation d’identité, de fausses informations trompeuses ni d’arnaques.</p><h3>Contenus interdits</h3><p>Pas de contenu sexuel explicite, ni d’images impliquant des mineurs.</p><h3>Droits d’auteur</h3><p>Ne publie que ce que tu as le droit de partager.</p><h3>Signalement</h3><p>Écris-nous via « Aide et assistance » pour signaler un contenu ou un compte.</p>',
  about:'<h3>OMEGIA</h3><p><b>One app. Infinite connections.</b></p><p>Un espace unique pour échanger, partager et rester connecté : fil d’actualité, stories, messages, appels, groupes, pages, événements, reels et plus encore.</p><p>Créé par Beno Lokonon.</p>'
};
const legalPage=k=>body=>{body.classList.add("om2-legal");body.innerHTML=LEGAL[k];};

/* ---------- Groupes et Pages ---------- */
const CFG={
  groups:{tbl:"groups",mem:"group_members",fk:"group_id",posts:"group_posts",label:"groupe",join:"Rejoindre",leave:"Quitter",word:"membre(s)",ph:"Écris dans le groupe…",mine:"Mes groupes",none:"Tu n’as rejoint aucun groupe. Va dans « Découvrir » ou crée le tien."},
  pages:{tbl:"pages",mem:"page_follows",fk:"page_id",posts:"page_posts",label:"page",join:"Suivre",leave:"Ne plus suivre",word:"abonné(s)",ph:"Publie sur la page…",mine:"Pages suivies",none:"Tu ne suis aucune page.",cat:true,ownerPosts:true}
};
const community=c=>async body=>{
  await tabs(body,[["mine",c.mine],["all","Découvrir"]],async(k,v)=>{
    const {data:mem,error:e1}=await db().from(c.mem).select(c.fk).eq("user_id",me().id);if(e1)throw e1;
    const mine=new Set((mem||[]).map(x=>x[c.fk]));
    const {data:gs,error}=await db().from(c.tbl).select("*").order("created_at",{ascending:false}).limit(100);if(error)throw error;
    const list=(gs||[]).filter(g=>k==="all"||mine.has(g.id)||g.created_by===me().id);
    v.innerHTML="";v.appendChild(bigBtn("+ Créer un(e) "+c.label,()=>newCommunity(c,v)));
    if(!list.length)v.insertAdjacentHTML("beforeend",'<p class="om-note">'+(k==="mine"?c.none:"Rien pour le moment. Crée le premier !")+"</p>");
    list.forEach(g=>v.appendChild(card("<strong>"+esc(g.name)+"</strong>"+(g.category?' <span class="om2-note">· '+esc(g.category)+"</span>":"")+'<div class="om2-note">'+esc(g.description||"")+"</div>",[[mine.has(g.id)?"Ouvrir":c.join,async()=>{if(!mine.has(g.id)){const {error:e}=await db().from(c.mem).insert({[c.fk]:g.id,user_id:me().id});if(e)throw e;}communityDetail(c,g);v.reload();}]])));
  });
};
function newCommunity(c,v){
  formModal("Créer un(e) "+c.label,'<input id="cN" maxlength="80" placeholder="Nom"><textarea id="cD" maxlength="300" placeholder="Description"></textarea>'+(c.cat?'<input id="cC" maxlength="40" placeholder="Catégorie (ex. Auteur, Commerce, Musique)">':""),"Créer",async w=>{
    const n=w.querySelector("#cN").value.trim();if(n.length<2)throw Error("Donne un nom.");
    const row={name:n,description:w.querySelector("#cD").value.trim(),created_by:me().id};if(c.cat)row.category=w.querySelector("#cC").value.trim();
    const {data:g,error}=await db().from(c.tbl).insert(row).select().single();if(error)throw error;
    const {error:e2}=await db().from(c.mem).insert({[c.fk]:g.id,user_id:me().id,role:"admin"});if(e2)throw e2;
    w.remove();toast("Créé.");communityDetail(c,g);v&&v.reload&&v.reload();});
}
function communityDetail(c,g){
  openPage(g.name,async body=>{
    const render=async()=>{
      const [m,p]=await Promise.all([db().from(c.mem).select("user_id").eq(c.fk,g.id),db().from(c.posts).select("*").eq(c.fk,g.id).order("created_at",{ascending:false}).limit(50)]);
      if(m.error)throw m.error;if(p.error)throw p.error;
      const members=m.data||[],posts=p.data||[],joined=members.some(x=>x.user_id===me().id),P=await profs(posts.map(x=>x.author_id));
      const canPost=c.ownerPosts?g.created_by===me().id:joined;
      body.innerHTML="";
      body.appendChild(card("<strong>"+esc(g.name)+'</strong><div class="om2-note">'+esc(g.description||"")+'</div><div class="om2-note">'+members.length+" "+c.word+"</div>",[[joined?c.leave:c.join,async()=>{if(joined){const {error}=await db().from(c.mem).delete().eq(c.fk,g.id).eq("user_id",me().id);if(error)throw error;}else{const {error}=await db().from(c.mem).insert({[c.fk]:g.id,user_id:me().id});if(error)throw error;}render();},joined]]));
      if(canPost)body.appendChild(composer(c.ph,async text=>{const {error}=await db().from(c.posts).insert({[c.fk]:g.id,author_id:me().id,body:text});if(error)throw error;render();}));
      posts.forEach(x=>body.appendChild(postCard(P[x.author_id],x.body,x.created_at)));
      if(!posts.length)body.insertAdjacentHTML("beforeend",'<p class="om-note">Aucune publication pour le moment.</p>');
    };
    await render();
  });
}

/* ---------- Événements ---------- */
async function eventsPage(body){
  await tabs(body,[["up","À venir"],["mine","Mes événements"]],async(k,v)=>{
    let q=db().from("events").select("*").order("starts_at",{ascending:true}).limit(100);
    if(k==="up")q=q.gte("starts_at",new Date(Date.now()-864e5).toISOString());
    const {data:evs,error}=await q;if(error)throw error;
    const ids=(evs||[]).map(e=>e.id),{data:rs}=ids.length?await db().from("event_rsvps").select("event_id,user_id,status").in("event_id",ids):{data:[]};
    const P=await profs((evs||[]).map(e=>e.created_by)),R=rs||[];
    let list=evs||[];if(k==="mine")list=list.filter(e=>e.created_by===me().id||R.some(r=>r.event_id===e.id&&r.user_id===me().id));
    v.innerHTML="";v.appendChild(bigBtn("+ Créer un événement",()=>newEvent(v)));
    if(!list.length)v.insertAdjacentHTML("beforeend",'<p class="om-note">Aucun événement.</p>');
    const rsvp=async(id,status)=>{if(status){const {error:e}=await db().from("event_rsvps").upsert({event_id:id,user_id:me().id,status},{onConflict:"event_id,user_id"});if(e)throw e;}else{const {error:e}=await db().from("event_rsvps").delete().eq("event_id",id).eq("user_id",me().id);if(e)throw e;}v.reload();};
    list.forEach(e=>{
      const mineR=R.find(r=>r.event_id===e.id&&r.user_id===me().id),going=R.filter(r=>r.event_id===e.id&&r.status==="going").length;
      const acts=[[mineR?.status==="going"?"✓ J’y vais":"Je participe",()=>rsvp(e.id,mineR?.status==="going"?null:"going")],[mineR?.status==="maybe"?"✓ Intéressé(e)":"Intéressé(e)",()=>rsvp(e.id,mineR?.status==="maybe"?null:"maybe"),true]];
      if(e.created_by===me().id)acts.push(["Supprimer",async()=>{if(!confirm("Supprimer cet événement ?"))return;const {error:x}=await db().from("events").delete().eq("id",e.id);if(x)throw x;v.reload();},true]);
      v.appendChild(card("📅 <strong>"+esc(e.title)+'</strong><div class="om2-note">'+ago(e.starts_at)+(e.location?" · 📍 "+esc(e.location):"")+"</div><p>"+esc(e.description||"")+'</p><div class="om2-note">Organisé par '+esc(nm(P[e.created_by]))+" · "+going+" participant(s)</div>",acts));
    });
  });
}
function newEvent(v){
  formModal("Créer un événement",'<input id="eT" maxlength="100" placeholder="Titre"><input id="eD" type="datetime-local"><input id="eL" maxlength="120" placeholder="Lieu"><textarea id="eX" maxlength="500" placeholder="Description"></textarea>',"Créer",async w=>{
    const t=w.querySelector("#eT").value.trim(),d=w.querySelector("#eD").value;if(!t||!d)throw Error("Titre et date obligatoires.");
    const {error}=await db().from("events").insert({title:t,starts_at:new Date(d).toISOString(),location:w.querySelector("#eL").value.trim(),description:w.querySelector("#eX").value.trim(),created_by:me().id});if(error)throw error;
    w.remove();toast("Événement créé.");v&&v.reload&&v.reload();});
}

/* ---------- Reels ---------- */
async function reelsPage(body){
  body.classList.add("om2-reels");
  body.innerHTML='<div class="om2-reels-bar"></div><div class="om2-reels-feed"></div>';
  const feed=body.querySelector(".om2-reels-feed");
  const load=async()=>{
    feed.innerHTML='<p class="om-note" style="color:#fff;padding:14px">Chargement…</p>';
    const {data,error}=await db().from("reels").select("*").order("created_at",{ascending:false}).limit(30);
    if(error){feed.innerHTML=errBox(error);return;}
    const P=await profs(data.map(r=>r.author_id));feed.innerHTML="";
    if(!data.length){feed.innerHTML='<p class="om-note" style="padding:14px">Aucun reel pour le moment. Publie le premier !</p>';return;}
    data.forEach(r=>{
      const el=document.createElement("section");el.className="om2-reel";
      el.innerHTML='<video playsinline loop muted preload="metadata" src="'+esc(r.video_url)+'"></video><div class="om2-reel-info"><strong>'+esc(nm(P[r.author_id]))+"</strong><p>"+esc(r.caption||"")+"</p></div>";
      const v=el.querySelector("video");v.onclick=()=>{if(v.muted){v.muted=false;return;}v.paused?v.play():v.pause();};
      if(r.author_id===me().id){const d=document.createElement("button");d.className="om2-reel-del";d.textContent="🗑";d.onclick=async()=>{if(!confirm("Supprimer ce reel ?"))return;const {error:e}=await db().from("reels").delete().eq("id",r.id);if(e)return toast(e.message);load();};el.appendChild(d);}
      feed.appendChild(el);
    });
    const io=new IntersectionObserver(es=>es.forEach(x=>{const v=x.target.querySelector("video");if(x.isIntersecting)v.play().catch(()=>{});else v.pause();}),{root:feed,threshold:.7});
    feed.querySelectorAll(".om2-reel").forEach(s=>io.observe(s));
  };
  body.querySelector(".om2-reels-bar").appendChild(bigBtn("+ Nouveau reel",async()=>{
    const f=await S().pick("video/*");if(!f)return;
    formModal("Nouveau reel",'<p class="om-note">'+esc(f.name)+'</p><textarea id="rC" maxlength="200" placeholder="Légende"></textarea>',"Publier",async w=>{
      const url=await S().upload(f,"reels");const {error}=await db().from("reels").insert({author_id:me().id,video_url:url,caption:w.querySelector("#rC").value.trim()});if(error)throw error;
      w.remove();toast("Reel publié !");load();});
  }));
  await load();
}

/* ---------- Mail ---------- */
async function mailPage(body){
  await tabs(body,[["in","Réception"],["out","Envoyés"]],async(k,v)=>{
    const col=k==="in"?"recipient_id":"sender_id";
    const {data,error}=await db().from("mail_messages").select("*").eq(col,me().id).order("created_at",{ascending:false}).limit(100);if(error)throw error;
    const P=await profs((data||[]).map(m=>k==="in"?m.sender_id:m.recipient_id));
    v.innerHTML="";v.appendChild(bigBtn("✉️ Écrire",()=>compose(()=>v.reload())));
    if(!data.length)v.insertAdjacentHTML("beforeend",'<p class="om-note">Aucun message.</p>');
    data.forEach(m=>{const who=P[k==="in"?m.sender_id:m.recipient_id];
      v.appendChild(card((k==="in"&&!m.read_at?'<span class="om2-dot"></span>':"")+"<strong>"+esc(m.subject||"(sans objet)")+'</strong><div class="om2-note">'+(k==="in"?"De ":"À ")+esc(nm(who))+" · "+ago(m.created_at)+"</div>",[["Ouvrir",async()=>{showMail(m,who,k,v);if(k==="in"&&!m.read_at){await db().from("mail_messages").update({read_at:new Date().toISOString()}).eq("id",m.id);v.reload();}}]]));});
  });
}
function showMail(m,who,k,v){
  const w=S().modal(m.subject||"(sans objet)",'<div class="om-note">'+(k==="in"?"De ":"À ")+esc(nm(who))+" · "+ago(m.created_at)+'</div><p style="white-space:pre-wrap">'+esc(m.body)+'</p><div class="om-actions"><button type="button" id="mR">Répondre</button><button type="button" class="om-cancel" id="mD">Supprimer</button><button type="button" class="om-cancel" id="mX">Fermer</button></div>');
  w.querySelector("#mX").onclick=()=>w.remove();
  w.querySelector("#mR").onclick=()=>{w.remove();compose(()=>v.reload(),who);};
  w.querySelector("#mD").onclick=async()=>{if(!confirm("Supprimer ce message ?"))return;const {error}=await db().from("mail_messages").delete().eq("id",m.id);if(error)return toast(error.message);w.remove();v.reload();};
}
function compose(reload,to){
  const go=rec=>formModal("Nouveau message",'<p class="om-note">À : <b>'+esc(nm(rec))+'</b></p><input id="mS" maxlength="120" placeholder="Objet"><textarea id="mB" placeholder="Ton message…"></textarea>',"Envoyer",async w=>{
    const b=w.querySelector("#mB").value.trim();if(!b)throw Error("Écris un message.");
    const {error}=await db().from("mail_messages").insert({sender_id:me().id,recipient_id:rec.id,subject:w.querySelector("#mS").value.trim(),body:b});if(error)throw error;
    w.remove();toast("Message envoyé.");reload&&reload();});
  to&&to.id?go(to):pickMember("Choisir le destinataire",go);
}

/* ---------- Fils ---------- */
async function feedsPage(body){
  await tabs(body,[["friends","Amis"],["all","Récents"],["media","Médias"]],async(k,v)=>{
    let q=db().from("posts").select("*").order("created_at",{ascending:false}).limit(60);
    if(k==="media")q=q.not("media_url","is",null);
    if(k==="friends"){const {data:fr,error}=await db().from("friend_requests").select("sender_id,recipient_id").eq("status","accepted").or("sender_id.eq."+me().id+",recipient_id.eq."+me().id);if(error)throw error;const ids=(fr||[]).map(r=>r.sender_id===me().id?r.recipient_id:r.sender_id);ids.push(me().id);q=q.in("author_id",ids);}
    const {data,error}=await q;if(error)throw error;
    const P=await profs(data.map(p=>p.author_id));v.innerHTML=data.length?"":'<p class="om-note">Rien à afficher pour le moment.</p>';
    data.forEach(p=>v.appendChild(postCard(P[p.author_id],p.body,p.created_at,mediaHtml(p.media_url,p.media_type))));
  });
}

/* ---------- Jeux ---------- */
function morpion(box){
  let b=Array(9).fill(""),over=false;const L=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const win=s=>L.some(l=>l.every(i=>b[i]===s)),full=()=>b.every(Boolean);
  const draw=t=>{box.innerHTML='<div class="om2-grid3">'+b.map((c,i)=>'<button type="button" data-i="'+i+'">'+c+"</button>").join("")+'</div><p class="om-note">'+(t||"Tu es X. À toi de jouer !")+'</p><button class="om2-primary" id="gAgain" type="button">Rejouer</button>';
    box.querySelectorAll("[data-i]").forEach(x=>x.onclick=()=>play(+x.dataset.i));box.querySelector("#gAgain").onclick=()=>{b=Array(9).fill("");over=false;draw();};};
  const ai=()=>{const empty=b.map((c,i)=>c?-1:i).filter(i=>i>=0);const tryWin=s=>empty.find(i=>{b[i]=s;const w=win(s);b[i]="";return w;});let m=tryWin("O");if(m===undefined)m=tryWin("X");if(m===undefined&&!b[4])m=4;if(m===undefined)m=empty[Math.floor(Math.random()*empty.length)];b[m]="O";};
  const play=i=>{if(over||b[i])return;b[i]="X";if(win("X")){over=true;return draw("Bravo, tu as gagné ! 🎉");}if(full()){over=true;return draw("Match nul.");}ai();if(win("O")){over=true;return draw("L’ordinateur a gagné.");}if(full()){over=true;return draw("Match nul.");}draw();};
  draw();
}
function memory(box){
  const E=["🦁","🐘","🦒","🐊","🦜","🐢","🦋","🐠"];const cards=[...E,...E].sort(()=>Math.random()-.5);let open=[],done=new Set(),moves=0,lock=false;
  const draw=()=>{box.innerHTML='<p class="om-note">Coups : '+moves+'</p><div class="om2-grid4">'+cards.map((c,i)=>'<button type="button" data-i="'+i+'">'+(done.has(i)||open.includes(i)?c:"❓")+"</button>").join("")+"</div>"+(done.size===16?"<p><b>Bravo ! Terminé en "+moves+" coups 🎉</b></p>":"")+'<button class="om2-primary" id="gAgain" type="button">Rejouer</button>';
    box.querySelectorAll("[data-i]").forEach(x=>x.onclick=()=>flip(+x.dataset.i));box.querySelector("#gAgain").onclick=()=>memory(box);};
  const flip=i=>{if(lock||open.includes(i)||done.has(i))return;open.push(i);draw();if(open.length===2){moves++;lock=true;const [a,c]=open;setTimeout(()=>{if(cards[a]===cards[c]){done.add(a);done.add(c);}open=[];lock=false;draw();},700);}};
  draw();
}
function guess(box){
  const n=1+Math.floor(Math.random()*100);let t=0,found=false;
  box.innerHTML='<p>Devine le nombre entre 1 et 100.</p><input id="gI" type="number" min="1" max="100" inputmode="numeric"><button class="om2-primary" id="gGo" type="button">Valider</button><p class="om-note" id="gMsg"></p>';
  const go=box.querySelector("#gGo"),msg=box.querySelector("#gMsg");
  go.onclick=()=>{if(found)return guess(box);const v=+box.querySelector("#gI").value;if(!v)return;t++;if(v===n){found=true;msg.textContent="Bravo ! Trouvé en "+t+" essai(s) 🎉";go.textContent="Rejouer";}else msg.textContent=v<n?"C’est plus grand ⬆️":"C’est plus petit ⬇️";};
}
function gamesPage(body){
  const GAMES=[["⭕ Morpion",morpion],["🧠 Mémoire",memory],["🔢 Devine le nombre",guess]];
  const menu=()=>{body.innerHTML='<p class="om2-note">Choisis un jeu.</p>';GAMES.forEach(([t,f])=>body.appendChild(card("<strong>"+t+"</strong>",[["Jouer",()=>{body.innerHTML='<button type="button" class="om-cancel" id="gBack" style="border:0;border-radius:10px;padding:8px 12px">‹ Jeux</button><div id="gBox"></div>';body.querySelector("#gBack").onclick=menu;f(body.querySelector("#gBox"));}]])));};
  menu();
}

/* ---------- Espace Pubs ---------- */
async function adsPage(body){
  await tabs(body,[["see","Découvrir"],["mine","Mes pubs"]],async(k,v)=>{
    v.innerHTML="";
    if(k==="mine")v.appendChild(bigBtn("+ Créer une pub",()=>newAd(v)));
    let q=db().from("ads").select("*").order("created_at",{ascending:false}).limit(40);q=k==="mine"?q.eq("owner_id",me().id):q.eq("status","active");
    const {data,error}=await q;if(error)throw error;
    if(!data.length)v.insertAdjacentHTML("beforeend",'<p class="om-note">'+(k==="mine"?"Tu n’as pas encore de pub.":"Aucune pub pour le moment.")+"</p>");
    data.forEach(a=>{const u=safeUrl(a.link_url);const acts=[];
      if(k==="mine"){acts.push([a.status==="active"?"Mettre en pause":"Activer",async()=>{const {error:e}=await db().from("ads").update({status:a.status==="active"?"paused":"active"}).eq("id",a.id);if(e)throw e;v.reload();},true],["Supprimer",async()=>{if(!confirm("Supprimer cette pub ?"))return;const {error:e}=await db().from("ads").delete().eq("id",a.id);if(e)throw e;v.reload();},true]);}
      const el=card('<div class="om2-note">'+(k==="mine"?(a.status==="active"?"🟢 Active":"⏸ En pause"):"Sponsorisé")+"</div><strong>"+esc(a.title)+"</strong>"+(a.image_url?'<img class="om-media" loading="lazy" src="'+esc(a.image_url)+'" alt="">':"")+"<p>"+esc(a.body||"")+"</p>"+(u?'<a class="om2-primary" style="display:inline-block;text-decoration:none" href="'+esc(u)+'" target="_blank" rel="noopener noreferrer">En savoir plus</a>':""),acts);
      v.appendChild(el);});
  });
}
function newAd(v){
  let file=null;
  const w=formModal("Créer une pub",'<input id="aT" maxlength="80" placeholder="Titre"><textarea id="aB" maxlength="300" placeholder="Texte de la pub"></textarea><input id="aL" type="url" placeholder="Lien (https://… ou lien WhatsApp)"><button type="button" class="om-cancel" id="aI" style="border:0;border-radius:12px;padding:10px 14px;margin-top:6px">📷 Ajouter une image</button><p class="om-note" id="aF"></p>',"Publier",async w=>{
    const t=w.querySelector("#aT").value.trim();if(!t)throw Error("Ajoute un titre.");
    const l=w.querySelector("#aL").value.trim();if(l&&!safeUrl(l))throw Error("Le lien doit commencer par https://");
    const img=file?await S().upload(file,"ads"):null;
    const {error}=await db().from("ads").insert({owner_id:me().id,title:t,body:w.querySelector("#aB").value.trim(),link_url:l||null,image_url:img});if(error)throw error;
    w.remove();toast("Pub publiée.");v&&v.reload&&v.reload();});
  w.querySelector("#aI").onclick=async()=>{const f=await S().pick("image/*");if(f){file=f;w.querySelector("#aF").textContent=f.name;}};
}

/* ---------- Avatars ---------- */
const SK=["#f6d3b5","#e0ac7e","#b9824f","#8a5a35","#5b3b25"],HC=["#1d1b1b","#4a2f1b","#a8571c","#e4c05a","#7652d6","#d0498b"],BGS=["#eadcff","#cfe8ff","#d6f5dc","#ffe3c4","#ffd0d8","#e5e5e5"];
function avSvg(o){
  const hc=HC[o.hc],sk=SK[o.sk];
  const back=o.hs===2?'<circle cx="100" cy="82" r="62" fill="'+hc+'"/>':o.hs===3?'<rect x="48" y="60" width="104" height="110" rx="40" fill="'+hc+'"/>':"";
  const front=o.hs===1?'<path d="M54 86 Q56 36 100 36 Q144 36 146 86 Q128 58 100 58 Q72 58 54 86Z" fill="'+hc+'"/>':o.hs===2?'<path d="M56 80 Q100 40 144 80 Q130 60 100 60 Q70 60 56 80Z" fill="'+hc+'"/>':o.hs===3?'<path d="M54 90 Q56 36 100 36 Q144 36 146 90 Q120 56 100 66 Q80 56 54 90Z" fill="'+hc+'"/>':"";
  const eyes=o.ey===0?'<circle cx="82" cy="96" r="5" fill="#222"/><circle cx="118" cy="96" r="5" fill="#222"/>':'<path d="M74 98 Q82 90 90 98" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M110 98 Q118 90 126 98" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>';
  const mouth=o.mo===0?'<path d="M82 120 Q100 138 118 120" stroke="#7a2e2e" stroke-width="5" fill="none" stroke-linecap="round"/>':o.mo===1?'<path d="M80 118 Q100 146 120 118Z" fill="#7a2e2e"/>':'<path d="M86 124 H114" stroke="#7a2e2e" stroke-width="5" stroke-linecap="round"/>';
  const gl=o.gl?'<g fill="none" stroke="#222" stroke-width="4"><circle cx="82" cy="96" r="14"/><circle cx="118" cy="96" r="14"/><path d="M96 96 H104"/></g>':"";
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="400" height="400"><rect width="200" height="200" fill="'+BGS[o.bg]+'"/>'+back+'<path d="M30 200 Q36 150 100 150 Q164 150 170 200Z" fill="#7652d6"/><rect x="88" y="130" width="24" height="28" fill="'+sk+'"/><ellipse cx="100" cy="95" rx="46" ry="52" fill="'+sk+'"/>'+front+eyes+mouth+gl+"</svg>";
}
function avatarsPage(body){
  const o={sk:1,hc:0,hs:1,bg:0,ey:0,mo:0,gl:0};
  const GROUPS=[["Peau","sk",SK],["Couleur des cheveux","hc",HC],["Coiffure","hs",["Aucune","Courte","Afro","Longue"]],["Fond","bg",BGS],["Yeux","ey",["Ronds","Souriants"]],["Bouche","mo",["Sourire","Grand sourire","Neutre"]],["Lunettes","gl",["Non","Oui"]]];
  body.innerHTML='<div class="om2-av-prev" id="avP"></div><div id="avC"></div><p class="om-note" id="avM"></p>';
  const prev=()=>{body.querySelector("#avP").innerHTML=avSvg(o);};
  const ctrl=body.querySelector("#avC");
  GROUPS.forEach(([label,key,vals])=>{
    const d=document.createElement("div");d.innerHTML="<strong>"+label+'</strong><div class="om2-opts"></div>';const box=d.querySelector(".om2-opts");
    vals.forEach((v,i)=>{const b=document.createElement("button");b.type="button";const col=typeof v==="string"&&v[0]==="#";if(col){b.className="sw";b.style.background=v;}else b.textContent=v;if(o[key]===i)b.classList.add("on");b.onclick=()=>{o[key]=i;box.querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");prev();};box.appendChild(b);});
    ctrl.appendChild(d);
  });
  const save=bigBtn("Utiliser comme photo de profil",async()=>{
    const msg=body.querySelector("#avM");save.disabled=true;msg.textContent="Enregistrement…";
    try{
      const img=new Image();await new Promise((res,rej)=>{img.onload=res;img.onerror=()=>rej(Error("Image impossible à créer."));img.src="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(avSvg(o));});
      const cv=document.createElement("canvas");cv.width=cv.height=400;cv.getContext("2d").drawImage(img,0,0,400,400);
      const blob=await new Promise(r=>cv.toBlob(r,"image/png"));if(!blob)throw Error("Image impossible à créer.");
      const url=await S().upload(new File([blob],"avatar.png",{type:"image/png"}),"profiles");
      const {error}=await db().from("profiles").update({avatar_url:url,updated_at:new Date().toISOString()}).eq("id",me().id);if(error)throw error;
      S().refreshProfile&&await S().refreshProfile();msg.textContent="Photo de profil mise à jour ✅";toast("Avatar enregistré.");
    }catch(e){msg.textContent=e.message||String(e);}finally{save.disabled=false;}
  });
  body.appendChild(save);prev();
}

/* ---------- Aide et assistance ---------- */
const FAQ=[["Comment modifier mon profil ?","Ouvre l’onglet Profil puis touche « Modifier le profil »."],["Comment changer mon mot de passe ?","Paramètres et confidentialité → Espace Comptes → Mot de passe et sécurité."],["Comment bloquer quelqu’un ?","Paramètres et confidentialité → Blocage, ou le menu ⋯ dans une conversation."],["Comment publier une story ou un statut ?","Touche « Créer une story » sur l’accueil, ou « Mon statut » dans l’onglet Statut."],["Je ne reçois pas de messages en temps réel","Vérifie ta connexion Internet puis ferme et rouvre l’application."]];
async function helpPage(body){
  body.innerHTML='<strong>Questions fréquentes</strong>';
  FAQ.forEach(([q,a])=>{const d=document.createElement("details");d.className="om2-card";d.innerHTML="<summary><strong>"+esc(q)+"</strong></summary><p>"+esc(a)+"</p>";body.appendChild(d);});
  const form=card("<strong>Contacter l’équipe OMEGIA</strong>");
  form.insertAdjacentHTML("beforeend",'<input id="tS" maxlength="120" placeholder="Sujet" style="width:100%;padding:10px;border:1px solid #d8d1e8;border-radius:12px;margin:8px 0;font:inherit"><textarea id="tB" maxlength="2000" placeholder="Décris ton problème ou ta question…" style="width:100%;min-height:90px;padding:10px;border:1px solid #d8d1e8;border-radius:12px;font:inherit"></textarea><div class="om-actions"><button type="button" id="tSend">Envoyer</button></div>');
  body.appendChild(form);
  const list=document.createElement("div");body.appendChild(list);
  const load=async()=>{const {data,error}=await db().from("support_tickets").select("*").eq("user_id",me().id).order("created_at",{ascending:false}).limit(20);if(error){list.innerHTML=errBox(error);return;}list.innerHTML=data.length?"<strong>Mes demandes</strong>":"";data.forEach(t=>list.appendChild(card("<strong>"+esc(t.subject||"(sans sujet)")+'</strong><div class="om2-note">'+ago(t.created_at)+" · "+(t.status==="open"?"En cours":"Traité")+"</div><p>"+esc(t.body)+"</p>")));};
  form.querySelector("#tSend").onclick=async()=>{const s=form.querySelector("#tS").value.trim(),b=form.querySelector("#tB").value.trim();if(!b)return toast("Écris ton message.");const {error}=await db().from("support_tickets").insert({user_id:me().id,subject:s,body:b});if(error)return toast(missing(error)?"Exécute d’abord supabase/features.sql dans Supabase.":error.message);form.querySelector("#tS").value="";form.querySelector("#tB").value="";toast("Message envoyé à l’équipe.");load();};
  await load();
}

/* ---------- Appels audio / vidéo (WebRTC + signalisation Supabase) ---------- */
const ICE={iceServers:[{urls:"stun:stun.l.google.com:19302"},{urls:"stun:stun1.l.google.com:19302"}]};
let call=null,ringCh=null;
function ensureRing(){
  if(ringCh||!db()||!me())return;
  ringCh=db().channel("omegia-calls-"+me().id)
    .on("broadcast",{event:"ring"},({payload})=>incoming(payload))
    .on("broadcast",{event:"answer"},async({payload})=>{if(call&&call.id===payload.id&&call.pc&&!call.pc.currentRemoteDescription){try{await call.pc.setRemoteDescription(payload.sdp);setStatus("Connexion…");}catch(e){endCall(false,"Appel impossible.");}}})
    .on("broadcast",{event:"hangup"},({payload})=>{if(call&&call.id===payload.id)endCall(false,payload.busy?"Ton contact est déjà en appel.":"Appel terminé.");})
    .subscribe();
}
async function sendTo(peer,event,payload){
  const ch=db().channel("omegia-calls-"+peer);
  await new Promise(res=>{ch.subscribe(s=>{if(s==="SUBSCRIBED")res();});setTimeout(res,4000);});
  await ch.send({type:"broadcast",event,payload});db().removeChannel(ch);
}
const gather=pc=>new Promise(res=>{if(pc.iceGatheringState==="complete")return res();const f=()=>{if(pc.iceGatheringState==="complete"){pc.removeEventListener("icegatheringstatechange",f);res();}};pc.addEventListener("icegatheringstatechange",f);setTimeout(res,3500);});
function setStatus(t){const s=call&&call.ui&&call.ui.querySelector("#om2St");if(s)s.textContent=t;}
function mkPc(){
  const pc=new RTCPeerConnection(ICE);call.pc=pc;call.stream.getTracks().forEach(t=>pc.addTrack(t,call.stream));
  pc.ontrack=e=>{const r=call&&call.ui&&call.ui.querySelector("#om2Remote");if(r&&r.srcObject!==e.streams[0]){r.srcObject=e.streams[0];r.play&&r.play().catch(()=>{});}};
  pc.onconnectionstatechange=()=>{if(!call)return;if(pc.connectionState==="connected")setStatus("En communication");if(pc.connectionState==="failed")endCall(true,"Connexion impossible (réseau).");};
  return pc;
}
function callUI(name,video){
  const d=document.createElement("div");d.className="om2-call";
  d.innerHTML='<video id="om2Remote" autoplay playsinline'+(video?"":' style="display:none"')+'></video>'+(video?'<video id="om2Local" autoplay playsinline muted></video>':"")+"<h2>"+esc(name)+'</h2><div id="om2St">Appel en cours…</div><div class="om2-ctl"><button type="button" id="om2Mute" aria-label="Micro">🎙</button><button type="button" class="end" id="om2End" aria-label="Raccrocher">📞</button></div>';
  document.body.appendChild(d);
  const l=d.querySelector("#om2Local");if(l)l.srcObject=call.stream;
  d.querySelector("#om2End").onclick=()=>endCall(true,"Appel terminé.");
  d.querySelector("#om2Mute").onclick=e=>{const a=call.stream.getAudioTracks()[0];if(a){a.enabled=!a.enabled;e.currentTarget.textContent=a.enabled?"🎙":"🔇";}};
  return d;
}
function endCall(notify,msg){
  if(!call)return;const c=call;call=null;
  if(notify)sendTo(c.peer,"hangup",{id:c.id}).catch(()=>{});
  clearTimeout(c.timer);try{c.stream.getTracks().forEach(t=>t.stop());}catch{}try{c.pc&&c.pc.close();}catch{}c.ui&&c.ui.remove();
  document.querySelectorAll(".om2-ring").forEach(x=>x.remove());
  if(msg)toast(msg);
}
async function startCall(video){
  if(!ready())return;const peer=S().activePeer;
  if(!peer)return toast("Ouvre une conversation avec un membre pour l’appeler.");
  if(call)return toast("Un appel est déjà en cours.");
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.RTCPeerConnection)return toast("Ton navigateur ne gère pas les appels.");
  let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:!!video});}catch{return toast("Autorise le micro"+(video?" et la caméra":"")+" pour appeler.");}
  const id=crypto.randomUUID();call={id,peer,stream,video:!!video};
  try{
    const P=await profs([peer]);call.ui=callUI(nm(P[peer]),video);ensureRing();
    const pc=mkPc();await pc.setLocalDescription(await pc.createOffer());await gather(pc);
    await sendTo(peer,"ring",{id,from:me().id,video:!!video,sdp:pc.localDescription});
    setStatus("Ça sonne…");call.timer=setTimeout(()=>{if(call&&call.id===id&&call.pc&&!call.pc.currentRemoteDescription)endCall(true,"Pas de réponse.");},45000);
  }catch(e){endCall(false,"Appel impossible : "+(e.message||e));}
}
async function incoming(p){
  if(!p||!p.id)return;
  if(call){sendTo(p.from,"hangup",{id:p.id,busy:true}).catch(()=>{});return;}
  const P=await profs([p.from]),w=document.createElement("div");w.className="om2-call om2-ring";
  w.innerHTML="<h2>"+esc(nm(P[p.from]))+"</h2><div>"+(p.video?"Appel vidéo":"Appel vocal")+' entrant…</div><div class="om2-ctl"><button type="button" id="rNo" class="end" aria-label="Refuser">📞</button><button type="button" id="rYes" aria-label="Répondre" style="background:#2e9d57">📞</button></div>';
  document.body.appendChild(w);const stop=()=>w.remove();
  const auto=setTimeout(()=>{stop();},45000);
  w.querySelector("#rNo").onclick=()=>{clearTimeout(auto);stop();sendTo(p.from,"hangup",{id:p.id}).catch(()=>{});};
  w.querySelector("#rYes").onclick=async()=>{
    clearTimeout(auto);stop();
    let stream;try{stream=await navigator.mediaDevices.getUserMedia({audio:true,video:!!p.video});}catch{sendTo(p.from,"hangup",{id:p.id}).catch(()=>{});return toast("Autorise le micro pour répondre.");}
    call={id:p.id,peer:p.from,stream,video:!!p.video};
    try{call.ui=callUI(nm(P[p.from]),p.video);const pc=mkPc();await pc.setRemoteDescription(p.sdp);await pc.setLocalDescription(await pc.createAnswer());await gather(pc);await sendTo(p.from,"answer",{id:p.id,sdp:pc.localDescription});setStatus("Connexion…");}
    catch(e){endCall(true,"Appel impossible.");}
  };
}

/* ---------- Contact, conversation, profil ---------- */
async function peerProfile(){
  const peer=S().activePeer;if(!peer)return toast("Aucun contact sélectionné.");
  const P=await profs([peer]),p=P[peer]||{};
  const w=S().modal("Profil",'<div class="om-user">'+av(p)+'<div class="om-grow"><strong>'+esc(nm(p))+'</strong><div class="om-note">@'+esc(p.username||"membre")+"</div></div></div><p>"+esc(p.bio||"Pas de bio.")+'</p><div class="om-note">'+(p.location?"📍 "+esc(p.location)+"<br>":"")+(p.work?"💼 "+esc(p.work)+"<br>":"")+(p.school?"🎓 "+esc(p.school):"")+'</div><div class="om-actions"><button type="button" class="om-cancel" id="pX">Fermer</button></div>');
  w.querySelector("#pX").onclick=()=>w.remove();
}
function chatMore(){
  const peer=S().activePeer;if(!peer)return toast("Aucun contact sélectionné.");
  const w=S().modal("Options de la conversation",'<div class="om-actions" style="flex-direction:column"><button type="button" id="cmP">👤 Voir le profil</button><button type="button" id="cmB" class="om-cancel">🚫 Bloquer ce contact</button><button type="button" id="cmX" class="om-cancel">Fermer</button></div>');
  w.querySelector("#cmX").onclick=()=>w.remove();
  w.querySelector("#cmP").onclick=()=>{w.remove();peerProfile();};
  w.querySelector("#cmB").onclick=async()=>{if(!confirm("Bloquer ce contact ?"))return;try{await blockUser(peer);w.remove();toast("Contact bloqué.");}catch(e){toast(missing(e)?"Exécute d’abord supabase/features.sql dans Supabase.":e.message);}};
}
function profileMore(){
  const w=S().modal("Options du profil",'<div class="om-actions" style="flex-direction:column"><button type="button" id="pmI">🔗 Inviter des amis sur OMEGIA</button><button type="button" id="pmA">🧑 Créer mon avatar</button><button type="button" id="pmH">📋 Historique d’activité</button><button type="button" id="pmS">⚙️ Paramètres et confidentialité</button><button type="button" id="pmX" class="om-cancel">Fermer</button></div>');
  w.querySelector("#pmX").onclick=()=>w.remove();
  w.querySelector("#pmI").onclick=async()=>{w.remove();const url=location.origin+location.pathname,text="Rejoins-moi sur OMEGIA !";try{if(navigator.share)await navigator.share({title:"OMEGIA",text,url});else{await navigator.clipboard.writeText(text+" "+url);toast("Lien copié.");}}catch{}};
  w.querySelector("#pmA").onclick=()=>{w.remove();openPage("Avatars",avatarsPage);};
  w.querySelector("#pmH").onclick=()=>{w.remove();openPage("Historique d’activité",activityPage);};
  w.querySelector("#pmS").onclick=()=>{w.remove();document.querySelector("[data-goto='settings']")?.click();};
}
async function profileTab(k){
  const box=$("profilePosts");if(!box)return;
  if(k==="all"){document.querySelector("[data-nav='profile']")?.click();return;}
  if(!ready())return;box.innerHTML='<p class="om-note">Chargement…</p>';
  try{
    if(k==="photos"){const {data,error}=await db().from("posts").select("media_url").eq("author_id",me().id).eq("media_type","image").order("created_at",{ascending:false}).limit(60);if(error)throw error;box.innerHTML=data.length?'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px"></div>':'<p class="om-note">Aucune photo publiée.</p>';const g=box.firstElementChild;data.forEach(x=>{const i=document.createElement("img");i.src=x.media_url;i.loading="lazy";i.style.cssText="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px";i.onclick=()=>S().showPhoto&&S().showPhoto(x.media_url);g.appendChild(i);});}
    if(k==="reels"){const {data,error}=await db().from("reels").select("video_url,caption").eq("author_id",me().id).order("created_at",{ascending:false}).limit(30);if(error)throw error;box.innerHTML=data.length?"":'<p class="om-note">Aucun reel publié. Ouvre « Reels » dans le menu pour en créer.</p>';data.forEach(x=>box.insertAdjacentHTML("beforeend",'<div class="om-post"><video class="om-media" controls playsinline preload="metadata" src="'+esc(x.video_url)+'"></video><p>'+esc(x.caption||"")+"</p></div>"));}
    if(k==="events"){const {data,error}=await db().from("events").select("title,starts_at,location").eq("created_by",me().id).order("starts_at",{ascending:false}).limit(30);if(error)throw error;box.innerHTML=data.length?"":'<p class="om-note">Aucun événement créé. Ouvre « Événements » dans le menu pour en créer.</p>';data.forEach(x=>box.insertAdjacentHTML("beforeend",'<div class="om-post"><strong>📅 '+esc(x.title)+'</strong><div class="om-note">'+ago(x.starts_at)+(x.location?" · "+esc(x.location):"")+"</div></div>"));}
  }catch(e){box.innerHTML=errBox(e);}
}

/* ---------- Routage des clics (capture : passe avant les anciens messages « bientôt ») ---------- */
const MENU={groups:["Groupes",community(CFG.groups)],pages:["Pages",community(CFG.pages)],events:["Événements",eventsPage],reels:["Reels",reelsPage],feeds:["Fils",feedsPage],games:["Jeux",gamesPage],ads:["Espace Pubs",adsPage],avatars:["Avatars",avatarsPage],assistance:["Assistance",helpPage],help:["Aide et assistance",helpPage],mail:["Mail",mailPage]};
const ITEMS={"privacy-assist":["Assistance confidentialité",assistPage],audience:["Paramètres d’audience par défaut",PANEL.audience],"posts-vis":["Publications",PANEL.audience],"stories-vis":["Stories / Statuts",PANEL.stories],notifications:["Notifications",PANEL.notif],language:["Langue et région",PANEL.lang],media:["Contenu multimédia",PANEL.media],time:["Gestion du temps",timePage],"profile-lock":["Verrouillage du profil",PANEL.lock],"how-find":["Comment les autres peuvent vous trouver",PANEL.find],followers:["Followers et contenu public",PANEL.followers],tagging:["Profil et identification",PANEL.tagging],blocking:["Blocage",blockPage],"online-status":["Statut En ligne",PANEL.online],activity:["Historique d’activité",activityPage],"device-perms":["Autorisations de l’appareil",devicePage],"link-history":["Historique des liens",linksPage],terms:["Conditions de service",legalPage("terms"),1],"privacy-policy":["Politique de confidentialité",legalPage("privacy"),1],cookies:["Politique d’utilisation des cookies",legalPage("cookies"),1],community:["Standards de la communauté",legalPage("community"),1],about:["À propos d’OMEGIA",legalPage("about"),1]};
const open=(t,f,st)=>{if(!st&&!ready())return;openPage(t,f);};
document.addEventListener("click",e=>{
  const el=e.target.closest&&e.target.closest("[data-setting],[data-setting-item],#chatVideo,#chatCall,#chatMore,#chatPeerBtn,#profileMoreBtn");if(!el)return;
  const s=el.dataset.setting,i=el.dataset.settingItem;let handled=true;
  if(s&&MENU[s]){const sm=$("sideMenu");if(sm)sm.hidden=true;closePages();open(...MENU[s]);}
  else if(i==="password")passwordModal();
  else if(i&&ITEMS[i]&&!el.closest(".om2-page")){open(...ITEMS[i]);}
  else if(el.id==="chatVideo")startCall(true);
  else if(el.id==="chatCall")startCall(false);
  else if(el.id==="chatMore")chatMore();
  else if(el.id==="chatPeerBtn")peerProfile();
  else if(el.id==="profileMoreBtn")profileMore();
  else handled=false;
  if(handled){e.preventDefault();e.stopPropagation();}
},true);
document.querySelectorAll("[data-ptab]").forEach(t=>t.addEventListener("click",()=>setTimeout(()=>profileTab(t.dataset.ptab),0)));

/* ---------- Synchronisation après connexion ---------- */
let synced=false;
setInterval(async()=>{
  if(!me()){synced=false;return;}if(synced||!db())return;synced=true;
  try{const {data}=await db().auth.getUser();const s=data&&data.user&&data.user.user_metadata&&data.user.user_metadata.settings;if(s&&typeof s==="object"){prefs={...s};try{localStorage.setItem(PK,JSON.stringify(prefs));}catch{}applyPrefs();}}catch{}
  try{const {data:ps}=await db().from("profile_settings").select("*").eq("user_id",me().id).maybeSingle();if(ps){prefs={...prefs,profileLocked:ps.profile_locked,discoverable:ps.discoverable,allowRequests:ps.allow_requests,allowMessages:ps.allow_messages==="friends"?"friends":"all",storiesAudience:ps.stories_audience==="friends"?"friends":"public"};try{localStorage.setItem(PK,JSON.stringify(prefs));}catch{}}}catch{}
  ensureRing();
},1500);
})();
