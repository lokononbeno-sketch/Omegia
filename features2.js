/* OMEGIA — lot 2 : blocage, confidentialité, romans synchronisés.
   Nécessite supabase/lot2.sql. Sans lui, l’application garde son comportement précédent et affiche une aide. */
(()=>{"use strict";
const $=id=>document.getElementById(id);
const S=()=>window.omegiaSocial||{};
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v);}catch{return d;}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch{}}
};
const toast=s=>(S().toast?S().toast(s):alert(s));
const SQL_HINT="Mise à jour SQL Supabase requise (supabase/lot2.sql).";
const isMissing=e=>!!e&&(/(does not exist|schema cache|could not find)/i.test(e.message||"")||["42P01","42883","PGRST202","PGRST205"].includes(e.code));
const fail=e=>toast(isMissing(e)?SQL_HINT:((e&&e.message)||"Action impossible."));
const nameOf=p=>((p?.first_name||"")+" "+(p?.last_name||"")).trim()||"Membre";
const CLOSE='<div class="om-actions"><button type="button" class="om-cancel" data-close>Fermer</button></div>';
function openPanel(title,html){
  if(!S().modal){alert("Le module social est en cours de chargement. Réessaie dans un instant.");return null;}
  const w=S().modal(title,html+CLOSE);
  w.querySelectorAll("[data-close]").forEach(b=>{b.onclick=()=>w.remove();});
  return w;
}

/* ---------- Réglages de confidentialité ---------- */
const DEF={show_online:true,discoverable:true,allow_messages:"everyone",default_visibility:"public",stories_audience:"everyone",profile_locked:false};
let cfg={...DEF};
function mirror(){try{localStorage.setItem("omegia.pref.showOnline",String(cfg.show_online));localStorage.setItem("omegia.pref.defaultVisibility",cfg.default_visibility);}catch{}}
async function loadCfg(){
  const {db,user}=S();if(!db||!user)return false;
  const {data,error}=await db.from("profile_settings").select("*").eq("user_id",user.id).maybeSingle();
  if(error){if(!isMissing(error))console.warn("Réglages :",error);return false;}
  if(data)cfg={...DEF,...data};
  mirror();return true;
}
async function saveCfg(patch){
  const {db,user}=S();if(!db||!user){toast("Connecte-toi d’abord.");return false;}
  const next={...cfg,...patch};
  const {error}=await db.from("profile_settings").upsert({user_id:user.id,show_online:next.show_online,discoverable:next.discoverable,allow_messages:next.allow_messages,default_visibility:next.default_visibility,stories_audience:next.stories_audience,profile_locked:next.profile_locked,updated_at:new Date().toISOString()},{onConflict:"user_id"});
  if(error){fail(error);return false;}
  cfg=next;mirror();toast("Réglage enregistré.");return true;
}
const fieldSelect=(id,label,value,options)=>'<label>'+esc(label)+'<select id="'+id+'">'+options.map(([v,l])=>'<option value="'+v+'"'+(v===value?" selected":"")+'>'+esc(l)+'</option>').join("")+'</select></label>';
const fieldToggle=(id,label,on)=>'<label class="om-toggle"><span>'+esc(label)+'</span><input type="checkbox" id="'+id+'"'+(on?" checked":"")+'></label>';
const bindToggle=(w,id,key)=>{const el=w.querySelector("#"+id);el.onchange=async e=>{const ok=await saveCfg({[key]:e.target.checked});if(!ok)e.target.checked=!e.target.checked;};};
const bindSelect=(w,id,key)=>{const el=w.querySelector("#"+id);el.onchange=async e=>{const before=cfg[key];const ok=await saveCfg({[key]:e.target.value});if(!ok)e.target.value=before;};};

