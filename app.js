/* app.js — Duo Lane */

import { EX, PHASES, FINISHERS, TRICEPS_POOL, TRICEPS_MAX_SETS, WARMUP, NAMES,
         FOOD, PORTION, NRV, UNIT, LABEL } from './data.js';
import { saveDay, readDay, watchDay, listDays,
         saveWeight, removeWeight, listWeights, saveConfig, loadConfig } from './firebase.js';

/* ---------- utils ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const now = () => Date.now();
const REST = 120000, REST_LONG = 180000;
const lsGet=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const todayId=()=>{const d=new Date();d.setMinutes(d.getMinutes()-d.getTimezoneOffset());return d.toISOString().slice(0,10)};
const dnum=id=>Math.round(new Date(id+'T12:00')/86400000);
const daysAgo=id=>dnum(todayId())-dnum(id);
const agoText=id=>{const n=daysAgo(id);return n<=0?'dzisiaj':n===1?'wczoraj':`${n} dni temu`};
const prettyDate=id=>new Date(id+'T12:00').toLocaleDateString('pl-PL',{day:'numeric',month:'long'});
const shortDate=id=>new Date(id+'T12:00').toLocaleDateString('pl-PL',{day:'numeric',month:'short'});
const mmss=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`};
const hhmm=ms=>{const m=Math.max(0,Math.floor(ms/60000));return `${Math.floor(m/60)}:${String(m%60).padStart(2,'0')}`};
const round=(v,st)=>Math.max(st,Math.round(v/st)*st);
const num=v=>{const n=parseFloat(String(v).replace(',','.'));return isFinite(n)?n:null};

const LS_DAY='dl.day.v4', LS_HIST='dl.hist.v4', LS_CFG='dl.cfg.v4';

const S = {
  tab:'train', sub:'progress', mzone:'weight',
  day:lsGet(LS_DAY,null), cursor:0,
  hist:lsGet(LS_HIST,[]), weights:[],
  cfg:{kcal:1000,...lsGet(LS_CFG,{})},
  unwatch:null, undo:null, keep:false
};

/* ---------- plan ---------- */
/* step: {ex, person, set, kind:'warm'|'work'} */
function buildSteps(day){
  const st=[];
  const push=(ex,person,set,kind='work')=>st.push({ex,person,set,kind});

  if (day.mode==='ana-legs'){
    PHASES.ana.forEach(ex=>{ for(let i=1;i<=EX[ex].sets;i++) push(ex,'ana',i); });
    return st;
  }
  const people = day.mode==='ana-solo' ? ['ana'] : ['martin','ana'];

  // rozgrzewka: M 50% -> A 50% -> M 75% -> A 75%
  const first = PHASES.together1[0];
  WARMUP.forEach((w,i)=> people.forEach(p=> push(first,p,i+1,'warm')));

  PHASES.together1.forEach(id=>{
    const ex = day.swaps?.[id] || id;
    for(let i=1;i<=EX[ex].sets;i++) people.forEach(p=>push(ex,p,i));
  });

  const splitList = day.mode==='ana-solo' ? PHASES.ana : PHASES.martin;
  const splitWho  = day.mode==='ana-solo' ? 'ana' : 'martin';
  splitList.forEach(id=>{
    if ((day.skipped||[]).includes(id)) return;
    const ex = day.swaps?.[id] || id;
    for(let i=1;i<=EX[ex].sets;i++) push(ex,splitWho,i);
  });

  // końcówka: dopiero po wyborze
  (day.finishers||[]).forEach(blk=>{
    for(let i=1;i<=blk.sets;i++) people.forEach(p=>push(blk.ex,p,i));
  });
  return st;
}

const K=s=>`${s.ex}|${s.person}|${s.set}|${s.kind}`;
const val=s=>S.day.log[K(s)];
const filled=s=>{const v=val(s);return s.kind==='warm'?!!(v&&v.ok):!!(v&&v.kg>0&&v.reps>0)};
function steps(){ if(!S.day) return []; return (S.day._steps ||= buildSteps(S.day)); }
function rebuild(){ if(S.day) delete S.day._steps; }
function finishersDone(){ return S.day && S.day.finishers && S.day.finishers.length; }

/* ---------- zapis ---------- */
let tmr=null;
function persist(imm=false){
  if(!S.day) return;
  const {_steps,...clean}=S.day;
  lsSet(LS_DAY,S.day);
  clearTimeout(tmr);
  const go=()=>saveDay(clean.id,clean).catch(()=>{});
  imm?go():tmr=setTimeout(go,800);
}

