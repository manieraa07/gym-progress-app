import { workoutPlan } from './data.js';
import { db, collection, addDoc } from './firebase.js';

let activeMode = null; // 'martin_session' lub 'ana_solo'
let currentIndex = 0;
let currentWorkoutData = {};

window.startSession = function(mode) {
  activeMode = mode;
  currentIndex = 0;
  currentWorkoutData = {
    date: new Date().toISOString(),
    mode: mode,
    exercises: {}
  };
  document.getElementById('mode-selection').classList.add('hidden');
  document.getElementById('exercise-card-view').classList.remove('hidden');
  renderCard();
};

function renderCard() {
  const list = workoutPlan[activeMode];
  const ex = list[currentIndex];
  const container = document.getElementById('card-container');

  if (!ex) {
    container.innerHTML = `
      <div style="padding: 20px; text-align: center; background: #111827; border-radius: 12px; color: #fff;">
        <h2>Trening Zakończony! 🎉</h2>
        <p>Wszystkie dane zostały zapisane w bazie.</p>
        <button onclick="location.reload()" style="padding: 10px 20px; background: #10b981; border: none; font-weight: bold; border-radius: 8px;">Powrót do menu</button>
      </div>
    `;
    return;
  }

  let html = `
    <div style="background: #111827; border: 1px solid #374151; padding: 20px; border-radius: 16px; color: #fff;">
      <span style="font-size: 12px; color: #10b981;">ĆWICZENIE ${currentIndex + 1} / ${list.length}</span>
      <h2 style="margin-top: 4px; margin-bottom: 16px;">${ex.name}</h2>
  `;

  // Sekcja Martina (jeśli w trybie Martina)
  if (activeMode === 'martin_session') {
    html += `
      <div style="background: #1f2937; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #60a5fa;">MARTIN (Ostatnio: ${ex.lastMartin || 'brak'})</h4>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input type="number" id="m_s1_w" placeholder="Seria 1 kg" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
          <input type="number" id="m_s1_r" placeholder="Seria 1 powt" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="m_s2_w" placeholder="Seria 2 kg" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
          <input type="number" id="m_s2_r" placeholder="Seria 2 powt" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
        </div>
      </div>
    `;
  }

  // Sekcja Ani (jeśli wspólne LUB jeśli solo Ana)
  if (ex.isJoint || activeMode === 'ana_solo') {
    html += `
      <div style="background: #1f2937; padding: 12px; border-radius: 8px; margin-bottom: 12px;">
        <h4 style="margin: 0 0 8px 0; color: #f472b6;">ANA (Ostatnio: ${ex.lastAna || 'brak'})</h4>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
          <input type="number" id="a_s1_w" placeholder="Seria 1 kg" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
          <input type="number" id="a_s1_r" placeholder="Seria 1 powt" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
        </div>
        <div style="display: flex; gap: 8px;">
          <input type="number" id="a_s2_w" placeholder="Seria 2 kg" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
          <input type="number" id="a_s2_r" placeholder="Seria 2 powt" style="width: 50%; padding: 8px; background: #000; color: #fff; border: 1px solid #4b5563; border-radius: 6px;">
        </div>
      </div>
    `;
  }

  html += `
      <div id="suggestion-box" style="display:none; margin-bottom: 12px; padding: 10px; background: #065f46; border: 1px solid #10b981; border-radius: 8px; color: #ecfdf5; font-size: 13px;"></div>
      <button onclick="window.submitCard()" style="width: 100%; padding: 12px; background: #10b981; color: #000; font-weight: bold; border: none; border-radius: 8px; cursor: pointer;">
        Zatwierdź i Przejdź Dalej →
      </button>
    </div>
  `;

  container.innerHTML = html;
}

window.submitCard = async function() {
  const list = workoutPlan[activeMode];
  const ex = list[currentIndex];
  let suggestions = [];

  // Zbieranie danych Martina
  if (activeMode === 'martin_session') {
    const ms1w = document.getElementById('m_s1_w')?.value || 0;
    const ms1r = parseInt(document.getElementById('m_s1_r')?.value || 0);
    const ms2w = document.getElementById('m_s2_w')?.value || 0;
    const ms2r = parseInt(document.getElementById('m_s2_r')?.value || 0);

    currentWorkoutData.exercises[ex.id + '_martin'] = { s1: { w: ms1w, r: ms1r }, s2: { w: ms2w, r: ms2r } };

    // Sugestia zwiększenia ciężaru
    if (ms1r >= ex.maxRepsTarget) {
      suggestions.push(`🚀 Martin, zrobiłeś ${ms1r} powtórzeń w 1. serii! Czas zwiększyć ciężar na kolejnym treningu.`);
    }
  }

  // Zbieranie danych Ani
  if (ex.isJoint || activeMode === 'ana_solo') {
    const as1w = document.getElementById('a_s1_w')?.value || 0;
    const as1r = parseInt(document.getElementById('a_s1_r')?.value || 0);
    const as2w = document.getElementById('a_s2_w')?.value || 0;
    const as2r = parseInt(document.getElementById('a_s2_r')?.value || 0);

    currentWorkoutData.exercises[ex.id + '_ana'] = { s1: { w: as1w, r: as1r }, s2: { w: as2w, r: as2r } };

    if (as1r >= ex.maxRepsTarget) {
      suggestions.push(`🔥 Ana, super wynik (${as1r} powt)! Pomyśl o dołożeniu ciężaru!`);
    }
  }

  // Jeśli jest sugestia, pokaż ją na chwilę przed przejściem
  const box = document.getElementById('suggestion-box');
  if (suggestions.length > 0 && box.style.display === 'none') {
    box.style.display = 'block';
    box.innerHTML = suggestions.join('<br>');
    // Zmiana tekstu przycisku
    const btn = document.querySelector('button[onclick="window.submitCard()"]');
    if (btn) btn.innerText = "Rozumiem, Przejdź Dalej →";
    return; // Czekaj na drugie kliknięcie
  }

  // Trwały zapis do Firebase oraz LocalStorage
  try {
    localStorage.setItem('last_workout_draft', JSON.stringify(currentWorkoutData));
    await addDoc(collection(db, "workouts"), currentWorkoutData);
  } catch (e) {
    console.error("Błąd zapisu Firebase: ", e);
  }

  currentIndex++;
  renderCard();
};
