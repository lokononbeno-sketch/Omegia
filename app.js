// OMEGIA — Auth Supabase + Espace membre (Facebook + WhatsApp hybrid)
const $ = (id) => document.getElementById(id);
const SUPABASE_URL = "https://nyiievcbciqxvxmerwdm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4ZW9RA9gktscWSW2tuEttw_yRNdnduw";
// URL publique unique utilisée pour les retours d’authentification sur le web et l’APK.
const OMEGIA_PUBLIC_URL = "https://lokononbeno.gitlab.io/omegia-social/";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_AGE = 13;

const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const startsInRecovery = hashParams.get("type") === "recovery";
const linkHadError = hashParams.has("error");

const supabaseReady = new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
  script.async = true;
  script.onload = () => {
    if (!window.supabase?.createClient) {
      reject(new Error("La bibliothèque Supabase n'a pas pu être initialisée."));
      return;
    }
    resolve(window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY));
  };
  script.onerror = () => reject(new Error("Impossible de charger Supabase. Vérifiez votre connexion Internet."));
  document.head.appendChild(script);
});

function setMessage(id, message, isError = false) {
  const el = $(id);
  if (!el) {
    if (message) console.warn("OMEGIA message [" + id + "]:", message);
    if (message && isError) {
      try { alert(message); } catch (_) {}
    }
    return;
  }
  el.hidden = false;
  el.style.display = "";
  el.textContent = message || "";
  el.dataset.state = isError ? "error" : "success";
  // Remonter le message dans le dialog / formulaire pour qu’il soit visible sur mobile
  try { el.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (_) {}
}

function friendlyError(error) {
  const msg = (error && error.message) || "";
  const known = {
    "Invalid login credentials": "Adresse e-mail ou mot de passe incorrect.",
    "Email not confirmed": "Veuillez d'abord confirmer votre adresse e-mail depuis le message envoyé par Supabase.",
    "User already registered": "Cette adresse e-mail possède déjà un compte. Essayez de vous connecter."
  };
  if (known[msg]) return known[msg];
  if (/rate limit|too many requests|security purposes/i.test(msg)) return "Trop de tentatives. Patientez quelques instants avant de réessayer.";
  if (/captcha/i.test(msg)) return "L'inscription est momentanément indisponible (vérification de sécurité du serveur). Réessayez plus tard.";
  if (/anonymous sign-?ins? (are|is) disabled/i.test(msg)) return "L'inscription par empreinte n'est pas activée sur le serveur. Utilisez « Créer un nouveau compte (e-mail) ».";
  if (/signups? (not allowed|(is|are) disabled)/i.test(msg)) return "Les inscriptions sont momentanément fermées. Réessayez plus tard ou contactez l’équipe OMEGIA.";
  if (/email.*not.*confirm|confirm.*email/i.test(msg)) return "Confirmez d’abord votre e-mail (regardez aussi les indésirables), puis reconnectez-vous.";
  if (/user already|already registered|already been registered/i.test(msg)) return "Cette adresse e-mail possède déjà un compte. Essayez de vous connecter.";
  if (/invalid.*email|email.*invalid/i.test(msg)) return "Adresse e-mail invalide. Vérifiez l’orthographe.";
  if (/Unable to validate|invalid login/i.test(msg)) return "Adresse e-mail ou mot de passe incorrect.";
  if (/different from the old password/i.test(msg)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/password should be|weak password/i.test(msg)) return "Mot de passe trop faible. Utilisez au moins 8 caractères variés.";
  if (/session missing/i.test(msg)) return "Le lien de récupération a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ? ».";
  if (/failed to fetch|network/i.test(msg)) return "Connexion impossible. Vérifiez votre connexion Internet.";
  if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) return "Vérification annulée ou refusée par l'appareil.";
  return msg || "Une erreur est survenue. Réessayez.";
}

let currentUser = null;

function render(state) {
  const landing = $("landing");
  const footer = $("landingFooter");
  const appShell = $("appShell");

  $("guestArea").hidden = state !== "guest";
  $("recoveryForm").hidden = state !== "recovery";
  $("lockArea").hidden = state !== "locked";

  if (state === "member") {
    landing.hidden = true;
    if (footer) footer.hidden = true;
    appShell.hidden = false;
    document.body.style.overflow = "hidden";
    populateMemberUI();
    showView("home");
    refreshBioButton();
  } else {
    landing.hidden = false;
    if (footer) footer.hidden = false;
    appShell.hidden = true;
    document.body.style.overflow = "";
  }
}

function showView(name) {
  document.querySelectorAll(".view").forEach((v) => {
    v.hidden = v.dataset.view !== name;
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === name);
  });
  if (name !== "chat") {
    document.querySelector(".bottom-nav")?.classList.remove("hidden-for-chat");
    document.querySelector(".app-header")?.classList.remove("hidden-for-chat");
    const panel = $("emojiPanel");
    if (panel) panel.hidden = true;
  }
  if (name === "literary") renderLiteraryGrid();
  const main = $("appMain");
  if (main) main.scrollTop = 0;
}

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.nav));
});

// Composer & stories
$("openComposer")?.addEventListener("click", () => showView("create"));
$("composerPhoto")?.addEventListener("click", () => {
  alert("Photo / Vidéo — bientôt disponible.");
});
$("createStoryBtn")?.addEventListener("click", () => {
  alert("Créer une story — bientôt disponible.\nTu pourras partager une photo, une vidéo ou un texte qui disparaît après 24 h.");
});
$("myStatusCard")?.addEventListener("click", () => {
  alert("Publication de statut — bientôt disponible.");
});

