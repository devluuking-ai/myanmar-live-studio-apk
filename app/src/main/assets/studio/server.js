// Myanmar Live Studio — open-source TikTok LIVE interactive games.
// Self-hosted: no Google login, no license, no watermark, no time limit.
// Run: npm install && npm start   (Node 22+ for the TikTok connector)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Node 18 (embedded in the APK) lacks AbortSignal.any in some builds; ttl-live uses it.
if (typeof AbortSignal !== 'undefined' && !AbortSignal.any) {
  AbortSignal.any = signals => {
    const c = new AbortController();
    for (const s of signals) { if (s.aborted) { c.abort(s.reason); break; } s.addEventListener('abort', () => c.abort(s.reason), { once: true }); }
    return c.signal;
  };
}

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 3000);

export const GAMES = [
  { id: 'flagbattle', label: 'နိုင်ငံအလံ တိုက်ပွဲ', how: 'ကိုယ့်နိုင်ငံကုဒ် (MM, TH, SG, JP…) Comment ရေးပါ၊ Gift နဲ့ အလံဘောလုံး ကြီးလာမယ်' },
  { id: 'garden', label: 'ဥယျာဉ် ကာကွယ်ပွဲ', how: 'Comment 1–5 နဲ့ တန်းရွေးပါ၊ Gift နဲ့ ဘီလူးတွေကို တိုက်ပါ' },
  { id: 'lethwei', label: 'လက်ဝှေ့ပွဲ', how: 'Comment 1 / 2 နဲ့ အသင်းရွေးပါ၊ Gift နဲ့ ထိုး/ကန်/ဒူး/ခေါင်းတိုက်ပါ' },
  { id: 'slap', label: 'ပါးရိုက်ပွဲ', how: 'Comment 1 / 2 နဲ့ အသင်းရွေးပါ၊ Gift နဲ့ ပါးရိုက်ပါ' },
  { id: 'car', label: 'ကားပြိုင်', how: 'Comment / Like နဲ့ ကားကို အရှိန်တင်ပါ' },
  { id: 'soundtruck', label: 'အသံထရပ် တိုက်ပွဲ', how: 'Comment 1 / 2 နဲ့ အသင်းရွေးပါ၊ Gift နဲ့ စပီကာ ထပ်ပါ' },
  { id: 'tug', label: 'လွန်ဆွဲ', how: 'Comment မှာ 1 (အနီ) သို့မဟုတ် 2 (အပြာ) ရေးပြီး အသင်းကို အားဖြည့်ပါ' },
  { id: 'partytruck', label: 'ပွဲတော် ထရပ်', how: 'Comment ရေးရင် ထရပ်ပေါ် တက်ကမယ်၊ Gift နဲ့ VIP ရွှေအကသမား ဖြစ်မယ်' },
  { id: 'monster', label: 'ဘီလူးကြီး တိုက်ပွဲ', how: 'Comment = ထိချက် ၁၊ Gift = ထိချက်အကြီး — အတူချကြမယ်' },
  { id: 'boatrace', label: 'အင်းလေး လှေပြိုင်', how: 'Comment 1–4 နဲ့ လှေရွေးပါ၊ Gift နဲ့ လှေကို ရှေ့တွန်းပါ' },
  { id: 'temple', label: 'ဘုရားဖူး', how: 'Comment ရေးရင် ခုံနေရာ ရမယ်၊ Gift ပို့ရင် ပူဇော်မှု ပေါ်မယ်' },
  { id: 'pagoda', label: 'စေတီဖူး', how: 'နေ့/ည အလိုက် scene ပြောင်းတယ်၊ Comment ရေးပြီး ဝင်ထိုင်ပါ' },
  { id: 'race', label: 'အပြေးပြိုင်', how: 'Comment / Like နဲ့ ကိုယ့်အပြေးသမားကို ရှေ့တိုးပါ' },
  { id: 'horse', label: 'မြင်းပြိုင်', how: 'Comment / Like နဲ့ မြင်းကို အားဖြည့်ပါ' },
  { id: 'boat', label: 'လှေပြိုင်', how: 'Comment / Like နဲ့ လှေကို ရှေ့တွန်းပါ' },
  { id: 'marble', label: 'ဂေါ်လီပြိုင်', how: 'Comment / Like နဲ့ ဂေါ်လီကို လှိမ့်ပါ' },
  { id: 'quiz', label: 'မေးခွန်း', how: 'အဖြေမှန်ကို Comment ရေးပါ — အရင်ဆုံးမှန်သူ အနိုင်ရမယ်' },
  { id: 'number', label: 'ဂဏန်းခန့်မှန်း', how: '1 မှ 100 ကြား ဂဏန်းတစ်ခုကို Comment ရေးပါ' },
  { id: 'climb', label: 'တောင်တက်', how: 'Comment ရေးရင် တစ်ဆင့်တက်မယ်၊ Gift ဆို ပိုတက်မယ်' },
  { id: 'penalty', label: 'ပင်နယ်တီ', how: 'ဘယ် / လယ် / ညာ တစ်ခုကို Comment ရေးပြီး ကန်ပါ' },
  { id: 'boss', label: 'Boss တိုက်ပွဲ', how: 'Comment = ထိချက် ၁၊ Gift = ထိချက်အကြီး — Boss ကို အတူချကြမယ်' },
  { id: 'peacock', label: 'ဒေါင်းအက', how: 'Like နဲ့ Comment တွေက ဒေါင်းအမွှေးတွေ ဖွင့်ပေးမယ်' },
  { id: 'thingyan', label: 'သင်္ကြန်', how: 'Comment နဲ့ ရေပက်၊ Gift နဲ့ ရေအကြီးပက်ပါ' },
  { id: 'region', label: 'ဒေသပြိုင်', how: 'ကိုယ့်ဒေသနာမည်ကို Comment ရေးပါ — ဥပမာ ရန်ကုန်၊ မန္တလေး၊ ရှမ်း' },
  { id: 'survival', label: 'အသက်ရှင်ကျန်', how: 'Comment ဆက်ရေးနေသူပဲ ကျန်မယ် — အလှည့်တိုင်း အနည်းဆုံးသူ ထွက်ရမယ်' },
];
const RACE_GAMES = new Set(['race', 'car', 'horse', 'boat', 'marble', 'boatrace']);
const VERSUS_GAMES = new Set(['lethwei', 'slap', 'soundtruck']);
export const COUNTRIES = [
  { code: 'MM', name: 'Myanmar', keys: ['mm', 'myanmar', 'မြန်မာ'] },
  { code: 'TH', name: 'Thailand', keys: ['th', 'thailand', 'ထိုင်း'] },
  { code: 'SG', name: 'Singapore', keys: ['sg', 'singapore', 'စင်ကာပူ'] },
  { code: 'JP', name: 'Japan', keys: ['jp', 'japan', 'ဂျပန်'] },
  { code: 'KR', name: 'Korea', keys: ['kr', 'korea', 'ကိုရီးယား'] },
  { code: 'MY', name: 'Malaysia', keys: ['my', 'malaysia', 'မလေးရှား'] },
  { code: 'CN', name: 'China', keys: ['cn', 'china', 'တရုတ်'] },
  { code: 'US', name: 'USA', keys: ['us', 'usa', 'america'] },
  { code: 'UK', name: 'UK', keys: ['uk', 'england'] },
  { code: 'AE', name: 'Dubai', keys: ['ae', 'dubai', 'ဒူဘိုင်း'] },
];
export const REGIONS = ['ရန်ကုန်', 'မန္တလေး', 'နေပြည်တော်', 'ရှမ်း', 'ကချင်', 'ကရင်', 'မွန်', 'ရခိုင်', 'ဧရာဝတီ', 'ပဲခူး', 'စစ်ကိုင်း', 'မကွေး', 'တနင်္သာရီ', 'ကယား', 'ချင်း'];
const LANE_NAMES = ['အနီ', 'အပြာ', 'အစိမ်း', 'အဝါ', 'ခရမ်း', 'လိမ္မော်'];

