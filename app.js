import { workoutPlan, initialNotes } from './data.js';
import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';

let activeMode = null;
let currentExIndex = 0;
let currentSetNumber = 1;
let selectedRepsM = null;
let selectedRepsA = null;

let historyData = {}; // Przechowuje ostatnie ciężary/notatki
let currentWorkoutLogs = { date: new Date().toISOString(), entries: {} };

// 1. Ładowanie historii z Firebase przed startem
async function loadHistory() {
  try {
    const q = query(collection(db, "workouts"), orderBy("date", "desc"), limit(1));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const lastWorkout = querySnapshot.docs[0].data();
      if (lastWorkout && lastWorkout.entries) {
        historyData = lastWorkout.entries;
      }
    }
  } catch (e) {
    console.log("Używam domyślnych notatek (brak połączenia lub danych w Firebase):", e);
  }
}

window.startSession = async function(mode) {
  activeMode = mode;
  currentIndex = 0;
  currentExIndex = 0;
  currentSetNumber = 1;
  
  document.getElementById('mode-selection').classList.add('hidden');
  document.getElementById('loading-screen').classList.remove('hidden');
  
  await loadHistory();
  
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('exercise-card-view').classList.remove('hidden');
  renderSingleSetCard();
};

function getLastRecord(exId, person) {
  // Szuka w historii Firebase dla danej serii/ćwiczenia
  const key = `${exId}_${person}`;
  if (historyData[key]) {
    return `${historyData[key].weight} kg x ${historyData[key].reps}`;
  }
  // Jeśli brak w Firebase, bierze notatkę początkową
  return initialNotes[person]?.[exId] || 'brak';
}

function getDefaultWeight(exId, person) {
  const key = `${exId}_${person}`;
  return historyData[key]?.weight || '';
}

function renderSingleSetCard() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    container.innerHTML = `
      <div style="padding: 24px; text-align: center; background: #111827; border-radius: 16px; color: #fff;">
        <h2>Trening Zakończony! 🎉</h2>
        <p style="color: #9ca3af; font-size: 14px;">Wszystko zostało trwale zapisane w Firebase.</p>
        <button onclick="location.reload()" style="margin-top: 16px; padding: 12px 24px; background: #10b981; border: none; font-weight: bold; border-radius: 8px; cursor: pointer;">Menu Główne</button>
      </div>
    `;
    return;
  }

  selectedRepsM = null;
  selectedRepsA = null;

  let html = `
    <div style="background: #111827; border: 1px solid #374151; padding: 20px; border-radius: 16px; color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 11px; color: #10b981; font-weight: bold;">ĆWICZENIE ${currentExIndex + 1} z ${list.length}</span>
        <span style="background: #374151; padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: bold;">SERIA ${currentSetNumber} z ${ex.totalSets}</span>
      </div>
      
      <h2 style="margin: 0 0 16px 0; font-size: 18px;">${ex.name}</h2>
  `;

  // Sekcja Martina
  if (activeMode === 'martin_session') {
    const lastM = getLastRecord(ex.id, 'martin');
    const defaultW = getDefaultWeight(ex.id, 'martin');
    html += renderPersonSection('martin', 'MARTIN', lastM, defaultW);
  }

  // Sekcja Ani
  if (ex.isJoint || activeMode === 'ana_solo') {
    const lastA = getLastRecord(ex.id, 'ana');
    const defaultW = getDefaultWeight(ex.id, 'ana');
    html += renderPersonSection('ana', 'ANA', lastA, defaultW);
  }

  html += `
      <button onclick="window.submitSet()" style="width: 100%; margin-top: 16px; padding: 14px; background: #10b981; color: #000; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; font-size: 15px;">
        Zatwierdź Serię ${currentSetNumber} →
      </button>
    </div>
  `;

  container.innerHTML = html;
}

