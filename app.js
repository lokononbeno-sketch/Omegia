// OMEGIA — login page: sign in, sign-up dialog, password recovery, fingerprint/face unlock.
// Shared helpers (supabaseReady, friendlyError, biometric functions) live in shared.js.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_AGE = 13;

// Read the link information now: Supabase removes it from the URL once loaded.
const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
const startsInRecovery = hashParams.get("type") === "recovery";
const linkHadError = hashParams.has("error");

function setMessage(id, message, isError = false) {
  const el = $(id);
  el.textContent = message;
  el.dataset.state = isError ? "error" : "success";
}

// Signed in: remember the unlock for this tab and open the news feed.
function enter() {
  markUnlocked();
  location.replace("home.html");
}

// One screen state at a time: "guest" (login), "recovery" (new password) or "locked"
// (signed in, waiting for fingerprint/face).
function render(state) {
  $("guestArea").hidden = state !== "guest";
  $("recoveryForm").hidden = state !== "recovery";
  $("lockArea").hidden = state !== "locked";
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
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setMessage("formMessage", "Connexion réussie. Ouverture de votre espace…");
    enter();
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
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
      closeSignup();
      enter();
      return;
    }
    setMessage("signupMessage", "Inscription envoyée ! Consultez votre boîte e-mail pour confirmer votre adresse avant de vous connecter.");
  } catch (error) {
    fail(friendlyError(error));
  }
  button.disabled = false;
  button.textContent = "S'inscrire";
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
    const { error } = await client.auth.updateUser({ password });
    if (error) throw error;
    history.replaceState(null, "", window.location.pathname + window.location.search);
    setMessage("formMessage", "Mot de passe mis à jour. Ouverture de votre espace…");
    enter();
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
    button.disabled = false;
    button.textContent = "Enregistrer le mot de passe";
  }
});

// ----- Locked screen (fingerprint / face) -----
$("unlockBtn").addEventListener("click", async () => {
  try {
    await verifyBiometric();
    enter();
  } catch (error) {
    setMessage("formMessage", friendlyError(error), true);
  }
});

$("lockLogout").addEventListener("click", async () => {
  try {
    const client = await supabaseReady;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    writeBio(null);
    clearUnlocked();
    render("guest");
    setMessage("formMessage", "Vous êtes déconnecté.");
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

// A returning member goes straight to the feed, or to the lock screen if fingerprint/face is on.
supabaseReady.then(async (client) => {
  client.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") render("recovery");
    if (event === "SIGNED_OUT") render("guest");
  });
  if (startsInRecovery) return;
  const { data: { session } } = await client.auth.getSession();
  if (!session) return;
  if (biometricEnabledFor(session.user) && !isUnlocked() && await biometricSupported()) {
    render("locked");
    return;
  }
  enter();
}).catch((error) => {
  console.error("OMEGIA / Supabase:", error);
  setMessage("formMessage", "Le service de connexion ne se charge pas. Vérifiez votre connexion Internet puis actualisez la page.", true);
});