// ---------- Profil / données ----------
function getDisplayName(user) {
  if (!user) return "Membre";
  const meta = user.user_metadata || {};
  const first = meta.first_name || "";
  const last = meta.last_name || "";
  const full = (first + " " + last).trim();
  return full || user.email?.split("@")[0] || "Membre";
}

function getInitials(user) {
  const name = getDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] || "Ω").toUpperCase();
}

function populateMemberUI() {
  if (!currentUser) return;
  const name = getDisplayName(currentUser);
  const first = (currentUser.user_metadata?.first_name) || name.split(" ")[0];
  const initials = getInitials(currentUser);
  const meta = currentUser.user_metadata || {};

  if ($("homeAvatar")) $("homeAvatar").textContent = initials;
  if ($("profileName")) $("profileName").textContent = name;
  if ($("profileAvatar")) $("profileAvatar").textContent = initials;
  if ($("sideName")) $("sideName").textContent = name;
  if ($("sideAvatar")) $("sideAvatar").textContent = initials;
  if ($("profileEmail")) $("profileEmail").textContent = currentUser.email || "—";

  if ($("profileSince") && currentUser.created_at) {
    try {
      const d = new Date(currentUser.created_at);
      $("profileSince").textContent = d.toLocaleDateString("fr-FR", { year: "numeric", month: "long" });
    } catch {
      $("profileSince").textContent = "—";
    }
  }

  if ($("profileBio")) $("profileBio").textContent = meta.bio || "Ajoute une bio pour te présenter";
  if ($("profileLocation")) $("profileLocation").textContent = meta.location ? "📍 " + meta.location : "📍 Lieu non renseigné";
  if ($("profileWork")) $("profileWork").textContent = meta.work ? "💼 " + meta.work : "💼 Travail non renseigné";
  if ($("profileSchool")) $("profileSchool").textContent = meta.school ? "🎓 " + meta.school : "🎓 Études non renseignées";
  if ($("profileStats")) $("profileStats").textContent = "0 follower · 0 suivi(e)s";
}

// Paramètres / placeholders
// ----- Bénoli littéraire (stockage local pour l’instant) -----
const LIT_KEY = "omegia.literary";
function loadNovels() {
  try { return JSON.parse(localStorage.getItem(LIT_KEY) || "[]"); } catch { return []; }
}
function saveNovels(list) {
  try { localStorage.setItem(LIT_KEY, JSON.stringify(list)); } catch {}
}

// Exemple initial si vide (tu pourras le remplacer / supprimer)
function ensureSampleNovels() {
  let list = loadNovels();
  if (list.length === 0) {
    list = [{
      id: "sample-1",
      title: "Exemple — Mon premier roman",
      price: "2 500 FCFA",
      buyUrl: "https://example.com",
      summary: "Remplace cet exemple par tes vrais romans.\nUn résumé accrocheur de l’histoire.",
      excerpt: "Chapitre 1 (extrait gratuit)…\n\nIl était une fois…",
      createdAt: Date.now()
    }];
    saveNovels(list);
  }
  return list;
}

function renderLiteraryGrid() {
  const grid = $("litGrid");
  const empty = $("litEmpty");
  if (!grid) return;
  const list = ensureSampleNovels();
  grid.innerHTML = "";
  if (!list.length) {
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  list.forEach((n) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "lit-card";
    btn.innerHTML = `
      <div class="lit-card-cover">📖</div>
      <div class="lit-card-body">
        <div class="lit-card-title"></div>
        <div class="lit-card-price"></div>
      </div>`;
    btn.querySelector(".lit-card-title").textContent = n.title;
    btn.querySelector(".lit-card-price").textContent = n.price;
    btn.addEventListener("click", () => openNovelDetail(n.id));
    grid.appendChild(btn);
  });
}

function openNovelDetail(id) {
  const n = loadNovels().find((x) => x.id === id);
  if (!n) return;
  if ($("litDetailName")) $("litDetailName").textContent = n.title;
  if ($("litDetailTitle")) $("litDetailTitle").textContent = n.title;
  if ($("litDetailPrice")) $("litDetailPrice").textContent = n.price;
  if ($("litDetailSummary")) $("litDetailSummary").textContent = n.summary || "—";
  if ($("litDetailExcerpt")) $("litDetailExcerpt").textContent = n.excerpt || "Aucun extrait gratuit pour le moment.";
  const buy = $("litBuyBtn");
  if (buy) {
    buy.href = n.buyUrl || "#";
    buy.onclick = (e) => {
      if (!n.buyUrl || n.buyUrl === "https://example.com") {
        e.preventDefault();
        alert("Configure le lien d’achat de ce roman (ton site / panier) pour activer le paiement.");
      }
    };
  }
  showView("lit-detail");
}

$("litAddBtn")?.addEventListener("click", () => {
  ["litTitle", "litPrice", "litBuyUrl", "litSummary", "litExcerpt"].forEach((id) => {
    if ($(id)) $(id).value = "";
  });
  if ($("litPdf")) $("litPdf").value = "";
  setMessage("litFormMessage", "");
  showView("lit-form");
});
$("litDetailBack")?.addEventListener("click", () => { showView("literary"); renderLiteraryGrid(); });
$("litFormBack")?.addEventListener("click", () => { showView("literary"); renderLiteraryGrid(); });

