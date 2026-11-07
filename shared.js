// OMEGIA — code shared by the login page (app.js) and the news feed (home.js)
const $ = (id) => document.getElementById(id);
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
  if (/row-level security|violates|permission denied/i.test(msg)) return "Action refusée : vous n'avez pas le droit de faire cela.";
  if (/failed to fetch|network/i.test(msg)) return "Connexion impossible. Vérifiez votre connexion Internet.";
  if (error && (error.name === "NotAllowedError" || error.name === "AbortError")) return "Vérification annulée ou refusée par l'appareil.";
  return msg || "Une erreur est survenue. Réessayez.";
}

// ----- Fingerprint / face unlock -----
// Uses the device's own biometric check (WebAuthn, platform authenticator). It is an app lock
// on this device: the real sign-in is still done by Supabase with e-mail and password.
const BIO_KEY = "omegia.biometric";
const UNLOCK_KEY = "omegia.unlocked";
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
// "Unlocked" is remembered for this browser tab only, so a new tab asks again.
function markUnlocked() {
  try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch { /* storage unavailable */ }
}
function isUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
}
function clearUnlocked() {
  try { sessionStorage.removeItem(UNLOCK_KEY); } catch { /* storage unavailable */ }
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
async function enableBiometric(user) {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "OMEGIA" },
      user: { id: new TextEncoder().encode(user.id), name: user.email, displayName: user.email },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      attestation: "none",
      timeout: 60000
    }
  });
  writeBio({ userId: user.id, credentialId: b64u.enc(credential.rawId) });
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
