// OMEGIA — Supabase authentication
const $ = (id) => document.getElementById(id);
let mode = "login";
const loginTab = $("loginTab"), signupTab = $("signupTab");
const SUPABASE_URL = "https://nyiievcbciqxvxmerwdm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4ZW9RA9gktscWSW2tuEttw_yRNdnduw";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function setMessage(message, isError = false) {
  const el = $("formMessage");
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
  return msg || "Une erreur est survenue. Réessayez.";
}

function submitLabel() {
  if (mode === "signup") return "Créer mon compte <span>→</span>";
  if (mode === "recovery") return "Enregistrer le mot de passe <span>→</span>";
  return "Se connecter <span>→</span>";
}

function setSignedIn(signedIn) {
  $("logoutBtn").hidden = !signedIn;
}

function setMode(next) {
  mode = next;
  const signup = mode === "signup";
  const recovery = mode === "recovery";
  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  loginTab.setAttribute("aria-selected", String(!signup));
  signupTab.setAttribute("aria-selected", String(signup));
  $("tabs").hidden = recovery;
  $("emailWrap").hidden = recovery;
  $("forgotLink").hidden = recovery;
  $("authTitle").textContent = recovery ? "Nouveau mot de passe" : signup ? "Rejoignez OMEGIA" : "Bienvenue sur OMEGIA";
  $("authSubtitle").textContent = recovery
    ? "Choisissez un nouveau mot de passe pour retrouver l'accès à votre compte."
    : signup
      ? "Créez votre compte pour rejoindre la communauté."
      : "Connectez-vous pour retrouver votre communauté.";
  $("submitBtn").innerHTML = submitLabel();
  $("confirmWrap").hidden = !(signup || recovery);
  $("password").autocomplete = signup || recovery ? "new-password" : "current-password";
  setMessage("");
}
loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const recovery = mode === "recovery";
  const email = $("email").value.trim();
  const password = $("password").value;
  const button = $("submitBtn");

  if (!recovery && !EMAIL_RE.test(email)) {
    setMessage("Veuillez saisir une adresse e-mail valide.", true); return;
  }
  if (password.length < 8) {
    setMessage("Le mot de passe doit contenir au moins 8 caractères.", true); return;
  }
  if (mode !== "login" && password !== $("confirmPassword").value) {
    setMessage("Les deux mots de passe ne correspondent pas.", true); return;
  }

  button.disabled = true;
  button.textContent = recovery ? "Enregistrement…" : mode === "signup" ? "Création du compte…" : "Connexion…";
  setMessage(recovery ? "Enregistrement du nouveau mot de passe…" : "Connexion sécurisée à Supabase…");

  try {
    const client = await supabaseReady;
    if (mode === "signup") {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      // With e-mail confirmation on, Supabase hides existing accounts by returning no identities.
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new Error("User already registered");
      }
      if (data.session) {
        setSignedIn(true);
        setMessage("Compte créé et connecté ! L'espace membre OMEGIA sera disponible dans une prochaine étape.");
      } else {
        setMessage("Inscription envoyée ! Consultez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
      }
    } else if (recovery) {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      history.replaceState(null, "", window.location.pathname + window.location.search);
      $("password").value = "";
      $("confirmPassword").value = "";
      setMode("login");
      setSignedIn(true);
      setMessage("Mot de passe mis à jour. Vous êtes connecté à OMEGIA.");
    } else {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setSignedIn(true);
      setMessage("Connexion réussie ! Votre session est active. L'espace membre OMEGIA sera disponible dans une prochaine étape.");
    }
  } catch (error) {
    setMessage(friendlyError(error), true);
  } finally {
    button.disabled = false;
    $("submitBtn").innerHTML = submitLabel();
  }
});

$("forgotLink").addEventListener("click", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  if (!EMAIL_RE.test(email)) {
    setMessage("Saisissez d'abord votre adresse e-mail pour recevoir le lien de récupération.", true);
    $("email").focus();
    return;
  }
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    if (error) throw error;
    setMessage("Si un compte existe pour cette adresse, un e-mail de récupération vient d'être envoyé. Vérifiez aussi vos courriers indésirables.");
  } catch (error) {
    setMessage(friendlyError(error), true);
  }
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    setSignedIn(false);
    setMessage("Vous êtes déconnecté.");
  } catch (error) {
    setMessage(friendlyError(error), true);
  }
});

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
if (startsInRecovery) setMode("recovery");
if (linkHadError) {
  setMessage("Ce lien est invalide ou a expiré. Demandez un nouveau lien depuis « Mot de passe oublié ? ».", true);
}

// Restore the Supabase session when a member reopens the app.
supabaseReady.then(async (client) => {
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") setMode("recovery");
    if (event === "SIGNED_OUT") setSignedIn(false);
  });
  if (startsInRecovery) return;
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    setSignedIn(true);
    setMessage("Vous êtes déjà connecté à OMEGIA avec " + session.user.email + ". L'espace membre sera disponible dans une prochaine étape.");
  }
}).catch((error) => {
  console.error("OMEGIA / Supabase:", error);
  setMessage("Le service de connexion ne se charge pas. Vérifiez votre connexion Internet puis actualisez la page.", true);
});
