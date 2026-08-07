export const workoutPlan = {
  martin_session: [
    // Wspólne ćwiczenia (Martin + Ana)
    { 
      id: 'lat_pull', 
      name: '1. Ściąganie z góry (Rozbieżna)', 
      isJoint: true, 
      lastMartin: '54 kg x 8', 
      lastAna: '50 kg x 11',
      maxRepsTarget: 10
    },
    { 
      id: 'rowing', 
      name: '2. Wiosłowanie w siadzie (Seated Row)', 
      isJoint: true, 
      lastMartin: '54 kg x 7', 
      lastAna: '50 kg x 6-7',
      maxRepsTarget: 10
    },
    // Tylko Martin
    { 
      id: 'm_incline', 
      name: '3. Wyciskanie na skosie dodatnim', 
      isJoint: false, 
      lastMartin: '5 kg x 8',
      maxRepsTarget: 10
    },
    { 
      id: 'm_shoulder', 
      name: '4. Shoulder Press na maszynie', 
      isJoint: false, 
      lastMartin: '14 kg x 8',
      maxRepsTarget: 10
    },
    { 
      id: 'm_pecdec', 
      name: '5. Rozpiętki na Pec-Decu', 
      isJoint: false, 
      lastMartin: '36 kg x 8',
      maxRepsTarget: 10
    },
    // Wspólne kontynuacja
    { 
      id: 'side_raises', 
      name: '6. Wznosy bokiem', 
      isJoint: true, 
      lastMartin: '36 kg x 8', 
      lastAna: '36 kg x 8',
      maxRepsTarget: 12
    },
    { 
      id: 'overhead', 
      name: '7. Overhead Triceps Extension', 
      isJoint: true, 
      lastMartin: '10 kg x 7', 
      lastAna: '12 kg x 10',
      maxRepsTarget: 10
    },
    { 
      id: 'triceps_mach', 
      name: '8. Triceps Extension na maszynie', 
      isJoint: true, 
      lastMartin: '12 kg x 11', 
      lastAna: '27 kg',
      maxRepsTarget: 10
    },
    { 
      id: 'biceps_mach', 
      name: '9. Biceps na modlitewniku / maszynie', 
      isJoint: true, 
      lastMartin: '5 kg x 20', 
      lastAna: '18 kg',
      maxRepsTarget: 12
    }
  ],
  ana_solo: [
    { id: 'a_legpress', name: '1. Suwnica / Beinpresse', isJoint: false, lastAna: '72 kg x 8', maxRepsTarget: 10 },
    { id: 'a_hamstrings', name: '2. Uginanie nóg (Dwugłowy)', isJoint: false, lastAna: '27 kg', maxRepsTarget: 12 },
    { id: 'a_abductor', name: '3. Abduktor (Pośladki)', isJoint: false, lastAna: '45 kg x 12', maxRepsTarget: 12 },
    { id: 'a_calves', name: '4. Łydki', isJoint: false, lastAna: '20 kg', maxRepsTarget: 15 }
  ]
};
