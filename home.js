// OMEGIA — news feed. Shared helpers ($, supabaseReady, friendlyError, biometric functions) are in shared.js.
const PAGE_SIZE = 20;
const AVATAR_COLORS = ["#7652d6", "#23806a", "#b4477a", "#2f6fb0", "#a5622a", "#5b6b2f", "#8a4fb8"];
const POST_SELECT = "id, content, created_at, author_id, author:profiles(first_name, last_name), likes(count), comments(count)";
const COMMENT_SELECT = "id, content, created_at, author_id, author:profiles(first_name, last_name)";

// ----- Small helpers -----
// Build DOM nodes without innerHTML, so member-written text can never inject markup.
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") el.className = value;
    else if (key === "text") el.textContent = value;
    else if (key.startsWith("on")) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? "" : value);
  }
  for (const child of children.flat()) if (child !== null && child !== undefined) el.append(child);
  return el;
}

function displayName(profile) {
  return [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim() || "Membre OMEGIA";
}
function initialsOf(name) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).slice(0, 2) || "Ω";
}
function colorFor(id) {
  let hash = 0;
  for (const ch of String(id)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function avatar(id, name, size = "") {
  const el = h("span", { class: "avatar " + size, "aria-hidden": "true", text: initialsOf(name) });
  el.style.background = colorFor(id);
  return el;
}

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
function timeAgo(iso) {
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(seconds);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  if (abs < 604800) return relative.format(Math.round(seconds / 86400), "day");
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function fullDate(iso) {
  return new Date(iso).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
}
function plural(count, one, many) {
  return count + " " + (count > 1 ? many : one);
}

let toastTimer;
function toast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 4500);
}

// ----- Main -----
async function main() {
  const client = await supabaseReady;
  const { data: { session } } = await client.auth.getSession();
  if (!session) { location.replace("./"); return; }
  const me = session.user;
  // Fingerprint/face is on and this tab has not been unlocked: go back to the lock screen.
  if (biometricEnabledFor(me) && !isUnlocked()) { location.replace("./"); return; }
  client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT") location.replace("./"); });

  const { data: profile } = await client.from("profiles").select("first_name, last_name").eq("id", me.id).maybeSingle();
  const myProfile = profile || { first_name: "", last_name: "" };
  const myName = displayName(myProfile) !== "Membre OMEGIA" ? displayName(myProfile) : (me.email || "").split("@")[0] || "Membre OMEGIA";

  setupHeader(client, me, myName);
  setupComposer(client, me, myProfile, myName);
  $("splash").hidden = true;

  let offset = 0;
  let loading = false;

  function buildPost(row) {
    return renderPost(client, me, myName, row, () => { offset = Math.max(0, offset - 1); $("emptyState").hidden = offset > 0 || $("posts").children.length > 0; });
  }

  async function loadPosts() {
    if (loading) return;
    loading = true;
    $("moreBtn").disabled = true;
    try {
      const { data, error } = await client.from("posts").select(POST_SELECT)
        .order("created_at", { ascending: false }).range(offset, offset + PAGE_SIZE - 1);
      if (error) throw error;
      let liked = new Set();
      if (data.length) {
        const { data: mine, error: likeError } = await client.from("likes").select("post_id")
          .eq("user_id", me.id).in("post_id", data.map((row) => row.id));
        if (likeError) throw likeError;
        liked = new Set(mine.map((like) => like.post_id));
      }
      for (const row of data) {
        $("posts").append(buildPost({
          ...row,
          likeCount: row.likes?.[0]?.count ?? 0,
          commentCount: row.comments?.[0]?.count ?? 0,
          liked: liked.has(row.id)
        }));
      }
      offset += data.length;
      $("moreBtn").hidden = data.length < PAGE_SIZE;
      $("emptyState").hidden = offset > 0;
    } catch (error) {
      toast(friendlyError(error), true);
    } finally {
      loading = false;
      $("moreBtn").disabled = false;
    }
  }
  $("moreBtn").addEventListener("click", loadPosts);

  // A freshly published post goes on top without reloading the list.
  window.addEventListener("omegia:published", (event) => {
    $("posts").prepend(buildPost(event.detail));
    offset += 1;
    $("emptyState").hidden = true;
  });

  await Promise.all([loadPosts(), loadMembers(client, me)]);
}

function setupHeader(client, me, myName) {
  const button = $("menuBtn");
  button.replaceChildren(initialsOf(myName));
  button.style.background = colorFor(me.id);
  $("menuUser").replaceChildren(h("strong", { text: myName }), h("span", { text: me.email || "" }));

  const menu = $("menu");
  const closeMenu = () => { menu.hidden = true; button.setAttribute("aria-expanded", "false"); };
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", (event) => { if (!menu.contains(event.target)) closeMenu(); });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeMenu(); });

  const bioButton = $("bioToggle");
  async function refreshBio() {
    if (!(await biometricSupported())) { bioButton.hidden = true; return; }
    const enabled = biometricEnabledFor(me);
    bioButton.hidden = false;
    bioButton.dataset.enabled = String(enabled);
    bioButton.textContent = enabled ? "Désactiver l'empreinte ou le visage" : "Activer l'empreinte ou le visage";
  }
  bioButton.addEventListener("click", async () => {
    const enabled = bioButton.dataset.enabled === "true";
    closeMenu();
    try {
      if (enabled) {
        writeBio(null);
        toast("Déverrouillage par empreinte ou visage désactivé sur cet appareil.");
      } else {
        await enableBiometric(me);
        toast("Activé : à la prochaine ouverture, OMEGIA se déverrouillera avec votre empreinte ou votre visage.");
      }
    } catch (error) {
      toast(friendlyError(error), true);
    }
    refreshBio();
  });
  refreshBio();

  $("logoutBtn").addEventListener("click", async () => {
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      writeBio(null);
      clearUnlocked();
      location.replace("./");
    } catch (error) {
      toast(friendlyError(error), true);
    }
  });
}