$("litPublishBtn")?.addEventListener("click", () => {
  const title = $("litTitle")?.value.trim();
  const price = $("litPrice")?.value.trim();
  const buyUrl = $("litBuyUrl")?.value.trim();
  const summary = $("litSummary")?.value.trim();
  const excerpt = $("litExcerpt")?.value.trim() || "";
  if (!title || !price || !buyUrl || !summary) {
    setMessage("litFormMessage", "Titre, prix, lien d’achat et résumé sont obligatoires.", true);
    return;
  }
  try {
    // validation basique d’URL
    new URL(buyUrl);
  } catch {
    setMessage("litFormMessage", "Le lien d’achat doit être une URL valide (https://…).", true);
    return;
  }
  const list = loadNovels().filter((n) => n.id !== "sample-1"); // retire l’exemple dès qu’on publie
  list.unshift({
    id: "n-" + Date.now(),
    title,
    price,
    buyUrl,
    summary,
    excerpt,
    createdAt: Date.now()
  });
  saveNovels(list);
  setMessage("litFormMessage", "Roman publié sur cet appareil.");
  setTimeout(() => {
    showView("literary");
    renderLiteraryGrid();
  }, 600);
});

// Quand on ouvre la vue literary, rafraîchir la grille
const _origShowView = typeof showView === "function" ? null : null;

const settingMessages = {
  privacy: "Confidentialité et sécurité — bientôt configurable",
  notifications: "Notifications — bientôt configurable",
  account: "Paramètres du compte — bientôt disponible",
  help: "Aide et support — contacte l’équipe OMEGIA",
  saved: "Enregistrements — bientôt disponible",
  memories: "Souvenirs — bientôt disponible",
  groups: "Groupes — bientôt disponible",
  pages: "Pages — bientôt disponible",
  events: "Événements — bientôt disponible",
  marketplace: "Bénoli littéraire — ouvre depuis le menu",
  reels: "Reels — bientôt disponible",
  feeds: "Fils — bientôt disponible",
  games: "Jeux — bientôt disponible",
  ads: "Espace Pubs — bientôt disponible",
  avatars: "Avatars — bientôt disponible",
  assistance: "Assistance — bientôt disponible",
  mail: "Mail — boîte de réception OMEGIA bientôt disponible"
};

document.querySelectorAll("[data-setting]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const s = btn.dataset.setting;
    if (s === "saved" || s === "memories") {
      $("sideMenu").hidden = true;
      if (window.omegiaSocial) (s === "saved" ? window.omegiaSocial.openSavedPosts() : window.omegiaSocial.openMemories());
      else alert("Le module social est en cours de chargement. Réessaie dans un instant.");
      return;
    }
    if (s === "privacy" || s === "notifications" || s === "account") {
      $("sideMenu").hidden = true;
      showView("settings");
      return;
    }
    alert(settingMessages[s] || "Bientôt disponible");
    $("sideMenu").hidden = true;
  });
});

// Depuis le profil → ouvrir Paramètres
document.querySelectorAll("#view-profile [data-setting]").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    // déjà géré au-dessus pour privacy/notifications
  });
});

// ----- Paramètres -----
$("settingsBack")?.addEventListener("click", () => showView("profile"));
$("accountBack")?.addEventListener("click", () => showView("settings"));
$("settingsLogout")?.addEventListener("click", signOut);

document.querySelectorAll("[data-open-panel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (btn.dataset.openPanel === "account") {
      fillAccountForm();
      showView("account");
    }
  });
});

// Préférences locales réellement appliquées sur cet appareil.
const ACCESS_KEY = "omegia.accessibility";
function applyAccessibilityPrefs(prefs) {
  const root = document.documentElement;
  root.style.fontSize = prefs.largeText ? "18px" : "";
  let style = document.getElementById("omegiaReducedMotion");
  if (prefs.reduceMotion) {
    if (!style) {
      style = document.createElement("style");
      style.id = "omegiaReducedMotion";
      style.textContent = "*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}";
      document.head.appendChild(style);
    }
  } else if (style) style.remove();
}
let accessibilityPrefs = {largeText:false,reduceMotion:false};
try { accessibilityPrefs = {...accessibilityPrefs,...JSON.parse(localStorage.getItem(ACCESS_KEY)||"{}")}; } catch {}
applyAccessibilityPrefs(accessibilityPrefs);

document.querySelectorAll("[data-setting-item]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.settingItem;
    const labels = {
      "privacy-assist": "Assistance confidentialité",
      audience: "Paramètres d’audience par défaut",
      notifications: "Notifications",
      accessibility: "Accessibilité",
      language: "Langue et région",
      media: "Contenu multimédia",
      time: "Gestion du temps",
      "profile-lock": "Verrouillage du profil",
      "profile-info": "Informations du profil",
      "how-find": "Comment les autres peuvent vous trouver",
      "posts-vis": "Visibilité des publications",
      "stories-vis": "Visibilité des stories / statuts",
      followers: "Followers et contenu public",
      tagging: "Profil et identification",
      blocking: "Liste des comptes bloqués",
      "online-status": "Qui peut voir que vous êtes en ligne",
      activity: "Historique d’activité",
      "device-perms": "Autorisations de l’appareil",
      "link-history": "Historique des liens",
      terms: "Conditions de service OMEGIA",
      "privacy-policy": "Politique de confidentialité OMEGIA",
      cookies: "Politique cookies",
      community: "Standards de la communauté",
      about: "OMEGIA — One app. Infinite connections.\nCréé par Beno Lokonon.",
      password: "Pour changer ton mot de passe, utilise le lien « Mot de passe oublié » sur l’écran de connexion."
    };
    if (key === "profile-info") {
      fillAccountForm();
      showView("account");
      return;
    }
    if (key === "accessibility") {
      const choice = prompt("Accessibilité OMEGIA\n\n1 — Texte normal\n2 — Texte agrandi\n3 — Réduire les animations\n4 — Texte agrandi + animations réduites\n\nEntre 1, 2, 3 ou 4 :", "1");
      if (choice === null) return;
      if (!["1","2","3","4"].includes(choice)) return alert("Choix non reconnu.");
      accessibilityPrefs = {largeText:choice==="2"||choice==="4",reduceMotion:choice==="3"||choice==="4"};
      try { localStorage.setItem(ACCESS_KEY,JSON.stringify(accessibilityPrefs)); } catch {}
      applyAccessibilityPrefs(accessibilityPrefs);
      alert("Préférences d’accessibilité appliquées sur cet appareil.");
      return;
    }
    alert((labels[key] || key) + "\n\nCette option n’est pas encore reliée à un réglage fonctionnel. Elle reste à développer.");
  });
});

