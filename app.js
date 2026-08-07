import { initialData } from './data.js';

let selectedUser = null; // 'martin' lub 'ana'
let currentExIndex = 0;
let currentSet = 1; // 1 lub 2
let workoutLogs = {};

// 1. Ekran wyboru osoby
window.selectUser = function(user) {
  selectedUser = user;
  currentExIndex = 0;
  currentSet = 1;
  document.getElementById('user-selector').classList.add('hidden');
  document.getElementById('workout-view').classList.remove('hidden');
  renderStep();
};

// 2. Renderowanie aktualnego kroku
function renderStep() {
  const exercises = initialData[selectedUser];
  const ex = exercises[currentExIndex];
  const container = document.getElementById('step-card');

  if (!ex) {
    container.innerHTML = `
      <div class="glass-panel p-8 rounded-3xl text-center space-y-4">
        <h2 class="text-2xl font-black text-emerald-400">Dobra robota! 🎉</h2>
        <p class="text-sm text-slate-300">Trening dla <strong>${selectedUser.toUpperCase()}</strong> zakończony.</p>
        <button onclick="location.reload()" class="w-full py-4 bg-emerald-500 text-slate-950 font-black rounded-2xl text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transition">
          Zacznij od nowa
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="glass-panel p-6 rounded-3xl space-y-6 card-enter">
      
      <div class="flex justify-between items-center">
        <div>
          <span class="text-[10px] font-black tracking-widest text-emerald-400 uppercase">
            ${selectedUser.toUpperCase()} • Ćwiczenie ${currentExIndex + 1} z ${exercises.length}
          </span>
          <h2 class="text-lg font-black text-slate-100 mt-1">${ex.name}</h2>
        </div>
        <span class="text-xs bg-slate-900 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full font-bold">
          ${ex.target}
        </span>
      </div>

      <div class="w-full h-36 bg-slate-950/80 rounded-2xl border border-slate-800 flex items-center justify-center text-slate-600 text-xs font-semibold">
        [ Miejsce na podgląd / zdjęcie ćwiczenia ]
      </div>

      <div class="bg-slate-950/60 p-3 rounded-2xl border border-slate-800/80 flex justify-between items-center text-xs">
        <span class="text-slate-400 font-semibold">Ostatnio (z notatek):</span>
        <span class="text-amber-400 font-bold">${ex.last}</span>
      </div>

      <div class="space-y-3 pt-2">
        <div class="flex justify-between items-center">
          <span class="text-xs font-black text-slate-200 uppercase tracking-wider">
            Zapisz: SERIA ${currentSet} z 2
          </span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-bold">Ciężar (kg)</label>
            <input type="number" id="input-weight" placeholder="0" class="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 text-center text-lg font-black text-emerald-400 focus:outline-none focus:border-emerald-500">
          </div>
          <div class="space-y-1">
            <label class="text-[10px] text-slate-400 font-bold">Powtórzenia</label>
            <input type="number" id="input-reps" placeholder="0" class="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 text-center text-lg font-black text-emerald-400 focus:outline-none focus:border-emerald-500">
          </div>
        </div>
      </div>

      <button onclick="window.saveSet()" class="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black rounded-2xl text-xs tracking-wider uppercase shadow-lg shadow-emerald-500/20 active:scale-95 transition">
        ${currentSet === 1 ? 'Zatwierdź Serię 1 →' : 'Zatwierdź Serię 2 & Następne Ćwiczenie →'}
      </button>

    </div>
  `;
}

// 3. Logika przeskakiwania serii
window.saveSet = function() {
  const weight = document.getElementById('input-weight').value;
  const reps = document.getElementById('input-reps').value;
  const exercises = initialData[selectedUser];
  const ex = exercises[currentExIndex];

  if (!workoutLogs[ex.id]) workoutLogs[ex.id] = {};
  workoutLogs[ex.id][`s${currentSet}`] = { weight, reps };

  if (currentSet === 1) {
    currentSet = 2;
  } else {
    currentSet = 1;
    currentExIndex++;
  }
  
  renderStep();
};