function renderPersonSection(personCode, personName, lastText, defaultWeight) {
  const color = personCode === 'martin' ? '#60a5fa' : '#f472b6';
  
  let repsButtons = '';
  for (let i = 1; i <= 12; i++) {
    const val = i === 12 ? '12+' : i;
    const numVal = i === 12 ? 12 : i;
    repsButtons += `<button type="button" onclick="window.selectRep('${personCode}', ${numVal}, this)" class="rep-btn-${personCode}" style="padding: 8px; background: #000; border: 1px solid #374151; color: #fff; border-radius: 6px; font-weight: bold; font-size: 12px;">${val}</button>`;
  }

  return `
    <div style="background: #1f2937; padding: 12px; border-radius: 10px; margin-bottom: 12px;">
      <div style="font-size: 12px; color: ${color}; font-weight: bold; margin-bottom: 6px;">${personName} (Ostatnio: ${lastText})</div>
      
      <div style="margin-bottom: 8px;">
        <label style="font-size: 10px; color: #9ca3af; display: block; margin-bottom: 2px;">Ciężar (kg)</label>
        <input type="number" id="${personCode}_weight" value="${defaultWeight}" placeholder="Wpisz kg..." style="width: 100%; padding: 10px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 8px; box-sizing: border-box; font-size: 16px;">
      </div>

      <div>
        <label style="font-size: 10px; color: #9ca3af; display: block; margin-bottom: 4px;">Wybierz Powtórzenia</label>
        <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;">
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
    b.style.background = '#000';
    b.style.borderColor = '#374151';
  });

  btn.style.background = person === 'martin' ? '#2563eb' : '#db2777';
  btn.style.borderColor = '#fff';
};

window.submitSet = async function() {
  const list = workoutPlan[activeMode];
  const ex = list[currentExIndex];
  let popupMessages = [];

  // Walidacja i analiza wyników dla Martina
  if (activeMode === 'martin_session') {
    const wM = document.getElementById('martin_weight')?.value || 0;
    if (selectedRepsM === null) {
      alert("Zaznacz powtórzenia dla Martina!");
      return;
    }
    
    currentWorkoutLogs.entries[`${ex.id}_martin`] = { weight: wM, reps: selectedRepsM };

    // Logika Sugestii
    const msg = getSuggestionMessage('Martin', selectedRepsM, currentSetNumber, ex.totalSets);
    if (msg) popupMessages.push(msg);
  }

  // Walidacja i analiza wyników dla Ani
  if (ex.isJoint || activeMode === 'ana_solo') {
    const wA = document.getElementById('ana_weight')?.value || 0;
    if (selectedRepsA === null) {
      alert("Zaznacz powtórzenia dla Ani!");
      return;
    }

    currentWorkoutLogs.entries[`${ex.id}_ana`] = { weight: wA, reps: selectedRepsA };

    const msg = getSuggestionMessage('Ana', selectedRepsA, currentSetNumber, ex.totalSets);
    if (msg) popupMessages.push(msg);
  }

  // Trwały zapis do Firebase po każdej serii
  try {
    await addDoc(collection(db, "workouts"), {
      ...currentWorkoutLogs,
      date: new Date().toISOString()
    });
  } catch (e) {
    console.error("Błąd zapisu w Firebase: ", e);
  }

  // Jeśli wygenerowano sugestię, pokaż dedykowany Pop-up
  if (popupMessages.length > 0) {
    showPopupCard(popupMessages, () => advanceFlow(ex));
  } else {
    advanceFlow(ex);
  }
};

function getSuggestionMessage(name, reps, setNum, totalSets) {
  // Jeśli to pierwsza seria w ćwiczeniu 2-seryjnym
  if (setNum === 1 && totalSets > 1) {
    if (reps < 6) return `⚠️ <strong>${name}</strong>: Mniej niż 6 powtórzeń. <strong>Zmniejsz ciężar już teraz na 2. serię!</strong>`;
    if (reps >= 12) return `🚀 <strong>${name}</strong>: 12 lub więcej powtórzeń! <strong>Dołóż ciężaru na 2. serię!</strong>`;
  } 
  // Jeśli to seria druga LUB jedyna seria (np. triceps)
  else {
    if (reps < 6) return `💡 <strong>${name}</strong>: Ciężka seria (poniżej 6 powt). Na następnym treningu zacznij od mniejszego ciężaru.`;
    if (reps >= 12) return `🔥 <strong>${name}</strong>: Rekord! Od NASTĘPNEGO treningu zwiększasz ciężar bazowy.`;
  }
  return null;
}

function showPopupCard(messages, onConfirm) {
  const container = document.getElementById('card-container');
  container.innerHTML = `
    <div style="background: #111827; border: 2px solid #10b981; padding: 24px; border-radius: 16px; color: #fff; text-align: center;">
      <h3 style="margin-top: 0; color: #10b981; font-size: 18px;">Sugestia Trenera 🎯</h3>
      <div style="margin: 20px 0; font-size: 14px; line-height: 1.5; text-align: left; background: #1f2937; padding: 12px; border-radius: 8px;">
        ${messages.join('<br><br>')}
      </div>
      <button id="popup-confirm-btn" style="width: 100%; padding: 14px; background: #10b981; color: #000; font-weight: bold; border: none; border-radius: 8px; cursor: pointer; font-size: 15px;">
        Okej, Rozumiem →
      </button>
    </div>
  `;
  document.getElementById('popup-confirm-btn').onclick = onConfirm;
}

function advanceFlow(ex) {
  if (currentSetNumber < ex.totalSets) {
    currentSetNumber++;
  } else {
    currentSetNumber = 1;
    currentExIndex++;
  }
  renderSingleSetCard();
}