const rooms = new Map();
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || lo));
const clean = (s, max = 60) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const hashTeam = id => ([...String(id)].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 === 0 ? 'a' : 'b');

export function createRoomState(id, username = '') {
  return {
    id, username: clean(username.replace(/^@/, ''), 40), createdAt: Date.now(),
    game: 'tug', safeMode: true, tts: true, bgm: false,
    scores: { a: 0, b: 0 }, likes: 0, follows: 0, shares: 0, likeMilestone: 0,
    goal: { label: 'ပန်းတိုင်', target: 1000, current: 0, celebrated: false },
    viewers: new Map(), feed: [], lanes: LANE_NAMES.map((name, i) => ({ name, pos: 0, i })),
    regions: Object.fromEntries(REGIONS.map(r => [r, 0])),
    quiz: { question: 'မြန်မာနိုင်ငံရဲ့ မြို့တော်က ဘယ်မြို့လဲ?', choices: ['ရန်ကုန်', 'နေပြည်တော်', 'မန္တလေး'], answer: 'နေပြည်တော်', open: true, winner: '' },
    number: { target: 1 + Math.floor(Math.random() * 100), best: null, lastHint: '' },
    boss: { hp: 500, max: 500 }, feathers: 0, penalty: { goals: 0, saves: 0, last: '' },
    countries: Object.fromEntries(COUNTRIES.map(c => [c.code, 0])),
    garden: { hp: 100, kills: 0, wave: 1 },
    settings: { banner: 'Gift ပို့ပြီး ကိုယ့်အသင်းကို အားပေးပါ', teamA: 'ရန်ကုန်', teamB: 'မန္တလေး', roundSec: 120, winScore: 30, backdrop: '' },
    mapping: { gifts: {}, chatA: ['1'], chatB: ['2'] }, round: 1,
    tiktok: { status: 'idle', username: '', error: '', want: false, retries: 0 },
    clients: new Set(), conn: null,
  };
}