function setupComposer(client, me, myProfile, myName) {
  const input = $("composerText");
  const publish = $("publishBtn");
  $("meAvatar").replaceChildren(initialsOf(myName));
  $("meAvatar").style.background = colorFor(me.id);
  const firstName = myProfile.first_name || myName.split(" ")[0];
  input.placeholder = "Quoi de neuf, " + firstName + " ?";

  const refresh = () => {
    $("composerCount").textContent = input.value.length + " / 2000";
    publish.disabled = input.value.trim().length === 0;
  };
  input.addEventListener("input", refresh);

  publish.addEventListener("click", async () => {
    const content = input.value.trim();
    if (!content) return;
    publish.disabled = true;
    publish.textContent = "Publication…";
    try {
      const { data, error } = await client.from("posts").insert({ content })
        .select("id, content, created_at, author_id").single();
      if (error) throw error;
      input.value = "";
      window.dispatchEvent(new CustomEvent("omegia:published", {
        detail: { ...data, author: { first_name: myProfile.first_name, last_name: myProfile.last_name }, likeCount: 0, commentCount: 0, liked: false }
      }));
    } catch (error) {
      toast(friendlyError(error), true);
    } finally {
      publish.textContent = "Publier";
      refresh();
    }
  });
  refresh();
}

async function loadMembers(client, me) {
  try {
    const { data, error } = await client.from("profiles").select("id, first_name, last_name")
      .neq("id", me.id).order("created_at", { ascending: false }).limit(8);
    if (error) throw error;
    $("members").replaceChildren(...data.map((member) => {
      const name = displayName(member);
      return h("li", {}, avatar(member.id, name), h("span", { text: name }));
    }));
    $("membersEmpty").hidden = data.length > 0;
  } catch (error) {
    $("membersEmpty").textContent = friendlyError(error);
    $("membersEmpty").hidden = false;
  }
}