/* ---------- historia ---------- */
function allDays(){ return S.hist.filter(d=>d.id!==S.day?.id); }
/* ostatni wynik: {kg,reps,id,ago} — pierwsza seria z najnowszego dnia */
function lastOf(ex,person){
  const days=[...allDays()].sort((a,b)=>b.id.localeCompare(a.id));
  for(const d of days){
    const hits=Object.entries(d.log||{})
      .map(([k,v])=>({k,v,part:k.split('|')}))
      .filter(({part,v})=>part[0]===ex&&part[1]===person&&part[3]==='work'&&v&&v.kg>0&&v.reps>0)
      .sort((a,b)=>(+a.part[2])-(+b.part[2]));
    if(hits.length) return {kg:hits[0].v.kg,reps:hits[0].v.reps,id:d.id};
  }
  return null;
}
function topOf(ex,person){
  let best=null;
  allDays().forEach(d=>Object.entries(d.log||{}).forEach(([k,v])=>{
    const p=k.split('|');
    if(p[0]!==ex||p[1]!==person||p[3]!=='work'||!v?.kg||!v?.reps)return;
    if(!best||v.kg*(1+v.reps/30)>best.kg*(1+best.reps/30)) best={...v,id:d.id};
  }));
  return best;
}
function seriesOf(ex,person){
  const out=[];
  [...S.hist].sort((a,b)=>a.id.localeCompare(b.id)).forEach(d=>{
    let b=null;
    Object.entries(d.log||{}).forEach(([k,v])=>{
      const p=k.split('|');
      if(p[0]===ex&&p[1]===person&&p[3]==='work'&&v?.kg&&v?.reps) if(!b||v.kg>b.kg) b=v;
    });
    if(b) out.push({id:d.id,kg:b.kg,reps:b.reps});
  });
  return out;
}

/* ---------- trener ---------- */
function coachFor(step,v){
  if(!v||!v.kg||!v.reps||step.kind==='warm')return null;
  if(v.reps<6) return {t:'down',msg:'Za ciężko. Następnym razem zmniejsz ciężar.'};
  if(v.reps>10) return {t:'up',msg:'Poszło za lekko. Zwiększ ciężar.'};
  return null;
}
function dropped(step,v){
  if(step.set<2||!v.reps)return false;
  const p=S.day.log[`${step.ex}|${step.person}|${step.set-1}|work`];
  return p&&p.reps&&v.reps<=p.reps-3;
}

/* ---------- render ---------- */
function render(){
  const el=$('#app');
  const old=el.querySelector('.scroll,.stage');
  const top=old?old.scrollTop:0;
  el.innerHTML=view()+nav();
  const n=el.querySelector('.scroll,.stage');
  if(n&&S.keep) n.scrollTop=top;
  S.keep=false;
}
const soft=()=>{S.keep=true;render()};
function view(){
  if(S.tab==='train') return !S.day?viewStart():S.day.finished?viewSummary():viewTrain();
  if(S.tab==='hist') return viewHist();
  return viewMartin();
}
function nav(){
  return `<nav>${[['train','Trening'],['hist','Progres'],['martin','Martin']]
    .map(([k,l])=>`<button class="${S.tab===k?'on':''}" data-tab="${k}">${l}</button>`).join('')}</nav>`;
}

/* ---------- start ---------- */
function viewStart(){
  const last=S.hist[0];
  return `<div class="scroll">
    <div class="today"><span class="eyebrow">Dziś · ${prettyDate(todayId())}</span>
    <h1>Kto trzyma<em>telefon?</em></h1></div>
    ${last?`<p class="empty" style="margin-bottom:18px">Ostatni trening ${agoText(last.id)}</p>`:''}
    <button class="tile m" data-open="martin"><b>Martin</b><span>plecy razem, potem klatka i barki</span></button>
    <button class="tile a" data-open="ana-legs"><b>Ana — nogi</b><span>4 ćwiczenia, potem wracasz do Martina</span></button>
    <button class="linkbtn" data-open="ana-solo">Ana trenuje sama (FBW)</button>
  </div>`;
}

/* ---------- trening ---------- */
function viewTrain(){
  const all=steps();
  const i=Math.min(S.cursor,Math.max(0,all.length-1));
  const step=all[i];

  if(!step) return chooseFinisherView();

  const ex=EX[step.ex];
  const done=all.filter(filled).length;
  const rest=(S.day.restUntil||0)-now();
  const locked=rest>0;

  return `
  <div class="tbar">
    <span class="clock">${hhmm(now()-S.day.startedAt)}</span>
    <button class="quit" data-finish>Zakończ</button>
    <span class="pos">${done}/${all.length}</span>
  </div>
  <div class="dots">${all.map((s,n)=>`<i class="${filled(s)?'done':n===i?'now':''}"></i>`).join('')}</div>
  <div class="stage">
    <div class="exhead">
      <div class="exname">${esc(ex.n)}</div>
      <div class="extag">${tagHTML(ex.tag)}</div>
      ${ex.seat?.[step.person]?`<div class="seat">${esc(ex.seat[step.person])}</div>`:''}
      ${S.day.swaps&&Object.values(S.day.swaps).includes(step.ex)?`<span class="swapped">zamiennik</span>`:''}
    </div>
    ${step.kind==='warm'?warmHTML(step,locked):workHTML(step,locked)}
    ${footHTML(all,i,step,locked,rest)}
  </div>
  ${locked?`<div class="restwrap"><div class="restring">
      <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44"/>
      <circle cx="50" cy="50" r="44" class="run" data-ring
        stroke-dasharray="276.5" stroke-dashoffset="${(276.5*(1-rest/(S.day.restLen||REST))).toFixed(1)}"/></svg>
      <b data-tick>${mmss(rest)}</b></div>
      <span>${S.day.restNote?'dłuższa przerwa · spadek siły':'przerwa'}</span></div>`:''}`;
}

function tagHTML(t){
  return t.split('·').map(p=>{const s=p.trim();
    return /^TRICEPS$/i.test(s)?`<span class="hot">${esc(s)}</span>`:esc(s)}).join(' · ');
}