async function visibilityPanel(){
  await loadCfg();
  const w=openPanel("Audience par défaut",fieldSelect("omVis2","Qui voit mes nouvelles publications ?",cfg.default_visibility,[["public","Public"],["friends","Mes amis"]])+'<p class="om-note">Tu peux toujours changer l’audience au moment de publier.</p>');
  if(w)bindSelect(w,"omVis2","default_visibility");
}
async function storiesPanel(){
  await loadCfg();
  const w=openPanel("Stories et statuts",fieldSelect("omSt","Qui peut voir mes stories et statuts ?",cfg.stories_audience,[["everyone","Tous les membres"],["friends","Mes amis uniquement"]])+'<p class="om-note">Ce réglage est appliqué par la base de données : les personnes non autorisées ne reçoivent pas ces contenus.</p>');
  if(w)bindSelect(w,"omSt","stories_audience");
}
async function findPanel(){
  await loadCfg();
  const w=openPanel("Comment les autres peuvent me trouver",fieldToggle("omDisc","Apparaître dans les recherches et suggestions",cfg.discoverable)+fieldSelect("omMsg","Qui peut m’écrire ?",cfg.allow_messages,[["everyone","Tous les membres"],["friends","Mes amis uniquement"]])+'<p class="om-note">Les personnes bloquées ne peuvent jamais t’écrire ni t’inviter.</p>');
  if(!w)return;
  bindToggle(w,"omDisc","discoverable");bindSelect(w,"omMsg","allow_messages");
}
async function lockPanel(){
  await loadCfg();
  const w=openPanel("Verrouillage du profil",fieldToggle("omLock","Verrouiller mon profil",cfg.profile_locked)+'<p class="om-note">Profil verrouillé : même tes publications « Public » ne sont visibles que par tes amis.</p>');
  if(w)bindToggle(w,"omLock","profile_locked");
}
async function onlinePanel(){
  await loadCfg();
  const w=openPanel("Statut En ligne",fieldToggle("omOn","Afficher quand je suis en ligne",cfg.show_online)+'<p class="om-note">Pris en compte à la prochaine ouverture de l’application. Désactivé, tu n’apparais plus en ligne pour les autres.</p>');
  if(w)bindToggle(w,"omOn","show_online");
}

