/* app.js — Duo Lane
   Zasada: pisze się jak w notatniku. Nic nie trzeba zatwierdzać.
   Zapis: localStorage natychmiast + Firestore w tle (debounce). */

import { EX, P, TOGETHER1, SPLIT, TOGETHER2, NUTRITION, NAMES } from './data.js';
import {
  pushLive, readLive, dropLive, finishSession, fetchSessions,
  addBody, fetchBody, saveSettings, loadSettings
} from './firebase.js';

/* ---------- utils ---------- */
const $ = s => document.querySelector(s);
const app = () => $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const now = () => Date.now();
const REST_MS = 2 * 60 * 1000;
const LONG_REST_MS = 3 * 60 * 1000;
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const dayId = ts => new Date(ts).toISOString().slice(0, 10);
const fmtDate = ts => new Date(ts).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
const mmss = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };

/* ---------- stan ---------- */
const LS_LIVE = 'duolane.live.v2';
const LS_HIST = 'duolane.hist.v2';

const state = {
  route: 'train',
  session: lsGet(LS_LIVE, null),   // aktywny trening
  history: lsGet(LS_HIST, []),     // cache Firestore
  body: [],
  settings: { kcalMin: 900, kcalMax: 1000, goalKg: null, ratePerWeek: null },
  synced: false
};

/* ---------- plan sesji ---------- */
function buildPlan(mode) {
  const items = [];
  const add = (id, who) => items.push({ id, who, sets: EX[id].sets });
  if (mode === 'ana') {
    SPLIT.ana.forEach(id => add(id, ['ana']));
    TOGETHER2.forEach(id => add(id, ['ana']));
    return items;
  }
  if (mode === 'martin') {
    TOGETHER1.forEach(id => add(id, ['martin']));
    SPLIT.martin.forEach(id => add(id, ['martin']));
    TOGETHER2.forEach(id => add(id, ['martin']));
    return items;
  }
  TOGETHER1.forEach(id => add(id, ['martin', 'ana']));
  SPLIT.martin.forEach(id => add(id, ['martin']));
  SPLIT.ana.forEach(id => add(id, ['ana']));
  TOGETHER2.forEach(id => add(id, ['martin', 'ana']));
  return items;
}

function newSession(mode) {
  const startedAt = now();
  return {
    docId: dayId(startedAt) + '-' + mode,
    mode, startedAt,
    plan: buildPlan(mode),
    entries: {},          // "exId|person|setNo" -> {kg,reps,ts}
    restEndsAt: 0,
    restNote: ''
  };
}

const key = (ex, person, n) => `${ex}|${person}|${n}`;

/* ---------- zapis ---------- */
let syncTimer = null;
function persist(immediate = false) {
  lsSet(LS_LIVE, state.session);
  clearTimeout(syncTimer);
  const run = () => {
    if (!state.session) return;
    pushLive(state.session.docId, state.session).catch(() => {});
  };
  if (immediate) run(); else syncTimer = setTimeout(run, 1200);
}

/* ---------- historia ---------- */
function lastResult(exId, person) {
  for (const s of state.history) {
    const rows = (s.rows || []).filter(r => r.ex === exId && r.person === person);
    if (rows.length) return rows[rows.length - 1];
  }
  return null;
}
function bestResult(exId, person) {
  let b = null;
  state.history.forEach(s => (s.rows || []).forEach(r => {
    if (r.ex !== exId || r.person !== person) return;
    const score = r.kg * (1 + r.reps / 30);
    if (!b || score > b.kg * (1 + b.reps / 30)) b = r;
  }));
  return b;
}

/* ---------- trener progresji ---------- */
function coach(exId, person, kg, reps) {
  if (!kg || !reps) return '';
  const tech = !!EX[exId].tech;               // skos Martina
  if (reps < 6) return 'Za ciężko — następnym razem zejdź o jeden przeskok maszyny.';
  if (tech && reps >= 12) return 'Czas na +2,5 kg.';
  if (!tech && reps > 10) return 'Lekko poszło — dołóż ciężaru.';
  return '';
}
function strengthDrop(exId, person, setNo, kg, reps) {
  if (setNo < 2) return false;
  const p = state.session.entries[key(exId, person, setNo - 1)];
  if (!p || !p.reps) return false;
  return reps <= p.reps - 3;
}