function fillAccountForm() {
  if (!currentUser) return;
  const meta = currentUser.user_metadata || {};
  if ($("accFirstName")) $("accFirstName").value = meta.first_name || "";
  if ($("accLastName")) $("accLastName").value = meta.last_name || "";
  if ($("accEmail")) $("accEmail").value = currentUser.email || "";
  if ($("accBirthdate")) $("accBirthdate").value = meta.birthdate || "";
  if ($("accPhone")) $("accPhone").value = meta.phone || "";
  if ($("accBio")) $("accBio").value = meta.bio || "";
  if ($("accLocation")) $("accLocation").value = meta.location || "";
}

$("accSaveBtn")?.addEventListener("click", async () => {
  const btn = $("accSaveBtn");
  const first = $("accFirstName")?.value.trim() || "";
  const last = $("accLastName")?.value.trim() || "";
  if (!first || !last) {
    setMessage("accMessage", "Prénom et nom sont obligatoires.", true);
    return;
  }
  btn.disabled = true;
  btn.textContent = "Enregistrement…";
  setMessage("accMessage", "Mise à jour du profil…");
  try {
    const client = await supabaseReady;
    const { data, error } = await client.auth.updateUser({
      data: {
        first_name: first,
        last_name: last,
        birthdate: $("accBirthdate")?.value || null,
        phone: $("accPhone")?.value.trim() || null,
        bio: $("accBio")?.value.trim() || null,
        location: $("accLocation")?.value.trim() || null
      }
    });
    if (error) throw error;
    currentUser = data.user;
    populateMemberUI();
    setMessage("accMessage", "Profil mis à jour.");
  } catch (error) {
    setMessage("accMessage", friendlyError(error), true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Enregistrer les modifications";
  }
});

// Thème OMEGIA : choix clair/sombre mémorisé sur cet appareil.
const DARK_KEY = "omegia.dark";
function applyDarkMode(on) {
  document.body.classList.toggle("dark-mode", on);
  document.documentElement.style.colorScheme = on ? "dark" : "light";
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", on ? "#151320" : "#7652d6");
  const state = $("darkModeState");
  if (state) state.textContent = on ? "Sombre" : "Clair";
  const toggle = $("toggleDarkMode");
  if (toggle) {
    toggle.setAttribute("aria-pressed", on ? "true" : "false");
    toggle.querySelector(".set-ico")?.replaceChildren(document.createTextNode(on ? "☀️" : "🌙"));
  }
  try { localStorage.setItem(DARK_KEY, on ? "1" : "0"); } catch {}
}
let savedTheme = null;
try { savedTheme = localStorage.getItem(DARK_KEY); } catch {}
applyDarkMode(savedTheme === "1");
$("toggleDarkMode")?.addEventListener("click", () => {
  applyDarkMode(!document.body.classList.contains("dark-mode"));
});

$("accBioToggle")?.addEventListener("click", () => {
  $("bioToggle")?.click();
});

$("editProfileBtn")?.addEventListener("click", () => {
  alert("Modification du profil (photo, bio, lieu, travail, études…) arrivera bientôt.");
});
$("editCover")?.addEventListener("click", () => alert("Photo de couverture — bientôt disponible."));
$("editAvatar")?.addEventListener("click", () => alert("Photo de profil — bientôt disponible."));
$("editAbout")?.addEventListener("click", () => alert("Modifier les informations — bientôt disponible."));
$("profileMoreBtn")?.addEventListener("click", () => alert("Plus d’options du profil — bientôt."));
$("newChatBtn")?.addEventListener("click", () => {
  alert("Nouvelle conversation — messagerie complète bientôt.");
});
$("searchBtn")?.addEventListener("click", () => alert("Recherche — bientôt disponible."));
$("notifBtn")?.addEventListener("click", () => alert("Centre de notifications — bientôt disponible."));
$("friendsSearch")?.addEventListener("click", () => alert("Rechercher des amis — bientôt disponible."));
$("seeAllInvites")?.addEventListener("click", () => alert("Toutes les invitations — bientôt."));

// ----- Conversation privée -----
$("chatBack")?.addEventListener("click", () => {
  showView("messages");
  document.querySelector(".bottom-nav")?.classList.remove("hidden-for-chat");
  document.querySelector(".app-header")?.classList.remove("hidden-for-chat");
  $("emojiPanel").hidden = true;
});
$("chatVideo")?.addEventListener("click", () => alert("Appel vidéo — bientôt disponible (WebRTC)."));
$("chatCall")?.addEventListener("click", () => alert("Appel vocal — bientôt disponible (WebRTC)."));
$("chatMore")?.addEventListener("click", () => alert("Options de la conversation — bientôt."));
$("chatAttach")?.addEventListener("click", () => alert("Pièce jointe (photo, document, etc.) — bientôt."));
$("chatCam")?.addEventListener("click", () => alert("Caméra — bientôt disponible."));
$("chatPeerBtn")?.addEventListener("click", () => alert("Profil du contact — bientôt."));

function scrollChatToBottom() {
  const box = $("chatMessages");
  if (box) box.scrollTop = box.scrollHeight;
}

// Micro ↔ Envoyer selon le contenu de l’input
const chatInput = $("chatInput");
const micSend = $("chatMicSend");
function updateMicSend() {
  if (!chatInput || !micSend) return;
  const hasText = chatInput.value.trim().length > 0;
  micSend.classList.toggle("sending", hasText);
  micSend.setAttribute("aria-label", hasText ? "Envoyer" : "Note vocale");
}
chatInput?.addEventListener("input", updateMicSend);
chatInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chatInput.value.trim()) {
    e.preventDefault();
    sendDemoMessage();
  }
});
micSend?.addEventListener("click", () => {
  if (chatInput?.value.trim()) sendDemoMessage();
  else alert("Note vocale — bientôt disponible.\nMaintiens le bouton pour enregistrer (comme WhatsApp).");
});

function sendDemoMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  const box = $("chatMessages");
  if (!box) return;
  const now = new Date();
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const div = document.createElement("div");
  div.className = "bubble out";
  div.innerHTML = `<div class="bubble-text"></div><div class="bubble-meta">${time} <span class="ticks">✓</span></div>`;
  div.querySelector(".bubble-text").textContent = text;
  box.appendChild(div);
  chatInput.value = "";
  updateMicSend();
  scrollChatToBottom();
}

// Emojis
const EMOJIS = ["😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","🥰","😘","😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣","😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","🙁","😖","😞","😟","😤","😢","😭","😦","😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","😡","😠","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🥳","🥺","🤠","🤡","🤥","🤫","🤭","🧐","🤓","😈","👿","👹","goblin","💀","👻","👽","🤖","💩","😺","😸","😹","😻","😼","😽","🙀","😿","😾","👋","🤚","🖐","✋","🖖","👌","🤏","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","👐","🤲","🤝","🙏","💪"];
// fix invalid emoji labels
const CLEAN_EMOJIS = EMOJIS.filter((e) => e.length <= 4 && e !== "goblin");
function fillEmojiGrid() {
  const grid = $("emojiGrid");
  if (!grid || grid.childElementCount) return;
  CLEAN_EMOJIS.forEach((em) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = em;
    b.addEventListener("click", () => {
      if (chatInput) {
        chatInput.value += em;
        chatInput.focus();
        updateMicSend();
      }
    });
    grid.appendChild(b);
  });
}
$("chatEmoji")?.addEventListener("click", () => {
  const panel = $("emojiPanel");
  if (!panel) return;
  panel.hidden = !panel.hidden;
  if (!panel.hidden) fillEmojiGrid();
});

// Installer depuis le menu
$("sideInstall")?.addEventListener("click", async () => {
  $("sideMenu").hidden = true;
  if (deferredInstall) {
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    if ($("installBtn")) $("installBtn").hidden = true;
  } else {
    alert("Pour installer OMEGIA : utilise le menu de ton navigateur (Ajouter à l’écran d’accueil) ou le bouton Installer sur la page d’accueil.");
  }
});

// Menu latéral
$("menuBtn")?.addEventListener("click", () => { $("sideMenu").hidden = false; });
$("sideMenuClose")?.addEventListener("click", () => { $("sideMenu").hidden = true; });
$("sideUser")?.addEventListener("click", () => {
  $("sideMenu").hidden = true;
  showView("profile");
});
document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("sideMenu").hidden = true;
    showView(btn.dataset.goto);
  });
});
$("sideSeeMore")?.addEventListener("click", () => {
  const more = $("sideMore");
  const open = !more.hidden;
  more.hidden = open;
  $("sideSeeMore").textContent = open ? "Voir plus" : "Voir moins";
});

// Chips amis
document.querySelectorAll("[data-friends-tab]").forEach((chip) => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("[data-friends-tab]").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  });
});

// Profil tabs
document.querySelectorAll("[data-ptab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("[data-ptab]").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
  });
});

// ---------- Biométrie ----------
const BIO_KEY = "omegia.biometric";
const b64u = {
  enc: (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (text) => {
    const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  }
};
function readBio() {
  try { return JSON.parse(localStorage.getItem(BIO_KEY) || "null"); } catch { return null; }
}
function writeBio(value) {
  try { if (value) localStorage.setItem(BIO_KEY, JSON.stringify(value)); else localStorage.removeItem(BIO_KEY); } catch {}
}
// Dans l'APK Android, la WebView ne gère pas WebAuthn : on utilise le capteur natif (plugin NativeBiometric).
const nativeBio = () => (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.Plugins && window.Capacitor.Plugins.NativeBiometric) || null;
async function nativeVerify(reason) {
  const plugin = nativeBio();
  try {
    await plugin.verifyIdentity({ reason, title: "OMEGIA", subtitle: reason, description: "Utilise ton empreinte ou ton visage", maxAttempts: 3, useFallback: true });
  } catch { throw new Error("Vérification biométrique annulée ou refusée."); }
}
async function biometricSupported() {
  const plugin = nativeBio();
  if (plugin) {
    try { const r = await plugin.isAvailable({ useFallback: true }); return Boolean(r && r.isAvailable); } catch { return false; }
  }
  try {
    return Boolean(window.isSecureContext && window.PublicKeyCredential &&
      await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}
function biometricEnabledFor(user) {
  const bio = readBio();
  return Boolean(bio && user && bio.userId === user.id);
}
async function refreshBioButton() {
  refreshSecureButton();
  const button = $("bioToggle");
  if (!button) return;
  if (!(await biometricSupported())) { button.hidden = true; return; }
  const enabled = biometricEnabledFor(currentUser);
  button.hidden = false;
  button.dataset.enabled = String(enabled);
  button.textContent = enabled ? "Désactiver l'empreinte ou le visage" : "Activer l'empreinte ou le visage";
}
async function enableBiometric() {
  if (nativeBio()) {
    await nativeVerify("Activer le déverrouillage");
    writeBio({ userId: currentUser.id, credentialId: "native-" + b64u.enc(crypto.getRandomValues(new Uint8Array(16))) });
    return;
  }
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "OMEGIA" },
      user: { id: new TextEncoder().encode(currentUser.id), name: currentUser.email || getDisplayName(currentUser), displayName: currentUser.email || getDisplayName(currentUser) },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000
    }
  });
  writeBio({ userId: currentUser.id, credentialId: b64u.enc(credential.rawId) });
}
// Crée une clé d'empreinte/visage stockée sur l'appareil (jamais envoyée à OMEGIA) et renvoie son identifiant.
async function createBiometricCredential(label) {
  if (nativeBio()) {
    await nativeVerify("Créer ton compte");
    return "native-" + b64u.enc(crypto.getRandomValues(new Uint8Array(16)));
  }
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "OMEGIA" },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: label, displayName: label },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000
    }
  });
  return b64u.enc(credential.rawId);
}