/* ---------- Blocage ---------- */
async function isBlocked(id){
  const {db,user}=S();if(!db||!user)return false;
  const {data}=await db.from("user_blocks").select("blocked_id").eq("blocker_id",user.id).eq("blocked_id",id).maybeSingle();
  return !!data;
}
async function blockUser(id,nm){
  const {db,user}=S();
  if(!db||!user||!id||id===user.id)return false;
  if(!confirm("Bloquer "+nm+" ? Cette personne ne pourra plus t’écrire ni t’inviter, et vous ne verrez plus vos publications respectives."))return false;
  const {error}=await db.from("user_blocks").insert({blocker_id:user.id,blocked_id:id});
  if(error&&error.code!=="23505"){fail(error);return false;}
  await db.from("friend_requests").delete().or("and(sender_id.eq."+user.id+",recipient_id.eq."+id+"),and(sender_id.eq."+id+",recipient_id.eq."+user.id+")");
  toast(nm+" est bloqué(e).");return true;
}
async function unblockUser(id,nm){
  const {db,user}=S();
  if(!db||!user)return false;
  const {error}=await db.from("user_blocks").delete().eq("blocker_id",user.id).eq("blocked_id",id);
  if(error){fail(error);return false;}
  toast(nm+" est débloqué(e).");return true;
}
async function blockingPanel(){
  const {db,user}=S();
  if(!db||!user)return toast("Connecte-toi d’abord.");
  const w=openPanel("Comptes bloqués",'<div id="omBlocks"><p class="om-note">Chargement…</p></div><p class="om-note">Pour bloquer quelqu’un : ouvre sa conversation, touche ⋮ puis Bloquer. Une personne bloquée ne peut plus t’écrire, t’inviter ni voir tes publications.</p>');
  if(!w)return;
  const box=w.querySelector("#omBlocks");
  const paint=async()=>{
    const {data,error}=await db.from("user_blocks").select("blocked_id,created_at").eq("blocker_id",user.id).order("created_at",{ascending:false});
    if(error){box.textContent=isMissing(error)?SQL_HINT:error.message;return;}
    const ids=(data||[]).map(x=>x.blocked_id);
    let profs=[];
    if(ids.length){const r=await db.from("profiles").select("id,first_name,last_name").in("id",ids);profs=r.data||[];}
    box.innerHTML="";
    if(!ids.length){box.innerHTML='<p class="om-note">Aucun compte bloqué.</p>';return;}
    ids.forEach(id=>{
      const nm=nameOf(profs.find(p=>p.id===id));
      const row=document.createElement("div");row.className="om-line";
      row.innerHTML="<span>"+esc(nm)+'</span><button type="button" class="om-cancel" style="border:0;border-radius:10px;padding:8px 12px">Débloquer</button>';
      row.querySelector("button").onclick=async()=>{if(await unblockUser(id,nm))paint();};
      box.appendChild(row);
    });
  };
  paint();
}
async function chatMenu(){
  const {db,user}=S(),peer=S().activePeer;
  if(!db||!user||!peer)return toast("Ouvre d’abord une conversation avec un membre.");
  const blocked=await isBlocked(peer);
  const w=openPanel("Options de la conversation",'<div class="om-actions" style="flex-direction:column"><button type="button" data-a="profile">👤 Voir le profil</button><button type="button" class="om-cancel" data-a="block">'+(blocked?"✅ Débloquer":"🚫 Bloquer")+"</button></div>");
  if(!w)return;
  w.querySelector('[data-a="profile"]').onclick=()=>{w.remove();peerProfile(peer);};
  w.querySelector('[data-a="block"]').onclick=async()=>{
    const {data:p}=await db.from("profiles").select("first_name,last_name").eq("id",peer).maybeSingle();
    const nm=nameOf(p);
    const ok=blocked?await unblockUser(peer,nm):await blockUser(peer,nm);
    if(ok)w.remove();
  };
}
async function peerProfile(id){
  const {db,user,av}=S();
  if(!db||!user)return;
  const {data:p,error}=await db.from("profiles").select("*").eq("id",id).maybeSingle();
  if(error)return fail(error);
  if(!p)return toast("Profil introuvable.");
  const blocked=await isBlocked(id);
  const rows=[["📍",p.location],["💼",p.work],["🎓",p.school]].filter(r=>r[1]).map(r=>"<p>"+r[0]+" "+esc(r[1])+"</p>").join("");
  const w=openPanel(nameOf(p),'<div class="om-user" style="border:0">'+(av?av(p):"")+'<div class="om-grow">'+(p.username?'<div class="om-note">@'+esc(p.username)+"</div>":"")+"</div></div>"+(p.bio?'<p class="om-post-body">'+esc(p.bio)+"</p>":"")+rows+'<div class="om-actions"><button type="button" data-a="invite">Inviter</button><button type="button" class="om-cancel" data-a="block">'+(blocked?"Débloquer":"Bloquer")+"</button></div>");
  if(!w)return;
  w.querySelector('[data-a="invite"]').onclick=async()=>{
    const {error:er}=await db.from("friend_requests").insert({sender_id:user.id,recipient_id:id});
    toast(er?(er.code==="23505"?"Invitation déjà envoyée.":er.message):"Invitation envoyée.");
  };
  w.querySelector('[data-a="block"]').onclick=async()=>{
    const nm=nameOf(p);
    const ok=blocked?await unblockUser(id,nm):await blockUser(id,nm);
    if(ok)w.remove();
  };
}

