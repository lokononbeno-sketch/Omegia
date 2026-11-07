// OMEGIA — Supabase authentication
const $ = (id) => document.getElementById(id);
let mode = "login";
const loginTab = $("loginTab"), signupTab = $("signupTab");
const SUPABASE_URL = "https://nyiievcbciqxvxmerwdm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_4ZW9RA9gktscWSW2tuEttw_yRNdnduw";

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

function setMode(next) {
  mode = next;
  const signup = mode === "signup";
  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  loginTab.setAttribute("aria-selected", String(!signup));
  signupTab.setAttribute("aria-selected", String(signup));
  $("authTitle").textContent = signup ? "Rejoignez OMEGIA" : "Bienvenue sur OMEGIA";
  $("authSubtitle").textContent = signup
    ? "Créez votre compte pour rejoindre la communauté."
    : "Connectez-vous pour retrouver votre communauté.";
  $("submitBtn").innerHTML = signup ? "Créer mon compte <span>→</span>" : "Se connecter <span>→</span>";
  $("confirmWrap").hidden = !signup;
  $("password").autocomplete = signup ? "new-password" : "current-password";
  setMessage("");
}
loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));

$("authForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  const button = $("submitBtn");

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setMessage("Veuillez saisir une adresse e-mail valide.", true); return;
  }
  if (password.length < 8) {
    setMessage("Le mot de passe doit contenir au moins 8 caractères.", true); return;
  }
  if (mode === "signup" && password !== $("confirmPassword").value) {
    setMessage("Les deux mots de passe ne correspondent pas.", true); return;
  }

  button.disabled = true;
  button.textContent = mode === "signup" ? "Création du compte…" : "Connexion…";
  setMessage("Connexion sécurisée à Supabase…");

  try {
    const client = await supabaseReady;
    if (mode === "signup") {
      const { data, error } = await client.auth.signUp({ email, password });
      if (error) throw error;
      if (data.session) {
        setMessage("Compte créé et connecté ! L'espace membre OMEGIA sera disponible dans une prochaine étape.");
      } else {
        setMessage("Inscription envoyée ! Consultez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
      }
    } else {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      setMessage("Connexion réussie ! Votre session est active. L'espace membre OMEGIA sera disponible dans une prochaine étape.");
    }
  } catch (error) {
    const known = {
      "Invalid login credentials": "Adresse e-mail ou mot de passe incorrect.",
      "Email not confirmed": "Veuillez d'abord confirmer votre adresse e-mail depuis le message envoyé par Supabase.",
      "User already registered": "Cette adresse e-mail possède déjà un compte. Essayez de vous connecter."
    };
    setMessage(known[error.message] || error.message || "Une erreur est survenue. Réessayez.", true);
  } finally {
    button.disabled = false;
    $("submitBtn").innerHTML = mode === "signup" ? "Créer mon compte <span>→</span>" : "Se connecter <span>→</span>";
  }
});

$("forgotLink").addEventListener("click", async (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
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
    setMessage(error.message || "Impossible d'envoyer le lien de récupération.", true);
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

// Restore the Supabase session when a member reopens the app.
supabaseReady.then(async (client) => {
  const { data: { session } } = await client.auth.getSession();
  if (session) {
    setMessage("Vous êtes déjà connecté à OMEGIA avec " + session.user.email + ". L'espace membre sera disponible dans une prochaine étape.");
  }
}).catch((error) => {
  console.error("OMEGIA / Supabase:", error);
  setMessage("Le service de connexion ne se charge pas. Vérifiez votre connexion Internet puis actualisez la page.", true);
});