// Compte sans e-mail : proposer d'en ajouter un pour pouvoir le récupérer.
function refreshSecureButton() {
  let btn = $("secureAccountBtn");
  // La connexion par e-mail est désactivée : le bouton d'ajout d'e-mail reste masqué pour l'instant.
  if (btn) btn.hidden = true;
  return;
  if (!btn) {
    const anchor = $("bioToggle");
    if (!anchor) return;
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "secureAccountBtn";
    btn.className = anchor.className;
    btn.addEventListener("click", secureAccount);
    anchor.after(btn);
  }
  btn.hidden = false;
  btn.textContent = "Ajouter une adresse e-mail à mon compte";
}
async function secureAccount() {
  const email = (prompt("Adresse e-mail à associer à votre compte :") || "").trim();
  if (!email) return;
  if (!EMAIL_RE.test(email)) { alert("Adresse e-mail invalide."); return; }
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.updateUser({ email }, { emailRedirectTo: OMEGIA_PUBLIC_URL });
    if (error) throw error;
    alert("Un e-mail de confirmation vous a été envoyé. Après l'avoir confirmé, utilisez « Mot de passe oublié ? » pour choisir un mot de passe et vous connecter depuis n'importe quel appareil.");
  } catch (error) {
    alert(friendlyError(error));
  }
}

// Bouton « Renvoyer l'e-mail de confirmation » après une inscription par e-mail.
function offerResend(email) {
  let btn = $("resendBtn");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = "resendBtn";
    btn.className = "link-text";
    btn.style.marginTop = "8px";
    $("signupMessage").after(btn);
  }
  btn.hidden = false;
  btn.disabled = false;
  btn.textContent = "Renvoyer l'e-mail de confirmation";
  btn.onclick = async () => {
    btn.disabled = true;
    try {
      const client = await supabaseReady;
      const { error } = await client.auth.resend({ type: "signup", email, options: { emailRedirectTo: OMEGIA_PUBLIC_URL } });
      if (error) throw error;
      setMessage("signupMessage", "E-mail renvoyé. Pensez à vérifier vos courriers indésirables.");
    } catch (error) {
      setMessage("signupMessage", friendlyError(error), true);
    }
    setTimeout(() => { btn.disabled = false; }, 30000);
  };
}

async function verifyBiometric() {
  const bio = readBio();
  if (!bio) throw new Error("Le déverrouillage biométrique n'est pas activé.");
  if (String(bio.credentialId).startsWith("native-")) {
    if (!nativeBio()) throw new Error("Cette clé a été créée dans l'application Android.");
    await nativeVerify("Déverrouiller OMEGIA");
    return;
  }
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: b64u.dec(bio.credentialId), transports: ["internal"] }],
      userVerification: "required",
      timeout: 60000
    }
  });
  const client = JSON.parse(new TextDecoder().decode(assertion.response.clientDataJSON));
  const userVerified = (new Uint8Array(assertion.response.authenticatorData)[32] & 0x04) !== 0;
  if (client.type !== "webauthn.get" || client.challenge !== b64u.enc(challenge) || client.origin !== location.origin || !userVerified) {
    throw new Error("Vérification biométrique refusée.");
  }
}

function ageFrom(dateString) {
  const birth = new Date(dateString + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ---------- Login ----------
$("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  const button = $("loginBtn");

  if (!EMAIL_RE.test(email)) { setMessage("formMessage", "Veuillez saisir une adresse e-mail valide.", true); return; }
  if (password.length < 8) { setMessage("formMessage", "Le mot de passe doit contenir au moins 8 caractères.", true); return; }

  button.disabled = true;
  button.textContent = "Connexion…";
  setMessage("formMessage", "Connexion sécurisée à Supabase…");
  try {
    const client = await supabaseReady;
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    currentUser = data.user;
    render("member");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Se connecter";
  }
});

$("forgotLink").addEventListener("click", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  if (!EMAIL_RE.test(email)) {
    setMessage("formMessage", "Saisissez d'abord votre adresse e-mail pour recevoir le lien de récupération.", true);
    $("email").focus();
    return;
  }
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: OMEGIA_PUBLIC_URL
    });
    if (error) throw error;
    setMessage("formMessage", "Si un compte existe pour cette adresse, un e-mail de récupération vient d'être envoyé. Vérifiez aussi vos courriers indésirables.");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
});

// ---------- Inscription ----------
const dialog = $("signupDialog");
$("birthdate").max = new Date().toISOString().slice(0, 10);

