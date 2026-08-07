import { workoutPlan } from './data.js';
import { db, collection, addDoc } from './firebase.js';

let currentIndex = 0;
let currentPerson = 'martin'; // 'martin' lub 'ana'
const flatExercises = flattenPlan(workoutPlan);

function flattenPlan(plan) {
  let list = [];
  plan.forEach(item => {
    if (item.type === 'together') {
      list.push({ ...item, scope: 'together' });
    } else if (item.type === 'split') {
      list.push({ ...item, scope: 'split' });
    }
  });
  return list;
}

function renderCurrentCard() {
  const container = document.getElementById('card-container');
  if (!container) return;

  const current = flatExercises[currentIndex];
  
  let html = `
    <div id="active-card" class="glass-panel rounded-3xl p-6 shadow-2xl card-enter space-y-6">
      
      <div class="flex justify-between items-center">
        <div>
          <span class="text-[11px] font-bold tracking-widest text-emerald-400 uppercase">
            Ćwiczenie ${currentIndex + 1} z ${flatExercises.length}
          </span>
          <h2 class="text-xl font-black text-slate-100 mt-0.5">${current.name || 'Sekcja Dedykowana'}</h2>
        </div>
        ${current.targetReps ? `<span class="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">Cel: ${current.targetReps[0]}-${current.targetReps[1]} powt.</span>` : ''}
      </div>

      <div class="w-full h-44 bg-slate-900/80 rounded-2xl border border-slate-800 flex flex-col items-center justify-center text-slate-500 overflow-hidden relative">
        ${current.gifUrl 
          ? `<img src="${current.gifUrl}" class="w-full h-full object-cover rounded-2xl">` 
          : `<svg class="w-10 h-10 mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
             <span class="text-xs font-semibold">Podgląd GIF-a (Miejsce na link)</span>`}
      </div>

      ${current.scope === 'split' ? `
        <div class="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
          <button onclick="window.setPerson('martin')" class="flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${currentPerson==='martin'?'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20':'text-slate-400'}">MARTIN (Góra)</button>
          <button onclick="window.setPerson('ana')" class="flex-1 py-2.5 text-xs font-black rounded-xl transition-all ${currentPerson==='ana'?'bg-pink-500 text-slate-950 shadow-lg shadow-pink-500/20':'text-slate-400'}">ANA (Nogi)</button>
        </div>
      ` : ''}

      <div class="space-y-4">
        ${renderInputs(current)}
      </div>

      <div id="coach-feedback" class="hidden"></div>

      <div class="flex gap-3 pt-2">
        <button onclick="window.prevCard()" ${currentIndex === 0 ? 'disabled' : ''} class="w-1/3 py-3.5 bg-slate-900 border border-slate-800 disabled:opacity-30 text-slate-300 font-bold rounded-2xl text-xs active:scale-95 transition">
          ← Wstecz
        </button>
        <button onclick="window.nextCard()" class="w-2/3 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-2xl text-xs shadow-lg shadow-emerald-500/20 active:scale-95 transition">
          ${currentIndex === flatExercises.length - 1 ? 'Zakończ Trening ✨' : 'Następne Ćwiczenie →'}
        </button>
      </div>

    </div>
  `;

  container.innerHTML = html;
}

function renderInputs(item) {
  let activeEx = item;
  if (item.scope === 'split') {
    activeEx = item[currentPerson][0]; // Pierwsze z listy dla danej osoby
  }

  return `
    <div class="bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 space-y-4">
      <div class="text-xs font-bold text-slate-400 uppercase tracking-wider">${item.scope === 'split' ? activeEx.name : 'Twój Wynik'}</div>
      
      <div class="space-y-1">
        <span class="text-[10px] text-slate-500 font-bold uppercase">Seria 1</span>
        <div class="grid grid-cols-2 gap-3">
          ${createStepper(`${activeEx.id}-s1-w`, 'kg', 2.5)}
          ${createStepper(`${activeEx.id}-s1-r`, 'powt', 1, activeEx.targetReps)}
        </div>
      </div>

      <div class="space-y-1 pt-2 border-t border-slate-800/50">
        <span class="text-[10px] text-slate-500 font-bold uppercase">Seria 2</span>
        <div class="grid grid-cols-2 gap-3">
          ${createStepper(`${activeEx.id}-s2-w`, 'kg', 2.5)}
          ${createStepper(`${activeEx.id}-s2-r`, 'powt', 1, activeEx.targetReps)}
        </div>
      </div>
    </div>
  `;
}