/* ---------- render: nawigacja ---------- */
function tabs() {
  const t = [['train','Trening'],['stats','Historia'],['martin','Martin']];
  return `<nav class="tabs">${t.map(([r,l])=>
    `<button class="tab${state.route===r?' on':''}" data-nav="${r}">${l}</button>`).join('')}</nav>`;
}

function render() {
  const v = state.route === 'stats' ? viewStats()
          : state.route === 'martin' ? viewMartin()
          : state.session ? viewSession() : viewStart();
  app().innerHTML = v + tabs();
}

/* ---------- widok: start ---------- */
function viewStart() {
  const n = state.history.length;
  const last = state.history[0];
  return `
  <header class="head">
    <span class="eyebrow">Duo Lane</span>
    <h1>Zapisz trening<em>w trzech dotknięciach.</em></h1>
  </header>
  <section class="start">
    <div class="meta">${n ? `${n} treningów · ostatni ${fmtDate(last.startedAt)}` : 'Jeszcze nic tu nie ma. Pierwszy trening zaczyna historię.'}</div>
    <button class="big m" data-start="duo">Trening razem</button>
    <button class="big a" data-start="ana">Ana sama</button>
    <button class="big m ghost" data-start="martin">Martin sam</button>
  </section>`;
}

/* ---------- widok: sesja ---------- */
function rowHTML(exId, person, n, locked) {
  const e = state.session.entries[key(exId, person, n)] || {};
  const prevR = lastResult(exId, person);
  const hint = prevR ? `${prevR.kg} × ${prevR.reps}` : '—';
  const cls = person === 'martin' ? 'm' : 'a';
  const tip = e.kg && e.reps ? coach(exId, person, e.kg, e.reps) : '';
  return `
  <div class="row ${cls}${locked ? ' locked' : ''}" data-ex="${exId}" data-person="${person}" data-set="${n}">
    <div class="who"><b>${P[person].name}</b><span>S${n}</span></div>
    <div class="fields">
      <label class="f"><input type="number" inputmode="decimal" step="1" class="kg" value="${e.kg ?? ''}" placeholder="${prevR ? prevR.kg : 'kg'}" ${locked?'disabled':''}><i>kg</i></label>
      <span class="x">×</span>
      <label class="f"><input type="number" inputmode="numeric" step="1" class="reps" value="${e.reps ?? ''}" placeholder="${prevR ? prevR.reps : 'powt'}" ${locked?'disabled':''}><i>powt</i></label>
      ${locked ? `<span class="lock" title="Przerwa">🔒 <em data-lock>${mmss(state.session.restEndsAt - now())}</em></span>`
               : `<button class="same" data-same title="Jak poprzednio">↺</button>`}
    </div>
    <div class="hintline"><span class="prev">poprzednio ${hint}</span>${tip ? `<span class="tip">${esc(tip)}</span>` : ''}</div>
  </div>`;
}

function exerciseHTML(item, idx) {
  const ex = EX[item.id];
  const locked = now() < state.session.restEndsAt;
  const rows = [];
  for (let n = 1; n <= item.sets; n++) {
    // blokada dotyczy tylko pierwszej niewypełnionej serii w kolejce
    const filled = item.who.every(p => {
      const e = state.session.entries[key(item.id, p, n)];
      return e && e.kg && e.reps;
    });
    item.who.forEach(p => rows.push(rowHTML(item.id, p, n, locked && !filled && isNextUp(item, n))));
  }
  const done = item.who.length * item.sets;
  const have = item.who.reduce((a, p) => a + Array.from({length:item.sets},(_,i)=>state.session.entries[key(item.id,p,i+1)]).filter(e=>e&&e.kg&&e.reps).length, 0);
  return `
  <article class="card${have===done?' done':''}">
    <div class="cardhead">
      <div><h3>${esc(ex.n)}</h3><p>${esc(ex.sub)} · ${esc(ex.grp)}</p></div>
      <span class="count">${have}/${done}</span>
    </div>
    ${rows.join('')}
  </article>`;
}

function isNextUp(item, n) {
  // pierwszy niekompletny slot w całej sesji
  for (const it of state.session.plan) {
    for (let i = 1; i <= it.sets; i++) {
      const complete = it.who.every(p => { const e = state.session.entries[key(it.id, p, i)]; return e && e.kg && e.reps; });
      if (!complete) return it.id === item.id && i === n;
    }
  }
  return false;
}

