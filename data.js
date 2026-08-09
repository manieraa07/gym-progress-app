/* data.js — plan, ćwiczenia, zamienniki, żywienie */

export const NAMES = { martin: 'Martin', ana: 'Ana' };

/* n  = nazwa dokładnie tak, jak mówi się na siłowni
   tag= krótki opis partii (podpis pod nazwą)
   step = przeskok ciężaru przy wpisywaniu
   sets = serie
   sub  = zamienniki; [] znaczy "brak, trzeba zrobić" */
export const EX = {
  latzug:          { n:'Latzug',           tag:'plecy · szerokość',      step:1,   sets:2, sub:[], warmup:true },
  rudern_sitzend:  { n:'Rudern sitzend',   tag:'plecy · grubość',        step:1,   sets:2, sub:[] },
  skos:            { n:'Skos',             tag:'klatka górna',           step:2.5, sets:2, sub:[], note:'Rozgrzej ramiona lekką serią.' },
  schulterpresse:  { n:'Schulterpresse',   tag:'barki · przód',          step:1,   sets:2, sub:[], skippable:true },
  rozpietki:       { n:'Rozpiętki',        tag:'klatka · rozciąganie',   step:1,   sets:2, sub:[] },
  overhead:        { n:'Overhead',         tag:'TRICEPS · głowa długa',  step:1,   sets:1, sub:[] },
  pushdown:        { n:'Pushdown',         tag:'TRICEPS · głowa boczna', step:1,   sets:1, sub:[] },
  tri_extensions:  { n:'Triceps extensions', tag:'TRICEPS · maszyna',    step:1,   sets:1, sub:[] },
  tri_dipy:        { n:'Dipy maszyna',     tag:'TRICEPS · ciężar własny',step:1,   sets:1, sub:[] },
  biceps_maszyna:  { n:'Biceps maszyna',   tag:'biceps · siedząc',       step:1,   sets:2, sub:['modlitewnik'] },
  modlitewnik:     { n:'Modlitewnik',      tag:'biceps · scott',         step:1,   sets:2, sub:[] },
  wznosy:          { n:'Wznosy bokiem',    tag:'barki · bok',            step:1,   sets:2, sub:[] },

  beinpresse:      { n:'Beinpresse',       tag:'nogi · całość',          step:1,   sets:2, sub:[] },
  beinbeuger:      { n:'Beinbeuger',       tag:'dwugłowy uda',           step:1,   sets:2, sub:[] },
  abduktor:        { n:'Abduktor',         tag:'pośladki · odwodzenie',  step:1,   sets:2, sub:[] },
  lydki:           { n:'Łydki',            tag:'łydki',                  step:1,   sets:2, sub:[] }
};

/* pula tricepsa: łącznie 2 serie na trening, dowolnie rozdzielone */
export const TRICEPS_POOL = ['overhead','pushdown','tri_extensions','tri_dipy'];
export const TRICEPS_SETS = 2;

export const PHASES = {
  together1: ['latzug','rudern_sitzend'],
  martin:    ['skos','schulterpresse','rozpietki'],
  ana:       ['beinpresse','beinbeuger','abduktor','lydki'],
  together2: ['__triceps__','biceps_maszyna','wznosy']
};

/* rozgrzewka: % ciężaru roboczego i powtórzenia */
export const WARMUP = [
  { pct:0.5,  reps:'12–15' },
  { pct:0.75, reps:'6–8'  }
];

/* ---------- żywienie ---------- */
/* białko: wartości z etykiety Martina (Bodylab24, na 100 g) */
export const FOOD = {
  protein: { n:'Whey Bodylab24', per:100, kcal:381, p:73, c:8.2, f:6, fiber:0,
             vit:{ B2:.5, B12:1.2 }, min:{ Ca:400, K:300, Na:200, Mg:60, P:250, Zn:1.5 } },
  milk:    { n:'Mleko 1,5%',     per:100, kcal:47,  p:3.3, c:4.8, f:1.5, fiber:0,
             vit:{ A:36, D:1, E:.04, K:.2, B1:.04, B2:.18, B3:.09, B5:.36, B6:.04, B9:5, B12:.44 },
             min:{ Ca:120, Fe:0, Mg:11, P:92, K:152, Na:42, Zn:.4, Cu:.01, Mn:0, Se:3.2 } },
  banana:  { n:'Banan',          per:100, kcal:89,  p:1.1, c:23, f:.3, fiber:2.6,
             vit:{ A:3, C:8.7, E:.1, K:.5, B1:.03, B2:.07, B3:.66, B5:.33, B6:.37, B9:20 },
             min:{ Ca:5, Fe:.26, Mg:27, P:22, K:358, Na:1, Zn:.15, Cu:.08, Mn:.27, Se:1 } },
  peanut:  { n:'Masło orzechowe',per:100, kcal:640, p:25, c:18, f:52, fiber:7,
             vit:{ E:9, K:.3, B1:.1, B2:.11, B3:13, B5:1.8, B6:.44, B9:87 },
             min:{ Ca:60, Fe:2.1, Mg:180, P:350, K:650, Na:10, Zn:3, Cu:.6, Mn:1.6, Se:4 } }
};

export const PORTION = { protein:40, milk:250, banana:118 }; // g / ml — edytowalne w apce

/* unijne referencyjne wartości dzienne (NRV) */
export const NRV = {
  A:800, C:80, D:5, E:12, K:75, B1:1.1, B2:1.4, B3:16, B5:6, B6:1.4, B9:200, B12:2.5,
  Ca:800, Fe:14, Mg:375, P:700, K:2000, Zn:10, Cu:1, Mn:2, Se:55
};
export const UNIT = {
  A:'µg', C:'mg', D:'µg', E:'mg', K:'µg', B1:'mg', B2:'mg', B3:'mg', B5:'mg', B6:'mg', B9:'µg', B12:'µg',
  Ca:'mg', Fe:'mg', Mg:'mg', P:'mg', K:'mg', Na:'mg', Zn:'mg', Cu:'mg', Mn:'mg', Se:'µg'
};
export const LABEL = {
  A:'Witamina A', C:'Witamina C', D:'Witamina D', E:'Witamina E', K:'Witamina K',
  B1:'Tiamina B1', B2:'Ryboflawina B2', B3:'Niacyna B3', B5:'Kwas pantotenowy B5',
  B6:'Witamina B6', B9:'Foliany', B12:'Witamina B12',
  Ca:'Wapń', Fe:'Żelazo', Mg:'Magnez', P:'Fosfor', K:'Potas', Na:'Sód',
  Zn:'Cynk', Cu:'Miedź', Mn:'Mangan', Se:'Selen'
};
