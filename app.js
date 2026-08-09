/* app.js — Duo Lane
   Model: jeden dokument treningu na dzień. Oba telefony piszą do niego.
   Ekran: jedno ćwiczenie, jedna seria, jedna osoba. Zapis natychmiastowy. */

import { EX, PHASES, TRICEPS_POOL, TRICEPS_SETS, WARMUP, NAMES,
         FOOD, PORTION, NRV, UNIT, LABEL } from './data.js';
import { saveDay, readDay, watchDay, listDays,
         saveWeight, removeWeight, listWeights, saveConfig, loadConfig } from './firebase.js';

/* ---------------- utils ---------------- */
const $  = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const now = () => Date.now();
const REST = 120000, REST_LONG = 180000;
const lsGet = (k,d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const todayId = () => { const d=new Date(); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); };
const prettyDate = id => new Date(id+'T12:00').toLocaleDateString('pl-PL',{day:'numeric',month:'long'});
const shortDate  = id => new Date(id+'T12:00').toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
const mmss = ms => { const s=Math.max(0,Math.ceil(ms/1000)); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; };
const hhmm = ms => { const m=Math.floor(ms/60000); return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`; };
const round = (v,st) => Math.max(st, Math.round(v/st)*st);

const LS_DAY='dl.day.v3', LS_HIST='dl.hist.v3', LS_CFG='dl.cfg.v3';

const S = {
  tab:'train', sub:'progress', mzone:'weight',
  day: lsGet(LS_DAY,null),      // aktywny trening dnia
  cursor: 0,                    // indeks kroku
  hist: lsGet(LS_HIST,[]),      // zakończone dni
  weights: [],
  cfg: { kcal:1000, ...lsGet(LS_CFG,{}) },
  unwatch: null, undo: null
};

/* ---------------- budowa planu ---------------- */
/* krok = { ex, person, set, kind:'work'|'warm', pct } */
function buildSteps(day) {
  const st = [];
  const who = day.who;                       // 'both' | 'ana-legs'
  const tri = day.triceps || ['overhead','pushdown'];
  const push = (ex, person, set, kind='work', pct) => st.push({ ex, person, set, kind, pct });

  const people = who === 'ana-legs' ? ['ana'] : (day.solo ? [day.solo] : ['martin','ana']);

  if (who === 'ana-legs') {
    PHASES.ana.forEach(ex => { for (let i=1;i<=EX[ex].sets;i++) push(ex,'ana',i); });
    return st;
  }

  // rozgrzewka przed pierwszym ćwiczeniem pleców
  const first = PHASES.together1[0];
  people.forEach(p => WARMUP.forEach((w,i) => push(first, p, i+1, 'warm', w.pct)));

  PHASES.together1.forEach(ex => {
    for (let i=1;i<=EX[ex].sets;i++) people.forEach(p => push(ex,p,i));
  });

  if (!day.solo || day.solo === 'martin') {
    PHASES.martin.forEach(ex => {
      if (day.skipped && day.skipped.includes(ex)) return;
      for (let i=1;i<=EX[ex].sets;i++) push(ex,'martin',i);
    });
  }
  if (!day.solo || day.solo === 'ana') {
    PHASES.ana.forEach(ex => { for (let i=1;i<=EX[ex].sets;i++) push(ex,'ana',i); });
  }

  // triceps: 2 serie łącznie, z wybranej puli
  tri.forEach((ex,i) => people.forEach(p => push(ex,p,i+1)));
  ['biceps_maszyna','wznosy'].forEach(id => {
    const ex = (day.swaps && day.swaps[id]) || id;
    for (let i=1;i<=EX[ex].sets;i++) people.forEach(p => push(ex,p,i));
  });
  return st;
}

const K = s => `${s.ex}|${s.person}|${s.set}|${s.kind}`;
const val = s => S.day.log[K(s)];
const isFilled = s => { const v = val(s); return s.kind==='warm' ? !!(v&&v.ok) : !!(v && v.kg>0 && v.reps>0); };

function steps() { return S.day ? (S.day._steps ||= buildSteps(S.day)) : []; }
function rebuild() { if (S.day) { delete S.day._steps; } }

/* ---------------- zapis ---------------- */
let t=null;
function persist(now_=false) {
  if (!S.day) return;
  const { _steps, ...clean } = S.day;
  lsSet(LS_DAY, S.day);
  clearTimeout(t);
  const go = () => saveDay(clean.id, clean).catch(()=>{});
  if (now_) go(); else t = setTimeout(go, 900);
}

/* ---------------- historia ---------------- */
function lastOf(ex, person) {
  for (const d of S.hist) {
    const hits = Object.entries(d.log||{})
      .filter(([k,v]) => { const [e,p,,kind]=k.split('|'); return e===ex&&p===person&&kind==='work'&&v.kg>0&&v.reps>0; })
      .map(([k,v]) => ({ set:+k.split('|')[2], ...v }))
      .sort((a,b)=>a.set-b.set);
    if (hits.length) return hits[0];
  }
  return null;
}
function topOf(ex, person) {
  let best=null;
  S.hist.forEach(d => Object.entries(d.log||{}).forEach(([k,v]) => {
    const [e,p,,kind]=k.split('|');
    if (e!==ex||p!==person||kind!=='work'||!v.kg||!v.reps) return;
    if (!best || v.kg*(1+v.reps/30) > best.kg*(1+best.reps/30)) best=v;
  }));
  return best;
}
function seriesOf(ex, person) {
  const out=[];
  [...S.hist].reverse().forEach(d => {
    let b=null;
    Object.entries(d.log||{}).forEach(([k,v]) => {
      const [e,p,,kind]=k.split('|');
      if (e===ex&&p===person&&kind==='work'&&v.kg&&v.reps) if(!b||v.kg>b.kg) b=v;
    });
    if (b) out.push({ id:d.id, kg:b.kg, reps:b.reps });
  });
  return out;
}

/* ---------------- trener ---------------- */
function coachFor(step, v) {
  if (!v || !v.kg || !v.reps || step.kind==='warm') return null;
  if (v.reps < 6)  return { t:'down', msg:'Za ciężko. Następnym razem zmniejsz ciężar.' };
  if (v.reps > 10) return { t:'up',   msg:'Poszło za lekko. Zwiększ ciężar.' };
  return null;
}
function dropDetected(step, v) {
  if (step.set < 2 || !v.reps) return false;
  const prev = S.day.log[`${step.ex}|${step.person}|${step.set-1}|work`];
  return prev && prev.reps && v.reps <= prev.reps - 3;
}

/* ---------------- render root ---------------- */
function render() {
  const el = $('#app');
  const keep = el.querySelector('.scroll,.stage');
  const top = keep ? keep.scrollTop : 0;
  el.innerHTML = view() + navBar();
  const nk = el.querySelector('.scroll,.stage');
  if (nk && S._keepScroll) nk.scrollTop = top;
  S._keepScroll = false;
}
const soft = () => { S._keepScroll = true; render(); };

function view() {
  if (S.tab==='train')  return S.day ? (S.day.finished ? viewSummary() : viewTrain()) : viewStart();
  if (S.tab==='hist')   return viewHist();
  return viewMartin();
}
function navBar() {
  const t=[['train','Trening'],['hist','Progres'],['martin','Martin']];
  return `<nav>${t.map(([k,l])=>`<button class="${S.tab===k?'on':''}" data-tab="${k}">${l}</button>`).join('')}</nav>`;
}

/* ---------------- start ---------------- */
function viewStart() {
  const last = S.hist[0];
  const skipped = lsGet('dl.lastSkip', null);
  return `<div class="scroll">
    <div class="today">
      <span class="eyebrow">Dziś · ${prettyDate(todayId())}</span>
      <h1>Kto trzyma<em>telefon?</em></h1>
    </div>
    ${last ? `<p class="empty" style="margin-bottom:18px">Ostatni trening ${shortDate(last.id)} · ${Object.keys(last.log||{}).length} wpisów</p>` : ''}
    <button class="tile m" data-open="both"><b>Martin</b><span>pełny plan dnia, Ana dopisuje się na tym samym treningu</span></button>
    <button class="tile a" data-open="ana-legs"><b>Ana — nogi</b><span>4 ćwiczenia, potem wracasz do Martina</span></button>
    <button class="linkbtn" data-open="ana-solo">Ana trenuje sama (FBW)</button>
  </div>`;
}

/* ---------------- trening ---------------- */
function viewTrain() {
  const all = steps();
  if (!all.length) return `<div class="scroll"><p class="empty">Pusty plan.</p></div>`;
  const i = Math.min(S.cursor, all.length-1);
  const step = all[i];
  const ex = EX[step.ex];
  const done = all.filter(isFilled).length;
  const locked = now() < (S.day.restUntil||0);
  const lockActive = locked && !isFilled(step) && step.kind==='work';

  const dots = all.map((s,n)=>`<i class="${isFilled(s)?'done':(n===i?'now':'')}"></i>`).join('');
  const elapsed = hhmm(now() - S.day.startedAt);

  return `
  <div class="tbar">
    <span class="clock">${elapsed}</span>
    <button class="quit" data-finish>Zakończ</button>
    <span class="pos">${done}/${all.length}</span>
  </div>
  <div class="dots">${dots}</div>
  <div class="stage">
    ${ex.note && step.kind==='work' && step.set===1 && !S.day.noted?.[step.ex] ?
      `<div class="notebar"><span>${esc(ex.note)}</span><button data-noted="${step.ex}">×</button></div>` : ''}
    <div class="exhead">
      <div class="exname">${esc(ex.n)}</div>
      <div class="extag">${tagHTML(ex.tag)}</div>
      ${S.day.swaps?.[step.ex] ? `<span class="swapped">zamiast ${esc(EX[S.day.swaps[step.ex]]?.n||'')}</span>` : ''}
    </div>
    ${step.kind==='warm' ? warmHTML(step) : workHTML(step, lockActive)}
    ${nextHTML(all, i, step, lockActive)}
  </div>`;
}

function tagHTML(tag) {
  return tag.split('·').map(p => {
    const s = p.trim();
    return /^TRICEPS$/i.test(s) ? `<span class="hot">${esc(s)}</span>` : esc(s);
  }).join(' · ');
}

function warmHTML(step) {
  const w = WARMUP[step.set-1];
  const base = lastOf(step.ex, step.person);
  const ex = EX[step.ex];
  const v = val(step);
  const kg = base ? round(base.kg * w.pct, ex.step) : null;
  return `
  <div class="turn ${step.person==='martin'?'m':'a'}">
    <i class="dot"></i><b>${NAMES[step.person]}</b><span>rozgrzewka ${step.set}/2</span>
  </div>
  <div class="entry warm">
    <div class="wtitle">${Math.round(w.pct*100)}% ciężaru roboczego</div>
    ${kg ? `<div class="wbig">${kg} kg</div><div class="wsub">${w.reps} powtórzeń</div>`
         : `<div class="wsub">Brak historii — zrób lekką serię na wyczucie, ${w.reps} powtórzeń.</div>`}
    <div class="acts"><button data-warm="${v&&v.ok?'0':'1'}">${v&&v.ok?'Odznacz':'Zrobione'}</button></div>
  </div>`;
}

function workHTML(step, locked) {
  const ex = EX[step.ex];
  const v = val(step) || {};
  const prev = lastOf(step.ex, step.person);
  const kgPh = prev ? prev.kg : '—';
  const rpPh = prev ? prev.reps : '—';
  const c = coachFor(step, v);
  const totalSets = step.ex && TRICEPS_POOL.includes(step.ex) ? TRICEPS_SETS : ex.sets;
  return `
  <div class="turn ${step.person==='martin'?'m':'a'}">
    <i class="dot"></i><b>${NAMES[step.person]}</b><span>seria ${step.set} z ${totalSets}</span>
  </div>
  <div class="entry ${step.person==='martin'?'m':'a'}">
    <div class="pair">
      <div class="num">
        <input type="number" inputmode="decimal" class="kg" value="${v.kg??''}" placeholder="${kgPh}" ${locked?'disabled':''}>
        <label>kg</label>
        <div class="step"><button data-add="kg:-${ex.step}">−${ex.step}</button><button data-add="kg:${ex.step}">+${ex.step}</button></div>
      </div>
      <div class="times">×</div>
      <div class="num">
        <input type="number" inputmode="numeric" class="reps" value="${v.reps??''}" placeholder="${rpPh}" ${locked?'disabled':''}>
        <label>powt</label>
        <div class="step"><button data-add="reps:-1">−1</button><button data-add="reps:1">+1</button></div>
      </div>
    </div>
    <div class="prevline">${prev ? `poprzednio <b>${prev.kg} × ${prev.reps}</b>` : 'pierwszy raz — wpisz co dasz radę'}</div>
    ${c ? `<div class="coach ${c.t}">${esc(c.msg)}</div>` : ''}
    <div class="acts">
      ${prev ? `<button data-same>Tak jak poprzednio</button>` : ''}
      <button data-busy>Maszyna zajęta</button>
    </div>
  </div>`;
}

function nextHTML(all, i, step, locked) {
  const filled = isFilled(step);
  const last = i >= all.length-1;
  if (locked) {
    return `<div class="next">
      <button disabled>Przerwa trwa</button>
      <div class="lockinfo">🔒 <span data-tick>${mmss(S.day.restUntil-now())}</span> · <button class="quit" data-skiprest>pomiń</button></div>
    </div>`;
  }
  return `<div class="next">
    <button data-next ${filled?'':'disabled'}>${last ? 'Zakończ trening' : 'Dalej'}</button>
    ${!filled ? `<div class="lockinfo">wpisz wynik, żeby przejść dalej</div>` : ''}
  </div>`;
}

/* ---------------- podsumowanie ---------------- */
function viewSummary() {
  const d = S.day;
  const sets = Object.entries(d.log).filter(([k,v])=>k.endsWith('|work')&&v.kg&&v.reps);
  const dur = hhmm((d.endedAt||now()) - d.startedAt);
  const ups = sets.filter(([k,v]) => {
    const [ex,p] = k.split('|');
    const before = S.hist.find(h=>h.id!==d.id);
    const pr = before ? topOf(ex,p) : null;
    return pr && v.kg*(1+v.reps/30) > pr.kg*(1+pr.reps/30);
  });
  return `<div class="doneview">
    <span class="eyebrow">Trening zamknięty</span>
    <div class="bignum" style="margin:14px 0 4px">${dur}<span> h</span></div>
    <p class="empty">${sets.length} serii zapisanych${ups.length?` · ${ups.length} nowych rekordów`:''}.</p>
    <div style="margin-top:26px">
      ${sets.map(([k,v])=>{const [ex,p]=k.split('|');
        return `<div class="line"><span class="name">${esc(EX[ex]?.n||ex)}</span>
        <span class="val"><i class="${p==='martin'?'m':'a'}">${v.kg} × ${v.reps}</i></span></div>`;}).join('')}
    </div>
    <div class="next" style="margin-top:26px"><button data-close>Gotowe</button></div>
  </div>`;
}

/* ---------------- progres ---------------- */
function viewHist() {
  const seg = `<div class="seg">
    <button class="${S.sub==='progress'?'on':''}" data-sub="progress">Progres</button>
    <button class="${S.sub==='days'?'on':''}" data-sub="days">Dni</button></div>`;
  if (!S.hist.length) return `<div class="scroll"><span class="eyebrow">Progres</span>
    <h1>Pusto.<em>Pierwszy trening zacznie historię.</em></h1>
    <p class="empty" style="margin-top:16px">Wszystko zapisuje się samo, także bez zasięgu.</p></div>`;

  if (S.sub==='days') {
    return `<div class="scroll"><span class="eyebrow">Progres</span><h1>Dni</h1><div style="margin-top:20px">${seg}
      ${S.hist.map(d=>{
        const n = Object.entries(d.log||{}).filter(([k,v])=>k.endsWith('|work')&&v.kg).length;
        return `<button class="card" style="width:100%;text-align:left" data-day="${d.id}">
          <h2>${prettyDate(d.id)}</h2><div class="sub">${n} serii · ${hhmm((d.endedAt||d.startedAt)-d.startedAt)} h</div></button>`;
      }).join('')}</div></div>`;
  }

  const rows = Object.keys(EX).map(id => {
    const out = [];
    ['martin','ana'].forEach(p => {
      const s = seriesOf(id,p);
      if (!s.length) return;
      const cur = s[s.length-1], prev = s.length>1 ? s[s.length-2] : null;
      const up = prev ? cur.kg*(1+cur.reps/30) - prev.kg*(1+prev.reps/30) : 0;
      out.push(`<i class="${p==='martin'?'m':'a'}">${cur.kg}×${cur.reps}${
        prev ? `<span class="trend ${up>0?'up':up<0?'down':''}">${up>0?'↑':up<0?'↓':'·'}</span>` : ''}</i>`);
    });
    if (!out.length) return '';
    return `<button class="line" style="width:100%" data-ex="${id}">
      <span class="name">${esc(EX[id].n)}</span><span class="val">${out.join('')}</span></button>`;
  }).filter(Boolean).join('');

  return `<div class="scroll"><span class="eyebrow">Progres</span><h1>${S.hist.length} treningów<em>i rosnące liczby.</em></h1>
    <div style="margin-top:20px">${seg}<div class="card">${rows}</div></div></div>`;
}

/* wykres liniowy w SVG */
function spark(points, color) {
  if (points.length < 2) return '';
  const w=300,h=120,pad=10;
  const xs=(i)=>pad+i*(w-2*pad)/(points.length-1);
  const min=Math.min(...points), max=Math.max(...points), rg=(max-min)||1;
  const ys=(v)=>h-pad-((v-min)/rg)*(h-2*pad);
  const d=points.map((v,i)=>`${i?'L':'M'}${xs(i).toFixed(1)},${ys(v).toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

/* ---------------- Martin ---------------- */
function viewMartin() {
  const zone = `<div class="duo">
    <button class="${S.mzone==='weight'?'on':''}" data-zone="weight"><b>Waga</b><span>zapis i historia</span></button>
    <button class="${S.mzone==='shake'?'on':''}" data-zone="shake"><b>Shake</b><span>kalorie i mikro</span></button></div>`;
  return `<div class="scroll"><span class="eyebrow">Martin</span>
    <h1>${S.mzone==='weight'?'Masa ciała':'Shake'}</h1>
    <div style="margin-top:20px">${zone}${S.mzone==='weight'?weightHTML():shakeHTML()}</div></div>`;
}

function weightHTML() {
  const w = S.weights;
  const pts = [...w].reverse().map(x=>x.kg);
  return `
  <div class="card">
    <div class="field">
      <input type="number" step="0.1" inputmode="decimal" id="wkg" class="kgbig" placeholder="kg">
      <input type="date" id="wdate" value="${todayId()}" style="flex:0 0 auto">
      <button data-addw>Zapisz</button>
    </div>
    <input type="text" id="wnote" placeholder="notatka (opcjonalna)" style="display:${S.noteOpen?'block':'none'};width:100%;background:var(--card2);border-radius:12px;padding:12px;font-size:14px;margin-bottom:10px">
    ${S.noteOpen?'':'<button class="tiny" data-note>+ dodaj notatkę</button>'}
    ${pts.length>1 ? spark(pts,'#FFC933') : ''}
    ${w.length ? w.map((x,i)=>{
      const prev = w[i+1];
      const dlt = prev ? (x.kg-prev.kg) : null;
      return `<div class="wrow">
        <span class="d">${shortDate(x.id)}${x.note?` · ${esc(x.note)}`:''}</span>
        <span class="n">${x.kg} kg</span>
        <span class="delta">${dlt!==null?(dlt>0?'+':'')+dlt.toFixed(1):''}</span>
        <button class="edit" data-editw="${x.id}">⋯</button></div>`;
    }).join('') : '<p class="empty">Brak wpisów. Możesz dopisać wstecz — wybierz datę.</p>'}
  </div>`;
}

function shakeHTML() {
  const s = calcShake(S.cfg.kcal);
  const micro = Object.entries(s.micro)
    .filter(([k])=>NRV[k])
    .sort((a,b)=> (b[1]/NRV[b[0]]) - (a[1]/NRV[a[0]]))
    .map(([k,v]) => {
      const pct = Math.round(v/NRV[k]*100);
      return `<div class="nrv"><div class="top"><span>${esc(LABEL[k]||k)}</span>
        <b>${v>=10?Math.round(v):v.toFixed(1)} ${UNIT[k]||''}<em>${pct}%</em></b></div>
        <div class="track"><i class="${pct>=100?'full':''}" style="width:${Math.min(100,pct)}%"></i></div></div>`;
    }).join('');
  return `
  <div class="card">
    <div class="kcalbig">${S.cfg.kcal}<span>kcal cel</span></div>
    <div class="slider"><input type="range" min="400" max="1500" step="50" value="${S.cfg.kcal}" id="kcal" aria-label="Cel kalorii"></div>
    <div class="pbline">Masło orzechowe: <b>${s.pb} g</b></div>
    <div class="macros">
      <div><b>${s.kcal}</b><span>kcal</span></div>
      <div><b>${s.p} g</b><span>białko</span></div>
      <div><b>${s.c} g</b><span>węgle</span></div>
      <div><b>${s.f} g</b><span>tłuszcz</span></div>
    </div>
    <p class="sub">${FOOD.protein.n} ${PORTION.protein} g · mleko ${PORTION.milk} ml · banan ${PORTION.banana} g</p>
  </div>
  <div class="card"><h2>Witaminy i minerały</h2>
    <div class="sub" style="margin-bottom:10px">% dziennego zapotrzebowania (RWS)</div>${micro}</div>`;
}

function calcShake(target) {
  const base = [['protein',PORTION.protein],['milk',PORTION.milk],['banana',PORTION.banana]];
  const kcalBase = base.reduce((a,[k,g]) => a + FOOD[k].kcal*g/FOOD[k].per, 0);
  const pb = Math.max(0, Math.round((target-kcalBase)/(FOOD.peanut.kcal/100)/5)*5);
  const parts = [...base, ['peanut', pb]];
  const sum = f => parts.reduce((a,[k,g]) => a + (FOOD[k][f]||0)*g/FOOD[k].per, 0);
  const micro = {};
  parts.forEach(([k,g]) => {
    const F = FOOD[k], r = g/F.per;
    Object.entries({...(F.vit||{}), ...(F.min||{})}).forEach(([n,v]) => micro[n]=(micro[n]||0)+v*r);
  });
  return { pb, kcal:Math.round(sum('kcal')), p:Math.round(sum('p')),
           c:Math.round(sum('c')), f:Math.round(sum('f')), micro };
}

/* ---------------- arkusze ---------------- */
function sheet(html) { $('#sheet').innerHTML = `<div class="sheet">${html}</div>`; }
function closeSheet() { $('#sheet').innerHTML=''; }
function snack(msg, actionLabel, fn) {
  $('#snack').innerHTML = `<div class="snack"><span>${esc(msg)}</span>${actionLabel?`<button data-undo>${esc(actionLabel)}</button>`:''}</div>`;
  clearTimeout(S._sn); S.undo = fn;
  S._sn = setTimeout(()=>{ $('#snack').innerHTML=''; S.undo=null; }, 5000);
}

function busySheet(step) {
  const ex = EX[step.ex];
  const subs = ex.sub || [];
  if (subs.length) {
    return sheet(`<h2>${esc(ex.n)} zajęte</h2><p>Wybierz zamiennik albo wróć tu później.</p>
      ${subs.map(id=>`<button class="opt" data-swap="${id}">${esc(EX[id].n)}<small>${esc(EX[id].tag)}</small></button>`).join('')}
      <button class="opt" data-defer>Przeskocz, wrócę później<small>wraca na koniec kolejki</small></button>
      <button class="opt mute" data-cancel>Anuluj</button>`);
  }
  if (ex.skippable) {
    const lastSkip = lsGet('dl.lastSkip', null);
    const canSkip = lastSkip !== todayId() && lastSkip !== lsGet('dl.prevDay', null);
    if (canSkip) {
      return sheet(`<h2>${esc(ex.n)} zajęte</h2>
        <p>Przód barków dostał już swoje przy skosie. Możesz dziś odpuścić to ćwiczenie — ale nie dwa treningi z rzędu.</p>
        <button class="opt" data-skipex>Odpuść dziś<small>wraca na następnym treningu</small></button>
        <button class="opt" data-defer>Przeskocz, wrócę później</button>
        <button class="opt mute" data-cancel>Anuluj</button>`);
    }
    return sheet(`<h2>${esc(ex.n)} zajęte</h2>
      <p>Ostatnio już to odpuściłeś. Dziś trzeba zrobić — poczekaj na maszynę albo przeskocz i wróć.</p>
      <button class="opt" data-defer>Przeskocz, wrócę później</button>
      <button class="opt mute" data-cancel>Anuluj</button>`);
  }
  return sheet(`<h2>${esc(ex.n)} zajęte</h2>
    <p>Tego nie zamieniamy — musi być w planie. Zrób coś innego i wróć, gdy się zwolni.</p>
    <button class="opt" data-defer>Przeskocz, wrócę później</button>
    <button class="opt mute" data-cancel>Anuluj</button>`);
}

function triSheet() {
  const opts = TRICEPS_POOL;
  const combos = [];
  opts.forEach(a => opts.forEach(b => { if (opts.indexOf(b) >= opts.indexOf(a)) combos.push([a,b]); }));
  return sheet(`<h2>Triceps</h2><p>Dwie serie na trening. Wybierz jak je rozłożyć.</p>
    ${combos.map(([a,b])=>`<button class="opt" data-tri="${a},${b}">${
      a===b ? `2 × ${esc(EX[a].n)}` : `${esc(EX[a].n)} + ${esc(EX[b].n)}`}</button>`).join('')}`);
}

/* ---------------- akcje ---------------- */
document.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  const d = b.dataset;

  if (d.tab)  { S.tab=d.tab; render(); if (d.tab==='martin') loadMartin(); return; }
  if (d.sub)  { S.sub=d.sub; render(); return; }
  if (d.zone) { S.mzone=d.zone; render(); return; }
  if (d.cancel!==undefined) return closeSheet();
  if (d.undo!==undefined) { const f=S.undo; S.undo=null; $('#snack').innerHTML=''; if(f) f(); return; }

  if (d.open) {
    const id = todayId();
    let day = await readDay(id).catch(()=>null) || S.day;
    if (!day || day.id!==id || day.finished) {
      day = { id, startedAt:now(), log:{}, swaps:{}, noted:{}, skipped:[], restUntil:0,
              who: d.open==='ana-legs'?'ana-legs':'both',
              solo: d.open==='ana-solo'?'ana':null };
    } else {
      day.who = d.open==='ana-legs' ? 'ana-legs' : 'both';
      if (d.open==='ana-solo') day.solo='ana';
    }
    S.day = day; S.cursor = 0; rebuild();
    if (day.who!=='ana-legs' && !day.triceps) { render(); return triSheet(); }
    persist(true); watchNow(); render(); jumpToFirstEmpty(); return;
  }

  if (d.tri) { S.day.triceps = d.tri.split(','); rebuild(); persist(true); closeSheet(); watchNow(); render(); jumpToFirstEmpty(); return; }

  const all = steps(), step = all[S.cursor];

  if (d.noted) { (S.day.noted ||= {})[d.noted]=1; persist(); soft(); return; }

  if (d.warm!==undefined) {
    S.day.log[K(step)] = { ok: d.warm==='1' };
    persist(); if (d.warm==='1') advance(); else soft(); return;
  }

  if (d.add) {
    const [f,delta] = d.add.split(':');
    const inp = $(`.${f}`); const cur = parseFloat(inp.value);
    const ex = EX[step.ex];
    const base = isFinite(cur) ? cur : (lastOf(step.ex,step.person)?.[f] ?? (f==='kg'?ex.step:6));
    const nv = Math.max(0, +(base + parseFloat(delta)).toFixed(2));
    inp.value = nv; writeFromInputs(step); soft(); return;
  }

  if (d.same!==undefined) {
    const p = lastOf(step.ex, step.person); if (!p) return;
    S.day.log[K(step)] = { kg:p.kg, reps:p.reps, ts:now() };
    persist(); soft(); return;
  }

  if (d.busy!==undefined) return busySheet(step);

  if (d.swap) {
    S.day.swaps[step.ex] = step.ex;
    const from = step.ex;
    (S.day._steps||[]).forEach(s => { if (s.ex===from) s.ex = d.swap; });
    S.day.swaps[d.swap] = from; delete S.day.swaps[from];
    persist(true); closeSheet(); soft(); return;
  }

  if (d.defer!==undefined) {
    const moved = all.filter(s=>s.ex===step.ex);
    S.day._steps = all.filter(s=>s.ex!==step.ex).concat(moved);
    closeSheet(); soft(); return;
  }

  if (d.skipex!==undefined) {
    (S.day.skipped ||= []).push(step.ex);
    lsSet('dl.lastSkip', todayId());
    S.day._steps = all.filter(s=>s.ex!==step.ex);
    S.cursor = Math.min(S.cursor, S.day._steps.length-1);
    persist(true); closeSheet(); render(); return;
  }

  if (d.skiprest!==undefined) { S.day.restUntil=0; persist(true); render(); return; }
  if (d.next!==undefined) return advance();
  if (d.finish!==undefined) return finish();
  if (d.close!==undefined) { S.day=null; lsSet(LS_DAY,null); S.cursor=0; render(); return; }

  if (d.ex) { return exSheet(d.ex); }
  if (d.day) { return daySheet(d.day); }

  /* --- Martin --- */
  if (d.note!==undefined) { S.noteOpen=true; soft(); return; }
  if (d.addw!==undefined) {
    const kg = parseFloat($('#wkg').value); if (!kg) return;
    const id = $('#wdate').value || todayId();
    const note = ($('#wnote')?.value||'').trim();
    const entry = { id, kg, note };
    S.weights = [entry, ...S.weights.filter(x=>x.id!==id)].sort((a,b)=>b.id.localeCompare(a.id));
    S.noteOpen=false; render();
    saveWeight(id, entry).catch(()=>{});
    return;
  }
  if (d.editw) {
    const x = S.weights.find(w=>w.id===d.editw); if (!x) return;
    return sheet(`<h2>${prettyDate(x.id)}</h2><p>${x.kg} kg${x.note?` · ${esc(x.note)}`:''}</p>
      <button class="opt" data-loadw="${x.id}">Popraw wpis<small>wraca do pól u góry</small></button>
      <button class="opt danger" data-delw="${x.id}">Usuń wpis</button>
      <button class="opt mute" data-cancel>Anuluj</button>`);
  }
  if (d.loadw) {
    const x = S.weights.find(w=>w.id===d.loadw); closeSheet();
    S.noteOpen = !!x.note; render();
    $('#wkg').value = x.kg; $('#wdate').value = x.id; if ($('#wnote')) $('#wnote').value = x.note||'';
    $('#wkg').focus(); return;
  }
  if (d.delw) {
    const x = S.weights.find(w=>w.id===d.delw); closeSheet();
    S.weights = S.weights.filter(w=>w.id!==d.delw); render();
    let undone=false;
    snack(`Usunięto wpis z ${shortDate(x.id)}`, 'Cofnij', () => {
      undone=true; S.weights=[x,...S.weights].sort((a,b)=>b.id.localeCompare(a.id)); render();
    });
    setTimeout(()=>{ if(!undone) removeWeight(x.id).catch(()=>{}); }, 5200);
    return;
  }
});

