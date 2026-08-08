import { workoutPlan, initialNotes } from './data.js';
import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';

let activeMode = null;
let currentExIndex = 0;
let currentSetNumber = 1;

let selectedRepsM = null;
let selectedRepsA = null;

let currentSessionData = {}; 
let historyData = {}; 
let currentWorkoutLogs = { date: new Date().toISOString(), entries: {} };

let timerInterval = null;
let timerSeconds = 0;

let touchStartX = 0;
let touchEndX = 0;

async function loadHistoryWithTimeout() {
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 1500));
  const fetchPromise = (async () => {
    try {
      const q = query(collection(db, "workouts"), orderBy("date", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const lastWorkout = querySnapshot.docs[0].data();
        if (lastWorkout && lastWorkout.entries) return lastWorkout.entries;
      }
    } catch (e) { console.warn("Firebase:", e); }
    return null;
  })();

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  if (result && result !== 'timeout') historyData = result;
}

window.startSession = async function(mode) {
  activeMode = mode;
  currentExIndex = 0;
  currentSetNumber = 1;
  currentSessionData = {};
  
  document.getElementById('mode-selection').classList.add('hidden');
  document.getElementById('loading-screen').classList.remove('hidden');
  
  await loadHistoryWithTimeout();
  
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('exercise-card-view').classList.remove('hidden');
  document.getElementById('app-header').classList.remove('hidden');
  
  startTimer();
  setupSwipeListeners();
  renderSingleSetCard();
};

function startTimer() {
  timerSeconds = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    timerSeconds++;
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('workout-timer').innerText = `${m}:${s}`;
  }, 1000);
}

window.confirmExit = function() {
  if (confirm("Czy na pewno chcesz zakończyć ten trening i wrócić do menu?")) {
    location.reload();
  }
};

function setupSwipeListeners() {
  const container = document.getElementById('card-container');

  container.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });
}

function handleSwipe() {
  const diffX = touchStartX - touchEndX;
  if (diffX > 50) window.goNext();
  else if (diffX < -50) window.goBack();
}

function saveCurrentStateSilently() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  if (!ex) return;

  if (activeMode === 'martin_session') {
    const wM = document.getElementById('martin_weight')?.value || getDefaultWeight(ex.id, 'martin');
    const keyM = `${ex.id}_martin`;
    const repsM = selectedRepsM || historyData[keyM]?.reps || 8;

    currentSessionData[keyM] = { weight: wM, reps: repsM };
    currentWorkoutLogs.entries[keyM] = { weight: wM, reps: repsM };
  }

  if (ex.isJoint || activeMode === 'ana_solo') {
    const wA = document.getElementById('ana_weight')?.value || getDefaultWeight(ex.id, 'ana');
    const keyA = `${ex.id}_ana`;
    const repsA = selectedRepsA || historyData[keyA]?.reps || 8;

    currentSessionData[keyA] = { weight: wA, reps: repsA };
    currentWorkoutLogs.entries[keyA] = { weight: wA, reps: repsA };
  }

  addDoc(collection(db, "workouts"), {
    ...currentWorkoutLogs,
    date: new Date().toISOString()
  }).catch(e => console.error("Firebase err: ", e));
}

window.goNext = function() {
  saveCurrentStateSilently();
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];

  animateAndProceed(() => {
    if (currentSetNumber < ex.totalSets) {
      currentSetNumber++;
      renderSingleSetCard();
    } else if (currentExIndex < list.length - 1) {
      currentSetNumber = 1;
      currentExIndex++;
      renderSingleSetCard();
    } else {
      renderCompletionScreen();
    }
  }, 'left');
};

window.goBack = function() {
  saveCurrentStateSilently();
  const list = workoutPlan[activeMode];
  
  if (currentSetNumber > 1) {
    currentSetNumber--;
    animateAndProceed(() => renderSingleSetCard(), 'right');
  } else if (currentExIndex > 0) {
    currentExIndex--;
    const prevEx = list[currentExIndex];
    currentSetNumber = prevEx.totalSets;
    animateAndProceed(() => renderSingleSetCard(), 'right');
  }
};