function ensureViewer(room, ev) {
  const id = clean(ev.id || ev.name || 'viewer', 80) || 'viewer';
  let v = room.viewers.get(id);
  if (!v) {
    v = { id, name: clean(ev.name, 30) || 'ကြည့်သူ', avatar: clean(ev.avatar, 300), team: hashTeam(id), lane: ([...id].reduce((a, c) => a + c.charCodeAt(0), 0) % room.lanes.length), score: 0, gifts: 0, chats: 0, climb: 0, alive: true, region: '', country: '', vip: false, joinedAt: Date.now() };
    room.viewers.set(id, v);
  }
  if (ev.name) v.name = clean(ev.name, 30);
  if (ev.avatar) v.avatar = clean(ev.avatar, 300);
  return v;
}

export function publicState(room) {
  const viewers = [...room.viewers.values()].sort((x, y) => y.score - x.score).slice(0, 60);
  const donors = [...room.viewers.values()].filter(v => v.gifts > 0).sort((x, y) => y.gifts - x.gifts).slice(0, 5)
    .map(v => ({ name: v.name, gifts: v.gifts }));
  return {
    id: room.id, username: room.username, game: room.game, games: GAMES,
    safeMode: room.safeMode, tts: room.tts, bgm: room.bgm,
    scores: room.scores, likes: room.likes, follows: room.follows, shares: room.shares,
    goal: room.goal, viewers, donors, feed: room.feed.slice(-25),
    lanes: room.lanes, regions: room.regions, quiz: room.quiz,
    number: { best: room.number.best, lastHint: room.number.lastHint },
    boss: room.boss, feathers: room.feathers, penalty: room.penalty,
    countries: room.countries, countryList: COUNTRIES, garden: room.garden,
    settings: room.settings, mapping: room.mapping, round: room.round,
    tiktok: { status: room.tiktok.status, username: room.tiktok.username, error: room.tiktok.error },
  };
}

function broadcast(room, msg) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const res of room.clients) { try { res.write(data); } catch { room.clients.delete(res); } }
}
const pushState = room => broadcast(room, { type: 'state', state: publicState(room) });
const fx = (room, f) => broadcast(room, { type: 'fx', fx: f });