function exSheet(id) {
  const rows = ['martin','ana'].map(p => {
    const s = seriesOf(id,p); if (!s.length) return '';
    const top = topOf(id,p);
    return `<h2 style="margin-top:14px;color:${p==='martin'?'var(--m)':'var(--a)'}">${NAMES[p]}</h2>
      <p style="margin-bottom:8px">rekord ${top.kg} × ${top.reps}</p>
      ${spark(s.map(x=>x.kg), p==='martin'?'#FFC933':'#B08CFF')}
      ${s.slice(-8).reverse().map(x=>`<div class="line"><span class="name">${shortDate(x.id)}</span>
        <span class="val">${x.kg} × ${x.reps}</span></div>`).join('')}`;
  }).join('');
  sheet(`<h2>${esc(EX[id].n)}</h2><p>${esc(EX[id].tag)}</p>${rows}
    <button class="opt mute" data-cancel>Zamknij</button>`);
}

function daySheet(id) {
  const d = S.hist.find(x=>x.id===id); if (!d) return;
  const rows = Object.entries(d.log).filter(([k,v])=>k.endsWith('|work')&&v.kg)
    .map(([k,v])=>{ const [ex,p]=k.split('|');
      return `<div class="line"><span class="name">${esc(EX[ex]?.n||ex)}</span>
        <span class="val"><i class="${p==='martin'?'m':'a'}">${v.kg} × ${v.reps}</i></span></div>`; }).join('');
  sheet(`<h2>${prettyDate(id)}</h2><p>${hhmm((d.endedAt||d.startedAt)-d.startedAt)} h treningu</p>${rows}
    <button class="opt mute" data-cancel>Zamknij</button>`);
}

