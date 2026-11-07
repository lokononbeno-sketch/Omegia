// OMEGIA — Authentification Supabase + Espace membre (shell Facebook + WhatsApp)
const $ = (id) => document.getElementById(id);
const SUPABASE_URL = "https://nyiievcbciqxvxmerwdm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4ZW9RA9gktscWSW2tuEttw_yRNdnduw";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_AGE = 13;

// Read the link information now: Supabase removes it from the URL once loaded.
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
  if (!el) return;
  el.textContent = message;
  el.dataset.state = isError ? "error" : "success";
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
  if (/signups? (not allowed|(is|are) disabled)/i.test(msg)) return "Les inscriptions sont momentanément fermées.";
  if (/different from the old password/i.test(msg)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/password should be|weak password/i.test(msg)) return "Mot de passe trop faible. Utilisez au moins 8 caractères variés.";
  if (/session missing/i.test(msg)) return "Le lien de récupération a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ? ».";
  if (/failed to fetch|network/i.test(msg)) return "Connexion impossible. Vérifiez votre connexion Internet.";
  if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) return "Vérification annulée ou refusée par l'appareil.";
  return msg || "Une erreur est survenue. Réessayez.";
}

let currentUser = null;

// États possibles : guest | recovery | locked | member
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

// ---------- Navigation entre vues ----------
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => {
    v.hidden = v.dataset.view !== name;
  });
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.nav === name);
  });
  // Scroll en haut à chaque changement de vue
  const main = $("appMain");
  if (main) main.scrollTop = 0;
}

document.querySelectorAll("[data-nav]").forEach((btn) => {
  btn.addEventListener("click", () => showView(btn.dataset.nav));
});

// Composer → vue Créer
$("openComposer")?.addEventListener("click", () => showView("create"));
$("myStatusCard")?.addEventListener("click", () => {
  // Pour l’instant on ouvre aussi la vue créer (statut = future évolution)
  showView("create");
  setMessage("formMessage", ""); // no-op, just placeholder
  alert("Publication de statut : bientôt disponible.\nTu pourras partager texte, photo ou vidéo qui disparaît après 24 h.");
});

// ---------- Profil / données utilisateur ----------
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

  if ($("homeFirstName")) $("homeFirstName").textContent = first;
  if ($("homeAvatar")) $("homeAvatar").textContent = initials;
  if ($("profileName")) $("profileName").textContent = name;
  if ($("profileAvatar")) $("profileAvatar").textContent = initials;
  if ($("profileEmail")) $("profileEmail").textContent = currentUser.email || "—";

  // Date d’inscription approximative
  if ($("profileSince") && currentUser.created_at) {
    try {
      const d = new Date(currentUser.created_at);
      $("profileSince").textContent = d.toLocaleDateString("fr-FR", { year: "numeric", month: "long" });
    } catch {
      $("profileSince").textContent = "—";
    }
  }

  // Bio / lieu (placeholders pour l’instant)
  const meta = currentUser.user_metadata || {};
  if ($("profileBio")) {
    $("profileBio").textContent = meta.bio || "Ajoute une bio pour te présenter";
  }
  if ($("profileLocation")) {
    $("profileLocation").textContent = meta.location ? "📍 " + meta.location : "📍 Lieu non renseigné";
  }
}

// Boutons paramètres (placeholders)
document.querySelectorAll("[data-setting]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const map = {
      privacy: "Confidentialité et sécurité — bientôt configurable",
      notifications: "Notifications — bientôt configurable",
      account: "Paramètres du compte — bientôt disponible",
      help: "Aide et support — contacte l’équipe OMEGIA"
    };
    alert(map[btn.dataset.setting] || "Bientôt disponible");
  });
});

$("editProfileBtn")?.addEventListener("click", () => {
  alert("Modification du profil (photo, bio, lieu…) arrivera bientôt.\nPour l’instant les infos viennent de ton compte Supabase.");
});

