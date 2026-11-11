/* OMEGIA — African Shop (marketplace). Étape 1 : accueil, catégories, liste, fiche produit, panier.
   Données d’exemple : les vrais produits et boutiques viendront de Supabase à l’étape suivante. */
(() => {
  'use strict';
  const root = document.getElementById('view-shop');
  if (!root) return;

  const CK = 'omegia.shop.cart';
  const SHIP = 2000;
  const money = (n) => Number(n).toLocaleString('fr-FR') + ' FCFA';
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATS = [
    { id: 'mode', n: 'Mode', sub: 'Femme · Homme · Enfant', ic: '👗' },
    { id: 'elec', n: 'Électronique', sub: 'Téléphones · Accessoires', ic: '📱' },
    { id: 'maison', n: 'Maison', sub: 'Décoration · Ustensiles', ic: '🏺' },
    { id: 'beaute', n: 'Beauté', sub: 'Soins · Parfums', ic: '💄' },
    { id: 'alim', n: 'Alimentation', sub: 'Produits locaux', ic: '🍲' },
    { id: 'sport', n: 'Sport', sub: 'Fitness · Loisirs', ic: '👟' },
    { id: 'enfants', n: 'Enfants', sub: 'Jouets · Vêtements', ic: '🧸' },
    { id: 'autres', n: 'Autres', sub: 'Artisanat · Divers', ic: '🧺' }
  ];
  const BG = {
    mode: 'linear-gradient(135deg,#f5761a,#c2410c)', elec: 'linear-gradient(135deg,#334155,#0f172a)',
    maison: 'linear-gradient(135deg,#b45309,#78350f)', beaute: 'linear-gradient(135deg,#db2777,#831843)',
    alim: 'linear-gradient(135deg,#65a30d,#365314)', sport: 'linear-gradient(135deg,#0ea5e9,#075985)',
    enfants: 'linear-gradient(135deg,#a855f7,#6b21a8)', autres: 'linear-gradient(135deg,#eab308,#854d0e)'
  };
  const PRODUCTS = [
    { id: 'p1', cat: 'mode', n: 'Robe en pagne africain', price: 12500, ic: '👗' },
    { id: 'p2', cat: 'mode', n: 'T-shirt coton bio', price: 8000, ic: '👕' },
    { id: 'p3', cat: 'mode', n: 'Sac à main africain', price: 15000, ic: '👜' },
    { id: 'p4', cat: 'mode', n: 'Sandales femme', price: 10000, ic: '🩴' },
    { id: 'p5', cat: 'mode', n: 'Boubou homme brodé', price: 22000, ic: '👘' },
    { id: 'p6', cat: 'elec', n: 'Écouteurs sans fil', price: 9500, ic: '🎧' },
    { id: 'p7', cat: 'elec', n: 'Téléphone Android 128 Go', price: 85000, ic: '📱' },
    { id: 'p8', cat: 'maison', n: 'Panier tressé', price: 6000, ic: '🧺' },
    { id: 'p9', cat: 'maison', n: 'Set de calebasses décorées', price: 11000, ic: '🏺' },
    { id: 'p10', cat: 'beaute', n: 'Beurre de karité pur', price: 3500, ic: '🧴' },
    { id: 'p11', cat: 'beaute', n: 'Huile de coco naturelle', price: 4000, ic: '🥥' },
    { id: 'p12', cat: 'alim', n: 'Piment moulu local 500 g', price: 2500, ic: '🌶️' },
    { id: 'p13', cat: 'alim', n: 'Café du terroir 1 kg', price: 7000, ic: '☕' },
    { id: 'p14', cat: 'sport', n: 'Baskets de sport', price: 15000, ic: '👟' },
    { id: 'p15', cat: 'enfants', n: 'Jeu de société Awélé', price: 5500, ic: '🎲' },
    { id: 'p16', cat: 'autres', n: 'Statuette en bois sculptée', price: 18000, ic: '🗿' }
  ];
  const prod = (id) => PRODUCTS.find((p) => p.id === id);
  const catName = (id) => (CATS.find((c) => c.id === id) || {}).n || '';

  const readCart = () => { try { return JSON.parse(localStorage.getItem(CK) || '{}') || {}; } catch { return {}; } };
  let cart = readCart();
  const saveCart = () => { try { localStorage.setItem(CK, JSON.stringify(cart)); } catch {} };
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const st = { s: 'home', cat: null, pid: null, q: '', qty: 1, from: 'home' };

  const css = document.createElement('style');
  css.textContent = `
#view-shop{--so:#f5761a;--so2:#ff9a4a;background:#121212;color:#fff;border-radius:22px;margin:8px auto;padding:12px 12px 22px;min-height:calc(100dvh - 190px)}
.nav-item[data-nav='shop'] span:not(.badge){font-size:9.5px;line-height:1.05;text-align:center}
:where(#view-shop) button{font:inherit;color:inherit;border:0;background:none;cursor:pointer}
:where(#view-shop) h2,:where(#view-shop) h3,:where(#view-shop) h4,:where(#view-shop) p{margin:0}
.so-top{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 10px}
.so-logo{display:flex;align-items:center;gap:10px}
.so-logo i{width:38px;height:38px;border-radius:12px;background:var(--so);display:grid;place-items:center;font-style:normal;font-size:20px}
.so-logo span{display:flex;flex-direction:column;line-height:1;font-weight:900;letter-spacing:.5px}
.so-logo em{font-style:normal;color:var(--so);font-size:19px}
.so-top>button{width:40px;height:40px;border-radius:50%;background:#1f1f22;font-size:17px}
.so-tabs{display:flex;gap:8px;position:sticky;top:0;z-index:5;background:#121212;padding:6px 0 10px}
.so-tabs button{flex:1;position:relative;padding:10px 6px;border-radius:14px;background:#1f1f22;color:#b9b9c1;font-weight:700;font-size:13px}
.so-tabs button.on{background:var(--so);color:#fff}
.so-n{position:absolute;top:-5px;right:8px;min-width:18px;height:18px;border-radius:9px;background:#fff;color:var(--so);font-size:11px;display:grid;place-items:center;padding:0 4px}
.so-search{display:flex;background:#fff;border-radius:14px;padding:4px;margin:4px 0 12px}
.so-search input{flex:1;min-width:0;border:0;outline:0;background:none;color:#222;font:inherit;font-size:16px;padding:10px 12px;box-shadow:none}
.so-search button{width:42px;border-radius:11px;font-size:17px}
.so-promo{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px;border-radius:18px;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.07) 0 12px,transparent 12px 24px),linear-gradient(135deg,#c2410c,#f5761a 60%,#ffb066);margin-bottom:14px}
.so-promo h3{font-size:19px;line-height:1.2;margin-bottom:12px;max-width:210px}
.so-promo button{background:#fff;color:#c2410c;font-weight:800;border-radius:99px;padding:9px 16px;font-size:13px}
.so-promo>span{font-size:64px;filter:drop-shadow(0 6px 10px rgba(0,0,0,.35))}
.so-qcats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;background:#fff;border-radius:18px;padding:14px 8px;margin-bottom:16px}
.so-qcats button{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:11.5px;font-weight:700;color:#222}
.so-qcats i{width:46px;height:46px;border-radius:14px;background:#161616;display:grid;place-items:center;font-style:normal;font-size:22px}
.so-row{display:flex;align-items:center;justify-content:space-between;margin:4px 2px 10px}
.so-row h3,.so-h{font-size:18px}
.so-row button{color:var(--so);font-weight:700;font-size:13px}
.so-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.so-card{background:#fff;color:#161616;border-radius:16px;padding:8px;display:flex;flex-direction:column;gap:8px}
.so-open{text-align:left;display:block}
.so-art{border-radius:12px;aspect-ratio:1;display:grid;place-items:center;font-size:54px;overflow:hidden;position:relative}
.so-art.big{aspect-ratio:4/3;font-size:96px;margin-bottom:12px}
.so-art::after{content:'';position:absolute;inset:0;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,.08) 0 10px,transparent 10px 20px)}
.so-art span{position:relative;z-index:1;filter:drop-shadow(0 4px 8px rgba(0,0,0,.35))}
.so-open h4{font-size:13.5px;margin:8px 2px 3px}
.so-open p{font-size:13px;font-weight:800;color:#c2410c;margin:0 2px}
.so-add{background:var(--so);color:#fff;font-weight:800;border-radius:10px;padding:10px 6px;font-size:12.5px}
.so-demo{margin-top:14px;font-size:12px;color:#9a9aa3;text-align:center;line-height:1.4}
.so-cgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:10px}
.so-ctile{background:#fff;color:#161616;border-radius:16px;padding:8px;text-align:left}
.so-ctile .so-art{font-size:46px;aspect-ratio:3/2;margin-bottom:8px}
.so-ctile b{display:block;font-size:14px;margin:0 2px}
.so-ctile small{color:#6b6b73;font-size:11px;margin:0 2px}
.so-bar{display:flex;align-items:center;gap:10px;margin:2px 0 12px}
.so-bar button{width:38px;height:38px;border-radius:50%;background:#1f1f22;font-size:18px;flex:none}
.so-bar h3{font-size:18px}
.so-pn{font-size:21px;margin:4px 0}
.so-price{font-size:22px;font-weight:900;color:var(--so2)}
.so-stock{color:#4ade80;font-size:13px;margin:6px 0}
.so-desc{color:#c9c9d1;line-height:1.5;font-size:14px;margin:8px 0 14px}
.so-qty{display:flex;align-items:center;gap:12px;margin-bottom:14px}
.so-qty button{width:34px;height:34px;border-radius:10px;background:#26262a;font-size:18px;font-weight:800}
.so-qty.small{margin:6px 0 0}
.so-qty.small button{width:28px;height:28px;font-size:16px}
.so-main{display:block;width:100%;padding:14px;border-radius:14px;background:var(--so);color:#fff;font-weight:800;font-size:15px;margin:8px 0;box-shadow:0 8px 20px rgba(245,118,26,.3)}
.so-ghost{display:block;width:100%;padding:14px;border-radius:14px;background:#26262a;color:#fff;font-weight:700;font-size:15px}
.so-line{display:flex;gap:12px;align-items:center;background:#1c1c1e;border-radius:16px;padding:10px;margin:10px 0}
.so-line .so-art{width:72px;flex:none;font-size:34px}
.so-line>div:nth-child(2){flex:1;min-width:0}
.so-line small{display:block;color:#bdbdc6;margin-top:2px}
.so-del{width:38px;height:38px;border-radius:10px;background:#2a1c1c;color:#ff6b6b;flex:none}
.so-sum{background:#1c1c1e;border-radius:16px;padding:14px;margin:14px 0}
.so-sum>div{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;color:#d0d0d8}
.so-sum>div.t{border-top:1px solid #333;margin-top:6px;padding-top:12px;color:#fff;font-weight:900;font-size:17px}
.so-empty{text-align:center;color:#a8a8b0;padding:34px 10px}
.so-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:40;background:#fff;color:#161616;font-weight:700;font-size:14px;padding:11px 16px;border-radius:99px;box-shadow:0 8px 24px rgba(0,0,0,.35);max-width:88vw;text-align:center}
`;
  document.head.appendChild(css);

  root.innerHTML = `<div class='so-top'><div class='so-logo'><i>🛍</i><span><b>AFRICAN</b><em>SHOP</em></span></div><button type='button' data-act='bell' aria-label='Notifications'>🔔</button></div><nav class='so-tabs'></nav><div class='so-body'></div><div class='so-toast' hidden></div>`;
  const tabsEl = root.querySelector('.so-tabs');
  const body = root.querySelector('.so-body');
  const toastEl = root.querySelector('.so-toast');
  let tm = 0;
  const toast = (t) => { toastEl.textContent = t; toastEl.hidden = false; clearTimeout(tm); tm = setTimeout(() => { toastEl.hidden = true; }, 2200); };

  const art = (p, big) => `<div class='so-art${big ? ' big' : ''}' style='background:${BG[p.cat]}'><span>${p.ic}</span></div>`;
  const card = (p) => `<article class='so-card'><button type='button' class='so-open' data-act='open' data-id='${p.id}'>${art(p)}<h4>${esc(p.n)}</h4><p>${money(p.price)}</p></button><button type='button' class='so-add' data-act='add' data-id='${p.id}'>Ajouter au panier</button></article>`;

  function home() {
    return `<form class='so-search'><input name='q' placeholder='Rechercher un produit, une boutique…' value='${esc(st.q)}' aria-label='Rechercher'><button type='submit' aria-label='Rechercher'>🔍</button></form>
<div class='so-promo'><div><h3>Les meilleures offres de la semaine</h3><button type='button' data-act='promo'>Voir les promos</button></div><span>🛍️</span></div>
<div class='so-qcats'>${CATS.map((c) => `<button type='button' data-act='cat' data-id='${c.id}'><i>${c.ic}</i>${esc(c.n)}</button>`).join('')}</div>
<div class='so-row'><h3>Produits populaires</h3><button type='button' data-act='all'>Voir tout</button></div>
<div class='so-grid'>${PRODUCTS.slice(0, 6).map(card).join('')}</div>
<p class='so-demo'>Articles d’exemple pour la démonstration : les vrais produits des commerçants arriveront bientôt.</p>`;
  }
  function cats() {
    return `<h3 class='so-h'>Catégories</h3><div class='so-cgrid'>${CATS.map((c) => `<button type='button' class='so-ctile' data-act='cat' data-id='${c.id}'><div class='so-art' style='background:${BG[c.id]}'><span>${c.ic}</span></div><b>${esc(c.n)}</b><small>${esc(c.sub)}</small></button>`).join('')}</div>`;
  }
  function list() {
    let items = PRODUCTS, title = 'Tous les produits';
    if (st.cat) { title = catName(st.cat) || title; items = items.filter((p) => p.cat === st.cat); }
    if (st.q) { const q = st.q.toLowerCase(); items = PRODUCTS.filter((p) => p.n.toLowerCase().includes(q)); title = 'Résultats pour « ' + st.q + ' »'; }
    return `<div class='so-bar'><button type='button' data-act='back' aria-label='Retour'>←</button><h3>${esc(title)}</h3></div>${items.length ? `<div class='so-grid'>${items.map(card).join('')}</div>` : `<p class='so-empty'>Aucun produit trouvé.</p>`}`;
  }
  function product() {
    const p = prod(st.pid);
    if (!p) return list();
    return `<div class='so-bar'><button type='button' data-act='back' aria-label='Retour'>←</button><h3>Détails du produit</h3></div>${art(p, true)}<h2 class='so-pn'>${esc(p.n)}</h2><div class='so-price'>${money(p.price)}</div><div class='so-stock'>● En stock (exemple)</div><p class='so-desc'>Article d’exemple de la catégorie « ${esc(catName(p.cat))} ». Le vendeur ajoutera sa vraie description et ses photos.</p><div class='so-qty'><span>Quantité :</span><button type='button' data-act='minus'>−</button><b>${st.qty}</b><button type='button' data-act='plus'>+</button></div><button type='button' class='so-main' data-act='addq' data-id='${p.id}'>Ajouter au panier</button><button type='button' class='so-ghost' data-act='seller'>💬 Contacter le vendeur</button>`;
  }
  function cartView() {
    const ids = Object.keys(cart).filter((id) => prod(id) && cart[id] > 0);
    if (!ids.length) return `<h3 class='so-h'>Mon panier</h3><p class='so-empty'>Ton panier est vide.</p><button type='button' class='so-main' data-act='tab' data-id='home'>Découvrir les produits</button>`;
    const sub = ids.reduce((a, id) => a + prod(id).price * cart[id], 0);
    const lines = ids.map((id) => { const p = prod(id); return `<div class='so-line'>${art(p)}<div><b>${esc(p.n)}</b><small>${money(p.price)}</small><div class='so-qty small'><button type='button' data-act='cminus' data-id='${id}'>−</button><b>${cart[id]}</b><button type='button' data-act='cplus' data-id='${id}'>+</button></div></div><button type='button' class='so-del' data-act='cdel' data-id='${id}' aria-label='Supprimer'>🗑</button></div>`; }).join('');
    return `<h3 class='so-h'>Mon panier</h3>${lines}<div class='so-sum'><div><span>Sous-total</span><span>${money(sub)}</span></div><div><span>Frais de livraison</span><span>${money(SHIP)}</span></div><div class='t'><span>Total</span><span>${money(sub + SHIP)}</span></div></div><button type='button' class='so-main' data-act='order'>Passer la commande</button>`;
  }
  const VIEWS = { home, cats, list, product, cart: cartView };
  const TABS = [['home', '🏠', 'Accueil'], ['cats', '▦', 'Catégories'], ['cart', '🛒', 'Panier']];

  function paintTabs() {
    const on = (st.s === 'list' || st.s === 'product') ? (st.from === 'cats' ? 'cats' : 'home') : st.s;
    tabsEl.innerHTML = TABS.map(([id, ic, n]) => `<button type='button' data-act='tab' data-id='${id}' class='${on === id ? 'on' : ''}'>${ic} ${n}${id === 'cart' && count() ? `<span class='so-n'>${count()}</span>` : ''}</button>`).join('');
  }
  function paint() { paintTabs(); body.innerHTML = VIEWS[st.s](); }
  function go(s) { st.s = s; paint(); const m = document.querySelector('.app-main'); if (m) m.scrollTop = 0; }
  function add(id, n) { cart[id] = (cart[id] || 0) + n; saveCart(); paintTabs(); toast('Ajouté au panier 🛒'); }

  root.addEventListener('submit', (e) => {
    const f = e.target.closest('form'); if (!f) return;
    e.preventDefault();
    st.q = String(new FormData(f).get('q') || '').trim(); st.cat = null; st.from = 'home';
    go(st.q ? 'list' : 'home');
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const a = b.dataset.act, id = b.dataset.id;
    if (a === 'tab') { st.cat = null; st.q = ''; go(id); }
    else if (a === 'cat') { st.from = st.s === 'cats' ? 'cats' : 'home'; st.cat = id; st.q = ''; go('list'); }
    else if (a === 'all') { st.from = 'home'; st.cat = null; st.q = ''; go('list'); }
    else if (a === 'open') { st.pid = id; st.qty = 1; go('product'); }
    else if (a === 'back') { go(st.s === 'product' ? 'list' : (st.from === 'cats' ? 'cats' : 'home')); }
    else if (a === 'add') add(id, 1);
    else if (a === 'addq') add(id, st.qty);
    else if (a === 'minus') { st.qty = Math.max(1, st.qty - 1); paint(); }
    else if (a === 'plus') { st.qty = Math.min(20, st.qty + 1); paint(); }
    else if (a === 'cplus') { cart[id] = Math.min(50, (cart[id] || 0) + 1); saveCart(); paint(); }
    else if (a === 'cminus') { cart[id] = Math.max(1, (cart[id] || 1) - 1); saveCart(); paint(); }
    else if (a === 'cdel') { delete cart[id]; saveCart(); paint(); }
    else if (a === 'order') toast('Le paiement par Mobile Money arrive bientôt.');
    else if (a === 'seller') toast('Le contact vendeur arrive avec les vraies boutiques.');
    else if (a === 'promo') toast('Les promotions arrivent bientôt.');
    else if (a === 'bell') toast('Les notifications de la boutique arrivent bientôt.');
  });

  paint();
})();