/* ---------- Assistance confidentialité ---------- */
async function privacyAssist(){
  await loadCfg();
  const items=[
    ["Profil verrouillé",cfg.profile_locked?"Oui":"Non","profile-lock"],
    ["Audience par défaut des publications",cfg.default_visibility==="public"?"Public":"Amis","audience"],
    ["Stories et statuts",cfg.stories_audience==="everyone"?"Tous les membres":"Amis","stories-vis"],
    ["Apparaître dans les recherches",cfg.discoverable?"Oui":"Non","how-find"],
    ["Qui peut m’écrire",cfg.allow_messages==="everyone"?"Tous":"Amis","how-find"],
    ["Statut En ligne visible",cfg.show_online?"Oui":"Non","online-status"]
  ];
  const w=openPanel("Assistance confidentialité",items.map(([l,v,k])=>'<div class="om-line"><span>'+esc(l)+' : <strong>'+esc(v)+'</strong></span><button type="button" class="om-cancel" data-go="'+k+'" style="border:0;border-radius:10px;padding:8px 12px">Modifier</button></div>').join("")+'<p class="om-note">Rappel : les photos, vidéos et vocaux envoyés restent accessibles à toute personne qui possède leur adresse exacte.</p>');
  if(!w)return;
  w.querySelectorAll("[data-go]").forEach(b=>{b.onclick=()=>{w.remove();H[b.dataset.go]();};});
}

/* ---------- Romans synchronisés ---------- */
let novelsCache=[],isAdmin=false,remote=false;
const toLocalShape=r=>({id:r.id,title:r.title,price:r.price,buyUrl:r.buy_url,summary:r.summary,excerpt:r.excerpt||"",pdfUrl:r.pdf_url||"",createdAt:Date.parse(r.created_at)});
async function offerImport(){
  if(store.get("omegia.novelsImportAsked",false))return;
  let local=[];
  try{local=JSON.parse(localStorage.getItem("omegia.literary")||"[]");}catch{}
  local=local.filter(n=>n&&n.id!=="sample-1"&&n.title&&n.buyUrl);
  if(!local.length)return;
  store.set("omegia.novelsImportAsked",true);
  if(!confirm("Importer "+local.length+" roman(s) enregistré(s) sur cet appareil vers ton compte ?"))return;
  const {db,user}=S();
  const rows=local.map(n=>({author_id:user.id,title:String(n.title).slice(0,120),price:String(n.price||"—").slice(0,40),buy_url:n.buyUrl,summary:String(n.summary||"—").slice(0,2000),excerpt:String(n.excerpt||"").slice(0,5000)}));
  const {error}=await db.from("novels").insert(rows);
  if(error){fail(error);return;}
  const r=await db.from("novels").select("*").order("created_at",{ascending:false}).limit(100);
  if(!r.error)novelsCache=(r.data||[]).map(toLocalShape);
  toast("Romans importés.");
}
async function refreshNovels(){
  const {db,user}=S();if(!db||!user)return;
  const [r,a]=await Promise.all([db.from("novels").select("*").order("created_at",{ascending:false}).limit(100),db.rpc("omegia_is_novel_admin")]);
  if(r.error){remote=false;return;}
  remote=true;novelsCache=(r.data||[]).map(toLocalShape);isAdmin=a.data===true;
  const add=$("litAddBtn");if(add)add.style.display=isAdmin?"":"none";
  if(isAdmin&&!novelsCache.length)await offerImport();
  if(typeof window.renderLiteraryGrid==="function")window.renderLiteraryGrid();
}
function decorateDetail(id){
  const card=document.querySelector(".lit-detail-card");if(!card)return;
  card.querySelector("#omNovelExtra")?.remove();
  const n=novelsCache.find(x=>x.id===id);if(!remote||!n)return;
  const box=document.createElement("div");box.id="omNovelExtra";box.style.marginTop="12px";
  if(n.pdfUrl){const a=document.createElement("a");a.href=n.pdfUrl;a.target="_blank";a.rel="noopener";a.className="primary-button";a.style.cssText="display:block;text-align:center;margin-bottom:8px";a.textContent="Lire l’extrait PDF";box.appendChild(a);}
  if(isAdmin){
    const b=document.createElement("button");b.type="button";b.className="secondary-btn";b.textContent="Supprimer ce roman";
    b.onclick=async()=>{
      if(!confirm("Supprimer ce roman ?"))return;
      const {error}=await S().db.from("novels").delete().eq("id",id);
      if(error)return fail(error);
      await refreshNovels();
      if(typeof window.showView==="function")window.showView("literary");
    };
    box.appendChild(b);
  }
  card.appendChild(box);
}
function installNovelHooks(){
  const origLoad=window.loadNovels,origSample=window.ensureSampleNovels,origShow=window.showView,origOpen=window.openNovelDetail;
  if(typeof origLoad==="function")window.loadNovels=function(){return remote?novelsCache:origLoad.apply(this,arguments);};
  if(typeof origSample==="function")window.ensureSampleNovels=function(){return remote?novelsCache:origSample.apply(this,arguments);};
  if(typeof origShow==="function")window.showView=function(n){const r=origShow.apply(this,arguments);if(n==="literary")refreshNovels();return r;};
  if(typeof origOpen==="function")window.openNovelDetail=function(id){const r=origOpen.apply(this,arguments);decorateDetail(id);return r;};
}
async function publishNovel(){
  const {db,user}=S();
  const val=id=>($(id)?.value||"").trim();
  const title=val("litTitle"),price=val("litPrice"),buy=val("litBuyUrl"),summary=val("litSummary"),excerpt=val("litExcerpt");
  const msg=(t,err)=>{const m=$("litFormMessage");if(m){m.textContent=t;m.dataset.state=err?"error":"success";}};
  if(!title||!price||!buy||!summary)return msg("Titre, prix, lien d’achat et résumé sont obligatoires.",true);
  try{const u=new URL(buy);if(!/^https?:$/.test(u.protocol))throw new Error("protocol");}catch{return msg("Le lien d’achat doit être une URL valide (https://…).",true);}
  const btn=$("litPublishBtn");btn.disabled=true;msg("Publication…");
  try{
    let pdf=null;const f=$("litPdf")?.files?.[0];
    if(f){
      if(f.type!=="application/pdf")throw new Error("Le fichier doit être un PDF.");
      if(f.size>50*1024*1024)throw new Error("PDF trop lourd (50 Mo maximum).");
      const path=user.id+"/novels/"+crypto.randomUUID()+".pdf";
      const up=await db.storage.from("omegia-media").upload(path,f,{contentType:"application/pdf"});
      if(up.error)throw up.error;
      pdf=db.storage.from("omegia-media").getPublicUrl(up.data.path).data.publicUrl;
    }
    const {error}=await db.from("novels").insert({author_id:user.id,title,price,buy_url:buy,summary,excerpt,pdf_url:pdf});
    if(error)throw error;
    msg("Roman publié.");
    await refreshNovels();
    setTimeout(()=>{if(typeof window.showView==="function")window.showView("literary");},500);
  }catch(e){msg(isMissing(e)?SQL_HINT:(e.message||"Publication impossible."),true);}
  finally{btn.disabled=false;}
}

