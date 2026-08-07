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

async function loadHistoryWithTimeout() {
  const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve('timeout'), 1500));
  
  const fetchPromise = (async () => {
    try {
      const q = query(collection(db, "workouts"), orderBy("date", "desc"), limit(1));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const lastWorkout = querySnapshot.docs[0].data();
        if (lastWorkout && lastWorkout.entries) {
          return lastWorkout.entries;
        }
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
  
  // Pokaż podgląd pierwszego ćwiczenia
  showExercisePreview();
};

function showExercisePreview() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    renderCompletionScreen();
    return;
  }

  // Animowane tymczasowe okienko ze zdjęciem/ikoną
  container.innerHTML = `
    <div class="card preview-card">
      <span class="preview-icon">🏋️‍♂️</span>
      <span style="font-size: 11px; color: var(--accent-green); font-weight: 800; letter-spacing: 1px;">NASTĘPNE ĆWICZENIE</span>
      <h2 style="margin: 8px 0 4px 0;">${ex.name}</h2>
      <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Przygotuj się do rozpoczęcia serii</p>
    </div>
  `;

  // Po 1.5 sekundy przejdź automatycznie do serii (lub rozgrzewki)
  setTimeout(() => {
    if (currentExIndex === 0 && currentSetNumber === 1 && activeMode === 'martin_session') {
      renderWarmupCard(ex);
    } else {
      renderSingleSetCard();
    }
  }, 1500);
}

function renderWarmupCard(ex) {
  const container = document.getElementById('card-container');
  
  // Szacowanie ciężaru roboczego
  const lastMWeight = parseFloat(historyData['latzug_martin']?.weight || 54);
  const lastAWeight = parseFloat(historyData['latzug_ana']?.weight || 50);

  const m50 = Math.round(lastMWeight * 0.5);
  const m75 = Math.round(lastMWeight * 0.75);
  const a50 = Math.round(lastAWeight * 0.5);
  const a75 = Math.round(lastAWeight * 0.75);

  container.innerHTML = `
    <div class="card">
      <div style="text-align: center; margin-bottom: 16px;">
        <span style="font-size: 11px; color: var(--martin-color); font-weight: 800; letter-spacing: 1px;">ROZGRZEWKA PLECÓW 🩸</span>
        <h2 style="margin: 4px 0;">Szybka Rozgrzewka (Latzug)</h2>
        <p style="font-size: 12px; color: var(--text-muted); margin: 0;">Wykonajcie 2 serie aktywacyjne przed seriami roboczymi</p>
      </div>

      <div class="person-box martin">
        <div class="person-title">MARTIN (Cel Roboczy: ~${lastMWeight} kg)</div>
        <div style="font-size: 13px; margin-top: 6px; color: var(--text-main);">
          • <strong>Seria 1 (50%):</strong> ~${m50} kg × 10-12 powt (Pobudzenie)<br>
          • <strong>Seria 2 (75%):</strong> ~${m75} kg × 4-5 powt (Bez zmęczenia!)
        </div>
      </div>

      <div class="person-box ana">
        <div class="person-title">ANA (Cel Roboczy: ~${lastAWeight} kg)</div>
        <div style="font-size: 13px; margin-top: 6px; color: var(--text-main);">
          • <strong>Seria 1 (50%):</strong> ~${a50} kg × 10-12 powt (Pobudzenie)<br>
          • <strong>Seria 2 (75%):</strong> ~${a75} kg × 4-5 powt (Bez zmęczenia!)
        </div>
      </div>

      <button onclick="window.finishWarmup()" class="btn-submit">
        Rozgrzani! Zaczynamy Serie Robocze →
      </button>
    </div>
  `;
}

window.finishWarmup = function() {
  renderSingleSetCard();
};

function renderSingleSetCard() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    renderCompletionScreen();
    return;
  }

  // Aktualizacja Paska Postępu
  const progressPercent = ((currentExIndex) / list.length) * 100;
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;
  document.getElementById('progress-text').innerText = `Ćwiczenie ${currentExIndex + 1} z ${list.length}`;
  document.getElementById('set-badge').innerText = `SERIA ${currentSetNumber} z ${ex.totalSets}`;

  selectedRepsM = null;
  selectedRepsA = null;

  let html = `
    <div class="card">
      <h2 style="margin: 0 0 16px 0; font-size: 20px;">${ex.name}</h2>
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
      <button onclick="window.submitSet()" class="btn-submit">
        Zatwierdź Serię ${currentSetNumber} →
      </button>
    </div>
  `;

  container.innerHTML = html;
}