export function applyEvent(room, ev) {
  const kind = ev.kind;
  if (kind === 'join') {
    const v = ensureViewer(room, ev);
    fx(room, { kind: 'welcome', name: v.name, say: room.tts ? `${v.name} ကို ကြိုဆိုပါတယ်` : '' });
  } else if (kind === 'chat') {
    const v = ensureViewer(room, ev);
    const text = clean(ev.text, 160);
    v.chats++; v.score += 1;
    room.feed.push({ name: v.name, text, at: Date.now() });
    const t = text.trim();
    const tl = t.toLowerCase();
    if (room.game === 'flagbattle') {
      const c = COUNTRIES.find(x => x.keys.some(k => tl === k || tl.includes(k)));
      if (c) { v.country = c.code; room.countries[c.code]++; }
      else if (v.country) room.countries[v.country]++;
    } else if (room.game === 'garden') {
      room.garden.kills++; room.garden.wave = 1 + Math.floor(room.garden.kills / 20);
      fx(room, { kind: 'shot', name: v.name, row: /^[1-5]$/.test(t) ? Number(t) : 0 });
    } else if (VERSUS_GAMES.has(room.game)) {
      if (room.mapping.chatA.some(k => tl === k || tl.includes(k)) || t.includes(room.settings.teamA)) { v.team = 'a'; room.scores.a++; }
      else if (room.mapping.chatB.some(k => tl === k || tl.includes(k)) || t.includes(room.settings.teamB)) { v.team = 'b'; room.scores.b++; }
      else room.scores[v.team]++;
    } else if (room.game === 'partytruck') {
      fx(room, { kind: 'rider', name: v.name });
    } else if (room.game === 'boatrace') {
      if (/^[1-4]$/.test(t)) v.lane = Number(t) - 1;
      room.lanes[v.lane % 4].pos += 1;
    } else if (room.game === 'monster') {
      room.boss.hp = Math.max(0, room.boss.hp - 1);
      if (room.boss.hp === 0) fx(room, { kind: 'bossDown', say: 'ဘီလူးကြီးကို အနိုင်ရပါပြီ' });
    } else if (room.game === 'tug' || room.game === 'thingyan') {
      if (t === '1' || t.includes('အနီ')) { v.team = 'a'; room.scores.a++; }
      else if (t === '2' || t.includes('အပြာ')) { v.team = 'b'; room.scores.b++; }
      else room.scores[v.team]++;
    } else if (RACE_GAMES.has(room.game)) {
      room.lanes[v.lane].pos += 1;
      const lead = room.lanes.reduce((m, l) => l.pos > m.pos ? l : m, room.lanes[0]);
      if (lead.pos >= 60) fx(room, { kind: 'raceWin', name: lead.name, say: `${lead.name} အနိုင်ရပါပြီ` });
    } else if (room.game === 'quiz' && room.quiz.open) {
      if (t.toLowerCase() === room.quiz.answer.trim().toLowerCase()) {
        room.quiz.open = false; room.quiz.winner = v.name; v.score += 20;
        fx(room, { kind: 'quizWin', name: v.name, say: `${v.name} အဖြေမှန်ပါပြီ` });
      }
    } else if (room.game === 'number') {
      const n = parseInt(t, 10);
      if (Number.isInteger(n) && n >= 1 && n <= 100) {
        const dist = Math.abs(n - room.number.target);
        if (!room.number.best || dist < room.number.best.dist) room.number.best = { name: v.name, guess: n, dist };
        room.number.lastHint = n === room.number.target ? 'မှန်ပါပြီ' : (n < room.number.target ? 'ပိုကြီးတဲ့ ဂဏန်း' : 'ပိုသေးတဲ့ ဂဏန်း');
        if (n === room.number.target) {
          v.score += 20; fx(room, { kind: 'numberWin', name: v.name, say: `${v.name} ဂဏန်း ${n} မှန်ပါပြီ` });
          room.number.target = 1 + Math.floor(Math.random() * 100); room.number.best = null; room.number.lastHint = 'အလှည့်သစ် စပါပြီ';
        }
      }
    } else if (room.game === 'region') {
      const r = REGIONS.find(x => t.includes(x));
      if (r) { room.regions[r]++; v.region = r; }
    } else if (room.game === 'climb') {
      v.climb += 1;
    } else if (room.game === 'penalty') {
      const pick = t.includes('ဘယ်') || /left/i.test(t) ? 0 : t.includes('ညာ') || /right/i.test(t) ? 2 : t.includes('လယ်') || /center|middle/i.test(t) ? 1 : -1;
      if (pick >= 0) {
        const keeper = Math.floor(Math.random() * 3);
        if (pick === keeper) { room.penalty.saves++; room.penalty.last = `${v.name} ကန်တာ ဂိုးသမား ဖမ်းမိတယ်`; }
        else { room.penalty.goals++; v.score += 5; room.penalty.last = `${v.name} ဂိုးသွင်းလိုက်ပြီ`; fx(room, { kind: 'goal', name: v.name, say: `${v.name} ဂိုးသွင်းလိုက်ပါပြီ` }); }
      }
    } else if (room.game === 'boss') {
      room.boss.hp = Math.max(0, room.boss.hp - 1);
      if (room.boss.hp === 0) fx(room, { kind: 'bossDown', say: 'Boss ကို အနိုင်ရပါပြီ' });
    } else if (room.game === 'peacock') {
      room.feathers = Math.min(24, room.feathers + 1);
    }
    fx(room, { kind: 'chat', name: v.name, text });
  } else if (kind === 'like') {
    const v = ensureViewer(room, ev);
    const n = clamp(ev.count || 1, 1, 100000);
    room.likes += n;
    const milestone = Math.floor(room.likes / 1000);
    if (milestone > room.likeMilestone) { room.likeMilestone = milestone; fx(room, { kind: 'milestone', likes: room.likes, say: `Like ${room.likes.toLocaleString()} ပြည့်ပါပြီ` }); }
    if (room.game === 'flagbattle') room.countries[v.country || 'MM'] += 1;
    else if (room.game === 'garden') { room.garden.kills += Math.min(5, Math.ceil(n / 5)); room.garden.wave = 1 + Math.floor(room.garden.kills / 20); }
    else if (room.game === 'monster') room.boss.hp = Math.max(0, room.boss.hp - Math.min(5, Math.ceil(n / 5)));
    else if (VERSUS_GAMES.has(room.game)) room.scores[v.team] += 1;
    else if (RACE_GAMES.has(room.game)) room.lanes[v.lane % (room.game === 'boatrace' ? 4 : room.lanes.length)].pos += Math.min(5, Math.ceil(n / 5));
    else if (room.game === 'peacock') room.feathers = Math.min(24, room.feathers + 1);
    else if (room.game === 'tug' || room.game === 'thingyan') room.scores[v.team] += 1;
  } else if (kind === 'gift') {
    const v = ensureViewer(room, ev);
    const giftName = clean(ev.gift || 'လက်ဆောင်', 40);
    const mapped = room.mapping.gifts[giftName.toLowerCase()];
    const value = (mapped ? clamp(mapped, 1, 100000) : clamp(ev.diamonds || 1, 1, 100000)) * clamp(ev.count || 1, 1, 999);
    v.gifts += value; v.score += value;
    room.goal.current += value;
    if (!room.goal.celebrated && room.goal.current >= room.goal.target) { room.goal.celebrated = true; fx(room, { kind: 'goalReached', say: 'ပန်းတိုင် ပြည့်ပါပြီ' }); }
    if (room.game === 'flagbattle') { const code = v.country || 'MM'; room.countries[code] += Math.max(1, Math.ceil(value / 5)); if (value >= 500) fx(room, { kind: 'titan', name: v.name, code, say: `${v.name} TITAN MODE` }); }
    else if (room.game === 'garden') { room.garden.kills += Math.max(1, Math.ceil(value / 10)); room.garden.wave = 1 + Math.floor(room.garden.kills / 20); }
    else if (room.game === 'partytruck') { if (value >= 50) v.vip = true; }
    else if (VERSUS_GAMES.has(room.game)) room.scores[v.team] += Math.max(1, Math.ceil(value / 10));
    else if (room.game === 'boss' || room.game === 'monster') { room.boss.hp = Math.max(0, room.boss.hp - Math.max(1, value)); if (room.boss.hp === 0) fx(room, { kind: 'bossDown', say: 'Boss ကို အနိုင်ရပါပြီ' }); }
    else if (room.game === 'climb') v.climb += Math.max(1, Math.ceil(value / 5));
    else if (RACE_GAMES.has(room.game)) room.lanes[v.lane % (room.game === 'boatrace' ? 4 : room.lanes.length)].pos += Math.max(1, Math.ceil(value / 5));
    else if (room.game === 'tug' || room.game === 'thingyan') room.scores[v.team] += Math.max(1, Math.ceil(value / 10));
    fx(room, { kind: 'gift', name: v.name, gift: giftName, value, say: room.tts ? `${v.name} က ${giftName} ပို့လို့ ကျေးဇူးတင်ပါတယ်` : '' });
  } else if (kind === 'follow') {
    const v = ensureViewer(room, ev); room.follows++;
    if (room.game === 'partytruck') v.vip = true;
    fx(room, { kind: 'follow', name: v.name, say: room.tts ? `${v.name} Follow လုပ်လို့ ကျေးဇူးတင်ပါတယ်` : '' });
  } else if (kind === 'share') {
    const v = ensureViewer(room, ev); room.shares++;
    fx(room, { kind: 'share', name: v.name, say: room.tts ? `${v.name} Share လုပ်လို့ ကျေးဇူးတင်ပါတယ်` : '' });
  }
  pushState(room);
}