/* ---------- Branchement ---------- */
const H={
  audience:visibilityPanel,"posts-vis":visibilityPanel,"stories-vis":storiesPanel,"how-find":findPanel,"profile-lock":lockPanel,
  "online-status":onlinePanel,blocking:blockingPanel,"privacy-assist":privacyAssist
};
document.addEventListener("click",e=>{
  const t=e.target.closest?e.target:e.target.parentElement;if(!t)return;
  const item=t.closest("[data-setting-item]");
  if(item&&H[item.dataset.settingItem]){e.preventDefault();e.stopImmediatePropagation();H[item.dataset.settingItem]();return;}
  if(t.closest("#chatMore")){e.preventDefault();e.stopImmediatePropagation();chatMenu();return;}
  if(t.closest("#chatPeerBtn")){e.preventDefault();e.stopImmediatePropagation();const p=S().activePeer;if(p)peerProfile(p);else toast("Ouvre d’abord une conversation.");return;}
  if(t.closest("#litPublishBtn")&&remote){e.preventDefault();e.stopImmediatePropagation();if(isAdmin)publishNovel();else toast("Seul l’auteur peut publier un roman.");}
},true);
installNovelHooks();
let lastUid=null;
setInterval(()=>{
  const id=S().user?.id||null;
  if(id===lastUid)return;
  lastUid=id;
  if(id){loadCfg();refreshNovels();}
  else{cfg={...DEF};novelsCache=[];isAdmin=false;remote=false;}
},2000);
})();
