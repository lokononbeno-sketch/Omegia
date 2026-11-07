// OMEGIA — Supabase authentication (login, sign-up dialog, password recovery)
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

// The signed-in Supabase user (null when nobody is signed in).
let currentUser = null;

// One screen state at a time: "guest" (login), "recovery" (new password),
// "locked" (signed in, waiting for fingerprint/face) or "member" (signed in).
function render(state) {
  $("guestArea").hidden = state !== "guest";
  $("recoveryForm").hidden = state !== "recovery";
  $("lockArea").hidden = state !== "locked";
  $("memberArea").hidden = state !== "member";
  if (state === "member") refreshBioButton();
}

// ----- Fingerprint / face unlock -----
// Uses the device's own biometric check (WebAuthn, platform authenticator). It is an app lock
// on this device: the real sign-in is still done by Supabase with e-mail and password.
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
  if (!(await biometricSupported())) { button.hidden = true; return; }
  const enabled = biometricEnabledFor(currentUser);
  button.hidden = false;
  button.dataset.enabled = String(enabled);
  button.textContent = enabled ? "Désactiver l'empreinte ou le visage" : "Activer l'empreinte ou le visage";
  button.className = enabled ? "link-button" : "create-button";
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

// ----- Login -----
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
    setMessage("formMessage", "Connexion réussie ! Votre session est active. L'espace membre OMEGIA sera disponible dans une prochaine étape.");
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

// ----- Sign-up dialog -----
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
    // With e-mail confirmation on, Supabase hides existing accounts by returning no identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      throw new Error("User already registered");
    }
    $("signupForm").reset();
    if (data.session) {
      currentUser = data.user;
      closeSignup();
      render("member");
      setMessage("formMessage", "Compte créé et connecté ! L'espace membre OMEGIA sera disponible dans une prochaine étape.");
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

// ----- Password recovery (after clicking the link in the e-mail) -----
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
    setMessage("formMessage", "Mot de passe mis à jour. Vous êtes connecté à OMEGIA.");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  } finally {
    button.disabled = false;
    button.textContent = "Enregistrer le mot de passe";
  }
});

// ----- Sign out -----
async function signOut() {
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    writeBio(null);
    currentUser = null;
    render("guest");
    setMessage("formMessage", "Vous êtes déconnecté.");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
}
$("logoutBtn").addEventListener("click", signOut);
$("lockLogout").addEventListener("click", signOut);

// ----- Fingerprint / face buttons -----
$("bioToggle").addEventListener("click", async () => {
  const enabled = $("bioToggle").dataset.enabled === "true";
  try {
    if (enabled) {
      writeBio(null);
      setMessage("formMessage", "Le déverrouillage par empreinte ou visage est désactivé sur cet appareil.");
    } else {
      await enableBiometric();
      setMessage("formMessage", "C'est activé : à la prochaine ouverture, OMEGIA se déverrouillera avec votre empreinte ou votre visage.");
    }
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
  refreshBioButton();
});

$("unlockBtn").addEventListener("click", async () => {
  try {
    await verifyBiometric();
    render("member");
    setMessage("formMessage", "Déverrouillé. Vous êtes connecté à OMEGIA avec " + currentUser.email + ".");
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
});

// ----- Page setup -----
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

// Opened from a password-recovery e-mail: show the "new password" form right away.
if (startsInRecovery) render("recovery");
if (linkHadError) {
  setMessage("formMessage", "Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ? ».", true);
}

// Restore the Supabase session when a member reopens the app.
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
    setMessage("formMessage", "Vous êtes déjà connecté à OMEGIA avec " + session.user.email + ". L'espace membre sera disponible dans une prochaine étape.");
  }
}).catch((error) => {
  console.error("OMEGIA / Supabase:", error);
  setMessage("formMessage", "Le service de connexion ne se charge pas. Vérifiez votre connexion Internet puis actualisez la page.", true);
});