// ----- One post (with likes and comments) -----
function renderPost(client, me, myName, post, onDeleted) {
  const authorName = displayName(post.author);
  const article = h("article", { class: "card post" });
  const stats = h("div", { class: "post-stats" });
  const likeBtn = h("button", { class: "action", type: "button" });
  const commentBtn = h("button", { class: "action", type: "button", "aria-expanded": "false" });
  const commentsBox = h("div", { class: "comments", hidden: true });
  let commentsLoaded = false;
  let likeBusy = false;

  function updateStats() {
    const likes = h("span", { text: post.likeCount ? "♥ " + plural(post.likeCount, "j'aime", "j'aime") : "" });
    const comments = h("span", { text: post.commentCount ? plural(post.commentCount, "commentaire", "commentaires") : "" });
    stats.replaceChildren(likes, comments);
    stats.hidden = !post.likeCount && !post.commentCount;
    likeBtn.textContent = post.liked ? "♥ Aimé" : "♡ J'aime";
    likeBtn.classList.toggle("on", post.liked);
    likeBtn.setAttribute("aria-pressed", String(post.liked));
    commentBtn.textContent = "Commenter";
  }

  const head = h("div", { class: "post-head" },
    avatar(post.author_id, authorName),
    h("div", { class: "post-who" },
      h("strong", { text: authorName }),
      h("time", { datetime: post.created_at, title: fullDate(post.created_at), text: timeAgo(post.created_at) })),
    post.author_id === me.id ? h("button", {
      class: "text-button", type: "button", "aria-label": "Supprimer cette publication", text: "Supprimer",
      onclick: async () => {
        if (!confirm("Supprimer cette publication ?")) return;
        const { error } = await client.from("posts").delete().eq("id", post.id);
        if (error) { toast(friendlyError(error), true); return; }
        article.remove();
        onDeleted();
      }
    }) : null);

  likeBtn.addEventListener("click", async () => {
    if (likeBusy) return;
    likeBusy = true;
    const was = post.liked;
    post.liked = !was;
    post.likeCount += was ? -1 : 1;
    updateStats();
    const { error } = was
      ? await client.from("likes").delete().eq("post_id", post.id).eq("user_id", me.id)
      : await client.from("likes").insert({ post_id: post.id });
    if (error && error.code !== "23505") {
      post.liked = was;
      post.likeCount += was ? 1 : -1;
      updateStats();
      toast(friendlyError(error), true);
    }
    likeBusy = false;
  });

  function renderComment(comment) {
    const name = displayName(comment.author);
    const row = h("div", { class: "comment" },
      avatar(comment.author_id, name, "xs"),
      h("div", {},
        h("div", { class: "bubble" }, h("strong", { text: name }), h("p", { text: comment.content })),
        h("div", { class: "comment-meta" },
          h("time", { datetime: comment.created_at, title: fullDate(comment.created_at), text: timeAgo(comment.created_at) }),
          comment.author_id === me.id ? h("button", {
            class: "text-button", type: "button", text: "Supprimer",
            onclick: async () => {
              const { error } = await client.from("comments").delete().eq("id", comment.id);
              if (error) { toast(friendlyError(error), true); return; }
              row.remove();
              post.commentCount = Math.max(0, post.commentCount - 1);
              updateStats();
            }
          }) : null)));
    return row;
  }

  const list = h("div", { class: "comment-list" });
  const field = h("input", { type: "text", maxlength: "1000", placeholder: "Écrire un commentaire…", "aria-label": "Écrire un commentaire" });
  const send = h("button", { class: "btn-primary", type: "submit", text: "Envoyer" });
  const form = h("form", {
    class: "comment-form",
    onsubmit: async (event) => {
      event.preventDefault();
      const content = field.value.trim();
      if (!content) return;
      send.disabled = true;
      try {
        const { data, error } = await client.from("comments").insert({ post_id: post.id, content }).select(COMMENT_SELECT).single();
        if (error) throw error;
        list.append(renderComment({ ...data, author: data.author || { first_name: myName, last_name: "" } }));
        field.value = "";
        post.commentCount += 1;
        updateStats();
      } catch (error) {
        toast(friendlyError(error), true);
      } finally {
        send.disabled = false;
      }
    }
  }, field, send);
  commentsBox.append(list, form);

  commentBtn.addEventListener("click", async () => {
    const open = commentsBox.hidden;
    commentsBox.hidden = !open;
    commentBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      field.focus();
      if (!commentsLoaded) {
        const { data, error } = await client.from("comments").select(COMMENT_SELECT)
          .eq("post_id", post.id).order("created_at", { ascending: true }).limit(100);
        if (error) { toast(friendlyError(error), true); return; }
        commentsLoaded = true;
        list.replaceChildren(...data.map(renderComment));
      }
    }
  });

  article.append(head, h("p", { class: "post-body", text: post.content }), stats,
    h("div", { class: "post-actions" }, likeBtn, commentBtn), commentsBox);
  updateStats();
  return article;
}

main().catch((error) => {
  console.error("OMEGIA / feed:", error);
  const splash = $("splash");
  splash.hidden = false;
  splash.textContent = friendlyError(error) + " Actualisez la page pour réessayer.";
});