function warmHTML(step,locked){
  const w=WARMUP[step.set-1], base=lastOf(step.ex,step.person), ex=EX[step.ex], v=val(step);
  const kg=base?round(base.kg*w.pct,ex.step):null;
  return `<div class="turn ${step.person==='martin'?'m':'a'}">
    <i class="dot"></i><b>${NAMES[step.person]}</b><span>rozgrzewka ${step.set}/2</span></div>
  <div class="entry warm">
    <div class="wtitle">${Math.round(w.pct*100)}% ciężaru roboczego</div>
    ${kg?`<div class="wbig">${kg} kg</div><div class="wsub">${w.reps} powtórzeń</div>`
        :`<div class="wsub">Brak historii — lekka seria na wyczucie, ${w.reps} powtórzeń.</div>`}
    <div class="acts"><button data-warm="${v&&v.ok?'0':'1'}" ${locked?'disabled':''}>${v&&v.ok?'Odznacz':'Zrobione'}</button></div>
  </div>`;
}

function workHTML(step,locked){
  const ex=EX[step.ex];
  let v=val(step);
  const prev=lastOf(step.ex,step.person);
  // prefill: wpisuje wynik z poprzedniego treningu jako realną wartość
  if(!v && prev){ v={kg:prev.kg,reps:prev.reps,pre:true}; S.day.log[K(step)]=v; }
  v=v||{};
  const c=coachFor(step,v);
  const total=maxSetsFor(step.ex);
  return `<div class="turn ${step.person==='martin'?'m':'a'}">
    <i class="dot"></i><b>${NAMES[step.person]}</b><span>seria ${step.set} z ${total}</span></div>
  <div class="entry ${step.person==='martin'?'m':'a'}">
    <div class="pair">
      <div class="num">
        <input type="text" inputmode="decimal" class="kg" value="${v.kg??''}" placeholder="kg" ${locked?'disabled':''}>
        <label>kg</label>
        <div class="step"><button data-add="kg:-${ex.step}" ${locked?'disabled':''}>−${ex.step}</button><button data-add="kg:${ex.step}" ${locked?'disabled':''}>+${ex.step}</button></div>
      </div>
      <div class="times">×</div>
      <div class="num">
        <input type="text" inputmode="numeric" class="reps" value="${v.reps??''}" placeholder="powt" ${locked?'disabled':''}>
        <label>powt</label>
        <div class="step"><button data-add="reps:-1" ${locked?'disabled':''}>−1</button><button data-add="reps:1" ${locked?'disabled':''}>+1</button></div>
      </div>
    </div>
    <div class="prevline">${prev?`poprzednio <b>${prev.kg} × ${prev.reps}</b> · ${agoText(prev.id)}`
      :'pierwszy raz — wpisz, co dasz radę'}</div>
    ${c?`<div class="coach ${c.t}">${esc(c.msg)}</div>`:''}
    <div class="acts"><button data-busy ${locked?'disabled':''}>Maszyna zajęta</button></div>
  </div>`;
}
function maxSetsFor(ex){
  const f=(S.day.finishers||[]).find(b=>b.ex===ex);
  return f?f.sets:EX[ex].sets;
}

function footHTML(all,i,step,locked,rest){
  if(locked) return `<div class="next"><button disabled>Przerwa · ${mmss(rest)}</button>
    <div class="lockinfo">wpisywanie odblokuje się samo</div></div>`;
  const ok=filled(step), last=i>=all.length-1;
  const lastIsFinisher = last && finishersDone();
  return `<div class="next">
    <button data-next ${ok?'':'disabled'}>${last?(lastIsFinisher?'Zakończ trening':'Dalej'):'Dalej'}</button>
    ${ok?'':'<div class="lockinfo">wpisz wynik, żeby przejść dalej</div>'}</div>`;
}

/* ---------- wybór końcówki ---------- */
function chooseFinisherView(){
  const used=(S.day.finishers||[]).map(b=>b.group);
  const left=Object.entries(FINISHERS).filter(([k])=>!used.includes(k));
  if(!left.length) return viewSummaryPrompt();
  return `<div class="tbar"><span class="clock">${hhmm(now()-S.day.startedAt)}</span>
    <button class="quit" data-finish>Zakończ</button></div>
  <div class="stage">
    <div class="exhead"><div class="exname">Co teraz?</div>
      <div class="extag">kolejność dowolna</div></div>
    ${left.map(([k,f])=>`<button class="pick" data-group="${k}"><b>${esc(f.label)}</b><span>${esc(f.hint)}</span></button>`).join('')}
    ${used.length?`<button class="pick mute" data-finish><b>Kończymy</b><span>${used.length} z 3 zrobione</span></button>`:''}
  </div>`;
}
function viewSummaryPrompt(){
  return `<div class="stage" style="padding-top:40px">
    <div class="exhead"><div class="exname">Wszystko zrobione.</div></div>
    <div class="next"><button data-finish>Zakończ trening</button></div></div>`;
}

