export const initialNotes = {
  martin: {
    latzug: '54 kg x 8',
    wioslowanie: '54 kg x 7',
    wyciskanie_skos: '5 kg x 8',
    bary: '14 kg x 8 / 22 kg x 7-8',
    rozpietki: '36 kg x 8',
    overhead_triceps: '10 kg x 7',
    pushdown_triceps: '12 kg x 11',
    biceps_maszyna: '32 kg x 9 / 5 kg x 20',
    wznosy: '36 kg x 8'
  },
  ana: {
    latzug: '50 kg x 11',
    wioslowanie: '50 kg x 6-7',
    overhead_triceps: '12 kg x 10',
    pushdown_triceps: '17 kg x 5-6',
    biceps_maszyna: '18 kg',
    wznosy: '36 kg x 8',
    a_legpress: '72 kg x 8',
    a_hamstrings: '27 kg',
    a_abductor: '45 kg x 12',
    a_calves: '20 kg'
  }
};

export const workoutPlan = {
  martin_session: [
    { id: 'latzug', name: '1. Latzug (Ściąganie z góry)', isJoint: true, totalSets: 2 },
    { id: 'wioslowanie', name: '2. Wiosłowanie w siadzie', isJoint: true, totalSets: 2 },
    { id: 'wyciskanie_skos', name: '3. Wyciskanie skos', isJoint: false, totalSets: 2 },
    { id: 'bary', name: '4. Bary (Shoulder Press)', isJoint: false, totalSets: 2 },
    { id: 'rozpietki', name: '5. Rozpiętki na Pec-Decu', isJoint: false, totalSets: 2 },
    { id: 'overhead_triceps', name: '6. Overhead Triceps', isJoint: true, totalSets: 1 },
    { id: 'pushdown_triceps', name: '7. Pushdown Triceps', isJoint: true, totalSets: 1 },
    { id: 'biceps_maszyna', name: '8. Biceps maszyna siedząca', isJoint: true, totalSets: 2 },
    { id: 'wznosy', name: '9. Wznosy bokiem', isJoint: true, totalSets: 2 }
  ],
  ana_solo: [
    { id: 'a_legpress', name: '1. Suwnica / Beinpresse', isJoint: false, totalSets: 2 },
    { id: 'a_hamstrings', name: '2. Uginanie nóg (Dwugłowy)', isJoint: false, totalSets: 2 },
    { id: 'a_abductor', name: '3. Abduktor (Pośladki)', isJoint: false, totalSets: 2 },
    { id: 'a_calves', name: '4. Łydki', isJoint: false, totalSets: 2 }
  ]
};
