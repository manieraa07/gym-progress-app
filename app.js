import { workoutPlan } from './data.js';
import { db, collection, addDoc } from './firebase.js';

let currentSplitUser = 'martin';

function renderApp() {
  const container = document.getElementById('exercises-container');
  if (!container) return;
  container.innerHTML = '';

  workoutPlan.forEach(item => {
    if (item.type === 'together') {
      container.appendChild(createExerciseCard(item));
    } else if (item.type === 'split') {
      const splitWrapper = document.createElement('div');
      splitWrapper.className = 'glass-card p-3 rounded-2xl space-y-4 my-4';
      
      splitWrapper.innerHTML = `
        <div class="flex bg-slate-900 p-1 rounded-xl">
          <button onclick="window.switchTab('martin')" class="flex-1 py-2 text-xs font-bold rounded-lg transition ${currentSplitUser==='martin'?'bg-emerald-500 text-slate-950':'text-slate-400'}">Martin (Góra)</button>
          <button onclick="window.switchTab('ana')" class="flex-1 py-2 text-xs font-bold rounded-lg transition ${currentSplitUser==='ana'?'bg-emerald-500 text-slate-950':'text-slate-400'}">Ana (Nogi)</button>
        </div>
        <div id="split-content" class="space-y-4"></div>
      `;
      container.appendChild(splitWrapper);
      renderSplitContent(item);
    }
  });
}

function renderSplitContent(splitData) {
  const content = document.getElementById('split-content');
  if (!content) return;
  content.innerHTML = '';
  const list = splitData[currentSplitUser];
  list.forEach(ex => {
    content.appendChild(createExerciseCard(ex, currentSplitUser));
  });
}

window.switchTab = function(user) {
  currentSplitUser = user;
  renderApp();
};

function createExerciseCard(ex, singleUser = null) {
  const card = document.createElement('div');
  card.className = 'glass-card rounded-2xl p-4 shadow-lg space-y-3';
  
  let usersHTML = '';
  const users = singleUser ? [singleUser] : ['martin', 'ana'];

  users.forEach(u => {
    const userName = u === 'martin' ? 'Martin' : 'Ana';
    const userColor = u === 'martin' ? 'text-blue-400' : 'text-pink-400';
    
    usersHTML += `
      <div class="space-y-2 pt-2 border-t border-slate-800">
        <div class="flex justify-between items-center text-xs font-semibold">
          <span class="${userColor}">${userName}</span>
          <span class="text-slate-400 text-[10px]">Low Vol / RIR 0-1</span>
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="text-[10px] text-slate-400 block mb-1">SERIA 1</label>
            <div class="flex gap-1">
              <input type="number" id="${ex.id}-${u}-s1-w" placeholder="kg" class="input-field w-1/2 rounded-lg px-2 py-1.5 text-center text-sm font-bold">
              <input type="number" id="${ex.id}-${u}-s1-r" placeholder="powt" onchange="window.checkProgression(this)" class="input-field w-1/2 rounded-lg px-2 py-1.5 text-center text-sm font-bold">
            </div>
          </div>
          <div>
            <label class="text-[10px] text-slate-400 block mb-1">SERIA 2</label>
            <div class="flex gap-1">
              <input type="number" id="${ex.id}-${u}-s2-w" placeholder="kg" class="input-field w-1/2 rounded-lg px-2 py-1.5 text-center text-sm font-bold">
              <input type="number" id="${ex.id}-${u}-s2-r" placeholder="powt" onchange="window.checkProgression(this)" class="input-field w-1/2 rounded-lg px-2 py-1.5 text-center text-sm font-bold">
            </div>
          </div>
        </div>
      </div>
    `;
  });

  card.innerHTML = `
    <div class="flex justify-between items-center">
      <h3 class="font-bold text-sm text-slate-100">${ex.name}</h3>
      ${ex.gifUrl ? `<button onclick="window.showGif('${ex.gifUrl}')" class="text-[10px] bg-slate-800 text-emerald-400 px-2 py-1 rounded-lg border border-emerald-500/20">GIF</button>` : ''}
    </div>
    ${usersHTML}
  `;
  return card;
}

window.checkProgression = function(input) {
  if (parseInt(input.value) > 10) {
    alert("🚀 Zrobiłeś/aś więcej niż 10 powtórzeń! Czas zwiększyć ciężar na kolejnym treningu!");
  }
};

window.saveWorkout = async function() {
  alert("Zapisywanie treningu w bazie...");
  // Tutaj podepniemy pełen zapis sesji do Firebase
};

document.addEventListener('DOMContentLoaded', renderApp);