$("newChatBtn")?.addEventListener("click", () => {
  alert("Nouvelle conversation — la messagerie complète (texte, photos, notes vocales, appels) arrive bientôt.");
});

$("searchBtn")?.addEventListener("click", () => {
  alert("Recherche de personnes, publications et conversations — bientôt disponible.");
});

$("notifBtn")?.addEventListener("click", () => {
  alert("Centre de notifications (messages, invitations, mentions…) — bientôt disponible.");
});

// Menu latéral
$("menuBtn")?.addEventListener("click", () => {
  $("sideMenu").hidden = false;
});
$("sideMenuClose")?.addEventListener("click", () => {
  $("sideMenu").hidden = true;
});
document.querySelectorAll("[data-goto]").forEach((btn) => {
  btn.addEventListener("click", () => {
    $("sideMenu").hidden = true;
    showView(btn.dataset.goto);
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
  try { if (value) localStorage.setItem(BIO_KEY, JSON.stringify(value)); else localStorage.removeItem(BIO_KEY); } catch { /* storage unavailable */ }
}
async function biometricSupported() {
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
  const button = $("bioToggle");
  if (!button) return;
  if (!(await biometricSupported())) { button.hidden = true; return; }
  const enabled = biometricEnabledFor(currentUser);
  button.hidden = false;
  button.dataset.enabled = String(enabled);
  button.textContent = enabled ? "Désactiver l'empreinte ou le visage" : "Activer l'empreinte ou le visage";
  button.className = enabled ? "link-button" : "create-button small";
}
async function enableBiometric() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "OMEGIA" },
      user: { id: new TextEncoder().encode(currentUser.id), name: currentUser.email, displayName: currentUser.email },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000
    }
  });
  writeBio({ userId: currentUser.id, credentialId: b64u.enc(credential.rawId) });
}
async function verifyBiometric() {
  const bio = readBio();
  if (!bio) throw new Error("Le déverrouillage biométrique n'est pas activé.");
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
      redirectTo: window.location.origin + window.location.pathname
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
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  const button = $("signupBtn");
  const fail = (text) => setMessage("signupMessage", text, true);

  if (!firstName || !lastName) { fail("Veuillez saisir votre prénom et votre nom."); return; }
  const age = birthdate ? ageFrom(birthdate) : null;
  if (age === null || age < 0 || age > 120) { fail("Veuillez saisir une date de naissance valide."); return; }
  if (age < MIN_AGE) { fail("Vous devez avoir au moins " + MIN_AGE + " ans pour créer un compte."); return; }
  if (!EMAIL_RE.test(email)) { fail("Veuillez saisir une adresse e-mail valide."); return; }
  if (password.length < 8) { fail("Le mot de passe doit contenir au moins 8 caractères."); return; }
  if (password !== $("signupConfirm").value) { fail("Les deux mots de passe ne correspondent pas."); return; }

  button.disabled = true;
  button.textContent = "Création du compte…";
  setMessage("signupMessage", "Connexion sécurisée à Supabase…");
  try {
    const client = await supabaseReady;
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName, birthdate },
        emailRedirectTo: window.location.origin + window.location.pathname
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
    } else {
      setMessage("signupMessage", "Inscription envoyée ! Consultez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
    }
  } catch (error) {
    fail(friendlyError(error));
  } finally {
    button.disabled = false;
    button.textContent = "S'inscrire";
  }
});

// ---------- Récupération mot de passe ----------
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

// ---------- Biométrie boutons ----------
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

// ---------- Setup page ----------
$("year").textContent = new Date().getFullYear();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}

let deferredInstall;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstall = event;
  $("installBtn").hidden = false;
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $("installBtn").hidden = true;
});

if (startsInRecovery) render("recovery");
if (linkHadError) {
  setMessage("formMessage", "Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ? ».", true);
}

// Restauration de session
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