function viewSession() {
  const s = state.session;
  const total = s.plan.reduce((a, i) => a + i.sets * i.who.length, 0);
  const done = Object.values(s.entries).filter(e => e.kg && e.reps).length;
  const locked = now() < s.restEndsAt;
  return `
  <header class="shead">
    <div><span class="eyebrow">${s.mode === 'duo' ? 'Razem' : s.mode === 'ana' ? 'Ana' : 'Martin'}</span>
    <b>${done}/${total} serii</b></div>
    <button class="finish" data-finish>Zakończ</button>
  </header>
  ${locked ? `<div class="restbar">🔒 Przerwa <em data-lock>${mmss(s.restEndsAt - now())}</em>${s.restNote ? ` · ${esc(s.restNote)}` : ''} <button data-skiprest>pomiń</button></div>` : ''}
  <div class="bar"><i style="width:${total ? (done/total*100) : 0}%"></i></div>
  <main class="feed">${s.plan.map(exerciseHTML).join('')}</main>`;
}

/* ---------- widok: historia / staty ---------- */
function viewStats() {
  if (!state.history.length) {
    return `<header class="head"><span class="eyebrow">Historia</span><h1>Pusto.<em>Zrób pierwszy trening.</em></h1></header>
    <section class="empty">Każdy zakończony trening ląduje tutaj i w chmurze.</section>`;
  }
  const cards = state.history.slice(0, 30).map(s => {
    const rows = s.rows || [];
    const byEx = {};
    rows.forEach(r => { (byEx[r.ex] ||= []).push(r); });
    return `<article class="card">
      <div class="cardhead"><div><h3>${fmtDate(s.startedAt)}</h3><p>${rows.length} serii · ${s.mode === 'duo' ? 'razem' : s.mode}</p></div></div>
      ${Object.entries(byEx).map(([id, rs]) => {
        const top = rs.reduce((a,b)=> (b.kg*(1+b.reps/30) > a.kg*(1+a.reps/30) ? b : a));
        return `<div class="hrow"><span>${esc(EX[id]?.n || id)}</span><b class="${top.person==='martin'?'m':'a'}">${top.kg} × ${top.reps}</b></div>`;
      }).join('')}
    </article>`;
  }).join('');
  const records = Object.keys(EX).map(id => {
    const m = bestResult(id, 'martin'), a = bestResult(id, 'ana');
    if (!m && !a) return '';
    return `<div class="hrow"><span>${esc(EX[id].n)}</span><b>${m ? `<i class="m">${m.kg}×${m.reps}</i>` : ''}${a ? `<i class="a">${a.kg}×${a.reps}</i>` : ''}</b></div>`;
  }).join('');
  return `<header class="head"><span class="eyebrow">Historia</span><h1>${state.history.length} treningów<em>i rosnące rekordy.</em></h1></header>
  <article class="card"><div class="cardhead"><div><h3>Rekordy</h3><p>najlepsza seria na ćwiczenie</p></div></div>${records}</article>
  ${cards}
  <div class="tools"><button data-export>Pobierz kopię (JSON)</button></div>`;
}

/* ---------- widok: Martin ---------- */
function shake(kcalMin, kcalMax) {
  const base = ['protein', 'banana', 'milk'].map(k => NUTRITION[k]);
  const target = (kcalMin + kcalMax) / 2;
  const kcalBase = base.reduce((a, x) => a + x.kcal, 0);
  const pb = NUTRITION.peanut;
  let g = Math.max(0, Math.round((target - kcalBase) / (pb.kcal / 100) / 5) * 5);
  const parts = [...base.map(x => ({ x, f: 1 })), { x: pb, f: g / 100 }];
  const sum = (sel) => parts.reduce((a, p) => a + (sel(p.x) || 0) * p.f, 0);
  const micro = {};
  parts.forEach(p => {
    Object.entries({ ...(p.x.vit || {}), ...(p.x.min || {}) }).forEach(([k, v]) => micro[k] = (micro[k] || 0) + v * p.f);
  });
  return {
    g, kcal: Math.round(sum(x => x.kcal)), p: Math.round(sum(x => x.p)),
    c: Math.round(sum(x => x.c)), f: Math.round(sum(x => x.f)), fiber: Math.round(sum(x => x.fiber)),
    micro
  };
}