/* wpisywanie */
document.addEventListener('input', e => {
  if (e.target.id==='kcal') { S.cfg.kcal=+e.target.value; lsSet(LS_CFG,S.cfg); saveConfig(S.cfg).catch(()=>{}); soft(); return; }
  if (!S.day || S.day.finished) return;
  if (e.target.classList.contains('kg')||e.target.classList.contains('reps')) {
    writeFromInputs(steps()[S.cursor]);
    const btn = document.querySelector('[data-next]'); if (btn) btn.disabled = !isFilled(steps()[S.cursor]);
  }
});

function writeFromInputs(step) {
  const kg = parseFloat($('.kg')?.value), reps = parseInt($('.reps')?.value,10);
  S.day.log[K(step)] = { kg: isFinite(kg)?kg:null, reps: isFinite(reps)?reps:null, ts:now() };
  persist();
}

/* przejście dalej + przerwa */
function advance() {
  const all = steps(), step = all[S.cursor];
  const v = val(step);
  if (step.kind==='work' && v) {
    const nx = all[S.cursor+1];
    const sameSetOtherPerson = nx && nx.ex===step.ex && nx.set===step.set && nx.person!==step.person;
    if (!sameSetOtherPerson) {
      const long = dropDetected(step, v);
      S.day.restUntil = now() + (long ? REST_LONG : REST);
      S.day.restNote = long ? 'spadek siły' : '';
    }
  }
  if (S.cursor >= all.length-1) return finish();
  S.cursor++; persist(); render();
  document.querySelector('.stage')?.scrollTo(0,0);
}