function renderPersonSection(personCode, personName, lastText, defaultWeight) {
  let repsButtons = '';
  for (let i = 1; i <= 12; i++) {
    const val = i === 12 ? '12+' : i;
    const numVal = i === 12 ? 12 : i;
    repsButtons += `<button type="button" onclick="window.selectRep('${personCode}', ${numVal}, this)" class="rep-btn rep-btn-${personCode}">${val}</button>`;
  }

  return `
    <div class="person-box ${personCode}">
      <div class="person-header">
        <span class="person-title">${personName}</span>
        <span class="history-badge">🏷️ Ostatnio: ${lastText}</span>
      </div>
      
      <div>
        <label class="input-label">Ciężar (kg)</label>
        <input type="number" id="${personCode}_weight" value="${defaultWeight}" placeholder="0" class="weight-input">
      </div>

      <div>
        <label class="input-label">Wykonane Powtórzenia</label>
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

window.submitSet = async function() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  let popupMessages = [];

  if (activeMode === 'martin_session') {
    const wM = document.getElementById('martin_weight')?.value || 0;
    if (selectedRepsM === null) {
      alert("Zaznacz powtórzenia dla Martina!");
      return;
    }
    
    const keyM = `${ex.id}_martin`;
    const lastRepsM = historyData[keyM]?.reps || null;

    currentSessionData[keyM] = { weight: wM, reps: selectedRepsM };
    currentWorkoutLogs.entries[keyM] = { weight: wM, reps: selectedRepsM };

    const msg = getSuggestionMessage('Martin', selectedRepsM, currentSetNumber, ex.totalSets, ex.id, lastRepsM);
    if (msg) popupMessages.push(msg);
  }

  if (ex.isJoint || activeMode === 'ana_solo') {
    const wA = document.getElementById('ana_weight')?.value || 0;
    if (selectedRepsA === null) {
      alert("Zaznacz powtórzenia dla Ani!");
      return;
    }

    const keyA = `${ex.id}_ana`;
    const lastRepsA = historyData[keyA]?.reps || null;

    currentSessionData[keyA] = { weight: wA, reps: selectedRepsA };
    currentWorkoutLogs.entries[keyA] = { weight: wA, reps: selectedRepsA };

    const msg = getSuggestionMessage('Ana', selectedRepsA, currentSetNumber, ex.totalSets, ex.id, lastRepsA);
    if (msg) popupMessages.push(msg);
  }

  addDoc(collection(db, "workouts"), {
    ...currentWorkoutLogs,
    date: new Date().toISOString()
  }).catch(e => console.error("Firebase err: ", e));

  if (popupMessages.length > 0) {
    showPopupCard(popupMessages, () => advanceFlow(ex));
  } else {
    advanceFlow(ex);
  }
};

function getSuggestionMessage(name, reps, setNum, totalSets, exId, lastReps) {
  const isIncline = (exId === 'wyciskanie_skos');
  const thresholdIncrease = isIncline ? (reps >= 12) : (reps > 10);

  if (setNum === 1 && totalSets > 1) {
    if (lastReps && reps < lastReps && reps >= 6) {
      return `⏱️ <strong>${name}</strong>: Mniej powtórzeń niż ostatnio (${reps} vs ${lastReps}). <strong>Zrób dłuższą przerwę przed 2. serią</strong>.`;
    }
    if (reps < 6) {
      return `⚠️ <strong>${name}</strong>: Mniej niż 6 powtórzeń. <strong>Zmniejsz ciężar na 2. serię!</strong>`;
    }
    if (thresholdIncrease) {
      return `🚀 <strong>${name}</strong>: Dobry wynik (${reps} powt.)! <strong>Dołóż ciężaru na 2. serię!</strong>`;
    }
  } else {
    if (reps < 6) return `💡 <strong>${name}</strong>: Ciężka seria (< 6 powt). Na następnym treningu zacznij od mniejszego ciężaru.`;
    if (thresholdIncrease) return `🔥 <strong>${name}</strong>: Świetny wynik! Od NASTĘPNEGO treningu zwiększasz ciężar.`;
  }
  return null;
}

function showPopupCard(messages, onConfirm) {
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div class="card" style="border: 2px solid var(--accent-green); text-align: center;">
      <span style="font-size: 40px; display: block; margin-bottom: 8px;">🎯</span>
      <h3 style="margin: 0; color: var(--accent-green); font-size: 18px;">Sugestia Trenera</h3>
      <div style="margin: 16px 0; font-size: 13px; line-height: 1.5; text-align: left; background: #090d16; padding: 12px; border-radius: 12px; border: 1px solid var(--card-border);">
        ${messages.join('<br><br>')}
      </div>
      <button id="popup-confirm-btn" class="btn-submit">
        Okej, Rozumiem →
      </button>
    </div>
  `;
  document.getElementById('popup-confirm-btn').onclick = onConfirm;
}

function advanceFlow(ex) {
  if (currentSetNumber < ex.totalSets) {
    currentSetNumber++;
    renderSingleSetCard();
  } else {
    currentSetNumber = 1;
    currentExIndex++;
    showExercisePreview();
  }
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
  document.getElementById('progress-fill').style.width = `100%`;
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div class="card" style="text-align: center; padding: 40px 20px;">
      <span style="font-size: 60px; display: block; margin-bottom: 12px;">🎉</span>
      <h2>Trening Zakończony!</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 24px;">Świetna robota! Wszystkie wyniki zostały bezpowrotnie zapisane w bazie.</p>
      <button onclick="location.reload()" class="btn-submit">Powrót do Menu</button>
    </div>
  `;
}