function applyControl(room, m) {
  switch (m.action) {
    case 'setGame': if (GAMES.some(g => g.id === m.game)) room.game = m.game; break;
    case 'setGoal': room.goal = { label: clean(m.label, 40) || 'ပန်းတိုင်', target: clamp(m.target, 1, 10000000), current: room.goal.current, celebrated: room.goal.current >= clamp(m.target, 1, 10000000) }; break;
    case 'resetScores': room.scores = { a: 0, b: 0 }; room.lanes.forEach(l => l.pos = 0); room.regions = Object.fromEntries(REGIONS.map(r => [r, 0])); room.feathers = 0; room.penalty = { goals: 0, saves: 0, last: '' }; room.boss = { hp: room.boss.max, max: room.boss.max }; room.countries = Object.fromEntries(COUNTRIES.map(c => [c.code, 0])); room.garden = { hp: 100, kills: 0, wave: 1 }; for (const v of room.viewers.values()) { v.score = 0; v.climb = 0; v.chats = 0; v.alive = true; v.vip = false; } break;
    case 'resetRound': room.scores = { a: 0, b: 0 }; room.lanes.forEach(l => l.pos = 0); room.countries = Object.fromEntries(COUNTRIES.map(c => [c.code, 0])); room.garden = { hp: 100, kills: 0, wave: 1 }; room.boss = { hp: room.boss.max, max: room.boss.max }; room.round++; break;
    case 'setSettings': room.settings = { banner: clean(m.banner, 120) || room.settings.banner, teamA: clean(m.teamA, 30) || room.settings.teamA, teamB: clean(m.teamB, 30) || room.settings.teamB, roundSec: clamp(m.roundSec, 15, 3600), winScore: clamp(m.winScore, 1, 100000), backdrop: clean(m.backdrop, 40) }; break;
    case 'setMapping': {
      const gifts = {};
      if (m.gifts && typeof m.gifts === 'object') for (const [k, val] of Object.entries(m.gifts).slice(0, 40)) { const key = clean(k, 40).toLowerCase(); if (key) gifts[key] = clamp(val, 1, 100000); }
      const kw = a => Array.isArray(a) ? a.slice(0, 10).map(x => clean(x, 30).toLowerCase()).filter(Boolean) : [];
      room.mapping = { gifts, chatA: kw(m.chatA).length ? kw(m.chatA) : ['1'], chatB: kw(m.chatB).length ? kw(m.chatB) : ['2'] };
      break;
    }
    case 'clearViewers': room.viewers.clear(); room.feed = []; break;
    case 'quiz': room.quiz = { question: clean(m.question, 160), choices: Array.isArray(m.choices) ? m.choices.slice(0, 4).map(c => clean(c, 60)) : [], answer: clean(m.answer, 60), open: true, winner: '' }; break;
    case 'numberNew': room.number = { target: 1 + Math.floor(Math.random() * 100), best: null, lastHint: 'အလှည့်သစ် စပါပြီ' }; break;
    case 'bossReset': room.boss = { hp: clamp(m.hp, 10, 100000), max: clamp(m.hp, 10, 100000) }; break;
    case 'eliminate': {
      const alive = [...room.viewers.values()].filter(v => v.alive).sort((x, y) => x.chats - y.chats);
      if (alive.length > 1) { alive[0].alive = false; fx(room, { kind: 'eliminated', name: alive[0].name, say: `${alive[0].name} ထွက်ရပါပြီ` }); }
      for (const v of room.viewers.values()) v.chats = 0;
      break;
    }
    case 'sound': fx(room, { kind: 'sound', sound: clean(m.sound, 20) }); break;
    case 'bgm': room.bgm = !!m.on; fx(room, { kind: 'bgm', on: room.bgm }); break;
    case 'tts': room.tts = !!m.on; break;
    case 'safeMode': room.safeMode = !!m.on; break;
  }
  pushState(room);
}