function createStepper(id, label, step, targetReps = null) {
  const onRepsChange = targetReps ? `onchange="window.analyzeReps(this.value, ${targetReps[0]}, ${targetReps[1]})"` : '';
  return `
    <div class="flex items-center bg-slate-950 rounded-xl border border-slate-800 p-1">
      <button onclick="window.stepValue('${id}', -${step})" class="w-8 h-8 rounded-lg bg-slate-900 text-slate-300 font-black text-sm flex items-center justify-center active:bg-slate-800">-</button>
      <input type="number" id="${id}" placeholder="0" ${onRepsChange} class="w-full bg-transparent text-center font-black text-sm text-emerald-400 focus:outline-none">
      <span class="text-[10px] text-slate-500 font-bold pr-1">${label}</span>
      <button onclick="window.stepValue('${id}', ${step})" class="w-8 h-8 rounded-lg bg-slate-900 text-slate-300 font-black text-sm flex items-center justify-center active:bg-slate-800">+</button>
    </div>
  `;
}

window.stepValue = function(inputId, step) {
  const input = document.getElementById(inputId);
  if (!input) return;
  let val = parseFloat(input.value) || 0;
  val = Math.max(0, val + step);
  input.value = val;
  input.dispatchEvent(new Event('change'));
};

window.analyzeReps = function(val, minReps, maxReps) {
  const reps = parseInt(val);
  const feedbackEl = document.getElementById('coach-feedback');
  if (!feedbackEl || isNaN(reps)) return;

  feedbackEl.classList.remove('hidden');
  
  if (reps > maxReps) {
    feedbackEl.innerHTML = `
      <div class="coach-pop p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3 text-xs text-emerald-300 font-semibold">
        <span class="text-lg">🔥</span>
        <span>Ogromna siła! Zrobiłeś/aś ${reps} powtórzeń (cel: ${maxReps}). Na następnym treningu **zwiększ ciężar**!</span>
      </div>
    `;
  } else if (reps < minReps && reps > 0) {
    feedbackEl.innerHTML = `
      <div class="coach-pop p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-xs text-amber-300 font-semibold">
        <span class="text-lg">💡</span>
        <span>Zrobiłeś/aś ${reps} powt. (poniżej ${minReps}). Jeśli czujesz duży opór, **zmniejsz delikatnie ciężar** na 2. serię.</span>
      </div>
    `;
  } else if (reps >= minReps && reps <= maxReps) {
    feedbackEl.innerHTML = `
      <div class="coach-pop p-3 bg-blue-500/10 border border-blue-500/30 rounded-2xl flex items-center gap-3 text-xs text-blue-300 font-semibold">
        <span class="text-lg">🎯</span>
        <span>Idealnie w celu (${reps} powt)! Trzymaj ten ciężar.</span>
      </div>
    `;
  }
};

window.setPerson = function(person) {
  currentPerson = person;
  renderCurrentCard();
};

window.nextCard = function() {
  if (currentIndex < flatExercises.length - 1) {
    const card = document.getElementById('active-card');
    if (card) card.classList.add('card-exit');
    setTimeout(() => {
      currentIndex++;
      renderCurrentCard();
    }, 200);
  } else {
    alert("🎉 Trening ukończony! Wyniki zostały zapisane.");
  }
};

window.prevCard = function() {
  if (currentIndex > 0) {
    currentIndex--;
    renderCurrentCard();
  }
};

document.addEventListener('DOMContentLoaded', renderCurrentCard);
