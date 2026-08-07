export const workoutPlan = [
  { 
    id: 'lat_pull', 
    name: '1. Lat Pulldown (Rozbieżna)', 
    type: 'together', 
    targetReps: [8, 10],
    gifUrl: 'https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExa3gzZW12bW5nb2ZjYWhhZ2lkdjVnZ2wxM2g4ZnVtMzI5Nmh5anZ2ZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/JZeYUA1uJCzXcR30IS/giphy.gif' 
  },
  { 
    id: 'rowing', 
    name: '2. Wiosłowanie na Maszynie', 
    type: 'together', 
    targetReps: [8, 10],
    gifUrl: '' 
  },
  { 
    id: 'split_section', 
    type: 'split',
    martin: [
      { id: 'm_incline', name: '3M. Ławka Skośna', targetReps: [6, 8], gifUrl: '' },
      { id: 'm_shoulders', name: '4M. Wyciskanie na Barki', targetReps: [8, 10], gifUrl: '' },
      { id: 'm_flyes', name: '5M. Rozpiętki', targetReps: [10, 12], gifUrl: '' }
    ],
    ana: [
      { id: 'a_legpress', name: '3A. Suwnica Siedząca', targetReps: [8, 10], gifUrl: '' },
      { id: 'a_hamstrings', name: '4A. Uginanie Nóg (Dwugłowe)', targetReps: [10, 12], gifUrl: '' },
      { id: 'a_abductors', name: '5A. Abduktory (Pośladki)', targetReps: [12, 15], gifUrl: '' }
    ]
  },
  { id: 'triceps', name: '6. Triceps', type: 'together', targetReps: [10, 12], gifUrl: '' },
  { id: 'biceps', name: '7. Biceps', type: 'together', targetReps: [10, 12], gifUrl: '' },
  { id: 'side_raises', name: '8. Wznosy Bokiem', type: 'together', targetReps: [12, 15], gifUrl: '' }
];
