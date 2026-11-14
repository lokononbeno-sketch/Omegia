/* OMEGIA — Actualités sur l'accueil + connexion Facebook
   - Les actualités viennent de flux RSS publics (titre, image, résumé court + lien vers l'article d'origine).
   - Rien ici ne touche au fil des publications (#feed) : les actualités ont leur propre bloc au-dessus. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ================= ACTUALITÉS ================= */
  const RSS2JSON = "https://api.rss2json.com/v1/api.json?rss_url=";
  const TTL = 20 * 60 * 1000; // on réutilise les actualités pendant 20 minutes
  const CACHE_KEY = "omegia.news.v1";
  const PAGE = 8;
  // Pour ajouter une source : une ligne ["Nom affiché", "adresse du flux RSS"] dans la bonne catégorie.
  const CATS = [
    { id: "monde", label: "🌐 Monde", feeds: [["France 24", "https://www.france24.com/fr/rss"], ["Le Monde", "https://www.lemonde.fr/rss/une.xml"]] },
    { id: "afrique", label: "🌍 Afrique", feeds: [["RFI Afrique", "https://www.rfi.fr/fr/afrique/rss"], ["France 24 Afrique", "https://www.france24.com/fr/afrique/rss"]] },
    { id: "benin", label: "🇧🇯 Bénin", feeds: [["Benin Web TV", "https://beninwebtv.com/feed/"], ["RFI Afrique", "https://www.rfi.fr/fr/afrique/rss"]] },
    { id: "tech", label: "💻 Tech", feeds: [["Numerama", "https://www.numerama.com/feed/"], ["Frandroid", "https://www.frandroid.com/feed"]] },
    { id: "science", label: "🔬 Découvertes", feeds: [["Futura Sciences", "https://www.futura-sciences.com/rss/actualites.xml"], ["Sciences et Avenir", "https://www.sciencesetavenir.fr/rss.xml"]] }
  ];

  const css = ".omn{margin:12px 0}.omn-head{display:flex;align-items:center;justify-content:space-between;margin:4px 2px 8px}.omn-head h3{margin:0;font-size:18px}.omn-head button{border:0;border-radius:999px;padding:8px 12px;background:#eee9f7;color:#392b55;font-weight:650}" +
    ".omn-tabs{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;scrollbar-width:none}.omn-tabs::-webkit-scrollbar{display:none}" +
    ".omn-tab{flex:0 0 auto;border:0;border-radius:999px;padding:9px 14px;background:#eee9f7;color:#392b55;font-weight:650;white-space:nowrap}.omn-tab.on{background:#7652d6;color:#fff}" +
    ".omn-card{display:block;background:#fff;color:#211d2b;border-radius:16px;overflow:hidden;margin:10px 0;box-shadow:0 3px 16px #0000000b;text-decoration:none}" +
    ".omn-img{display:block;width:100%;max-height:200px;object-fit:cover;background:#eee6ff}.omn-body{padding:12px 14px 14px}" +
    ".omn-title{font-weight:700;font-size:16px;line-height:1.3;margin:0 0 6px}.omn-desc{font-size:14px;line-height:1.45;margin:0 0 8px;color:#4a4357}" +
    ".omn-meta{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;color:#81788f}.omn-meta b{color:#7652d6}" +
    ".omn-state{text-align:center;padding:18px 10px;color:#81788f;font-size:14px}.omn-more{display:block;margin:6px auto 2px;border:0;border-radius:12px;padding:11px 18px;background:#7652d6;color:#fff;font-weight:650}";
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  const readCache = () => { try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}"); } catch (_) { return {}; } };
  const writeCache = (c) => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)); } catch (_) {} };
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch (_) { return ""; } };
  const plain = (html) => { try { return (new DOMParser().parseFromString(String(html || ""), "text/html").body.textContent || "").replace(/\s+/g, " ").trim(); } catch (_) { return ""; } };
  const parseDate = (s) => { if (!s) return 0; const t = Date.parse(String(s).replace(" ", "T") + "Z"); return isNaN(t) ? 0 : t; };
  function ago(t) {
    if (!t) return "";
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return "à l’instant";
    if (m < 60) return "il y a " + m + " min";
    const h = Math.round(m / 60);
    if (h < 24) return "il y a " + h + " h";
    const d = Math.round(h / 24);
    return d < 8 ? "il y a " + d + " j" : new Date(t).toLocaleDateString("fr-FR");
  }

  async function fetchFeed(name, url) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(RSS2JSON + encodeURIComponent(url), { signal: ctl.signal });
      if (!r.ok) return [];
      const j = await r.json();
      if (j.status !== "ok" || !Array.isArray(j.items)) return [];
      return j.items.map((it) => {
        let img = it.thumbnail || "";
        if (!img && it.enclosure && /image/.test(it.enclosure.type || "")) img = it.enclosure.link || "";
        return { title: plain(it.title), desc: plain(it.description || it.content).slice(0, 160), link: safeUrl(it.link), img: safeUrl(img), t: parseDate(it.pubDate), src: name };
      }).filter((x) => x.title && x.link);
    } catch (_) { return []; } finally { clearTimeout(timer); }
  }

  async function loadCat(cat, force) {
    const cache = readCache();
    const hit = cache[cat.id];
    if (!force && hit && Date.now() - hit.at < TTL) return hit.items;
    const parts = await Promise.all(cat.feeds.map((f) => fetchFeed(f[0], f[1])));
    const seen = new Set();
    const items = parts.flat().filter((x) => (seen.has(x.link) ? false : seen.add(x.link))).sort((a, b) => b.t - a.t).slice(0, 40);
    if (items.length) { cache[cat.id] = { at: Date.now(), items }; writeCache(cache); return items; }
    return hit ? hit.items : []; // hors connexion : on garde les dernières actualités connues
  }

  let current = CATS[0], shown = PAGE, items = [], token = 0, loadedOnce = false;
  let box, list, more, tabs;

  function paint() {
    list.innerHTML = "";
    items.slice(0, shown).forEach((n) => {
      const a = document.createElement("a");
      a.className = "omn-card"; a.href = n.link; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.innerHTML = (n.img ? '<img class="omn-img" loading="lazy" referrerpolicy="no-referrer" alt="" src="' + esc(n.img) + '">' : "") +
        '<div class="omn-body"><p class="omn-title">' + esc(n.title) + "</p>" + (n.desc ? '<p class="omn-desc">' + esc(n.desc) + "</p>" : "") +
        '<div class="omn-meta"><span><b>' + esc(n.src) + "</b> · " + esc(ago(n.t)) + "</span><span>Lire ↗</span></div></div>";
      const im = a.querySelector("img");
      if (im) im.onerror = () => im.remove();
      list.appendChild(a);
    });
    more.hidden = items.length <= shown;
  }

  async function select(cat, force) {
    current = cat; shown = PAGE;
    tabs.querySelectorAll(".omn-tab").forEach((b) => b.classList.toggle("on", b.dataset.cat === cat.id));
    const my = ++token;
    list.innerHTML = '<div class="omn-state">Chargement des actualités…</div>';
    more.hidden = true;
    const res = await loadCat(cat, force);
    if (my !== token) return; // l'utilisateur a changé de catégorie entre-temps
    items = res;
    if (!items.length) { list.innerHTML = '<div class="omn-state">Impossible de charger les actualités pour le moment. Vérifie ta connexion puis appuie sur ↻.</div>'; return; }
    paint();
  }

  function buildNews() {
    const feed = $("feed");
    if (!feed || !feed.parentNode || $("omNews")) return;
    box = document.createElement("section");
    box.id = "omNews"; box.className = "omn"; box.setAttribute("aria-label", "Actualités");
    box.innerHTML = '<div class="omn-head"><h3>📰 Actualités</h3><button type="button" id="omnRefresh" aria-label="Actualiser">↻ Actualiser</button></div><div class="omn-tabs" id="omnTabs"></div><div id="omnList"></div><button type="button" class="omn-more" id="omnMore" hidden>Voir plus d’actualités</button>';
    feed.parentNode.insertBefore(box, feed);
    list = $("omnList"); more = $("omnMore"); tabs = $("omnTabs");
    CATS.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "omn-tab"; b.dataset.cat = c.id; b.textContent = c.label;
      b.onclick = () => select(c, false);
      tabs.appendChild(b);
    });
    more.onclick = () => { shown += PAGE; paint(); };
    $("omnRefresh").onclick = () => select(current, true);
  }

  // On ne charge les actualités qu'une fois la personne connectée (page d'accueil visible).
  function maybeLoad() {
    const shell = $("appShell");
    if (!shell || shell.hidden || loadedOnce) return;
    buildNews();
    if (!box) return;
    loadedOnce = true;
    select(current, false);
  }
  const shell = $("appShell");
  if (shell) new MutationObserver(maybeLoad).observe(shell, { attributes: true, attributeFilter: ["hidden"] });
  maybeLoad();

  /* ================= CONNEXION FACEBOOK ================= */
  async function getDb() {
    if (typeof supabaseReady !== "undefined") return supabaseReady; // client déjà créé par app.js
    if (window.supabase && window.supabase.createClient) return window.supabase.createClient("https://nyiievcbciqxvxmerwdm.supabase.co", "sb_publishable_4ZW9RA9gktscWSW2tuEttw_yRNdnduw");
    throw new Error("Supabase indisponible");
  }
  function say(text, isError) {
    const m = $("formMessage");
    if (!m) { alert(text); return; }
    m.hidden = false; m.style.display = ""; m.textContent = text; m.dataset.state = isError ? "error" : "success";
  }
  const fb = $("fbLoginBtn");
  if (fb) fb.addEventListener("click", async () => {
    fb.disabled = true; say("Ouverture de Facebook…", false);
    try {
      const db = await getDb();
      const redirectTo = typeof OMEGIA_PUBLIC_URL !== "undefined" ? OMEGIA_PUBLIC_URL : location.origin + "/";
      const { error } = await db.auth.signInWithOAuth({ provider: "facebook", options: { redirectTo } });
      if (error) throw error;
    } catch (e) {
      const m = (e && e.message) || "";
      say(/not enabled|unsupported provider/i.test(m) ? "La connexion Facebook n’est pas encore activée sur le serveur. Utilise l’e-mail pour l’instant." : (m || "Connexion Facebook impossible. Réessaie."), true);
      fb.disabled = false;
    }
  });

  // Après une connexion Facebook : on reprend le nom et la photo pour que le profil ne soit pas vide.
  async function fillFromFacebook(u) {
    try {
      const db = await getDb();
      const meta = u.user_metadata || {};
      const full = String(meta.full_name || meta.name || "").trim();
      if (!full) return;
      const parts = full.split(/\s+/);
      const first = meta.first_name || parts[0];
      const last = meta.last_name || parts.slice(1).join(" ") || "";
      if (!meta.first_name) await db.auth.updateUser({ data: { first_name: first, last_name: last } });
      const { data: p } = await db.from("profiles").select("first_name,last_name,avatar_url").eq("id", u.id).maybeSingle();
      if (!p) return;
      const patch = {};
      if (!p.first_name) { patch.first_name = first; patch.last_name = p.last_name || last; }
      if (!p.avatar_url && (meta.avatar_url || meta.picture)) patch.avatar_url = meta.avatar_url || meta.picture;
      if (Object.keys(patch).length) await db.from("profiles").update(patch).eq("id", u.id);
    } catch (_) { /* pas grave : l'utilisateur pourra compléter son profil à la main */ }
  }
  getDb().then((db) => {
    db.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session && session.user && session.user.app_metadata && session.user.app_metadata.provider === "facebook") {
        setTimeout(() => fillFromFacebook(session.user), 0);
      }
    });
  }).catch(() => {});
})();