/* triceps: elastyczny wybór 1–2 serii, max 2 łącznie */
function triSheet(){
  const opts=TRICEPS_POOL;
  const rows=[];
  opts.forEach(a=>rows.push({list:[[a,1]],label:`1 × ${EX[a].n}`,sub:'lekki dzień'}));
  opts.forEach(a=>rows.push({list:[[a,2]],label:`2 × ${EX[a].n}`,sub:'jedno ćwiczenie'}));
  opts.forEach((a,i)=>opts.slice(i+1).forEach(b=>
    rows.push({list:[[a,1],[b,1]],label:`${EX[a].n} + ${EX[b].n}`,sub:'po jednej serii'})));
  sheet(`<h2>Triceps</h2><p>Maksymalnie 2 serie na trening. Jeśli triceps nie doszedł, weź jedną.</p>
    ${rows.map(r=>`<button class="opt" data-tri='${JSON.stringify(r.list)}'>${esc(r.label)}<small>${esc(r.sub)}</small></button>`).join('')}
    <button class="opt mute" data-cancel>Anuluj</button>`);
}
function pickSheet(group){
  const f=FINISHERS[group];
  if(group==='triceps') return triSheet();
  if(f.alts.length<2){ addFinisher(group,f.def,2); return; }
  sheet(`<h2>${esc(f.label)}</h2><p>Domyślnie ${esc(EX[f.def].n)}.</p>
    ${f.alts.map(id=>`<button class="opt" data-fin="${group}:${id}">${esc(EX[id].n)}<small>${esc(EX[id].tag)}</small></button>`).join('')}
    <button class="opt mute" data-cancel>Anuluj</button>`);
}
function addFinisher(group,ex,sets){
  (S.day.finishers ||= []).push({group,ex,sets});
  rebuild(); persist(true); closeSheet(); jumpToFirstEmpty();
}

/* ---------- podsumowanie ---------- */
function viewSummary(){
  const d=S.day;
  const sets=Object.entries(d.log).filter(([k,v])=>k.endsWith('|work')&&v?.kg&&v?.reps);
  return `<div class="doneview">
    <span class="eyebrow">Trening zamknięty</span>
    <div class="bignum" style="margin:14px 0 4px">${hhmm((d.endedAt||now())-d.startedAt)}<span> h</span></div>
    <p class="empty">${sets.length} serii zapisanych.</p>
    <div style="margin-top:26px">${sets.map(([k,v])=>{const [ex,p]=k.split('|');
      return `<div class="line"><span class="name">${esc(EX[ex]?.n||ex)}</span>
      <span class="val"><i class="${p==='martin'?'m':'a'}">${v.kg} × ${v.reps}</i></span></div>`}).join('')}</div>
    <div class="next" style="margin-top:26px"><button data-close>Gotowe</button></div></div>`;
}

/* ---------- progres ---------- */
function viewHist(){
  const seg=`<div class="seg">
    <button class="${S.sub==='progress'?'on':''}" data-sub="progress">Rekordy</button>
    <button class="${S.sub==='days'?'on':''}" data-sub="days">Dni</button></div>`;

  if(S.sub==='days'){
    return `<div class="scroll"><span class="eyebrow">Progres</span><h1>Dni</h1>
      <div style="margin-top:20px">${seg}
      ${S.hist.length?S.hist.map(d=>{
        const n=Object.entries(d.log||{}).filter(([k,v])=>k.endsWith('|work')&&v?.kg).length;
        return `<button class="card" style="width:100%;text-align:left" data-day="${d.id}">
          <h2>${prettyDate(d.id)}</h2><div class="sub">${n} serii · ${agoText(d.id)}</div></button>`}).join('')
        :'<p class="empty">Brak treningów.</p>'}</div></div>`;
  }

  const rows=Object.keys(EX).map(id=>{
    const out=[];
    ['martin','ana'].forEach(p=>{
      const l=lastOf(id,p)||(S.hist.length?null:null);
      const t=topOf(id,p);
      if(!t)return;
      out.push(`<i class="${p==='martin'?'m':'a'}">${t.kg}×${t.reps}</i>`);
    });
    return `<button class="line" style="width:100%" data-ex="${id}">
      <span class="name">${esc(EX[id].n)}</span>
      <span class="val">${out.length?out.join(''):'<i style="color:var(--dim2)">—</i>'}</span></button>`;
  }).join('');

  return `<div class="scroll"><span class="eyebrow">Progres</span>
    <h1>Rekordy<em>i historia ciężarów.</em></h1>
    <div style="margin-top:20px">${seg}
    <div class="card">${rows}</div>
    <p class="empty" style="margin-top:14px">Dotknij ćwiczenia, żeby zobaczyć wykres albo dopisać wynik wstecz.</p>
    </div></div>`;
}

function exSheet(id){
  const blocks=['martin','ana'].map(p=>{
    const s=seriesOf(id,p);
    const t=topOf(id,p);
    if(!s.length) return `<h2 style="margin-top:16px;color:${p==='martin'?'var(--m)':'var(--a)'}">${NAMES[p]}</h2>
      <p>brak wyników</p>`;
    return `<h2 style="margin-top:16px;color:${p==='martin'?'var(--m)':'var(--a)'}">${NAMES[p]}</h2>
      <p style="margin-bottom:6px">rekord ${t.kg} × ${t.reps} · ${agoText(t.id)}</p>
      ${chart(s,p==='martin'?'#FFC933':'#B08CFF')}
      ${s.slice(-6).reverse().map(x=>`<div class="line"><span class="name">${shortDate(x.id)} · ${agoText(x.id)}</span>
        <span class="val">${x.kg} × ${x.reps}</span></div>`).join('')}`;
  }).join('');
  sheet(`<h2>${esc(EX[id].n)}</h2><p>${esc(EX[id].tag)}</p>${blocks}
    <div class="addwrap"><div class="wtitle">Dopisz wynik wstecz</div>
      <div class="field">
        <select id="mkPerson"><option value="martin">Martin</option><option value="ana">Ana</option></select>
        <input type="date" id="mkDate" value="${todayId()}">
      </div>
      <div class="field">
        <input type="text" inputmode="decimal" id="mkKg" placeholder="kg" class="kgbig">
        <input type="text" inputmode="numeric" id="mkReps" placeholder="powt" class="kgbig">
        <button data-mk="${id}">Dodaj</button>
      </div></div>
    <button class="opt mute" data-cancel>Zamknij</button>`);
}