function jumpToFirstEmpty() {
  const all = steps();
  const i = all.findIndex(s=>!isFilled(s));
  S.cursor = i<0 ? all.length-1 : i;
  render();
}

async function finish() {
  const d = S.day; if (!d) return;
  const has = Object.values(d.log).some(v=>v && v.kg && v.reps);
  if (!has) { S.day=null; lsSet(LS_DAY,null); render(); return; }
  d.finished = true; d.endedAt = now(); d.restUntil = 0;
  lsSet('dl.prevDay', lsGet('dl.lastSkip',null));
  const { _steps, ...clean } = d;
  S.hist = [clean, ...S.hist.filter(h=>h.id!==d.id)];
  lsSet(LS_HIST, S.hist);
  render();
  saveDay(d.id, clean).catch(()=>{});
}

/* zegar przerwy i czasu trwania */
setInterval(() => {
  if (!S.day || S.day.finished || S.tab!=='train') return;
  const left = (S.day.restUntil||0) - now();
  const tick = document.querySelector('[data-tick]');
  if (left > 0 && tick) tick.textContent = mmss(left);
  else if (left <= 0 && S.day.restUntil) { S.day.restUntil=0; persist(true); render(); }
  const c = document.querySelector('.tbar .clock');
  if (c) c.textContent = hhmm(now() - S.day.startedAt);
}, 1000);

