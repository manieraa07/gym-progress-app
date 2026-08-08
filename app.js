import { workoutPlan, initialNotes } from './data.js';
import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';

let activeMode = null;
let historyData = {};
let currentWorkoutLogs = { date: new Date().toISOString(), entries: {} };

let startTime = null;
let timerInterval = null;

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
  
  document.getElementById('mode-selection').classList.add('hidden');
  document.getElementById('loading-screen').classList.remove('hidden');
  
  await loadHistoryWithTimeout();
  
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('top-nav').classList.remove('hidden');
  document.getElementById('workout-feed').classList.remove('hidden');
  document.getElementById('bottom-dock').classList.remove('hidden');
  
  document.getElementById('nav-workout-name').innerText = (mode === 'martin_session') ? 'Martin & Ana Duo' : 'Ana Solo';

  startAccurateTimer();
  renderWorkoutFeed();
};

function startAccurateTimer() {
  startTime = Date.now();
  clearInterval(timerInterval);
  
  timerInterval = setInterval(() => {
    if (!startTime) return;
    const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    const m = Math.floor(elapsedSeconds / 60).toString().padStart(2, '0');
    const s = (elapsedSeconds % 60).toString().padStart(2, '0');
    
    const timerEl = document.getElementById('session-timer');
    if (timerEl) timerEl.innerText = `${m}:${s}`;
  }, 1000);
}

function renderWorkoutFeed() {
  const feed = document.getElementById('workout-feed');
  const list = workoutPlan[activeMode];
  let html = '';

  list.forEach((ex, exIdx) => {
    const imgHtml = ex.image ? `<img src="${ex.image}" alt="${ex.name}" class="exercise-thumb">` : `<div class="exercise-thumb" style="display:flex;align-items:center;justify-content:center;">🏋️</div>`;
    
    html += `
      <div class="exercise-block">
        <div class="exercise-header">
          ${imgHtml}
          <div class="exercise-info">
            <h3>${ex.name}</h3>
            <p>${ex.totalSets} serie robocze</p>
          </div>
        </div>
    `;

    if (activeMode === 'martin_session') {
      html += `<span class="person-tag martin">MARTIN</span>`;
      html += renderSetsTable(ex, 'martin');
    }

    if (ex.isJoint || activeMode === 'ana_solo') {
      html += `<span class="person-tag ana">ANA</span>`;
      html += renderSetsTable(ex, 'ana');
    }

    html += `</div>`;
  });

  feed.innerHTML = html;
  updateProgress();
}

function renderSetsTable(ex, person) {
  let tableHtml = `
    <table class="sets-table">
      <thead>
        <tr>
          <th>Seria</th>
          <th>Poprzednio</th>
          <th>kg</th>
          <th>Powt</th>
          <th>✓</th>
        </tr>
      </thead>
      <tbody>
  `;

  for (let s = 1; s <= ex.totalSets; s++) {
    const historyKey = `${ex.id}_${person}`;
    const lastRecord = historyData[historyKey] ? `${historyData[historyKey].weight}kg × ${historyData[historyKey].reps}` : (initialNotes[person]?.[ex.id] || '-');
    const defaultWeight = historyData[historyKey]?.weight || '';
    const defaultReps = historyData[historyKey]?.reps || '';

    tableHtml += `
      <tr class="set-row">
        <td class="set-num">S${s}</td>
        <td style="font-size:10px; color:var(--text-muted);">${lastRecord}</td>
        <td><input type="number" id="w_${person}_${ex.id}_${s}" value="${defaultWeight}" class="set-input"></td>
        <td><input type="number" id="r_${person}_${ex.id}_${s}" value="${defaultReps}" class="set-input"></td>
        <td>
          <button onclick="window.toggleCheck(this, '${ex.id}', '${person}', ${s})" class="btn-check-set">✓</button>
        </td>
      </tr>
    `;
  }

  tableHtml += `</tbody></table>`;
  return tableHtml;
}

window.toggleCheck = function(btn, exId, person, setNum) {
  btn.classList.toggle('checked');
  
  const weightVal = document.getElementById(`w_${person}_${exId}_${setNum}`)?.value || 0;
  const repsVal = document.getElementById(`r_${person}_${exId}_${setNum}`)?.value || 0;
  
  const key = `${exId}_${person}`;
  currentWorkoutLogs.entries[key] = { weight: weightVal, reps: repsVal };

  // Cichy zapis w tle do Firebase
  addDoc(collection(db, "workouts"), {
    ...currentWorkoutLogs,
    date: new Date().toISOString()
  }).catch(e => console.error("Firebase err:", e));

  updateProgress();
};

function updateProgress() {
  const totalChecks = document.querySelectorAll('.btn-check-set').length;
  const checkedCount = document.querySelectorAll('.btn-check-set.checked').length;
  
  const percent = totalChecks > 0 ? (checkedCount / totalChecks) * 100 : 0;
  document.getElementById('dock-progress-bar').style.width = `${percent}%`;
  document.getElementById('dock-status-text').innerText = `Ukończono ${checkedCount} z ${totalChecks} serii`;
}

window.finishWorkout = function() {
  if (confirm("Czy na pewno chcesz zakończyć i zapisać ten trening?")) {
    clearInterval(timerInterval);
    alert("Trening został pomyślnie zapisany!");
    location.reload();
  }
};