function renderSingleSetCard() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    renderCompletionScreen();
    return;
  }

  document.getElementById('header-ex-name').innerText = ex.name.split('.')[1] || ex.name;
  document.getElementById('header-set-counter').innerText = `SERIA ${currentSetNumber}/${ex.totalSets}`;

  const progressPercent = ((currentExIndex) / list.length) * 100;
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;

  selectedRepsM = currentSessionData[`${ex.id}_martin`]?.reps || null;
  selectedRepsA = currentSessionData[`${ex.id}_ana`]?.reps || null;

  const imgHtml = ex.image ? `<img src="${ex.image}" alt="${ex.name}" class="preview-img">` : '';

  let html = `
    <div class="card">
      ${imgHtml}
      <h2 style="margin: 0 0 12px 0; font-size: 18px;">${ex.name}</h2>
  `;

  if (activeMode === 'martin_session') {
    const lastM = getLastRecord(ex.id, 'martin');
    const defaultW = getDefaultWeight(ex.id, 'martin');
    html += renderPersonSection('martin', 'MARTIN', lastM, defaultW);
  }

  if (ex.isJoint || activeMode === 'ana_solo') {
    const lastA = getLastRecord(ex.id, 'ana');
    const defaultW = getDefaultWeight(ex.id, 'ana');
    html += renderPersonSection('ana', 'ANA', lastA, defaultW);
  }

  html += `
      <button onclick="window.goNext()" class="btn-submit">
        Dalej (Seria ${currentSetNumber}) →
      </button>
      <div class="swipe-hint">👈 Przesuń w lewo | 👉 Przesuń w prawo</div>
    </div>
  `;

  container.innerHTML = html;

  if (selectedRepsM) highlightRep('martin', selectedRepsM);
  if (selectedRepsA) highlightRep('ana', selectedRepsA);
}

function renderPersonSection(personCode, personName, lastText, defaultWeight) {
  let repsButtons = '';
  for (let i = 1; i <= 12; i++) {
    const val = i === 12 ? '12+' : i;
    const numVal = i === 12 ? 12 : i;
    repsButtons += `<button type="button" onclick="window.selectRep('${personCode}', ${numVal}, this)" class="rep-btn rep-btn-${personCode}" id="btn-${personCode}-${numVal}">${val}</button>`;
  }

  return `
    <div class="person-box ${personCode}">
      <div class="person-header">
        <span class="person-title">${personName}</span>
        <span class="history-badge">Ostatnio: ${lastText}</span>
      </div>
      
      <div class="input-group">
        <label class="input-label">Ciężar Roboczy</label>
        <div><input type="number" id="${personCode}_weight" value="${defaultWeight}" class="weight-input"> <span style="font-size:12px; font-weight:700;">kg</span></div>
      </div>

      <div>
        <label class="input-label" style="margin-bottom:6px; display:block;">Powtórzenia</label>
        <div class="reps-grid">
          ${repsButtons}
        </div>
      </div>
    </div>
  `;
}

window.selectRep = function(person, val, btn) {
  if (person === 'martin') selectedRepsM = val;
  if (person === 'ana') selectedRepsA = val;

  document.querySelectorAll(`.rep-btn-${person}`).forEach(b => {
    b.classList.remove('selected-martin', 'selected-ana');
  });

  btn.classList.add(person === 'martin' ? 'selected-martin' : 'selected-ana');
};

function highlightRep(person, val) {
  const btn = document.getElementById(`btn-${person}-${val}`);
  if (btn) btn.classList.add(person === 'martin' ? 'selected-martin' : 'selected-ana');
}

function animateAndProceed(callback, direction = 'left') {
  const container = document.getElementById('card-container');
  const className = direction === 'left' ? 'swipe-left' : 'swipe-right';
  
  container.classList.add(className);
  setTimeout(() => {
    callback();
    container.classList.remove(className);
  }, 150);
}

function getLastRecord(exId, person) {
  const key = `${exId}_${person}`;
  if (currentSetNumber === 2 && currentSessionData[key]) {
    return `${currentSessionData[key].weight} kg × ${currentSessionData[key].reps} (Seria 1)`;
  }
  if (historyData[key]) {
    return `${historyData[key].weight} kg × ${historyData[key].reps}`;
  }
  return initialNotes[person]?.[exId] || 'brak';
}

function getDefaultWeight(exId, person) {
  const key = `${exId}_${person}`;
  if (currentSessionData[key]) return currentSessionData[key].weight;
  return historyData[key]?.weight || '';
}

function renderCompletionScreen() {
  clearInterval(timerInterval);
  document.getElementById('progress-fill').style.width = `100%`;
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div class="card" style="text-align: center; padding: 40px 16px;">
      <span style="font-size: 50px; display: block; margin-bottom: 8px;">🔥</span>
      <h2>Trening Zakończony!</h2>
      <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 24px;">Czas sesji: ${document.getElementById('workout-timer').innerText}</p>
      <button onclick="location.reload()" class="btn-submit">Wróć do Menu</button>
    </div>
  `;
}