function openSignup() {
  setMessage("signupMessage", "");
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
  $("firstName").focus();
}
function closeSignup() {
  if (typeof dialog.close === "function") dialog.close();
  else dialog.removeAttribute("open");
}
$("openSignup").addEventListener("click", openSignup);
$("closeSignup").addEventListener("click", closeSignup);
dialog.addEventListener("click", (event) => { if (event.target === dialog) closeSignup(); });

$("signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const firstName = $("firstName").value.trim();
  const lastName = $("lastName").value.trim();
  const birthdate = $("birthdate").value;
  const email = $("signupEmail").value.trim().toLowerCase();
  const password = $("signupPassword").value;
  const button = $("signupBtn");
  const fail = (text) => {
    setMessage("signupMessage", text, true);
    console.error("OMEGIA inscription:", text);
  };

  if (!firstName || !lastName) { fail("Veuillez saisir votre prénom et votre nom."); return; }
  if (!birthdate) { fail("Veuillez saisir votre date de naissance."); return; }
  const age = ageFrom(birthdate);
  if (age === null || age < 0 || age > 120) { fail("Veuillez saisir une date de naissance valide."); return; }
  if (age < MIN_AGE) { fail("Vous devez avoir au moins " + MIN_AGE + " ans pour créer un compte."); return; }
  if (!EMAIL_RE.test(email)) { fail("Veuillez saisir une adresse e-mail valide (ex. nom@gmail.com)."); return; }
  if (password.length < 8) { fail("Le mot de passe doit contenir au moins 8 caractères."); return; }
  if (password !== $("signupConfirm").value) { fail("Les deux mots de passe ne correspondent pas."); return; }

  button.disabled = true;
  button.textContent = "Création du compte…";
  setMessage("signupMessage", "Inscription en cours, patientez…");
  try {
    const client = await supabaseReady;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, birthdate },
        emailRedirectTo: OMEGIA_PUBLIC_URL
      }
    });
    if (error) throw error;
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }
    $("signupForm").reset();
    if (data.session) {
      currentUser = data.user;
      closeSignup();
      render("member");
      setMessage("formMessage", "Compte créé ! Bienvenue sur OMEGIA.");
    } else {
      setMessage("signupMessage", "Inscription envoyée ! Ouvre ta boîte e-mail (et les indésirables) pour confirmer ton adresse, puis reconnecte-toi.");
      offerResend(email);
    }
  } catch (error) {
    console.error("OMEGIA signUp error:", error);
    fail(friendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = "S'inscrire";
  }
});

// ---------- Accès aux comptes e-mail existants (lien discret) ----------
$("showEmailLogin")?.addEventListener("click", () => {
  const form = $("loginForm");
  if (form) { form.hidden = false; form.style.display = ""; $("email")?.focus(); }
  $("showEmailLogin").style.display = "none";
});

// ---------- Inscription par empreinte / visage (sans e-mail) ----------
const bioDialog = $("bioSignupDialog");
function openBioSignup() {
  setMessage("bioSignupMessage", "");
  closeSignup();
  if (typeof bioDialog.showModal === "function") bioDialog.showModal();
  else bioDialog.setAttribute("open", "");
  $("bioFirstName").focus();
}
function closeBioSignup() {
  if (typeof bioDialog.close === "function") bioDialog.close();
  else bioDialog.removeAttribute("open");
}
if (bioDialog) {
  $("bioSignupOpen")?.addEventListener("click", openBioSignup);
  $("closeBioSignup")?.addEventListener("click", closeBioSignup);
  bioDialog.addEventListener("click", (event) => { if (event.target === bioDialog) closeBioSignup(); });
  $("bioBirthdate").max = new Date().toISOString().slice(0, 10);
  biometricSupported().then((ok) => {
    const open = $("bioSignupOpen");
    if (open && !ok) {
      open.disabled = true;
      open.textContent = "Empreinte non disponible sur cet appareil";
      setMessage("formMessage", "L’empreinte / le visage n’est pas disponible ici. Utilise « Créer un nouveau compte (e-mail) ».", true);
    }
  });

  $("bioSignupForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const firstName = $("bioFirstName").value.trim();
    const lastName = $("bioLastName").value.trim();
    const birthdate = $("bioBirthdate").value;
    const button = $("bioSignupBtn");
    const fail = (text) => {
      setMessage("bioSignupMessage", text, true);
      console.error("OMEGIA bio signup:", text);
    };

    if (!firstName || !lastName) { fail("Veuillez saisir votre prénom et votre nom."); return; }
    if (!birthdate) { fail("Veuillez saisir votre date de naissance."); return; }
    const age = ageFrom(birthdate);
    if (age === null || age < 0 || age > 120) { fail("Veuillez saisir une date de naissance valide."); return; }
    if (age < MIN_AGE) { fail("Vous devez avoir au moins " + MIN_AGE + " ans pour créer un compte."); return; }
    if ($("bioAgree") && !$("bioAgree").checked) { fail("Cochez la case pour confirmer que vous avez compris."); return; }

    const bioOk = await biometricSupported();
    if (!bioOk) {
      fail("Cet appareil ne propose pas l'empreinte ou le visage. Ferme cette fenêtre et utilise « Créer un nouveau compte (e-mail) ».");
      return;
    }

    button.disabled = true;
    button.textContent = "Création du compte…";
    setMessage("bioSignupMessage", "Validez avec votre empreinte ou votre visage…");
    try {
      const credentialId = await createBiometricCredential(firstName + " " + lastName);
      setMessage("bioSignupMessage", "Création de votre compte…");
      const client = await supabaseReady;
      const { data, error } = await client.auth.signInAnonymously({
        options: { data: { first_name: firstName, last_name: lastName, birthdate, signup_method: "biometric" } }
      });
      if (error) throw error;
      if (!data?.user) throw new Error("Compte non créé. Réessayez ou utilisez l’inscription par e-mail.");
      currentUser = data.user;
      writeBio({ userId: currentUser.id, credentialId });
      $("bioSignupForm").reset();
      closeBioSignup();
      render("member");
      alert("Bienvenue sur OMEGIA ! Complétez votre profil depuis l'onglet Profil.");
    } catch (error) {
      console.error("OMEGIA bio signup error:", error);
      let msg = friendlyError(error);
      if (/anonymous/i.test(error?.message || "")) {
        msg = "L’inscription par empreinte n’est pas activée sur le serveur. Utilise plutôt « Créer un nouveau compte (e-mail) ».";
      }
      fail(msg);
    } finally {
      button.disabled = false;
      button.textContent = "Continuer avec l'empreinte ou le visage";
    }
  });
}

