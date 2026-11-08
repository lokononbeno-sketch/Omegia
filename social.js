/* OMEGIA social module */
(()=>{"use strict";
const URL="https://nyiievcbciqxvxmerwdm.supabase.co",KEY="sb_publishable_4ZW9RA9gktscWSW2tuEttw_yRNdnduw",BUCKET="omegia-media";
const $=id=>document.getElementById(id);let db,user,active=null,activePeer=null,channel=null,recorder=null,chunks=[];
const ready=new Promise((resolve,reject)=>{const go=()=>window.supabase?.createClient?resolve(window.supabase.createClient(URL,KEY)):reject(Error("Supabase indisponible"));if(window.supabase?.createClient)go();else{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";s.onload=go;s.onerror=()=>reject(Error("Chargement Supabase impossible"));document.head.appendChild(s);}});
const css=".om-modal{position:fixed;inset:0;z-index:10000;background:#17132699;display:grid;place-items:center;padding:14px}.om-panel{background:#fff;color:#211d2b;width:min(100%,520px);max-height:90dvh;overflow:auto;border-radius:20px;padding:20px;box-shadow:0 20px 70px #0003}.om-panel h2{margin:0 0 14px}.om-panel input,.om-panel textarea{width:100%;padding:12px;border:1px solid #d8d1e8;border-radius:12px;margin:7px 0;font:inherit}.om-panel textarea{min-height:110px}.om-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:12px}.om-actions button,.om-user button{border:0;border-radius:12px;padding:11px 15px;background:#7652d6;color:white;font-weight:650}.om-actions .om-cancel{background:#eee9f7;color:#392b55}.om-note{font-size:13px;color:#81788f}.om-user{display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #eee}.om-grow{flex:1}.om-avatar{width:42px;height:42px;border-radius:50%;object-fit:cover;background:#eee6ff;display:grid;place-items:center;font-weight:700}.om-media{max-width:100%;max-height:360px;border-radius:14px;margin-top:8px}.om-post{background:#fff;color:#211d2b;border-radius:16px;padding:15px;margin:12px 0;box-shadow:0 3px 16px #0000000b}.om-post-head{display:flex;align-items:center;gap:10px}.om-post-body{white-space:pre-wrap;margin:12px 0}.om-story{min-width:110px;max-width:140px;border:2px solid #8c6ce2;border-radius:16px;padding:10px;background:#f3efff;color:#34235c;min-height:110px}.om-bubble{max-width:82%;padding:10px 13px;border-radius:16px;margin:7px 0;background:#eeeaf6;white-space:pre-wrap;overflow-wrap:anywhere}.om-bubble.mine{margin-left:auto;background:#7652d6;color:white}.om-feed-actions{display:flex;gap:14px}.om-feed-actions button{border:0;background:transparent;color:inherit;padding:7px}";
const st=document.createElement("style");st.textContent=css;document.head.appendChild(st);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const name=p=>((p?.first_name||"")+" "+(p?.last_name||"")).trim()||"Membre";
const initials=p=>((p?.first_name||"")[0]||"Ω")+((p?.last_name||"")[0]||"");
const av=p=>p?.avatar_url?'<img class="om-avatar" src="'+esc(p.avatar_url)+'" alt="">':'<div class="om-avatar">'+esc(initials(p))+'</div>';
function toast(s){try{window.omegiaSocial?.onToast?.(s);}catch{}let n=$("omToast");if(!n){n=document.createElement("div");n.id="omToast";n.style.cssText="position:fixed;z-index:11000;bottom:90px;left:50%;transform:translateX(-50%);background:#29213b;color:white;padding:12px 18px;border-radius:14px;max-width:90%;text-align:center";document.body.appendChild(n);}n.textContent=s;n.hidden=false;clearTimeout(n._t);n._t=setTimeout(()=>n.hidden=true,3500);}
function modal(title,body){const w=document.createElement("div");w.className="om-modal";w.innerHTML='<section class="om-panel" role="dialog" aria-modal="true"><h2>'+esc(title)+'</h2>'+body+'</section>';w.onclick=e=>{if(e.target===w)w.remove();};document.body.appendChild(w);return w;}
function pick(accept){const i=document.createElement("input");i.type="file";i.accept=accept;i.click();return new Promise(r=>i.onchange=()=>r(i.files?.[0]||null));}
async function upload(f,folder){if(!f)return null;if(f.size>150*1024*1024)throw Error("Fichier supérieur à 150 Mo.");const ext=(f.name.split(".").pop()||"bin").replace(/[^a-z0-9]/gi,"");const path=user.id+"/"+folder+"/"+crypto.randomUUID()+"."+ext;const {data,error}=await db.storage.from(BUCKET).upload(path,f,{contentType:f.type||"application/octet-stream"});if(error)throw error;return db.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;}
async function profile(id=user.id){const {data,error}=await db.from("profiles").select("*").eq("id",id).maybeSingle();if(error)throw error;return data;}
function setAvatar(el,url,fallback){if(!el)return;if(url){el.textContent="";el.style.background="center/cover no-repeat url('"+url.replace(/'/g,"%27")+"')";}else{el.style.background="";el.textContent=fallback||"Ω";}}
async function refreshProfile(){const p=await profile();if(!p)return;["homeAvatar","profileAvatar","sideAvatar"].forEach(id=>setAvatar($(id),p.avatar_url,initials(p)));if($("profileName"))$("profileName").textContent=name(p)||user.email;if($("profileBio"))$("profileBio").textContent=p.bio||"Ajoute une bio pour te présenter";if($("profileLocation"))$("profileLocation").textContent=p.location?"📍 "+p.location:"📍 Lieu non renseigné";if($("profileWork"))$("profileWork").textContent=p.work?"💼 "+p.work:"💼 Travail non renseigné";if($("profileSchool"))$("profileSchool").textContent=p.school?"🎓 "+p.school:"🎓 Études non renseignées";const c=document.querySelector(".profile-cover");if(c&&p.cover_url)c.style.backgroundImage="url('"+p.cover_url+"')";}
function media(url,type){if(!url)return"";if(type==="image")return'<img class="om-media" loading="lazy" src="'+esc(url)+'" alt="Média">';if(type==="video")return'<video class="om-media" controls playsinline preload="metadata" src="'+esc(url)+'"></video>';if(type==="audio")return'<audio controls preload="metadata" src="'+esc(url)+'"></audio>';return"";}
async function publish(kind){const labels={post:"Créer une publication",story:"Créer une story (24 h)",status:"Publier un statut (24 h)"};const w=modal(labels[kind],'<textarea id="omBody" placeholder="Écris ton message…"></textarea>'+(kind==="post"?'<label class="om-note om-vis">Qui peut voir ?<select id="omVis"><option value="public">Public</option><option value="friends">Mes amis</option></select></label>':'')+'<div class="om-actions"><button id="omImg">📷 Image</button><button id="omVid">🎬 Vidéo</button><button id="omAud">🎙 Audio</button></div><p class="om-note" id="omFile">Aucun média sélectionné.</p><div class="om-actions"><button class="om-cancel" id="omCancel">Annuler</button><button id="omSend">Publier</button></div>');let file=null,type=null;{const dv=(()=>{try{return localStorage.getItem("omegia.pref.defaultVisibility");}catch{return null;}})(),sel=w.querySelector("#omVis");if(sel&&(dv==="friends"||dv==="public"))sel.value=dv;}const choose=async(t,a)=>{file=await pick(a);if(file){type=t;$("omFile").textContent=file.name;}};w.querySelector("#omImg").onclick=()=>choose("image","image/*");w.querySelector("#omVid").onclick=()=>choose("video","video/*");w.querySelector("#omAud").onclick=()=>kind==="post"?toast("Les publications acceptent texte, images et vidéos."):choose("audio","audio/*");w.querySelector("#omCancel").onclick=()=>w.remove();w.querySelector("#omSend").onclick=async()=>{const body=$("omBody").value.trim();if(!body&&!file)return toast("Ajoute un texte ou un média.");const b=w.querySelector("#omSend");b.disabled=true;b.textContent="Envoi…";try{const url=file?await upload(file,kind==="post"?"posts":kind==="story"?"stories":"statuses"):null;const table=kind==="post"?"posts":kind==="story"?"stories":"statuses";const row=kind==="post"?{author_id:user.id,body,media_url:url,media_type:type,visibility:($("omVis")?.value==="friends"?"friends":"public")}:{author_id:user.id,body,media_url:url,media_type:type||"text",expires_at:new Date(Date.now()+86400000).toISOString()};const {error}=await db.from(table).insert(row);if(error)throw error;w.remove();toast("Publication envoyée !");await Promise.all([loadFeed(),loadStories(),loadStatuses()]);}catch(e){b.disabled=false;b.textContent="Publier";toast(e.message||"Échec.");}};}
async function loadFeed(){const box=$("feed");if(!box||!user)return;const {data,error}=await db.from("posts").select("*,profiles:profiles!posts_author_id_fkey(first_name,last_name,avatar_url)").order("created_at",{ascending:false}).limit(40);if(error){toast("Fil : "+error.message);return;}box.innerHTML="";if(!data?.length){box.innerHTML='<div class="empty-state"><p>Ton fil est vide pour le moment.</p></div>';return;}data.forEach(p=>{const el=document.createElement("article");el.className="om-post";el.innerHTML='<div class="om-post-head">'+av(p.profiles)+'<div><strong>'+esc(name(p.profiles))+'</strong><div class="om-note">'+new Date(p.created_at).toLocaleString("fr-FR")+'</div></div></div><div class="om-post-body">'+esc(p.body)+'</div>'+media(p.media_url,p.media_type)+'<div class="om-feed-actions"><button data-like="'+p.id+'">👍 J’aime</button><button data-comment="'+p.id+'">💬 Commenter</button></div>';box.appendChild(el);});box.querySelectorAll("[data-like]").forEach(b=>b.onclick=async()=>{const {error}=await db.from("post_reactions").upsert({post_id:b.dataset.like,user_id:user.id,reaction:"like"},{onConflict:"post_id,user_id"});toast(error?error.message:"Réaction ajoutée.");});box.querySelectorAll("[data-comment]").forEach(b=>b.onclick=()=>{const id=b.dataset.comment,w=modal("Commenter",'<textarea id="omComment" placeholder="Ton commentaire…"></textarea><div class="om-actions"><button id="omCommentSend">Envoyer</button></div>');w.querySelector("#omCommentSend").onclick=async()=>{const body=w.querySelector("#omComment").value.trim();if(!body)return;const {error}=await db.from("post_comments").insert({post_id:id,author_id:user.id,body});if(error)toast(error.message);else{w.remove();toast("Commentaire publié.");}};});}
async function loadStories(){const row=$("homeStories");if(!row||!user)return;const {data,error}=await db.from("stories").select("*,profiles:profiles!stories_author_id_fkey(first_name,last_name,avatar_url)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(30);if(error)return;row.innerHTML='<button type="button" class="story-card create-story" id="createStoryBtn"><div class="story-thumb create"><span class="plus">+</span></div><span class="story-label">Créer une story</span></button>';row.querySelector("#createStoryBtn").onclick=()=>publish("story");(data||[]).forEach(s=>{const b=document.createElement("button");b.className="om-story";b.innerHTML='<strong>'+esc(name(s.profiles))+'</strong><p>'+esc(s.body)+'</p>'+media(s.media_url,s.media_type);b.onclick=()=>modal("Story",'<p>'+esc(s.body)+'</p>'+media(s.media_url,s.media_type));row.appendChild(b);});}
async function loadStatuses(){const box=$("statusList");if(!box||!user)return;const {data,error}=await db.from("statuses").select("*,profiles:profiles!statuses_author_id_fkey(first_name,last_name,avatar_url)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(50);if(error){box.innerHTML='<p class="om-note">Mise à jour SQL Supabase requise pour les statuts.</p>';return;}box.innerHTML="";(data||[]).forEach(s=>{const el=document.createElement("div");el.className="om-post";el.innerHTML='<div class="om-post-head">'+av(s.profiles)+'<strong>'+esc(name(s.profiles))+'</strong></div><p>'+esc(s.body)+'</p>'+media(s.media_url,s.media_type);box.appendChild(el);});if(!data?.length)box.innerHTML='<div class="empty-state"><p>Aucun statut pour le moment.</p></div>';}
async function findPeople(q){q=q.replace(/[,()%*\\]/g," ").trim();if(q.length<2)return;const box=$("omResults");box.textContent="Recherche…";let {data,error}=await db.rpc("omegia_search_members",{q});if(error&&/omegia_search_members|schema cache|does not exist/i.test(error.message||"")){({data,error}=await db.from("profiles").select("id,first_name,last_name,username,avatar_url").or("first_name.ilike.%"+q+"%,last_name.ilike.%"+q+"%,username.ilike.%"+q+"%").neq("id",user.id).limit(15));}if(error){box.textContent=error.message;return;}box.innerHTML="";(data||[]).forEach(p=>{const el=document.createElement("div");el.className="om-user";el.innerHTML=av(p)+'<div class="om-grow"><strong>'+esc(name(p))+'</strong><div class="om-note">@'+esc(p.username||"membre")+'</div></div><button data-invite="'+p.id+'">Inviter</button><button data-chat="'+p.id+'">Message</button>';box.appendChild(el);});box.querySelectorAll("[data-invite]").forEach(b=>b.onclick=()=>invite(b.dataset.invite));box.querySelectorAll("[data-chat]").forEach(b=>b.onclick=()=>startChat(b.dataset.chat));}
function people(){const w=modal("Trouver des membres",'<input id="omSearch" placeholder="Nom ou nom d’utilisateur"><div id="omResults"></div>');w.querySelector("#omSearch").oninput=e=>{if(e.target.value.trim().length>1)findPeople(e.target.value.trim());};}
async function invite(id){const {error}=await db.from("friend_requests").insert({sender_id:user.id,recipient_id:id});toast(error?error.message:"Invitation envoyée.");loadFriends();}
async function loadFriends(){const box=$("inviteList");if(!box||!user)return;const {data,error}=await db.from("friend_requests").select("*,sender:profiles!friend_requests_sender_id_fkey(first_name,last_name,avatar_url)").eq("recipient_id",user.id).eq("status","pending").order("created_at",{ascending:false});if(error){box.textContent=error.message;return;}box.innerHTML="";if($("inviteCount"))$("inviteCount").textContent=String(data?.length||0);(data||[]).forEach(r=>{const el=document.createElement("div");el.className="om-user";el.innerHTML=av(r.sender)+'<div class="om-grow"><strong>'+esc(name(r.sender))+'</strong></div><button data-accept="'+r.id+'">Accepter</button><button data-no="'+r.id+'">Refuser</button>';box.appendChild(el);});if(!data?.length)box.innerHTML='<p class="om-note">Aucune invitation reçue.</p>';box.querySelectorAll("[data-accept]").forEach(b=>b.onclick=()=>respond(b.dataset.accept,"accepted"));box.querySelectorAll("[data-no]").forEach(b=>b.onclick=()=>respond(b.dataset.no,"declined"));if($("suggestList"))$("suggestList").innerHTML='<button class="primary-button small" id="omFind">Rechercher des membres</button>';$("omFind")?.addEventListener("click",people);}
async function respond(id,status){const {error}=await db.from("friend_requests").update({status}).eq("id",id);toast(error?error.message:(status==="accepted"?"Invitation acceptée.":"Invitation refusée."));loadFriends();}
async function startChat(peer){const {data:rows}=await db.from("conversation_members").select("conversation_id").eq("user_id",user.id);let id=null;for(const r of rows||[]){const {data:ms}=await db.from("conversation_members").select("user_id").eq("conversation_id",r.conversation_id);if(ms?.some(x=>x.user_id===peer)){id=r.conversation_id;break;}}if(!id){const {data:c,error}=await db.from("conversations").insert({created_by:user.id,is_group:false}).select().single();if(error)return toast(error.message);id=c.id;const {error:e}=await db.from("conversation_members").insert([{conversation_id:id,user_id:user.id},{conversation_id:id,user_id:peer}]);if(e)return toast(e.message);}await openChat(id,peer);}
async function loadChats(){const box=$("chatList");if(!box||!user)return;const {data:rows,error}=await db.from("conversation_members").select("conversation_id").eq("user_id",user.id);if(error){box.textContent=error.message;return;}box.innerHTML="";for(const r of rows||[]){const {data:ms}=await db.from("conversation_members").select("user_id").eq("conversation_id",r.conversation_id).neq("user_id",user.id);const peer=ms?.[0]?.user_id,p=peer?await profile(peer):null;const b=document.createElement("button");b.className="om-user";b.style.width="100%";b.innerHTML=av(p)+'<span class="om-grow">'+esc(name(p))+'</span>';b.onclick=()=>openChat(r.conversation_id,peer);box.appendChild(b);}if(!rows?.length)box.innerHTML='<p class="om-note">Aucune conversation. Appuie sur + pour trouver un membre.</p>';}
async function openChat(id,peer){active=id;activePeer=peer||null;if(peer){const p=await profile(peer);if($("chatPeerName"))$("chatPeerName").textContent=name(p);setAvatar($("chatPeerAvatar"),p?.avatar_url,initials(p));if($("chatPeerStatus"))$("chatPeerStatus").textContent="Hors ligne";}document.querySelectorAll(".view").forEach(v=>v.hidden=v.dataset.view!=="chat");document.querySelector(".bottom-nav")?.classList.add("hidden-for-chat");document.querySelector(".app-header")?.classList.add("hidden-for-chat");await loadMessages();if(channel)db.removeChannel(channel);channel=db.channel("omegia-chat-"+id,{config:{presence:{key:user.id}}}).on("postgres_changes",{event:"INSERT",schema:"public",table:"messages",filter:"conversation_id=eq."+id},loadMessages).on("presence",{event:"sync"},()=>{const state=channel.presenceState();const online=Object.keys(state).some(k=>k===peer);if($("chatPeerStatus")&&$("chatPeerStatus").dataset.activity!=="typing"&&$("chatPeerStatus").dataset.activity!=="recording")$("chatPeerStatus").textContent=online?"🟢 En ligne":"Hors ligne";}).on("broadcast",{event:"typing"},({payload})=>{if(payload?.user_id===peer&&$("chatPeerStatus")){$("chatPeerStatus").textContent=payload.active?"En train d’écrire…":"En ligne";$("chatPeerStatus").dataset.activity=payload.active?"typing":"";}}).on("broadcast",{event:"recording"},({payload})=>{if(payload?.user_id===peer&&$("chatPeerStatus")){$("chatPeerStatus").textContent=payload.active?"🎙 Enregistrement audio…":"En ligne";$("chatPeerStatus").dataset.activity=payload.active?"recording":"";}}).subscribe(async status=>{if(status==="SUBSCRIBED"&&showOnline()){await channel.track({user_id:user.id,online_at:new Date().toISOString()});}});}
async function chatSignal(event,activeState){if(channel&&active)try{await channel.send({type:"broadcast",event,payload:{user_id:user.id,active:activeState}});}catch(e){console.warn("Chat presence:",e);}}
async function loadMessages(){const box=$("chatMessages");if(!box||!active)return;const {data,error}=await db.from("messages").select("*").eq("conversation_id",active).order("created_at",{ascending:true}).limit(150);if(error){box.textContent=error.message;return;}box.innerHTML="";(data||[]).forEach(m=>{const el=document.createElement("div");el.className="om-bubble"+(m.sender_id===user.id?" mine":"");el.textContent=m.body||"";if(m.attachment_url){const tag=m.attachment_type==="video"?"video":m.attachment_type==="audio"?"audio":"img";const mediaEl=document.createElement(tag);mediaEl.src=m.attachment_url;if(tag!=="img")mediaEl.controls=true;mediaEl.className=m.body==="__OMEGIA_STICKER__"?"om-media om-sticker":"om-media";mediaEl.alt=m.body==="__OMEGIA_STICKER__"?"Sticker animé":"Média";el.appendChild(mediaEl);}box.appendChild(el);});box.scrollTop=box.scrollHeight;}
async function send(body,url=null,type=null){if(!active)return toast("Ouvre une conversation.");const {error}=await db.from("messages").insert({conversation_id:active,sender_id:user.id,body,attachment_url:url,attachment_type:type});if(error)toast(error.message);else{if($("chatInput"))$("chatInput").value="";loadMessages();}}
async function editProfile(){try{const p=await profile();if(!p)return toast("Profil introuvable. Déconnecte-toi puis reconnecte-toi.");const w=modal("Modifier mon profil",'<label>Prénom<input id="omFirst" maxlength="50" value="'+esc(p.first_name)+'" placeholder="Prénom"></label><label>Nom<input id="omLast" maxlength="50" value="'+esc(p.last_name)+'" placeholder="Nom"></label><label>Biographie<textarea id="omBio" maxlength="200" placeholder="Présente-toi">'+esc(p.bio||"")+'</textarea></label><label>Lieu<input id="omLocation" maxlength="100" value="'+esc(p.location||"")+'" placeholder="Ville, pays"></label><label>Travail<input id="omWork" maxlength="100" value="'+esc(p.work||"")+'" placeholder="Profession"></label><label>Études<input id="omSchool" maxlength="120" value="'+esc(p.school||"")+'" placeholder="Établissement / formation"></label><p class="om-note" id="omProfileMessage">Tes modifications seront enregistrées sur ton compte.</p><div class="om-actions"><button class="om-cancel" id="omProfileCancel">Annuler</button><button id="omProfileSave">Enregistrer</button></div>');w.querySelector("#omProfileCancel").onclick=()=>w.remove();w.querySelector("#omProfileSave").onclick=async()=>{const b=w.querySelector("#omProfileSave"),first=$("omFirst").value.trim(),last=$("omLast").value.trim();if(!first||!last){$("omProfileMessage").textContent="Le prénom et le nom sont obligatoires.";return;}b.disabled=true;b.textContent="Enregistrement…";$("omProfileMessage").textContent="Sauvegarde en cours…";try{const values={first_name:first,last_name:last,bio:$("omBio").value.trim(),location:$("omLocation").value.trim(),work:$("omWork").value.trim(),school:$("omSchool").value.trim(),updated_at:new Date().toISOString()};const {error}=await db.from("profiles").update(values).eq("id",user.id);if(error)throw error;const {error:authError}=await db.auth.updateUser({data:{first_name:first,last_name:last,bio:values.bio,location:values.location}});await refreshProfile();w.remove();toast(authError?"Profil enregistré. Certaines informations du compte seront synchronisées à la prochaine connexion.":"Profil mis à jour avec succès.");}catch(e){$("omProfileMessage").textContent=e.message||"Impossible d'enregistrer le profil.";b.disabled=false;b.textContent="Réessayer";}};}catch(e){toast("Impossible d'ouvrir le profil : "+e.message);}}
function showPhoto(url,title){if(!url)return;const w=document.createElement("div");w.className="om-photo-viewer";w.innerHTML='<button type="button" class="om-photo-close" aria-label="Fermer">×</button><img src="'+esc(url)+'" alt="'+esc(title||"Photo")+'">';w.onclick=e=>{if(e.target===w||e.target.classList.contains("om-photo-close"))w.remove();};document.body.appendChild(w);}
async function loadMyPosts(){const box=$("profilePosts");if(!box||!user)return;box.innerHTML='<p class="om-note">Chargement de tes publications…</p>';const {data,error}=await db.from("posts").select("id,body,media_url,media_type,created_at").eq("author_id",user.id).order("created_at",{ascending:false}).limit(50);if(error){box.innerHTML='<p class="om-note">Impossible de charger tes publications : '+esc(error.message)+'</p>';return;}box.innerHTML="";if(!data?.length){box.innerHTML='<div class="empty-state"><p>Tu n’as pas encore publié.</p><p class="om-note">Tes textes, photos et vidéos apparaîtront ici.</p></div>';return;}data.forEach(p=>{const el=document.createElement("article");el.className="om-post";el.innerHTML='<div class="om-post-head">'+av({first_name:"Moi"})+'<div><strong>Mes publications</strong><div class="om-note">'+new Date(p.created_at).toLocaleString("fr-FR")+'</div></div></div><div class="om-post-body">'+esc(p.body||"")+'</div>'+media(p.media_url,p.media_type);box.appendChild(el);});}
async function photo(which){const f=await pick("image/*");if(!f)return;try{const url=await upload(f,"profiles"),field=which==="avatar"?"avatar_url":"cover_url";const {error}=await db.from("profiles").update({[field]:url,updated_at:new Date().toISOString()}).eq("id",user.id);if(error)throw error;await refreshProfile();toast("Photo mise à jour.");}catch(e){toast(e.message);}}
async function audioNote(){if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return toast("Microphone non pris en charge.");try{if(recorder?.state==="recording"){recorder.stop();return;}const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());chatSignal("recording",false);try{const f=new File([new Blob(chunks,{type:recorder.mimeType||"audio/webm"})],"note-vocale.webm",{type:recorder.mimeType||"audio/webm"});await send("",await upload(f,"messages"),"audio");}catch(e){toast(e.message);}};recorder.start();chatSignal("recording",true);toast("Enregistrement… appuie de nouveau sur le micro pour envoyer.");}catch(e){toast("Autorise le microphone.");}}
function capture(id,fn){$(id)?.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();fn();},true);}

const STICKER_KEY="omegia-stickers-v1";
function getStickerPack(){try{return JSON.parse(localStorage.getItem(STICKER_KEY)||"[]");}catch{return [];}}
function saveStickerPack(items){localStorage.setItem(STICKER_KEY,JSON.stringify(items));}
function stickerGrid(){const grid=$("stickerGrid"),status=$("stickerImportStatus");if(!grid)return;const items=getStickerPack();grid.innerHTML="";if(!items.length){grid.innerHTML='<p class="sticker-empty">Aucun sticker importé. Utilise le bouton ci-dessous pour ajouter ton ZIP WhatsApp.</p>';return;}items.forEach((item,index)=>{const b=document.createElement("button");b.type="button";b.className="sticker-choice";b.title=item.name||"Sticker";const im=document.createElement("img");im.src=item.url;im.alt="Sticker";im.loading="lazy";b.appendChild(im);b.onclick=()=>{if(!active)return toast("Ouvre d'abord une conversation.");send("__OMEGIA_STICKER__",item.url,"image");$("emojiPanel").hidden=true;};grid.appendChild(b);});if(status)status.textContent=items.length+" stickers dans ta bibliothèque sur cet appareil.";}
async function loadZipLibrary(){if(window.JSZip)return window.JSZip;await new Promise((resolve,reject)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js";s.onload=resolve;s.onerror=()=>reject(Error("Impossible de charger le lecteur ZIP. Réessaie avec une connexion Internet."));document.head.appendChild(s);});return window.JSZip;}
async function importStickerZip(){const file=await pick(".zip,application/zip,application/x-zip-compressed");if(!file)return;if(file.size>250*1024*1024)return toast("Archive trop volumineuse (maximum 250 Mo).");if(!confirm("Ton archive sera décompressée puis les stickers WEBP seront envoyés dans le stockage OMEGIA. Le dossier contient potentiellement plus de 200 Mo : utilise le Wi-Fi si possible. Continuer ?"))return;const status=$("stickerImportStatus"),button=$("importStickerPack");button.disabled=true;try{status.textContent="Lecture de l'archive…";const JSZip=await loadZipLibrary();const zip=await JSZip.loadAsync(file);const entries=Object.values(zip.files).filter(x=>!x.dir&&/\.webp$/i.test(x.name));if(!entries.length)throw Error("Aucun sticker WEBP trouvé dans cette archive.");const saved=getStickerPack();let done=0,added=0;for(const entry of entries){const blob=await entry.async("blob");const safe=(entry.name.split("/").pop()||"sticker.webp").replace(/[^a-z0-9._-]/gi,"_");const path=user.id+"/stickers/"+crypto.randomUUID()+"-"+safe;const {data,error}=await db.storage.from(BUCKET).upload(path,blob,{contentType:"image/webp",upsert:false});if(error)throw error;const url=db.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;saved.push({name:safe,url});added++;done++;if(done%10===0||done===entries.length){status.textContent="Importation : "+done+" / "+entries.length+" stickers…";saveStickerPack(saved);}}saveStickerPack(saved);stickerGrid();status.textContent="Import terminé : "+added+" stickers ajoutés.";toast(added+" stickers importés dans OMEGIA !");}catch(e){status.textContent="Import interrompu : "+(e.message||"erreur");toast("Import : "+(e.message||"erreur"));}finally{button.disabled=false;}}
function bindStickerPicker(){const panel=$("emojiPanel");if(!panel)return;document.querySelectorAll("[data-sticker-tab]").forEach(tab=>tab.addEventListener("click",()=>{const stickers=tab.dataset.stickerTab==="stickers";document.querySelectorAll("[data-sticker-tab]").forEach(x=>x.classList.toggle("active",x===tab));$("emojiGrid").hidden=stickers;$("stickerGrid").hidden=!stickers;$("stickerTools").hidden=!stickers;if(stickers)stickerGrid();}));$("importStickerPack")?.addEventListener("click",importStickerZip);$("chatEmoji")?.addEventListener("click",()=>{if(!panel.hidden){$("emojiGrid").hidden=false;$("stickerGrid").hidden=true;$("stickerTools").hidden=true;document.querySelectorAll("[data-sticker-tab]").forEach(x=>x.classList.toggle("active",x.dataset.stickerTab==="emoji"));}});}

/* ===== OMEGIA social+ : j'aime, commentaires, amis, messagerie, stories, statuts, notifications ===== */
// Ces fonctions remplacent les versions plus simples définies plus haut (la dernière déclaration l'emporte).
const css2=".om-ghost{border:0;background:transparent;font-size:16px;padding:6px;cursor:pointer;color:inherit}.om-counts{display:flex;justify-content:space-between;min-height:18px;margin-top:6px}.om-feed-actions button{flex:1;border-radius:10px;font-weight:650;cursor:pointer}.om-feed-actions button.on{color:#7652d6;background:#f0ebff}.om-comments{border-top:1px solid #eee;margin-top:8px;padding-top:8px}.om-comment{display:flex;gap:8px;align-items:flex-start;margin:8px 0}.om-comment .om-avatar{width:32px;height:32px;font-size:12px;flex:none}.om-cbody{flex:1;min-width:0;background:#f3f0fa;border-radius:14px;padding:7px 11px}.om-ctext{white-space:pre-wrap;overflow-wrap:anywhere}.om-comment-form{display:flex;gap:8px;margin-top:8px}.om-comment-form input{flex:1;min-width:0;height:40px;border:1px solid #d8d1e8;border-radius:999px;padding:0 14px;font:inherit;font-size:16px}.om-comment-form button{border:0;border-radius:999px;padding:0 16px;background:#7652d6;color:#fff;font-weight:650}.om-user .om-cancel{background:#eee9f7;color:#392b55}.om-row{width:100%;text-align:left;background:transparent;border:0;border-bottom:1px solid #eee;color:inherit;font:inherit;cursor:pointer}.om-unread{min-width:22px;height:22px;border-radius:11px;background:#7652d6;color:#fff;font-size:12px;font-weight:700;display:grid;place-items:center;padding:0 6px}.om-preview{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60vw}.om-story{display:flex;flex-direction:column;align-items:center;gap:4px;min-width:96px;max-width:110px;min-height:0;border:0;background:transparent;padding:0;cursor:pointer;color:inherit}.om-story .om-avatar{border:3px solid #8c6ce2;box-sizing:content-box}.om-story strong{font-size:12px;max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.om-vis{display:block;margin-top:6px}.om-vis select{margin-left:8px;padding:6px;border-radius:8px}.dark-mode .om-post,.dark-mode .om-panel{background:#211d30;color:#eee9f7}.dark-mode .om-cbody{background:#2d2840}.dark-mode .om-panel input,.dark-mode .om-panel textarea,.dark-mode .om-comment-form input{background:#2d2840;color:#eee9f7;border-color:#453d5e}.dark-mode .om-feed-actions button.on{background:#352c52;color:#cbb8ff}.dark-mode .om-row{border-color:#352f48}";
{const s=document.createElement("style");s.textContent=css2;document.head.appendChild(s);}

const timeAgo=iso=>{const s=Math.max(1,Math.round((Date.now()-new Date(iso))/1000));if(s<60)return"à l’instant";const m=Math.round(s/60);if(m<60)return m+" min";const h=Math.round(m/60);if(h<24)return h+" h";const d=Math.round(h/24);if(d<7)return d+" j";return new Date(iso).toLocaleDateString("fr-FR");};
const profCache=new Map();
let globalCh=null,presence=new Set(),syncTimer=null;
async function profilesById(ids){const need=[...new Set(ids)].filter(i=>i&&!profCache.has(i));if(need.length){const {data}=await db.from("profiles").select("id,first_name,last_name,avatar_url,username").in("id",need);(data||[]).forEach(p=>profCache.set(p.id,p));}return id=>profCache.get(id)||null;}
function setBadge(id,n){const el=$(id);if(!el)return;el.hidden=!n;el.textContent=n>99?"99+":String(n||0);}
function userRow(p,actions=[],sub=""){const el=document.createElement("div");el.className="om-user";el.innerHTML=av(p)+'<div class="om-grow"><strong>'+esc(name(p))+'</strong>'+(sub?'<div class="om-note">'+esc(sub)+'</div>':'')+'</div>';actions.forEach(([label,fn,secondary])=>{const b=document.createElement("button");b.type="button";b.textContent=label;if(secondary)b.className="om-cancel";b.onclick=async()=>{b.disabled=true;try{await fn();}finally{b.disabled=false;}};el.appendChild(b);});return el;}
const groupByAuthor=list=>{const m=new Map();list.forEach(x=>{if(!m.has(x.author_id))m.set(x.author_id,[]);m.get(x.author_id).push(x);});return [...m.values()];};

/* ---------- Fil d'actualité : j'aime, commentaires, suppression ---------- */
async function loadFeed(){
  const box=$("feed");if(!box||!user)return;
  const {data:posts,error}=await db.from("posts").select("*,profiles:profiles!posts_author_id_fkey(first_name,last_name,avatar_url)").order("created_at",{ascending:false}).limit(40);
  if(error){toast("Fil : "+error.message);return;}
  const ids=(posts||[]).map(p=>p.id);
  let rx=[],cm=[];
  if(ids.length){const [r,c]=await Promise.all([db.from("post_reactions").select("post_id,user_id").in("post_id",ids),db.from("post_comments").select("post_id").in("post_id",ids)]);rx=r.data||[];cm=c.data||[];}
  const likes={},mine=new Set(),comments={};
  rx.forEach(r=>{likes[r.post_id]=(likes[r.post_id]||0)+1;if(r.user_id===user.id)mine.add(r.post_id);});
  cm.forEach(c=>{comments[c.post_id]=(comments[c.post_id]||0)+1;});
  box.innerHTML="";
  if(!posts?.length){box.innerHTML='<div class="empty-state"><p>Ton fil est vide pour le moment.</p><p class="om-note">Publie quelque chose ou invite des amis.</p></div>';return;}
  posts.forEach(p=>box.appendChild(postCard(p,likes[p.id]||0,mine.has(p.id),comments[p.id]||0)));
}
function postCard(p,nLikes,liked,nComments){
  const el=document.createElement("article");el.className="om-post";el.dataset.post=p.id;
  const own=p.author_id===user.id;
  el.innerHTML='<div class="om-post-head">'+av(p.profiles)+'<div class="om-grow"><strong>'+esc(name(p.profiles))+'</strong><div class="om-note">'+timeAgo(p.created_at)+' · '+(p.visibility==="public"?"🌐 Public":"👥 Amis")+'</div></div>'+(own?'<button type="button" class="om-ghost" data-del aria-label="Supprimer la publication">🗑</button>':'')+'</div>'
    +(p.body?'<div class="om-post-body">'+esc(p.body)+'</div>':'')+media(p.media_url,p.media_type)
    +'<div class="om-counts om-note"><span data-nl></span><span data-nc></span></div>'
    +'<div class="om-feed-actions"><button type="button" data-like>👍 J’aime</button><button type="button" data-toggle>💬 Commenter</button><button type="button" data-save aria-pressed="false">🔖 Enregistrer</button><button type="button" data-share>↗ Partager</button></div><div class="om-comments" hidden></div>';
  let l=nLikes,on=liked,c=nComments;
  const paint=()=>{el.querySelector("[data-nl]").textContent=l?"👍 "+l:"";el.querySelector("[data-nc]").textContent=c?c+" commentaire"+(c>1?"s":""):"";const b=el.querySelector("[data-like]");b.classList.toggle("on",on);b.setAttribute("aria-pressed",String(on));};
  paint();
  el.querySelector("[data-like]").onclick=async()=>{
    const was=on;on=!was;l+=was?-1:1;paint();
    const {error}=was?await db.from("post_reactions").delete().eq("post_id",p.id).eq("user_id",user.id):await db.from("post_reactions").upsert({post_id:p.id,user_id:user.id,reaction:"like"},{onConflict:"post_id,user_id"});
    if(error){on=was;l+=was?1:-1;paint();toast(error.message);}
  };
  const savedPostIds=()=>{try{return JSON.parse(localStorage.getItem("omegia.saved."+user.id)||"[]");}catch{return [];}};
  const saveBtn=el.querySelector("[data-save]");
  const paintSaved=()=>{const yes=savedPostIds().includes(p.id);saveBtn.textContent=yes?"🔖 Enregistré":"🔖 Enregistrer";saveBtn.setAttribute("aria-pressed",String(yes));saveBtn.classList.toggle("on",yes);};
  paintSaved();
  saveBtn.onclick=()=>{const ids=savedPostIds(),yes=ids.includes(p.id);const next=yes?ids.filter(id=>id!==p.id):[...ids,p.id];try{localStorage.setItem("omegia.saved."+user.id,JSON.stringify(next));paintSaved();toast(yes?"Publication retirée des enregistrements.":"Publication enregistrée sur cet appareil.");}catch(e){toast("Impossible d’enregistrer sur cet appareil.");}};
  el.querySelector("[data-share]").onclick=async()=>{const text=name(p.profiles)+" : "+(p.body||"").slice(0,200),link=location.origin+location.pathname;try{if(navigator.share){await navigator.share({title:"OMEGIA",text,url:link});}else{await navigator.clipboard.writeText(text+" — "+link);toast("Texte et lien copiés.");}}catch(e){if(e?.name!=="AbortError")toast("Partage impossible sur cet appareil.");}};
  const cbox=el.querySelector(".om-comments");
  el.querySelector("[data-toggle]").onclick=async()=>{cbox.hidden=!cbox.hidden;if(!cbox.hidden)await renderComments(p.id,cbox,n=>{c=n;paint();});};
  el.querySelector("[data-del]")?.addEventListener("click",async()=>{if(!confirm("Supprimer cette publication ?"))return;const {error}=await db.from("posts").delete().eq("id",p.id);if(error)return toast(error.message);el.remove();toast("Publication supprimée.");});
  return el;
}
async function openSavedPosts(){
  const w=modal("Mes enregistrements",'<div id="omSavedList"><p class="om-note">Chargement…</p></div><p class="om-note">Les enregistrements sont conservés sur cet appareil et associés à ce compte.</p>');
  const box=w.querySelector("#omSavedList"),ids=(()=>{try{return JSON.parse(localStorage.getItem("omegia.saved."+user.id)||"[]");}catch{return [];}})();
  if(!ids.length){box.innerHTML='<p class="om-note">Aucune publication enregistrée pour le moment. Utilise 🔖 Enregistrer sous une publication.</p>';return;}
  const {data,error}=await db.from("posts").select("*,profiles:profiles!posts_author_id_fkey(first_name,last_name,avatar_url)").in("id",ids).order("created_at",{ascending:false});
  if(error){box.textContent=error.message;return;}
  if(!data?.length){box.innerHTML='<p class="om-note">Les publications enregistrées ne sont plus disponibles.</p>';return;}
  const reactions=await db.from("post_reactions").select("post_id,user_id").in("post_id",ids);
  const comments=await db.from("post_comments").select("post_id").in("post_id",ids);
  data.forEach(p=>{const card=postCard(p,(reactions.data||[]).filter(x=>x.post_id===p.id).length,(reactions.data||[]).some(x=>x.post_id===p.id&&x.user_id===user.id),(comments.data||[]).filter(x=>x.post_id===p.id).length);if(card)box.appendChild(card);});
}
async function openMemories(){
  const w=modal("Souvenirs",'<div id="omMemories"><p class="om-note">Recherche de tes anciennes publications…</p></div>');
  const box=w.querySelector("#omMemories"),today=new Date(),month=today.getMonth(),day=today.getDate();
  const {data,error}=await db.from("posts").select("*,profiles:profiles!posts_author_id_fkey(first_name,last_name,avatar_url)").eq("author_id",user.id).lt("created_at",new Date(today.getFullYear(),month,day).toISOString()).order("created_at",{ascending:false}).limit(200);
  if(error){box.textContent=error.message;return;}
  const matches=(data||[]).filter(p=>{const d=new Date(p.created_at);return d.getMonth()===month&&d.getDate()===day&&d.getFullYear()<today.getFullYear();});
  if(!matches.length){box.innerHTML='<p class="om-note">Pas encore de souvenir publié à cette date les années précédentes. Reviens plus tard !</p>';return;}
  matches.forEach(p=>{const card=postCard(p,0,false,0);if(card){const note=document.createElement("p");note.className="om-note";note.textContent="Souvenir du "+new Date(p.created_at).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"});card.prepend(note);box.appendChild(card);}});
}
async function renderComments(postId,box,onCount){
  box.innerHTML='<p class="om-note">Chargement…</p>';
  const {data,error}=await db.from("post_comments").select("id,author_id,body,created_at,profiles:profiles!post_comments_author_id_fkey(first_name,last_name,avatar_url)").eq("post_id",postId).order("created_at",{ascending:true}).limit(100);
  if(error){box.innerHTML='<p class="om-note">'+esc(error.message)+'</p>';return;}
  onCount(data.length);box.innerHTML="";
  data.forEach(c=>{
    const row=document.createElement("div");row.className="om-comment";
    row.innerHTML=av(c.profiles)+'<div class="om-cbody"><strong>'+esc(name(c.profiles))+'</strong> <span class="om-note">'+timeAgo(c.created_at)+'</span><div class="om-ctext">'+esc(c.body)+'</div></div>'+(c.author_id===user.id?'<button type="button" class="om-ghost" aria-label="Supprimer le commentaire">✕</button>':'');
    row.querySelector("button")?.addEventListener("click",async()=>{const {error:e}=await db.from("post_comments").delete().eq("id",c.id);if(e)return toast(e.message);renderComments(postId,box,onCount);});
    box.appendChild(row);
  });
  const form=document.createElement("form");form.className="om-comment-form";
  form.innerHTML='<input maxlength="3000" placeholder="Écrire un commentaire…" aria-label="Commentaire"><button>Envoyer</button>';
  form.onsubmit=async e=>{e.preventDefault();const input=form.querySelector("input"),body=input.value.trim();if(!body)return;input.disabled=true;const {error:er}=await db.from("post_comments").insert({post_id:postId,author_id:user.id,body});input.disabled=false;if(er)return toast(er.message);renderComments(postId,box,onCount);};
  box.appendChild(form);
}

/* ---------- Stories et statuts (24 h) ---------- */
function viewer(list,table){
  let i=0;
  const w=modal(name(list[0].profiles),'<div class="om-note" id="omVMeta"></div><div id="omVBody"></div><div class="om-actions"><button type="button" class="om-cancel" id="omVPrev" aria-label="Précédent">‹</button><button type="button" class="om-cancel" id="omVNext" aria-label="Suivant">›</button><button type="button" class="om-cancel" id="omVDel" hidden>🗑 Supprimer</button></div>');
  const show=()=>{const s=list[i];w.querySelector("#omVMeta").textContent=(i+1)+" / "+list.length+" · "+timeAgo(s.created_at);w.querySelector("#omVBody").innerHTML=(s.body?'<p class="om-post-body">'+esc(s.body)+'</p>':'')+media(s.media_url,s.media_type);w.querySelector("#omVPrev").disabled=i===0;w.querySelector("#omVNext").disabled=i===list.length-1;w.querySelector("#omVDel").hidden=s.author_id!==user.id;};
  w.querySelector("#omVPrev").onclick=()=>{i--;show();};
  w.querySelector("#omVNext").onclick=()=>{i++;show();};
  w.querySelector("#omVDel").onclick=async()=>{if(!confirm("Supprimer ce contenu ?"))return;const {error}=await db.from(table).delete().eq("id",list[i].id);if(error)return toast(error.message);w.remove();loadStories();loadStatuses();};
  show();
}
async function loadStories(){
  const row=$("homeStories");if(!row||!user)return;
  const {data,error}=await db.from("stories").select("*,profiles:profiles!stories_author_id_fkey(first_name,last_name,avatar_url)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(100);
  if(error)return;
  row.innerHTML='<button type="button" class="story-card create-story" id="createStoryBtn"><div class="story-thumb create"><span class="plus">+</span></div><span class="story-label">Créer une story</span></button>';
  row.querySelector("#createStoryBtn").onclick=()=>publish("story");
  groupByAuthor(data||[]).forEach(list=>{const b=document.createElement("button");b.type="button";b.className="om-story";b.innerHTML=av(list[0].profiles)+'<strong>'+esc(list[0].author_id===user.id?"Ma story":name(list[0].profiles))+'</strong><span class="om-note">'+timeAgo(list[list.length-1].created_at)+'</span>';b.onclick=()=>viewer(list,"stories");row.appendChild(b);});
}
function statusRow(list,label){const el=document.createElement("button");el.type="button";el.className="om-user om-row";el.innerHTML=av(list[0].profiles)+'<div class="om-grow"><strong>'+esc(label||name(list[0].profiles))+'</strong><div class="om-note">'+list.length+' statut'+(list.length>1?'s':'')+' · '+timeAgo(list[list.length-1].created_at)+'</div></div>';el.onclick=()=>viewer(list,"statuses");return el;}
async function loadStatuses(){
  const box=$("statusList");if(!box||!user)return;
  const {data,error}=await db.from("statuses").select("*,profiles:profiles!statuses_author_id_fkey(first_name,last_name,avatar_url)").gt("expires_at",new Date().toISOString()).order("created_at",{ascending:true}).limit(150);
  if(error){box.innerHTML='<p class="om-note">'+esc(error.message)+'</p>';return;}
  const mineList=(data||[]).filter(s=>s.author_id===user.id);
  const meta=document.querySelector("#myStatusCard .status-meta");
  if(meta)meta.textContent=mineList.length?mineList.length+" statut"+(mineList.length>1?"s":"")+" actif"+(mineList.length>1?"s":"")+" · appuie pour en ajouter":"Appuie pour ajouter un statut";
  box.innerHTML="";
  if(mineList.length)box.appendChild(statusRow(mineList,"Mes statuts"));
  groupByAuthor((data||[]).filter(s=>s.author_id!==user.id)).forEach(list=>box.appendChild(statusRow(list)));
  if(!box.children.length)box.innerHTML='<div class="empty-state"><p>Aucun statut pour le moment.</p><p class="om-note">Les statuts de tes amis apparaîtront ici.</p></div>';
}

/* ---------- Amis ---------- */
async function answer(id,status){
  const {error}=await db.from("friend_requests").update({status,updated_at:new Date().toISOString()}).eq("id",id);
  toast(error?error.message:({accepted:"Vous êtes maintenant amis.",declined:"Invitation refusée.",cancelled:"Invitation annulée."}[status]));
  await Promise.all([loadFriends(),loadFeed()]);
}
async function loadFriends(){
  const inv=$("inviteList"),sug=$("suggestList");if(!inv||!sug||!user)return;
  const {data:reqs,error}=await db.from("friend_requests").select("id,sender_id,recipient_id,status,created_at").in("status",["pending","accepted"]).order("created_at",{ascending:false});
  if(error){inv.textContent=error.message;return;}
  const incoming=reqs.filter(r=>r.status==="pending"&&r.recipient_id===user.id);
  const sent=reqs.filter(r=>r.status==="pending"&&r.sender_id===user.id);
  const friends=reqs.filter(r=>r.status==="accepted").map(r=>({reqId:r.id,id:r.sender_id===user.id?r.recipient_id:r.sender_id}));
  const related=new Set(reqs.flatMap(r=>[r.sender_id,r.recipient_id]));related.delete(user.id);
  const get=await profilesById([...related]);
  setBadge("friendsBadge",incoming.length);
  if($("inviteCount"))$("inviteCount").textContent=String(incoming.length);
  inv.innerHTML="";
  incoming.forEach(r=>inv.appendChild(userRow(get(r.sender_id),[["Accepter",()=>answer(r.id,"accepted")],["Refuser",()=>answer(r.id,"declined"),true]],"Veut devenir ton ami(e)")));
  sent.forEach(r=>inv.appendChild(userRow(get(r.recipient_id),[["Annuler",()=>answer(r.id,"cancelled"),true]],"Invitation envoyée")));
  if(!incoming.length&&!sent.length)inv.innerHTML='<p class="om-note">Aucune invitation en attente.</p>';
  const tab=document.querySelector("[data-friends-tab].active")?.dataset.friendsTab||"online";
  const title=document.querySelector(".friends-section-title");
  sug.innerHTML="";
  if(tab==="suggestions"){
    if(title)title.textContent="Suggestions";
    let {data:ppl,error:pe}=await db.rpc("omegia_suggest_members");if(pe)({data:ppl}=await db.from("profiles").select("id,first_name,last_name,avatar_url,username").neq("id",user.id).order("created_at",{ascending:false}).limit(40));
    const known=new Set([...related]);
    const list=(ppl||[]).filter(p=>!known.has(p.id)).slice(0,12);
    list.forEach(p=>sug.appendChild(userRow(p,[["Inviter",()=>invite(p.id)]],p.username?"@"+p.username:"")));
    if(!list.length)sug.innerHTML='<p class="om-note">Aucune suggestion pour le moment.</p>';
  }else{
    const list=tab==="online"?friends.filter(f=>presence.has(f.id)):friends;
    if(title)title.textContent=tab==="online"?"Ami(e)s en ligne":"Vos ami(e)s ("+friends.length+")";
    list.forEach(f=>sug.appendChild(userRow(get(f.id),[["Message",()=>startChat(f.id)],["Retirer",async()=>{if(!confirm("Retirer cet(te) ami(e) ?"))return;const {error:e}=await db.from("friend_requests").delete().eq("id",f.reqId);toast(e?e.message:"Ami(e) retiré(e).");loadFriends();loadFeed();},true]],presence.has(f.id)?"🟢 En ligne":"")));
    if(!list.length)sug.innerHTML='<p class="om-note">'+(tab==="online"?"Aucun(e) ami(e) en ligne pour le moment.":"Tu n’as pas encore d’ami(e). Utilise « Suggestions » ou la recherche.")+'</p>';
  }
  const find=document.createElement("button");find.type="button";find.className="primary-button small";find.id="omFind";find.textContent="Rechercher des membres";find.onclick=people;sug.appendChild(find);
}

/* ---------- Messagerie ---------- */
const readKey=id=>"omegia.read."+id;
const lastRead=id=>{try{return Date.parse(localStorage.getItem(readKey(id)))||0;}catch{return 0;}};
async function markRead(id){const {data}=await db.from("messages").select("created_at").eq("conversation_id",id).order("created_at",{ascending:false}).limit(1);const t=data?.[0]?.created_at;if(t)try{localStorage.setItem(readKey(id),t);}catch{}}
const preview=m=>!m?"Aucun message":m.body==="__OMEGIA_STICKER__"?"Sticker":m.body?m.body:({image:"📷 Photo",video:"🎬 Vidéo",audio:"🎙 Message vocal",file:"📎 Fichier"}[m.attachment_type]||"Message");
async function startChat(peer){
  if(!peer||peer===user.id)return toast("Choisis un autre membre.");
  const {data:mine,error:e0}=await db.from("conversation_members").select("conversation_id").eq("user_id",user.id);
  if(e0)return toast(e0.message);
  let id=null;
  const mineIds=(mine||[]).map(x=>x.conversation_id);
  if(mineIds.length){
    const {data:shared,error:e1}=await db.from("conversation_members").select("conversation_id,conversations!inner(is_group)").eq("user_id",peer).in("conversation_id",mineIds).eq("conversations.is_group",false);
    if(e1)return toast(e1.message);
    id=shared?.[0]?.conversation_id||null;
  }
  if(!id){
    const {data:c,error:e2}=await db.from("conversations").insert({created_by:user.id,is_group:false}).select().single();
    if(e2)return toast(e2.message);
    id=c.id;
    const {error:e3}=await db.from("conversation_members").insert([{conversation_id:id,user_id:user.id},{conversation_id:id,user_id:peer}]);
    if(e3)return toast(e3.message);
  }
  document.querySelectorAll(".om-modal").forEach(m=>m.remove());
  await openChat(id,peer);
  markRead(id).then(loadChats);
}
async function loadChats(){
  const box=$("chatList");if(!box||!user)return;
  const {data:mine,error}=await db.from("conversation_members").select("conversation_id,conversations(is_group,title,created_at)").eq("user_id",user.id);
  if(error){box.textContent=error.message;return;}
  if(!mine?.length){box.innerHTML='<p class="om-note">Aucune conversation. Appuie sur + pour trouver un membre.</p>';setBadge("msgBadge",0);return;}
  const ids=mine.map(r=>r.conversation_id);
  const [{data:members},{data:msgs}]=await Promise.all([
    db.from("conversation_members").select("conversation_id,user_id").in("conversation_id",ids),
    db.from("messages").select("conversation_id,sender_id,body,attachment_type,created_at").in("conversation_id",ids).order("created_at",{ascending:false}).limit(300)]);
  const get=await profilesById((members||[]).map(m=>m.user_id));
  const last={},unread={};let total=0;
  (msgs||[]).forEach(m=>{if(!last[m.conversation_id])last[m.conversation_id]=m;if(m.sender_id!==user.id&&Date.parse(m.created_at)>lastRead(m.conversation_id)){unread[m.conversation_id]=(unread[m.conversation_id]||0)+1;total++;}});
  const rows=mine.map(r=>({id:r.conversation_id,peer:(members||[]).find(m=>m.conversation_id===r.conversation_id&&m.user_id!==user.id)?.user_id,conv:r.conversations,last:last[r.conversation_id]}))
    .sort((a,b)=>Date.parse(b.last?.created_at||b.conv?.created_at||0)-Date.parse(a.last?.created_at||a.conv?.created_at||0));
  box.innerHTML="";
  rows.forEach(r=>{
    const p=r.peer?get(r.peer):null;
    const b=document.createElement("button");b.type="button";b.className="om-user om-row";
    b.innerHTML=av(p)+'<div class="om-grow"><strong>'+esc(r.conv?.title||name(p))+'</strong><div class="om-note om-preview">'+esc((r.last?.sender_id===user.id?"Toi : ":"")+preview(r.last))+'</div></div>'+(r.last?'<span class="om-note">'+timeAgo(r.last.created_at)+'</span>':'')+(unread[r.id]?'<span class="om-unread">'+unread[r.id]+'</span>':'');
    b.onclick=async()=>{await openChat(r.id,r.peer);markRead(r.id).then(loadChats);};
    box.appendChild(b);
  });
  setBadge("msgBadge",total);
}
function onNewMessage(payload){
  const m=payload.new;if(!m||m.sender_id===user.id)return;
  if(active===m.conversation_id){markRead(m.conversation_id);}else toast("💬 Nouveau message");
  loadChats();
}

/* ---------- Notifications ---------- */
const NOTIF_KEY="omegia.notif.seen";
async function fetchNotifs(){
  const [inv,cm,rx]=await Promise.all([
    db.from("friend_requests").select("sender_id,created_at").eq("recipient_id",user.id).eq("status","pending").order("created_at",{ascending:false}).limit(20),
    db.from("post_comments").select("author_id,body,created_at,posts!inner(author_id)").eq("posts.author_id",user.id).neq("author_id",user.id).order("created_at",{ascending:false}).limit(20),
    db.from("post_reactions").select("user_id,created_at,posts!inner(author_id)").eq("posts.author_id",user.id).neq("user_id",user.id).order("created_at",{ascending:false}).limit(20)]);
  const items=[
    ...(inv.data||[]).map(r=>({who:r.sender_id,t:r.created_at,text:"t’a envoyé une invitation."})),
    ...(cm.data||[]).map(r=>({who:r.author_id,t:r.created_at,text:"a commenté ta publication : « "+r.body.slice(0,80)+(r.body.length>80?"…":"")+" »"})),
    ...(rx.data||[]).map(r=>({who:r.user_id,t:r.created_at,text:"a aimé ta publication."}))
  ].sort((a,b)=>Date.parse(b.t)-Date.parse(a.t));
  return items;
}
const seenAt=()=>{try{return Date.parse(localStorage.getItem(NOTIF_KEY))||0;}catch{return 0;}};
async function loadNotifBadge(){try{const items=await fetchNotifs();setBadge("notifBadge",items.filter(i=>Date.parse(i.t)>seenAt()).length);}catch(e){console.warn("Notifications:",e);}}
async function openNotifs(){
  const w=modal("Notifications",'<div id="omNotifs"><p class="om-note">Chargement…</p></div>');
  try{
    const items=await fetchNotifs();
    const get=await profilesById(items.map(i=>i.who));
    const box=w.querySelector("#omNotifs");box.innerHTML="";
    items.forEach(i=>{const p=get(i.who),el=document.createElement("div");el.className="om-user";el.innerHTML=av(p)+'<div class="om-grow"><strong>'+esc(name(p))+'</strong> '+esc(i.text)+'<div class="om-note">'+timeAgo(i.t)+'</div></div>';box.appendChild(el);});
    if(!items.length)box.innerHTML='<p class="om-note">Rien de nouveau pour le moment.</p>';
    if(items[0])try{localStorage.setItem(NOTIF_KEY,items[0].t);}catch{}
    setBadge("notifBadge",0);
  }catch(e){w.querySelector("#omNotifs").textContent=e.message;}
}

/* ---------- Temps réel global : présence, messages, invitations, notifications ---------- */
function startGlobalChannel(){
  if(globalCh)db.removeChannel(globalCh);
  const refreshFriends=()=>{clearTimeout(syncTimer);syncTimer=setTimeout(()=>{if(user&&!$("view-friends")?.hidden)loadFriends();},400);};
  globalCh=db.channel("omegia-online",{config:{presence:{key:user.id}}})
    .on("presence",{event:"sync"},()=>{presence=new Set(Object.keys(globalCh.presenceState()));refreshFriends();})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},onNewMessage)
    .on("postgres_changes",{event:"*",schema:"public",table:"friend_requests"},p=>{if(p.eventType==="INSERT"&&p.new?.recipient_id===user.id)toast("🤝 Nouvelle invitation d’ami");loadFriends();loadNotifBadge();})
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"post_comments"},loadNotifBadge)
    .on("postgres_changes",{event:"INSERT",schema:"public",table:"post_reactions"},loadNotifBadge)
    .subscribe(async s=>{if(s==="SUBSCRIBED"&&showOnline())await globalCh.track({user_id:user.id,online_at:new Date().toISOString()});});
}
function bindPlus(){
  capture("notifBtn",openNotifs);
  $("chatBack")?.addEventListener("click",()=>setTimeout(loadChats,200),true);
  document.querySelectorAll("[data-friends-tab]").forEach(c=>c.addEventListener("click",()=>setTimeout(loadFriends,0)));
}

function bind(){bindPlus();
capture("editProfileBtn",editProfile);capture("editAbout",editProfile);capture("searchBtn",people);capture("openComposer",()=>publish("post"));capture("composerPhoto",()=>publish("post"));capture("createStoryBtn",()=>publish("story"));capture("myStatusCard",()=>publish("status"));capture("publishBtn",()=>publish("post"));capture("newChatBtn",people);capture("friendsSearch",people);capture("seeAllInvites",loadFriends);capture("editAvatar",()=>photo("avatar"));capture("editCover",()=>photo("cover"));
["profileAvatar","homeAvatar","sideAvatar"].forEach(id=>$(id)?.addEventListener("click",async()=>{try{const p=await profile();showPhoto(p?.avatar_url,"Photo de profil");}catch(e){toast(e.message);}}));
document.querySelector(".profile-cover")?.addEventListener("click",async e=>{if(e.target.closest("#editCover"))return;try{const p=await profile();showPhoto(p?.cover_url,"Photo de couverture");}catch(err){toast(err.message);}});
document.querySelectorAll("[data-nav='profile'],[data-goto='profile']").forEach(b=>b.addEventListener("click",()=>setTimeout(loadMyPosts,180)));

capture("chatBack",()=>{active=null;if(channel)db.removeChannel(channel);document.querySelectorAll(".view").forEach(v=>v.hidden=v.dataset.view!=="messages");document.querySelector(".bottom-nav")?.classList.remove("hidden-for-chat");document.querySelector(".app-header")?.classList.remove("hidden-for-chat");});
capture("chatAttach",async()=>{const f=await pick("image/*,video/*,audio/*,.pdf");if(!f)return;const t=f.type.startsWith("image/")?"image":f.type.startsWith("video/")?"video":f.type.startsWith("audio/")?"audio":"file";try{await send("",await upload(f,"messages"),t);}catch(e){toast(e.message);}});
capture("chatCam",async()=>{const f=await pick("image/*,video/*");if(f)try{await send("",await upload(f,"messages"),f.type.startsWith("video/")?"video":"image");}catch(e){toast(e.message);}});
$("chatInput")?.addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.value.trim()){e.preventDefault();e.stopImmediatePropagation();send(e.target.value.trim());}},true);
$("chatInput")?.addEventListener("input",()=>{chatSignal("typing",!!$("chatInput").value.trim());},true);
$("chatMicSend")?.addEventListener("click",e=>{e.stopImmediatePropagation();$("chatInput")?.value.trim()?send($("chatInput").value.trim()):audioNote();},true);
document.querySelectorAll("[data-nav='messages'],[data-goto='messages']").forEach(b=>b.addEventListener("click",()=>setTimeout(loadChats,150)));
document.querySelectorAll("[data-nav='friends'],[data-goto='friends']").forEach(b=>b.addEventListener("click",()=>setTimeout(loadFriends,150)));
document.querySelectorAll("[data-nav='home']").forEach(b=>b.addEventListener("click",()=>setTimeout(loadFeed,150)));
document.querySelectorAll("[data-nav='status'],[data-goto='status']").forEach(b=>b.addEventListener("click",()=>setTimeout(loadStatuses,150)));
}
let bound=false, initializedUserId=null;
async function initForUser(nextUser){if(!nextUser||initializedUserId===nextUser.id)return;user=nextUser;initializedUserId=nextUser.id;if(!bound){bind();bindStickerPicker();bound=true;}await refreshProfile();await Promise.allSettled([loadFeed(),loadStories(),loadStatuses(),loadFriends(),loadChats()]);startGlobalChannel();loadNotifBadge();}
async function boot(){try{db=await ready;db.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_OUT"){user=null;initializedUserId=null;active=null;if(channel)db.removeChannel(channel);if(globalCh){db.removeChannel(globalCh);globalCh=null;}profCache.clear();presence=new Set();return;}if((event==="SIGNED_IN"||event==="INITIAL_SESSION"||event==="TOKEN_REFRESHED")&&session?.user){setTimeout(()=>initForUser(session.user).catch(e=>{console.warn("OMEGIA:",e);toast("Services sociaux : "+e.message);}),0);}});const {data:{session}}=await db.auth.getSession();if(session?.user)await initForUser(session.user);}catch(e){console.warn("OMEGIA:",e);toast("Services sociaux : "+e.message);}}
const showOnline=()=>{try{return localStorage.getItem("omegia.pref.showOnline")!=="false";}catch{return true;}};
window.omegiaSocial={openSavedPosts,openMemories,modal,toast,esc,media,av,name,get db(){return db;},get user(){return user;},get active(){return active;},get activePeer(){return activePeer;}};
window.addEventListener("load",()=>setTimeout(boot,300));
})();