function viewMartin() {
  const s = shake(state.settings.kcalMin, state.settings.kcalMax);
  const bw = state.body;
  const lastBw = bw[0];
  const microRows = Object.entries(s.micro).map(([k, v]) =>
    `<div class="hrow"><span>${esc(NAMES[k] || k)}</span><b>${v >= 10 ? Math.round(v) : v.toFixed(1)}</b></div>`).join('');
  return `
  <header class="head"><span class="eyebrow">Martin</span><h1>Masa i shake<em>bez zgadywania.</em></h1></header>
  <article class="card">
    <div class="cardhead"><div><h3>Masa ciała</h3><p>${lastBw ? `${lastBw.kg} kg · ${fmtDate(lastBw.ts)}` : 'brak wpisów'}</p></div></div>
    <div class="inline">
      <input type="number" step="0.1" inputmode="decimal" id="bwkg" placeholder="kg">
      <input type="text" id="bwnote" placeholder="notatka / samopoczucie">
      <button data-bw>Dodaj</button>
    </div>
    ${bw.slice(0, 8).map(b => `<div class="hrow"><span>${fmtDate(b.ts)}${b.note ? ' · ' + esc(b.note) : ''}</span><b class="m">${b.kg} kg</b></div>`).join('')}
    <div class="inline">
      <input type="number" step="0.1" id="goal" placeholder="cel kg" value="${state.settings.goalKg ?? ''}">
      <input type="number" step="0.05" id="rate" placeholder="kg / tydzień" value="${state.settings.ratePerWeek ?? ''}">
      <button data-goal>Zapisz cel</button>
    </div>
  </article>
  <article class="card">
    <div class="cardhead"><div><h3>Shake</h3><p>mleko 250 ml · białko 30 g · banan</p></div>
      <select id="range">
        ${[[900,1000],[1000,1100],[1100,1200]].map(([a,b])=>`<option value="${a}-${b}"${state.settings.kcalMin===a?' selected':''}>${a}–${b} kcal</option>`).join('')}
      </select>
    </div>
    <div class="pb">Masło orzechowe: <b>${s.g} g</b></div>
    <div class="macros">
      <div><b>${s.kcal}</b><span>kcal</span></div>
      <div><b>${s.p} g</b><span>białko</span></div>
      <div><b>${s.c} g</b><span>węgle</span></div>
      <div><b>${s.f} g</b><span>tłuszcz</span></div>
      <div><b>${s.fiber} g</b><span>błonnik</span></div>
    </div>
    <details><summary>Witaminy i minerały</summary>${microRows}</details>
  </article>`;
}

