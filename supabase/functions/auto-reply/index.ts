// OMEGIA : réponse automatique par IA.
// Déclenchée par un Database Webhook (INSERT sur public.messages). Voir supabase/auto_reply.sql.
// Secrets requis : ANTHROPIC_API_KEY, AUTO_REPLY_SECRET (optionnel : AUTO_REPLY_MODEL).
import { createClient } from 'npm:@supabase/supabase-js@2';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const MODEL = Deno.env.get('AUTO_REPLY_MODEL') ?? 'claude-haiku-5-5';
const SECRET = Deno.env.get('AUTO_REPLY_SECRET') ?? '';
const NL = '\n';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const redact = (t: string) => t
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}/g, '[e-mail]')
  .replace(/[+]?[0-9][0-9 ().-]{6,}[0-9]/g, '[numéro]');

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get('x-webhook-secret') !== SECRET) return new Response('forbidden', { status: 403 });
  let payload: any;
  try { payload = await req.json(); } catch { return new Response('bad request', { status: 400 }); }
  if (payload?.type !== 'INSERT' || !payload?.record) return new Response('ignored');
  // @ts-ignore EdgeRuntime est fourni par Supabase
  EdgeRuntime.waitUntil(handle(payload.record).catch((e) => console.error('auto-reply:', e)));
  return new Response('ok');
});

async function getCfg(userId: string) {
  const { data } = await db.from('auto_reply_settings').select('*').eq('user_id', userId).eq('enabled', true).maybeSingle();
  return data;
}

