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
  
  setupSwipeListeners();
  showExercisePreview();
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
  
  // SWIPE W LEWO (👈) -> Idź dalej
  if (diffX > 60) {
    const submitBtn = document.querySelector('.btn-submit');
    if (submitBtn) submitBtn.click();
  } 
  // SWIPE W PRAWO (👉) -> Cofnij
  else if (diffX < -60) {
    window.goBack();
  }
}

window.goBack = function() {
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

function showExercisePreview() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    renderCompletionScreen();
    return;
  }

  const imgHtml = ex.image ? `<img src="${ex.image}" alt="${ex.name}" class="preview-img">` : '<span class="preview-icon">🏋️‍♂️</span>';

  container.innerHTML = `
    <div class="card preview-card">
      ${imgHtml}
      <span class="preview-badge">NASTĘPNE ĆWICZENIE</span>
      <h2>${ex.name}</h2>
    </div>
  `;

  setTimeout(() => {
    if (currentExIndex === 0 && currentSetNumber === 1 && activeMode === 'martin_session') {
      renderWarmupCard(ex);
    } else if (ex.id === 'wyciskanie_skos' && currentSetNumber === 1 && activeMode === 'martin_session') {
      renderInclineWarmupCard(ex);
    } else {
      renderSingleSetCard();
    }
  }, 1400);
}

function renderWarmupCard(ex) {
  const container = document.getElementById('card-container');
  const lastMWeight = parseFloat(historyData['latzug_martin']?.weight || 54);
  const lastAWeight = parseFloat(historyData['latzug_ana']?.weight || 50);

  container.innerHTML = `
    <div class="card">
      <div style="text-align: center; margin-bottom: 12px;">
        <span class="preview-badge">ROZGRZEWKA PLECÓW 🩸</span>
        <h2 style="margin: 4px 0;">Rozgrzewka (Latzug)</h2>
      </div>

      <div class="person-box martin">
        <div class="person-title">MARTIN (Cel: ~${lastMWeight} kg)</div>
        <div style="font-size: 13px; margin-top: 4px;">
          • <strong>Seria 1 (50%):</strong> ~${Math.round(lastMWeight * 0.5)} kg × 10-12<br>
          • <strong>Seria 2 (75%):</strong> ~${Math.round(lastMWeight * 0.75)} kg × 4-5
        </div>
      </div>

      <div class="person-box ana">
        <div class="person-title">ANA (Cel: ~${lastAWeight} kg)</div>
        <div style="font-size: 13px; margin-top: 4px;">
          • <strong>Seria 1 (50%):</strong> ~${Math.round(lastAWeight * 0.5)} kg × 10-12<br>
          • <strong>Seria 2 (75%):</strong> ~${Math.round(lastAWeight * 0.75)} kg × 4-5
        </div>
      </div>

      <button onclick="window.finishWarmup()" class="btn-submit">Rozgrzani! Zaczynamy →</button>
      <div class="swipe-hint">👈 Przesuń w lewo, aby przejść dalej</div>
    </div>
  `;
}