/* ---------- interakcje ---------- */
document.addEventListener('click', async (e) => {
  const t = e.target.closest('[data-nav],[data-start],[data-finish],[data-same],[data-skiprest],[data-bw],[data-goal],[data-export]');
  if (!t) return;

  if (t.dataset.nav) { state.route = t.dataset.nav; render(); if (t.dataset.nav === 'martin') refreshMartin(); return; }

  if (t.dataset.start) { state.session = newSession(t.dataset.start); persist(true); state.route = 'train'; render(); return; }

  if ('skiprest' in t.dataset) { state.session.restEndsAt = 0; persist(true); render(); return; }

  if ('same' in t.dataset) {
    const row = t.closest('.row');
    const prevR = lastResult(row.dataset.ex, row.dataset.person);
    if (prevR) { writeEntry(row.dataset.ex, row.dataset.person, +row.dataset.set, prevR.kg, prevR.reps); render(); }
    return;
  }

  if ('finish' in t.dataset) { await finish(); return; }

  if ('bw' in t.dataset) {
    const kg = parseFloat($('#bwkg').value); if (!kg) return;
    const entry = { kg, note: $('#bwnote').value.trim(), ts: now() };
    state.body.unshift(entry); render();
    addBody(entry).catch(() => {});
    return;
  }

  if ('goal' in t.dataset) {
    state.settings.goalKg = parseFloat($('#goal').value) || null;
    state.settings.ratePerWeek = parseFloat($('#rate').value) || null;
    saveSettings(state.settings).catch(() => {});
    return;
  }

  if ('export' in t.dataset) {
    const blob = new Blob([JSON.stringify({ sessions: state.history, body: state.body }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `duolane-${dayId(now())}.json`;
    a.click();
    return;
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'range') {
    const [a, b] = e.target.value.split('-').map(Number);
    state.settings.kcalMin = a; state.settings.kcalMax = b;
    saveSettings(state.settings).catch(() => {});
    render();
  }
});

// wpisywanie: zapis od razu, bez zatwierdzania
document.addEventListener('input', (e) => {
  const row = e.target.closest('.row');
  if (!row || !state.session) return;
  const kg = parseFloat(row.querySelector('.kg').value);
  const reps = parseInt(row.querySelector('.reps').value, 10);
  writeEntry(row.dataset.ex, row.dataset.person, +row.dataset.set, kg, reps, row);
});

function writeEntry(exId, person, n, kg, reps, row) {
  const s = state.session; if (!s) return;
  const k = key(exId, person, n);
  const had = s.entries[k] && s.entries[k].kg && s.entries[k].reps;
  s.entries[k] = { kg: isFinite(kg) ? kg : null, reps: isFinite(reps) ? reps : null, ts: now(), person, ex: exId, set: n };

  const complete = isFinite(kg) && isFinite(reps) && kg > 0 && reps > 0;
  if (complete && !had) {
    const item = s.plan.find(i => i.id === exId);
    const allDone = item.who.every(p => { const en = s.entries[key(exId, p, n)]; return en && en.kg && en.reps; });
    if (allDone) {
      const drop = strengthDrop(exId, person, n, kg, reps);
      s.restEndsAt = now() + (drop ? LONG_REST_MS : REST_MS);
      s.restNote = drop ? 'spadek siły — 3 min' : '';
      persist(true);
      render();
      return;
    }
  }
  persist();
  if (row) {
    const tip = complete ? coach(exId, person, kg, reps) : '';
    const line = row.querySelector('.hintline .tip');
    if (tip && !line) row.querySelector('.hintline').insertAdjacentHTML('beforeend', `<span class="tip">${esc(tip)}</span>`);
    else if (line) line.textContent = tip;
  }
}

/* ---------- kłódka: tyka po timestampie ---------- */
setInterval(() => {
  const s = state.session; if (!s || state.route !== 'train') return;
  const left = s.restEndsAt - now();
  if (left > 0) document.querySelectorAll('[data-lock]').forEach(el => el.textContent = mmss(left));
  else if (s.restEndsAt) { s.restEndsAt = 0; s.restNote = ''; persist(true); render(); }
}, 1000);

document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

/* ---------- zakończenie treningu ---------- */
async function finish() {
  const s = state.session; if (!s) return;
  const rows = Object.values(s.entries).filter(e => e.kg && e.reps)
    .sort((a, b) => a.ts - b.ts)
    .map(({ ex, person, set, kg, reps, ts }) => ({ ex, person, set, kg, reps, ts }));
  if (!rows.length) { state.session = null; lsSet(LS_LIVE, null); dropLive(s.docId); render(); return; }
  const session = { mode: s.mode, startedAt: s.startedAt, endedAt: now(), rows };
  state.history.unshift(session); lsSet(LS_HIST, state.history);
  state.session = null; lsSet(LS_LIVE, null);
  render();
  try { await finishSession(session); await dropLive(s.docId); } catch (e) {}
}

/* ---------- start ---------- */
async function refreshMartin() {
  try {
    const [b, st] = await Promise.all([fetchBody(), loadSettings()]);
    state.body = b.sort((x, y) => y.ts - x.ts);
    state.settings = { ...state.settings, ...st };
    if (state.route === 'martin') render();
  } catch (e) {}
}

async function boot() {
  render();
  // aktywna sesja z chmury wygrywa, jeśli nowsza
  try {
    if (state.session) {
      const cloud = await readLive(state.session.docId);
      if (cloud && (cloud.updatedAt || 0) > (lsGet(LS_LIVE, {})?.updatedAt || 0)) state.session = cloud;
    }
  } catch (e) {}
  try {
    const h = await fetchSessions();
    if (h.length) { state.history = h.sort((a, b) => b.startedAt - a.startedAt); lsSet(LS_HIST, state.history); }
    state.synced = true;
  } catch (e) {}
  render();
  refreshMartin();
}
boot();
