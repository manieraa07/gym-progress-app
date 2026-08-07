export const workoutPlan = [
  { 
    id: 'lat_pull', 
    name: '1. Lat Pulldown (Rozbieżna)', 
    type: 'together', 
    gifUrl: '' // TUTAJ WKLEISZ LINK DO GIFA
  },
  { 
    id: 'rowing', 
    name: '2. Wiosłowanie na Maszynie', 
    type: 'together', 
    gifUrl: '' 
  },
  { 
    id: 'split_section', 
    type: 'split', 
    martin: [
      { id: 'm_incline', name: '3M. Ławka Skośna', gifUrl: '' },
      { id: 'm_shoulders', name: '4M. Wyciskanie na Barki', gifUrl: '' },
      { id: 'm_flyes', name: '5M. Rozpiętki', gifUrl: '' }
    ],
    ana: [
      { id: 'a_legpress', name: '3A. Suwnica Siedząca', gifUrl: '' },
      { id: 'a_hamstrings', name: '4A. Uginanie Nóg (Dwugłowe)', gifUrl: '' },
      { id: 'a_abductors', name: '5A. Abduktory (Pośladki)', gifUrl: '' }
    ]
  },
  { id: 'triceps', name: '6. Triceps', type: 'together', gifUrl: '' },
  { id: 'biceps', name: '7. Biceps', type: 'together', gifUrl: '' },
  { id: 'side_raises', name: '8. Wznosy Bokiem', type: 'together', gifUrl: '' }
];