/* ------------------------------------------------------------- TikTok */
async function connectTikTok(room, username) {
  username = clean(String(username || '').replace(/^.*tiktok\.com\/@?/i, '').replace(/^@/, '').replace(/\/.*$/, ''), 40);
  if (!username) return;
  room.tiktok = { status: 'connecting', username, error: '', want: true, retries: room.tiktok.retries || 0 };
  room.username = username; pushState(room);
  try {
    if (parseInt(process.versions.node, 10) < 18) throw new Error('Node 18+ လိုပါတယ် (node -v နဲ့ စစ်ပါ)');
    const { TikTokLive } = await import('ttl-live');
    const conn = new TikTokLive('@' + username);
    room.conn = conn;
    const user = u => ({ id: u?.uniqueId || u?.userId || u?.nickname, name: u?.nickname || u?.uniqueId || 'ကြည့်သူ', avatar: u?.avatarUrl || '' });
    conn.on('chat', d => applyEvent(room, { kind: 'chat', ...user(d.user), text: d.comment }));
    conn.on('gift', d => { if (d.streakable && !d.repeatEnd) return; applyEvent(room, { kind: 'gift', ...user(d.user), gift: d.giftName, diamonds: d.diamondCount ?? 1, count: d.repeatCount || 1 }); });
    conn.on('member', d => applyEvent(room, { kind: 'join', ...user(d.user) }));
    conn.on('like', d => applyEvent(room, { kind: 'like', ...user(d.user), count: d.count || d.likeCount || 1 }));
    conn.on('social', d => { if (d.action === 1) applyEvent(room, { kind: 'follow', ...user(d.user) }); else if (d.action === 3) applyEvent(room, { kind: 'share', ...user(d.user) }); });
    conn.on('connected', () => { room.tiktok.status = 'connected'; room.tiktok.error = ''; room.tiktok.retries = 0; pushState(room); });
    conn.on('disconnected', () => {
      room.tiktok.status = 'disconnected'; pushState(room);
      if (room.tiktok.want && room.tiktok.retries < 5) { room.tiktok.retries++; setTimeout(() => { if (room.tiktok.want) connectTikTok(room, username); }, 5000); }
    });
    conn.on('error', e => { room.tiktok.error = String(e?.message || e); pushState(room); });
    await conn.connect();
    room.tiktok.status = 'connected'; room.tiktok.retries = 0;
  } catch (e) {
    room.tiktok.status = 'error';
    room.tiktok.error = String(e?.message || e) + ' — LIVE အရင်ဖွင့်ထားတာ သေချာလား စစ်ပါ၊ npm install လုပ်ထားလား စစ်ပါ';
  }
  pushState(room);
}
function disconnectTikTok(room) {
  room.tiktok.want = false;
  try { room.conn?.disconnect(); } catch { /* already closed */ }
  room.conn = null; room.tiktok = { status: 'idle', username: '', error: '', want: false, retries: 0 };
  pushState(room);
}