document.addEventListener('visibilitychange', () => { if (!document.hidden && S.day) render(); });

/* synchronizacja drugiego telefonu */
function watchNow() {
  if (S.unwatch) S.unwatch();
  if (!S.day) return;
  S.unwatch = watchDay(S.day.id, cloud => {
    if (!S.day || cloud.id!==S.day.id) return;
    if ((cloud.updatedAt||0) <= (S.day.updatedAt||0)) return;
    S.day.log = { ...cloud.log, ...S.day.log };
    S.day.updatedAt = cloud.updatedAt;
    if (cloud.triceps && !S.day.triceps) { S.day.triceps=cloud.triceps; rebuild(); }
    lsSet(LS_DAY, S.day);
    if (S.tab==='train') soft();
  });
}

async function loadMartin() {
  try {
    const [w,c] = await Promise.all([listWeights(), loadConfig()]);
    S.weights = w.sort((a,b)=>b.id.localeCompare(a.id));
    S.cfg = { ...S.cfg, ...c }; lsSet(LS_CFG, S.cfg);
    if (S.tab==='martin') render();
  } catch(e) {}
}

async function boot() {
  if (S.day && S.day.finished) { S.day=null; lsSet(LS_DAY,null); }
  render();
  if (S.day) { jumpToFirstEmpty(); watchNow(); }
  try {
    const days = await listDays();
    const done = days.filter(d=>d.finished);
    if (done.length) { S.hist = done; lsSet(LS_HIST, S.hist); }
    const t = days.find(d=>d.id===todayId() && !d.finished);
    if (t && !S.day) { S.day = t; rebuild(); jumpToFirstEmpty(); watchNow(); }
    render();
  } catch(e) {}
  loadMartin();
}
boot();
