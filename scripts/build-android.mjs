import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const webDir = path.join(root, "www");
fs.rmSync(webDir, { recursive: true, force: true });
fs.mkdirSync(webDir, { recursive: true });

for (const file of ["index.html", "app.js", "social.js", "styles.css", "manifest.webmanifest", "sw.js", "update.js", "version.json", "features.js"]) {
  fs.copyFileSync(path.join(root, file), path.join(webDir, file));
}
if (fs.existsSync(path.join(root, "assets"))) {
  fs.cpSync(path.join(root, "assets"), path.join(webDir, "assets"), { recursive: true });
}

execFileSync("npx", ["cap", "add", "android"], { stdio: "inherit" });
execFileSync("npx", ["cap", "sync", "android"], { stdio: "inherit" });

const res = path.join(root, "android/app/src/main/res");
const iconSvg = path.join(root, "assets/omega.svg");
const legacy = {
  "mipmap-mdpi": 48,
  "mipmap-hdpi": 72,
  "mipmap-xhdpi": 96,
  "mipmap-xxhdpi": 144,
  "mipmap-xxxhdpi": 192
};
for (const [folder, size] of Object.entries(legacy)) {
  const dir = path.join(res, folder);
  fs.mkdirSync(dir, { recursive: true });
  for (const name of ["ic_launcher.png", "ic_launcher_round.png", "ic_launcher_foreground.png"]) {
    await sharp(iconSvg).resize(size, size).png().toFile(path.join(dir, name));
  }
}
const anydpi = path.join(res, "mipmap-anydpi-v26");
if (fs.existsSync(anydpi)) {
  for (const name of ["ic_launcher.xml", "ic_launcher_round.xml"]) {
    const file = path.join(anydpi, name);
    if (fs.existsSync(file)) fs.rmSync(file);
  }
}

const gradleFile = path.join(root, "android/app/build.gradle");
if (fs.existsSync(gradleFile)) {
  let gradle = fs.readFileSync(gradleFile, "utf8");
  gradle = gradle.replace(/versionCode\s+1\b/, "versionCode 4");
  gradle = gradle.replace(/versionName\s+"[^"]+"/, 'versionName "1.0.3"');
  fs.writeFileSync(gradleFile, gradle);
}

// Autorisations nécessaires aux appels, notes vocales et caméra dans la WebView Android.
const manifestFile = path.join(root, "android/app/src/main/AndroidManifest.xml");
if (fs.existsSync(manifestFile)) {
  let manifest = fs.readFileSync(manifestFile, "utf8");
  const perms = ["android.permission.RECORD_AUDIO", "android.permission.CAMERA", "android.permission.MODIFY_AUDIO_SETTINGS"];
  const add = perms.filter((p) => !manifest.includes(p)).map((p) => `    <uses-permission android:name="${p}" />`).join("\n");
  if (add) manifest = manifest.replace("</manifest>", add + "\n</manifest>");
  fs.writeFileSync(manifestFile, manifest);
}

// Signature fixe de l'APK : active seulement si les variables GitLab ANDROID_KEYSTORE_* sont définies.
// Sans elle, chaque build est signé avec une clé aléatoire et Android refuse la mise à jour par-dessus l'APK installé.
if (process.env.ANDROID_KEYSTORE_BASE64 && fs.existsSync(gradleFile)) {
  fs.writeFileSync(path.join(root, "android/omegia.keystore"), Buffer.from(process.env.ANDROID_KEYSTORE_BASE64, "base64"));
  let signedGradle = fs.readFileSync(gradleFile, "utf8");
  if (!signedGradle.includes("signingConfigs.omegia")) {
    signedGradle = signedGradle.replace(/android\s*\{/, `android {\n    signingConfigs {\n        omegia {\n            storeFile file("../omegia.keystore")\n            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")\n            keyAlias System.getenv("ANDROID_KEY_ALIAS")\n            keyPassword System.getenv("ANDROID_KEYSTORE_PASSWORD")\n        }\n    }`);
    signedGradle = signedGradle.replace(/buildTypes\s*\{/, `buildTypes {\n        debug {\n            signingConfig signingConfigs.omegia\n        }`);
    fs.writeFileSync(gradleFile, signedGradle);
  }
