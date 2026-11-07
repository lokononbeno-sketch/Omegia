const $ = (id) => document.getElementById(id);
let mode = "login";
const loginTab = $("loginTab"), signupTab = $("signupTab");
function setMode(next){
  mode = next;
  const signup = mode === "signup";
  loginTab.classList.toggle("active", !signup);
  signupTab.classList.toggle("active", signup);
  loginTab.setAttribute("aria-selected", String(!signup));
  signupTab.setAttribute("aria-selected", String(signup));
  $("authTitle").textContent = signup ? "Rejoignez OMEGIA" : "Bienvenue sur OMEGIA";
  $("authSubtitle").textContent = signup ? "Créez votre compte pour rejoindre la communauté." : "Connectez-vous pour retrouver votre communauté.";
  $("submitBtn").innerHTML = signup ? "Créer mon compte <span>→</span>" : "Se connecter <span>→</span>";
  $("confirmWrap").hidden = !signup;
  $("password").autocomplete = signup ? "new-password" : "current-password";
  $("formMessage").textContent = "";
}
loginTab.addEventListener("click", () => setMode("login"));
signupTab.addEventListener("click", () => setMode("signup"));
$("authForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const email = $("email").value.trim();
  const password = $("password").value;
  const message = $("formMessage");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { message.textContent = "Veuillez saisir une adresse e-mail valide."; return; }
  if (password.length < 8) { message.textContent = "Le mot de passe doit contenir au moins 8 caractères."; return; }
  if (mode === "signup" && password !== $("confirmPassword").value) { message.textContent = "Les deux mots de passe ne correspondent pas."; return; }
  message.textContent = "L’interface est prête. L’inscription et la connexion seront activées après la mise en place du serveur sécurisé. Aucun mot de passe n’a été enregistré.";
});
$("forgotLink").addEventListener("click", (event) => {
  event.preventDefault();
  $("formMessage").textContent = "La récupération du compte sera activée avec le service d’authentification sécurisé.";
});
$("year").textContent = new Date().getFullYear();
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
let deferredInstall;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault(); deferredInstall = event; $("installBtn").hidden = false;
});
$("installBtn").addEventListener("click", async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; $("installBtn").hidden = true;
});