// ---------- Récupération ----------
$("recoveryForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = $("newPassword").value;
  const button = $("recoveryBtn");
  if (password.length < 8) { setMessage("formMessage", "Le mot de passe doit contenir au moins 8 caractères.", true); return; }
  if (password !== $("newPasswordConfirm").value) { setMessage("formMessage", "Les deux mots de passe ne correspondent pas.", true); return; }

  button.disabled = true;
  button.textContent = "Enregistrement…";
  setMessage("formMessage", "Enregistrement du nouveau mot de passe…");
  try {
    const client = await supabaseReady;
    const { data, error } = await client.auth.updateUser({ password });
    if (error) throw error;
    currentUser = data.user;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    $("recoveryForm").reset();
    render("member");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Enregistrer le mot de passe";
  }
});

// ---------- Déconnexion ----------
async function signOut() {
  if (!confirm("Attention : la connexion par e-mail est désactivée. Si vous vous déconnectez, vous ne pourrez plus rouvrir ce compte. Continuer ?")) return;
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    writeBio(null);
    currentUser = null;
    $("sideMenu").hidden = true;
    render("guest");
    setMessage("formMessage", "Vous êtes déconnecté.");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
}
$("logoutBtn")?.addEventListener("click", signOut);
$("lockLogout")?.addEventListener("click", signOut);
$("sideLogout")?.addEventListener("click", signOut);

// Biométrie
$("bioToggle")?.addEventListener("click", async () => {
  const enabled = $("bioToggle").dataset.enabled === "true";
  try {
    if (enabled) {
      writeBio(null);
      alert("Le déverrouillage par empreinte ou visage est désactivé sur cet appareil.");
    } else {
      await enableBiometric();
      alert("C'est activé : à la prochaine ouverture, OMEGIA se déverrouillera avec votre empreinte ou votre visage.");
    }
  } catch (error) {
    alert(friendlyError(error));
  }
  refreshBioButton();
});

$("unlockBtn").addEventListener("click", async () => {
  try {
    await verifyBiometric();
    render("member");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
});

// Setup
$("year").textContent = new Date().getFullYear();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("OMEGIA / Service Worker :", error);
    });
  });
}

// Installation PWA : conserver l'invite native jusqu'au clic de l'utilisateur.
let deferredInstall = null;
const installButton = $("installBtn");
const sideInstallButton = $("sideInstall");

function isAppInstalled() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

function updateInstallVisibility() {
  if (isAppInstalled()) {
    if (installButton) installButton.hidden = true;
    if (sideInstallButton) sideInstallButton.hidden = true;
  } else if (deferredInstall && installButton) {
    installButton.hidden = false;
  }
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  updateInstallVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredInstall = null;
  if (installButton) installButton.hidden = true;
  if (sideInstallButton) sideInstallButton.hidden = true;
  alert("OMEGIA est installée sur votre appareil. 🎉");
});

async function installOMEGIA() {
  if (isAppInstalled()) {
    alert("OMEGIA est déjà installée sur cet appareil.");
    return;
  }

  if (deferredInstall) {
    try {
      deferredInstall.prompt();
      const choice = await deferredInstall.userChoice;
      deferredInstall = null;
      if (installButton) installButton.hidden = true;
      if (choice && choice.outcome === "accepted") {
        alert("Installation acceptée. Suivez les dernières étapes affichées par votre téléphone.");
      }
    } catch (error) {
      console.error("OMEGIA / Installation :", error);
      alert("L'installation n'a pas pu démarrer. Ouvrez le menu de Chrome puis choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».");
    }
    return;
  }

  alert("OMEGIA n'est pas encore proposée à l'installation par ce navigateur. Sur Android, ouvrez cette page dans Chrome, vérifiez que vous êtes connecté à Internet, puis ouvrez le menu ⋮ et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ». Si cette option n'apparaît pas, actualisez la page et réessayez.");
}

installButton?.addEventListener("click", installOMEGIA);
sideInstallButton?.addEventListener("click", () => {
  $("sideMenu").hidden = true;
  installOMEGIA();
});
updateInstallVisibility();

if (startsInRecovery) render("recovery");
if (linkHadError) {
  setMessage("formMessage", "Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ? ».", true);
}

supabaseReady.then(async (client) => {
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") render("recovery");
    if (event === "SIGNED_OUT") { currentUser = null; render("guest"); }
  });
  if (startsInRecovery) return;
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    currentUser = session.user;
    if (biometricEnabledFor(currentUser) && await biometricSupported()) {
      render("locked");
      return;
    }
    if (readBio() && !biometricEnabledFor(currentUser)) writeBio(null);
    render("member");
  }
}).catch((error) => {
  console.error("OMEGIA / Supabase:", error);
  setMessage("formMessage", "Le service de connexion ne se charge pas. Vérifiez votre connexion Internet puis actualisez la page.", true);
});