async function handle(m: any) {
  // Jamais de réponse à un message automatique (pas de boucle) ni à un média seul.
  if (m.is_auto || !m.body || m.body === '__OMEGIA_STICKER__' || !String(m.body).trim()) return;
  if (!API_KEY) { console.error('ANTHROPIC_API_KEY manquante'); return; }

  // Conversations privées uniquement.
  const { data: conv } = await db.from('conversations').select('is_group').eq('id', m.conversation_id).single();
  if (!conv || conv.is_group) return;
  const { data: members } = await db.from('conversation_members').select('user_id').eq('conversation_id', m.conversation_id);
  const owner = (members ?? []).map((x: any) => x.user_id).find((id: string) => id !== m.sender_id);
  if (!owner) return;

  const cfg = await getCfg(owner);
  if (!cfg) return;

  // Blocage dans un sens ou dans l'autre : silence.
  const { data: blk } = await db.from('user_blocks').select('blocker_id')
    .or(`and(blocker_id.eq.${owner},blocked_id.eq.${m.sender_id}),and(blocker_id.eq.${m.sender_id},blocked_id.eq.${owner})`).limit(1);
  if (blk && blk.length) return;

  // Si la personne vient d'écrire elle-même (3 dernières minutes), elle est là : l'IA ne répond pas.
  const recent = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data: active } = await db.from('messages').select('id').eq('conversation_id', m.conversation_id)
    .eq('sender_id', owner).eq('is_auto', false).gte('created_at', recent).limit(1);
  if (active && active.length) return;

  await sleep((cfg.delay_seconds ?? 60) * 1000);

  // Après le délai : réglage toujours actif ? message toujours le dernier ? (sinon la personne a répondu, ou un message plus récent sera traité à sa place)
  const cfg2 = await getCfg(owner);
  if (!cfg2) return;
  const { data: lastRows } = await db.from('messages').select('id').eq('conversation_id', m.conversation_id)
    .order('created_at', { ascending: false }).limit(1);
  if (!lastRows || lastRows[0]?.id !== m.id) return;

  // Plafond par heure.
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count } = await db.from('messages').select('id', { count: 'exact', head: true })
    .eq('conversation_id', m.conversation_id).eq('sender_id', owner).eq('is_auto', true).gte('created_at', since);
  if ((count ?? 0) >= (cfg2.max_per_hour ?? 20)) return;
  const intro = new Date(Date.now() - 6 * 3600_000).toISOString();
  const { count: introCount } = await db.from('messages').select('id', { count: 'exact', head: true })
    .eq('conversation_id', m.conversation_id).eq('sender_id', owner).eq('is_auto', true).gte('created_at', intro);
  const introduced = (introCount ?? 0) > 0;

  // Noms.
  const { data: profs } = await db.from('profiles').select('id,first_name').in('id', [owner, m.sender_id]);
  const ownerName = profs?.find((p: any) => p.id === owner)?.first_name || 'la personne';
  const peerName = profs?.find((p: any) => p.id === m.sender_id)?.first_name || 'son interlocuteur';

  // Historique de la conversation.
  const { data: hist } = await db.from('messages').select('sender_id,body,created_at').eq('conversation_id', m.conversation_id)
    .order('created_at', { ascending: false }).limit(30);
  const turns: { role: 'user' | 'assistant'; content: string }[] = [];
  for (const h of (hist ?? []).reverse()) {
    if (!h.body || h.body === '__OMEGIA_STICKER__') continue;
    const role = h.sender_id === owner ? 'assistant' : 'user';
    const text = String(h.body).slice(0, 1000);
    const prev = turns[turns.length - 1];
    if (prev && prev.role === role) prev.content += NL + text; else turns.push({ role, content: text });
  }
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return;

  // Style : exemples de messages écrits par la personne (si elle l'a autorisé).
  let examples = '';
  if (cfg2.use_history) {
    const { data: mine } = await db.from('messages').select('body').eq('sender_id', owner).eq('is_auto', false)
      .order('created_at', { ascending: false }).limit(80);
    examples = (mine ?? []).map((x: any) => String(x.body || '').trim())
      .filter((t: string) => t.length >= 3 && t.length <= 240 && t !== '__OMEGIA_STICKER__')
      .slice(0, 40).map((t: string) => '- ' + redact(t)).join(NL);
  }
  const persona = String(cfg2.persona || '').trim();

  const system = [
    `Tu es l’assistant IA de ${ownerName}. ${ownerName} est momentanément indisponible et t’a chargé de répondre à sa place à ${peerName} dans la messagerie OMEGIA.`,
    '',
    'TRANSPARENCE',
    `- Tu n’es pas ${ownerName}. Tu ne prétends jamais être un humain. Si on te demande qui écrit, réponds clairement que tu es l’assistant IA de ${ownerName}.`,
    introduced ? '' : `- C’est ta première réponse : présente-toi en une courte phrase (assistant IA de ${ownerName}, qui répond pendant son indisponibilité), puis réponds au message.`,
    '',
    'STYLE',
    `- Écris dans l’esprit de ${ownerName} : ton, vocabulaire, humour et longueur des messages proches des siens, dans la langue de ${peerName}.`,
    '- Messages courts et naturels, comme dans une vraie discussion, sans listes ni titres. Un emoji seulement si la personne en utilise.',
    persona ? `- Personnalité de ${ownerName} : ${persona}` : '',
    examples ? `- Exemples de messages écrits par ${ownerName} :${NL}${examples}` : '',
    '',
    'LIMITES STRICTES',
    `- Ne t’engage jamais à la place de ${ownerName} : pas d’argent, de rendez-vous, de promesses, de décisions, de secrets, ni d’informations personnelles (adresse, téléphone, mots de passe).`,
    '- Pas de flirt, de propos romantiques ou sexuels, et ne feins pas d’émotions intimes à sa place.',
    `- Si le sujet est sensible (détresse, urgence, santé, argent, conflit), reste bref et bienveillant, dis que ${ownerName} répondra en personne à son retour, et conseille d’appeler les secours en cas d’urgence.`,
    `- Si on demande ${ownerName}, dis qu’il ou elle est indisponible et reviendra bientôt.`,
    `- N’invente aucun fait sur la vie de ${ownerName}.`,
    '',
    'Réponds uniquement avec le texte du message à envoyer.',
  ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join(NL);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 300, system, messages: turns }),
  });
  if (!res.ok) { console.error('Anthropic', res.status, await res.text()); return; }
  const out = await res.json();
  const text = (out.content ?? []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim();
  if (!text) return;

  const { error } = await db.from('messages').insert({
    conversation_id: m.conversation_id, sender_id: owner, body: text.slice(0, 1500), is_auto: true,
  });
  if (error) console.error('insert auto-reply:', error.message);
}