function renderInclineWarmupCard(ex) {
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div class="card">
      <div style="text-align: center; margin-bottom: 12px;">
        <span class="preview-badge">ROZGRZEWKA 🎯</span>
        <h2 style="margin: 4px 0;">Wyciskanie Skos (Martin)</h2>
      </div>

      <div class="person-box martin">
        <div class="person-title">MARTIN</div>
        <div style="font-size: 13px; margin-top: 4px;">
          ⚠️ Pamiętaj o <strong>1-2 lekkich seriach rozgrzewkowych</strong> przed serią roboczą!
        </div>
      </div>

      <button onclick="window.finishWarmup()" class="btn-submit">Rozgrzany! Zaczynamy →</button>
      <div class="swipe-hint">👈 Przesuń w lewo | 👉 Przesuń w prawo (cofnij)</div>
    </div>
  `;
}

window.finishWarmup = function() {
  animateAndProceed(() => renderSingleSetCard(), 'left');
};

function renderSingleSetCard() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    renderCompletionScreen();
    return;
  }

  const progressPercent = ((currentExIndex) / list.length) * 100;
  document.getElementById('progress-fill').style.width = `${progressPercent}%`;
  document.getElementById('progress-text').innerText = `Ćwiczenie ${currentExIndex + 1} z ${list.length}`;
  document.getElementById('set-badge').innerText = `SERIA ${currentSetNumber} z ${ex.totalSets}`;

  selectedRepsM = null;
  selectedRepsA = null;

  let html = `
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <h2 style="margin: 0; font-size: 18px;">${ex.name}</h2>
        ${(currentExIndex > 0 || currentSetNumber > 1) ? `<button onclick="window.goBack()" class="btn-back">↩ Cofnij</button>` : ''}
      </div>
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
      <div class="swipe-hint">👈 Dalej | 👉 Cofnij</div>
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
        <span class="history-badge">Ostatnio: ${lastText}</span>
      </div>
      
      <div style="margin-bottom: 8px;">
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
      return `🚀 <strong>${name}</strong>: Kapitalny wynik (${reps} powt.)! <strong>Dołóż ciężaru na 2. serię!</strong>`;
    }
    if (lastReps && reps > lastReps) {
      const diff = reps - lastReps;
      return `👏 <strong>${name}</strong>: Brawo! Progres o <strong>+${diff} powt.</strong> w porównaniu do poprzedniego treningu!`;
    }
  } else {
    if (reps < 6) return `💡 <strong>${name}</strong>: Ciężka seria (< 6 powt). Na następnym treningu zacznij od mniejszego ciężaru.`;
    if (thresholdIncrease) return `🔥 <strong>${name}</strong>: Świetny wynik! Od NASTĘPNEGO treningu zwiększasz ciężar.`;
    if (lastReps && reps > lastReps) {
      const diff = reps - lastReps;
      return `👏 <strong>${name}</strong>: Piękny finisz! Progres o <strong>+${diff} powt.</strong> względem ostatniego treningu!`;
    }
  }
  return null;
}

function showPopupCard(messages, onConfirm) {
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div class="card" style="border: 2px solid var(--accent-green); text-align: center;">
      <span style="font-size: 36px; display: block; margin-bottom: 4px;">🎯</span>
      <h3 style="margin: 0; color: var(--accent-green); font-size: 16px;">Sugestia Trenera</h3>
      <div style="margin: 12px 0; font-size: 13px; line-height: 1.4; text-align: left; background: #090d16; padding: 10px; border-radius: 8px;">
        ${messages.join('<br><br>')}
      </div>
      <button id="popup-confirm-btn" class="btn-submit">Dalej →</button>
    </div>
  `;
  document.getElementById('popup-confirm-btn').onclick = onConfirm;
}

function advanceFlow(ex) {
  animateAndProceed(() => {
    if (currentSetNumber < ex.totalSets) {
      currentSetNumber++;
      renderSingleSetCard();
    } else {
      currentSetNumber = 1;
      currentExIndex++;
      showExercisePreview();
    }
  }, 'left');
}

function animateAndProceed(callback, direction = 'left') {
  const container = document.getElementById('card-container');
  const className = direction === 'left' ? 'swipe-left' : 'swipe-right';
  
  container.classList.add(className);
  setTimeout(() => {
    callback();
    container.classList.remove(className);
  }, 180);
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
    <div class="card" style="text-align: center; padding: 30px 16px;">
      <span style="font-size: 50px; display: block; margin-bottom: 8px;">🎉</span>
      <h2>Trening Zakończony!</h2>
      <p style="color: var(--text-muted); font-size: 13px; margin-bottom: 20px;">Świetna robota! Wyniki zapisane w bazie.</p>
      <button onclick="location.reload()" class="btn-submit">Powrót do Menu</button>
    </div>
  `;
}