function daySheet(id){
  const d=S.hist.find(x=>x.id===id); if(!d)return;
  const rows=Object.entries(d.log).filter(([k,v])=>k.endsWith('|work')&&v?.kg)
    .map(([k,v])=>{const [ex,p,set]=k.split('|');
      return `<div class="line"><span class="name">${esc(EX[ex]?.n||ex)} · S${set}</span>
      <span class="val"><i class="${p==='martin'?'m':'a'}">${v.kg} × ${v.reps}</i></span></div>`}).join('');
  sheet(`<h2>${prettyDate(id)}</h2><p>${agoText(id)}</p>${rows}
    <button class="opt mute" data-cancel>Zamknij</button>`);
}

/* wykres z osiami i punktami */
function chart(series,color){
  if(series.length<2) return '<p class="sub">Za mało danych na wykres.</p>';
  const w=320,h=150,L=34,R=8,T=12,B=22;
  const v=series.map(s=>s.kg);
  let min=Math.min(...v), max=Math.max(...v);
  if(min===max){min-=1;max+=1}
  const pad=(max-min)*0.15; min-=pad; max+=pad;
  const X=i=>L+i*(w-L-R)/(series.length-1);
  const Y=k=>T+(1-(k-min)/(max-min))*(h-T-B);
  const grid=[0,.5,1].map(f=>{const k=min+f*(max-min);
    return `<line x1="${L}" y1="${Y(k).toFixed(1)}" x2="${w-R}" y2="${Y(k).toFixed(1)}" class="g"/>
    <text x="4" y="${(Y(k)+3.5).toFixed(1)}" class="ax">${k.toFixed(0)}</text>`}).join('');
  const path=series.map((s,i)=>`${i?'L':'M'}${X(i).toFixed(1)},${Y(s.kg).toFixed(1)}`).join(' ');
  const dots=series.map((s,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(s.kg).toFixed(1)}" r="3.2" fill="${color}"/>`).join('');
  const first=shortDate(series[0].id), last=shortDate(series[series.length-1].id);
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Wykres ciężaru">
    ${grid}<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>${dots}
    <text x="${L}" y="${h-5}" class="ax">${first}</text>
    <text x="${w-R}" y="${h-5}" class="ax" text-anchor="end">${last}</text></svg>`;
}

/* ---------- Martin ---------- */
function viewMartin(){
  return `<div class="scroll"><span class="eyebrow">Martin</span>
    <h1>${S.mzone==='weight'?'Masa ciała':'Shake'}</h1>
    <div style="margin-top:20px">
    <div class="duo">
      <button class="${S.mzone==='weight'?'on':''}" data-zone="weight"><b>Waga</b><span>zapis i historia</span></button>
      <button class="${S.mzone==='shake'?'on':''}" data-zone="shake"><b>Shake</b><span>kalorie i mikro</span></button>
    </div>${S.mzone==='weight'?weightHTML():shakeHTML()}</div></div>`;
}

function weightHTML(){
  const w=S.weights;
  const s=[...w].sort((a,b)=>a.id.localeCompare(b.id)).map(x=>({id:x.id,kg:x.kg}));
  return `<div class="card">
    <div class="field">
      <input type="text" inputmode="decimal" id="wkg" class="kgbig" placeholder="kg">
      <input type="date" id="wdate" value="${todayId()}">
      <button data-addw>Zapisz</button>
    </div>
    <input type="text" id="wnote" placeholder="notatka (opcjonalna)" class="notein" style="display:${S.noteOpen?'block':'none'}">
    ${S.noteOpen?'':'<button class="tiny" data-note>+ dodaj notatkę</button>'}
    ${s.length>1?chart(s,'#FFC933'):''}
    ${w.length?w.map((x,i)=>{const p=w[i+1];const d=p?x.kg-p.kg:null;
      return `<div class="wrow"><span class="d">${shortDate(x.id)}${x.note?` · ${esc(x.note)}`:''}</span>
      <span class="n">${x.kg} kg</span>
      <span class="delta">${d!==null?(d>0?'+':'')+d.toFixed(1):''}</span>
      <button class="edit" data-editw="${x.id}">⋯</button></div>`}).join('')
      :'<p class="empty">Brak wpisów. Datę można cofnąć i dopisać historię.</p>'}
  </div>`;
}

function shakeHTML(){
  const s=calcShake(S.cfg.kcal);
  const micro=Object.entries(s.micro).filter(([k])=>NRV[k])
    .sort((a,b)=>(b[1]/NRV[b[0]])-(a[1]/NRV[a[0]]))
    .map(([k,v])=>{const pct=Math.round(v/NRV[k]*100);
      return `<div class="nrv"><div class="top"><span>${esc(LABEL[k]||k)}</span>
      <b>${v>=10?Math.round(v):v.toFixed(1)} ${UNIT[k]||''}<em>${pct}%</em></b></div>
      <div class="track"><i class="${pct>=100?'full':''}" style="width:${Math.min(100,pct)}%"></i></div></div>`}).join('');
  return `<div class="card">
    <div class="kcalbig">${S.cfg.kcal}<span>kcal cel</span></div>
    <div class="slider"><input type="range" min="400" max="1500" step="50" value="${S.cfg.kcal}" id="kcal" aria-label="Cel kalorii"></div>
    <div class="pbline">Masło orzechowe: <b>${s.pb} g</b></div>
    <div class="macros">
      <div><b>${s.kcal}</b><span>kcal</span></div><div><b>${s.p} g</b><span>białko</span></div>
      <div><b>${s.c} g</b><span>węgle</span></div><div><b>${s.f} g</b><span>tłuszcz</span></div></div>
    <p class="sub">szklanka mleka · banan · miarka białka</p></div>
  <div class="card"><h2>Witaminy i minerały</h2>
    <div class="sub" style="margin-bottom:10px">% dziennego zapotrzebowania (RWS)</div>${micro}</div>`;
}
function calcShake(target){
  const base=[['protein',PORTION.protein],['milk',PORTION.milk],['banana',PORTION.banana]];
  const kb=base.reduce((a,[k,g])=>a+FOOD[k].kcal*g/FOOD[k].per,0);
  const pb=Math.max(0,Math.round((target-kb)/(FOOD.peanut.kcal/100)/5)*5);
  const parts=[...base,['peanut',pb]];
  const sum=f=>parts.reduce((a,[k,g])=>a+(FOOD[k][f]||0)*g/FOOD[k].per,0);
  const micro={};
  parts.forEach(([k,g])=>{const F=FOOD[k],r=g/F.per;
    Object.entries({...(F.vit||{}),...(F.min||{})}).forEach(([n,v])=>micro[n]=(micro[n]||0)+v*r)});
  return {pb,kcal:Math.round(sum('kcal')),p:Math.round(sum('p')),c:Math.round(sum('c')),f:Math.round(sum('f')),micro};
}

/* ---------- arkusze ---------- */
function sheet(html){ $('#sheet').innerHTML=`<div class="sheet">${html}</div>`; }
function closeSheet(){ $('#sheet').innerHTML=''; }
function modal(html){ $('#sheet').innerHTML=`<div class="modal">${html}</div>`; }
function snack(msg,label,fn){
  $('#snack').innerHTML=`<div class="snack"><span>${esc(msg)}</span>${label?`<button data-undo>${esc(label)}</button>`:''}</div>`;
  clearTimeout(S._sn); S.undo=fn;
  S._sn=setTimeout(()=>{$('#snack').innerHTML='';S.undo=null},5000);
}
function gateModal(step){
  modal(`<div class="gicon">!</div><h2>${esc(EX[step.ex].n)}</h2>
    <p>${esc(EX[step.ex].gate)}</p>
    <button class="opt" data-gate="${step.ex}">Rozgrzałem się</button>`);
}
function busySheet(step){
  const ex=EX[step.ex], subs=ex.sub||[];
  if(subs.length) return sheet(`<h2>${esc(ex.n)} zajęte</h2><p>Wybierz zamiennik.</p>
    ${subs.map(id=>`<button class="opt" data-swap="${id}">${esc(EX[id].n)}<small>${esc(EX[id].tag)}</small></button>`).join('')}
    <button class="opt mute" data-cancel>Anuluj</button>`);
  if(ex.skippable){
    const lastSkip=lsGet('dl.lastSkip',null);
    const can=lastSkip!==lsGet('dl.prevTrainingId',null)&&lastSkip!==todayId();
    if(can) return sheet(`<h2>${esc(ex.n)} zajęte</h2>
      <p>Przód barków dostał już swoje przy skosie. Dziś możesz odpuścić — ale nie dwa treningi z rzędu.</p>
      <button class="opt" data-skipex>Odpuść dziś<small>wraca na następnym treningu</small></button>
      <button class="opt mute" data-cancel>Anuluj</button>`);
    return sheet(`<h2>${esc(ex.n)} zajęte</h2>
      <p>Poprzednio już to odpuściłeś. Dziś trzeba zrobić — poczekaj, aż maszyna się zwolni.</p>
      <button class="opt mute" data-cancel>Rozumiem</button>`);
  }
  return sheet(`<h2>${esc(ex.n)} zajęte</h2>
    <p>Tego nie zamieniamy i nie przestawiamy kolejności. Poczekaj, aż się zwolni.</p>
    <button class="opt mute" data-cancel>Rozumiem</button>`);
}

/* ---------- akcje ---------- */
document.addEventListener('click',async e=>{
  const b=e.target.closest('button'); if(!b)return;
  const d=b.dataset;

  if(d.tab){S.tab=d.tab;render();if(d.tab==='martin')loadMartin();return}
  if(d.sub){S.sub=d.sub;render();return}
  if(d.zone){S.mzone=d.zone;render();return}
  if(d.cancel!==undefined)return closeSheet();
  if(d.undo!==undefined){const f=S.undo;S.undo=null;$('#snack').innerHTML='';f&&f();return}

  if(d.open){
    const id=todayId();
    let day=await readDay(id).catch(()=>null);
    if(!day||day.finished) day={id,startedAt:now(),log:{},swaps:{},skipped:[],gated:{},finishers:[],restUntil:0};
    day.mode=d.open;
    S.day=day; S.cursor=0; rebuild(); persist(true); watchNow(); jumpToFirstEmpty(); return;
  }

  if(d.group) return pickSheet(d.group);
  if(d.fin){const [g,ex]=d.fin.split(':');return addFinisher(g,ex,2)}
  if(d.tri){
    const list=JSON.parse(d.tri);
    list.forEach(([ex,sets])=>(S.day.finishers ||= []).push({group:'triceps',ex,sets}));
    rebuild();persist(true);closeSheet();jumpToFirstEmpty();return;
  }

  const all=steps(), step=all[S.cursor];
  if(d.gate){(S.day.gated ||= {})[d.gate]=1;persist();closeSheet();render();return}

  if(step){
    if(d.warm!==undefined){S.day.log[K(step)]={ok:d.warm==='1'};persist();d.warm==='1'?advance():soft();return}
    if(d.add){
      const [f,dl]=d.add.split(':');
      const inp=$('.'+f), cur=num(inp.value);
      const base=cur!==null?cur:(f==='kg'?EX[step.ex].step:6);
      inp.value=Math.max(0,+(base+parseFloat(dl)).toFixed(2));
      writeInputs(step);soft();return;
    }
    if(d.busy!==undefined)return busySheet(step);
    if(d.swap){
      const from=step.ex;
      S.day.swaps[from]=d.swap;
      Object.keys(S.day.log).forEach(k=>{if(k.startsWith(from+'|'))delete S.day.log[k]});
      (S.day.finishers||[]).forEach(bl=>{if(bl.ex===from)bl.ex=d.swap});
      rebuild();persist(true);closeSheet();render();return;
    }
    if(d.skipex!==undefined){
      (S.day.skipped ||= []).push(step.ex);
      lsSet('dl.lastSkip',todayId());
      rebuild();persist(true);closeSheet();jumpToFirstEmpty();return;
    }
    if(d.next!==undefined)return advance();
  }
  if(d.finish!==undefined)return finish();
  if(d.close!==undefined){S.day=null;lsSet(LS_DAY,null);S.cursor=0;render();return}
  if(d.ex)return exSheet(d.ex);
  if(d.day)return daySheet(d.day);

  if(d.mk){
    const p=$('#mkPerson').value, date=$('#mkDate').value||todayId();
    const kg=num($('#mkKg').value), reps=num($('#mkReps').value);
    if(!kg||!reps)return;
    let day=S.hist.find(x=>x.id===date);
    if(!day){day={id:date,startedAt:new Date(date+'T18:00').getTime(),endedAt:new Date(date+'T19:00').getTime(),
      finished:true,manual:true,log:{},swaps:{},finishers:[]};S.hist=[day,...S.hist]}
    const n=Object.keys(day.log).filter(k=>k.startsWith(`${d.mk}|${p}|`)).length+1;
    day.log[`${d.mk}|${p}|${n}|work`]={kg,reps,ts:now()};
    S.hist.sort((a,b)=>b.id.localeCompare(a.id));
    lsSet(LS_HIST,S.hist);
    const {_steps,...clean}=day; saveDay(date,clean).catch(()=>{});
    exSheet(d.mk); return;
  }

  if(d.note!==undefined){S.noteOpen=true;soft();return}
  if(d.addw!==undefined){
    const kg=num($('#wkg').value); if(!kg)return;
    const id=$('#wdate').value||todayId();
    const entry={id,kg,note:($('#wnote')?.value||'').trim()};
    S.weights=[entry,...S.weights.filter(x=>x.id!==id)].sort((a,b)=>b.id.localeCompare(a.id));
    S.noteOpen=false;render();saveWeight(id,entry).catch(()=>{});return;
  }
  if(d.editw){
    const x=S.weights.find(w=>w.id===d.editw);if(!x)return;
    return sheet(`<h2>${prettyDate(x.id)}</h2><p>${x.kg} kg${x.note?` · ${esc(x.note)}`:''}</p>
      <button class="opt" data-loadw="${x.id}">Popraw wpis</button>
      <button class="opt danger" data-delw="${x.id}">Usuń wpis</button>
      <button class="opt mute" data-cancel>Anuluj</button>`);
  }
  if(d.loadw){
    const x=S.weights.find(w=>w.id===d.loadw);closeSheet();
    S.noteOpen=!!x.note;render();
    $('#wkg').value=x.kg;$('#wdate').value=x.id;if($('#wnote'))$('#wnote').value=x.note||'';
    $('#wkg').focus();return;
  }
  if(d.delw){
    const x=S.weights.find(w=>w.id===d.delw);closeSheet();
    S.weights=S.weights.filter(w=>w.id!==d.delw);render();
    let undone=false;
    snack(`Usunięto wpis z ${shortDate(x.id)}`,'Cofnij',()=>{undone=true;
      S.weights=[x,...S.weights].sort((a,b)=>b.id.localeCompare(a.id));render()});
    setTimeout(()=>{if(!undone)removeWeight(x.id).catch(()=>{})},5200);
    return;
  }
});

document.addEventListener('input',e=>{
  if(e.target.id==='kcal'){S.cfg.kcal=+e.target.value;lsSet(LS_CFG,S.cfg);
    const k=document.querySelector('.kcalbig');if(k)k.innerHTML=`${S.cfg.kcal}<span>kcal cel</span>`;
    clearTimeout(S._kc);S._kc=setTimeout(()=>{saveConfig(S.cfg).catch(()=>{});soft()},220);return}
  if(!S.day||S.day.finished)return;
  if(e.target.classList.contains('kg')||e.target.classList.contains('reps')){
    const st=steps()[S.cursor]; if(!st)return;
    writeInputs(st);
    const btn=document.querySelector('[data-next]');if(btn)btn.disabled=!filled(st);
  }
});

function writeInputs(step){
  const kg=num($('.kg')?.value), reps=num($('.reps')?.value);
  S.day.log[K(step)]={kg,reps,ts:now()};
  persist();
}

/* ---------- nawigacja kroków ---------- */
function advance(){
  const all=steps(), step=all[S.cursor];
  if(step&&step.kind==='work'){
    const v=val(step);
    const nx=all[S.cursor+1];
    const sameSet=nx&&nx.ex===step.ex&&nx.set===step.set&&nx.person!==step.person;
    if(!sameSet&&v){
      const long=dropped(step,v);
      S.day.restLen=long?REST_LONG:REST;
      S.day.restUntil=now()+S.day.restLen;
      S.day.restNote=long?'spadek siły':'';
    }
  }
  if(S.cursor>=all.length-1){
    S.cursor=all.length; persist(true); render();
    return checkGate();
  }
  S.cursor++; persist(); render(); checkGate();
  document.querySelector('.stage')?.scrollTo(0,0);
}
function checkGate(){
  const st=steps()[S.cursor];
  if(st&&st.kind==='work'&&EX[st.ex].gate&&!S.day.gated?.[st.ex]) gateModal(st);
}
function jumpToFirstEmpty(){
  const all=steps();
  const i=all.findIndex(s=>!filled(s));
  S.cursor=i<0?all.length:i;
  render(); checkGate();
}

async function finish(){
  const d=S.day;if(!d)return;
  if(!Object.values(d.log).some(v=>v&&v.kg&&v.reps)){S.day=null;lsSet(LS_DAY,null);render();return}
  d.finished=true;d.endedAt=now();d.restUntil=0;
  lsSet('dl.prevTrainingId',d.id);
  const {_steps,...clean}=d;
  S.hist=[clean,...S.hist.filter(h=>h.id!==d.id)].sort((a,b)=>b.id.localeCompare(a.id));
  lsSet(LS_HIST,S.hist);
  closeSheet(); render();
  saveDay(d.id,clean).catch(()=>{});
}

/* zegar */
setInterval(()=>{
  if(!S.day||S.day.finished||S.tab!=='train')return;
  const left=(S.day.restUntil||0)-now();
  if(left>0){
    const t=document.querySelector('[data-tick]');if(t)t.textContent=mmss(left);
    const r=document.querySelector('[data-ring]');
    if(r)r.setAttribute('stroke-dashoffset',(276.5*(1-left/(S.day.restLen||REST))).toFixed(1));
    const n=document.querySelector('[data-next]');if(n)n.textContent=`Przerwa · ${mmss(left)}`;
  } else if(S.day.restUntil){S.day.restUntil=0;persist(true);render();checkGate()}
  const c=document.querySelector('.tbar .clock');
  if(c)c.textContent=hhmm(now()-S.day.startedAt);
},1000);

document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.day)render()});

function watchNow(){
  if(S.unwatch)S.unwatch();
  if(!S.day)return;
  S.unwatch=watchDay(S.day.id,cloud=>{
    if(!S.day||cloud.id!==S.day.id||cloud.finished)return;
    if((cloud.updatedAt||0)<=(S.day.updatedAt||0))return;
    S.day.log={...cloud.log,...S.day.log};
    S.day.updatedAt=cloud.updatedAt;
    if(cloud.finishers?.length&&!S.day.finishers?.length){S.day.finishers=cloud.finishers;rebuild()}
    lsSet(LS_DAY,S.day);
    if(S.tab==='train')soft();
  });
}

async function loadMartin(){
  try{
    const [w,c]=await Promise.all([listWeights(),loadConfig()]);
    S.weights=w.sort((a,b)=>b.id.localeCompare(a.id));
    S.cfg={...S.cfg,...c};lsSet(LS_CFG,S.cfg);
    if(S.tab==='martin')render();
  }catch(e){}
}

async function boot(){
  if(S.day&&S.day.finished){S.day=null;lsSet(LS_DAY,null)}
  render();
  if(S.day){rebuild();jumpToFirstEmpty();watchNow()}
  try{
    const days=await listDays();
    const done=days.filter(d=>d.finished);
    if(done.length){S.hist=done.sort((a,b)=>b.id.localeCompare(a.id));lsSet(LS_HIST,S.hist)}
    const t=days.find(d=>d.id===todayId()&&!d.finished);
    if(t&&!S.day){S.day=t;rebuild();watchNow();jumpToFirstEmpty()}else render();
  }catch(e){}
  loadMartin();
}
boot();