/* ------------------------------------------------------------- HTTP */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
function sendJson(res, code, obj) { res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''; req.on('data', c => { data += c; if (data.length > 100000) req.destroy(); });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}
function serveFile(res, file) {
  const full = path.join(PUB, file);
  if (!full.startsWith(PUB) || !fs.existsSync(full)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(full)] || 'application/octet-stream' });
  fs.createReadStream(full).pipe(res);
}
function getRoom(id) {
  if (id === 'main' && !rooms.has('main')) rooms.set('main', createRoomState('main', ''));
  if (id === 'demo' && !rooms.has('demo')) {
    const r = createRoomState('demo', 'demo');
    ['မေသူ', 'ကိုဖြိုး', 'အေးမြတ်', 'သက်ထား', 'ကျော်ကျော်', 'နှင်းနှင်း'].forEach((name, i) => ensureViewer(r, { id: 'demo_' + i, name }));
    rooms.set('demo', r);
  }
  return rooms.get(id);
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const parts = url.pathname.split('/').filter(Boolean);
    try {
      if (req.method === 'GET' && url.pathname === '/') return serveFile(res, 'index.html');
      if (req.method === 'GET' && (url.pathname === '/dashboard' || url.pathname === '/control' || url.pathname === '/live/control.html')) return serveFile(res, 'dashboard.html');
      if (req.method === 'GET' && url.pathname === '/guide') return serveFile(res, 'guide.html');
      if (req.method === 'GET' && (url.pathname === '/overlay' || url.pathname === '/live/overlay.html')) return serveFile(res, 'overlay.html');
      if (req.method === 'GET' && parts[0] === 'o' && parts[1]) return serveFile(res, 'overlay.html');
      if (req.method === 'GET' && parts[0] === 'public') return serveFile(res, parts.slice(1).join('/'));
      if (req.method === 'POST' && url.pathname === '/api/rooms') {
        const body = await readBody(req);
        const id = 'MM-' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const room = createRoomState(id, body.username || '');
        rooms.set(id, room);
        return sendJson(res, 201, { id, overlay: `/o/${id}`, dashboard: `/dashboard?room=${id}` });
      }
      if (parts[0] === 'api' && parts[1] === 'rooms' && parts[2]) {
        const room = getRoom(parts[2]);
        if (!room) return sendJson(res, 404, { error: 'room not found' });
        if (req.method === 'GET' && parts[3] === 'state') return sendJson(res, 200, publicState(room));
        if (req.method === 'GET' && parts[3] === 'events') {
          res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
          res.write(`data: ${JSON.stringify({ type: 'state', state: publicState(room) })}\n\n`);
          room.clients.add(res);
          const keep = setInterval(() => { try { res.write(': keepalive\n\n'); } catch { clearInterval(keep); } }, 25000);
          req.on('close', () => { clearInterval(keep); room.clients.delete(res); });
          return;
        }
        if (req.method === 'POST' && parts[3] === 'sim') { applyEvent(room, await readBody(req)); return sendJson(res, 200, { ok: true }); }
        if (req.method === 'POST' && parts[3] === 'control') { applyControl(room, await readBody(req)); return sendJson(res, 200, { ok: true }); }
        if (req.method === 'POST' && parts[3] === 'connect') { const b = await readBody(req); connectTikTok(room, b.username || room.username); return sendJson(res, 202, { ok: true }); }
        if (req.method === 'POST' && parts[3] === 'disconnect') { disconnectTikTok(room); return sendJson(res, 200, { ok: true }); }
      }
      res.writeHead(404); res.end('not found');
    } catch (e) { sendJson(res, 400, { error: String(e?.message || e) }); }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`Myanmar Live Studio: http://localhost:${PORT}`);
    for (const list of Object.values(os.networkInterfaces())) for (const n of list || []) if (n.family === 'IPv4' && !n.internal) console.log(`LAN: http://${n.address}:${PORT}`);
    if (parseInt(process.versions.node, 10) < 18) console.log('⚠️ Node 18+ လိုပါတယ် TikTok ချိတ်ဖို့ (node -v နဲ့ စစ်ပါ)');
  });
}
