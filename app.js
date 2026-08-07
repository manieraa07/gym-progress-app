import { workoutPlan } from './data.js';
import { db, collection, addDoc } from './firebase.js';

let activeMode = null;
let currentExIndex = 0;
let currentSetNumber = 1; 
let currentWorkoutData = { date: new Date().toISOString(), exercises: {} };

window.startSession = function(mode) {
  activeMode = mode;
  currentExIndex = 0;
  currentSetNumber = 1;
  document.getElementById('mode-selection').classList.add('hidden');
  document.getElementById('exercise-card-view').classList.remove('hidden');
  renderSingleSetCard();
};

function renderSingleSetCard() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; background: #111827; border-radius: 16px; color: #fff;">
        <h2>Trening Zakończony! 🎉</h2>
        <p style="color: #9ca3af; font-size: 14px;">Wszystkie serie zostały trwale zapisane.</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 12px 24px; background: #10b981; border: none; font-weight: bold; border-radius: 8px; cursor: pointer;">Menu Główne</button>
      </div>
    `;
    return;
  }

  let html = `
    <div style="background: #111827; border: 1px solid #374151; padding: 20px; border-radius: 16px; color: #fff;">
      <div style="display: flex; justify-space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 11px; color: #10b981; font-weight: bold;">ĆWICZENIE ${currentExIndex + 1} z ${list.length}</span>
        <span style="background: #374151; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold; color: #f3f4f6;">SERIA ${currentSetNumber} z ${ex.totalSets}</span>
      </div>
      
      <h2 style="margin: 0 0 16px 0; font-size: 18px;">${ex.name}</h2>
  `;

  // Sekcja Martina
  if (activeMode === 'martin_session') {
    html += `
      <div style="background: #1f2937; padding: 12px; border-radius: 10px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #60a5fa; font-weight: bold; margin-bottom: 6px;">MARTIN (Ostatnio: ${ex.lastM || 'brak'})</div>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="m_weight" placeholder="Ciężar kg" style="width: 50%; padding: 10px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 8px;">
          <input type="number" id="m_reps" placeholder="Powtórzenia" style="width: 50%; padding: 10px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 8px;">
        </div>
      </div>
    `;
  }

  // Sekcja Ani (na wspólnych lub solo)
  if (ex.isJoint || activeMode === 'ana_solo') {
    html += `
      <div style="background: #1f2937; padding: 12px; border-radius: 10px; margin-bottom: 12px;">
        <div style="font-size: 12px; color: #f472b6; font-weight: bold; margin-bottom: 6px;">ANA (Ostatnio: ${ex.lastA || 'brak'})</div>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="a_weight" placeholder="Ciężar kg" style="width: 50%; padding: 10px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 8px;">
          <input type="number" id="a_reps" placeholder="Powtórzenia" style="width: 50%; padding: 10px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 8px;">
        </div>
      </div>
    `;
  }

  html += `
      <div id="suggestion-box" style="display:none; margin-bottom: 12px; padding: 12px; background: #065f46; border: 1px solid #10b981; border-radius: 8px; color: #ecfdf5; font-size: 13px;"></div>
      <button onclick="window.submitSet()" style="width: 100%; padding: 14px; background: #10b981; color: #000; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
        Zatwierdź Serię ${currentSetNumber} →
      </button>
    </div>
  `;

  container.innerHTML = html;
}

window.submitSet = async function() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  let suggestions = [];

  const keyBase = `${ex.id}_set${currentSetNumber}`;
  if (!currentWorkoutData.exercises[keyBase]) currentWorkoutData.exercises[keyBase] = {};

  if (activeMode === 'martin_session') {
    const mw = document.getElementById('m_weight')?.value || 0;
    const mr = parseInt(document.getElementById('m_reps')?.value || 0);
    currentWorkoutData.exercises[keyBase]['martin'] = { w: mw, r: mr };

    if (mr >= ex.targetReps) {
      suggestions.push(`🚀 Martin: ${mr} powtórzeń w Serii ${currentSetNumber}! Sugestia: Zwiększ ciężar w kolejnym treningu.`);
    }
  }

  if (ex.isJoint || activeMode === 'ana_solo') {
    const aw = document.getElementById('a_weight')?.value || 0;
    const ar = parseInt(document.getElementById('a_reps')?.value || 0);
    currentWorkoutData.exercises[keyBase]['ana'] = { w: aw, r: ar };

    if (ar >= ex.targetReps) {
      suggestions.push(`🔥 Ana: ${ar} powtórzeń w Serii ${currentSetNumber}! Sugestia: Zwiększ ciężar w kolejnym treningu.`);
    }
  }

  // Wyświetlanie karty z sugestią zmiany ciężaru
  const box = document.getElementById('suggestion-box');
  if (suggestions.length > 0 && box.style.display === 'none') {
    box.style.display = 'block';
    box.innerHTML = suggestions.join('<br><br>');
    const btn = document.querySelector('button[onclick="window.submitSet()"]');
    if (btn) btn.innerText = "Rozumiem, Przejdź Dalej →";
    return;
  }

  // Zapis do Firebase przy każdej serii
  try {
    localStorage.setItem('workout_draft', JSON.stringify(currentWorkoutData));
    await addDoc(collection(db, "workouts"), {
      ...currentWorkoutData,
      lastUpdated: new Date().toISOString()
    });
  } catch (e) {
    console.error("Błąd zapisu Firebase: ", e);
  }

  // Przejście do następnej serii lub kolejnego ćwiczenia
  if (currentSetNumber < ex.totalSets) {
    currentSetNumber++;
  } else {
    currentSetNumber = 1;
    currentExIndex++;
  }

  renderSingleSetCard();
};
