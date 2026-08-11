/* data.js — plan, ćwiczenia, ustawienia maszyn, żywienie */

export const NAMES = { martin:'Martin', ana:'Ana' };

/* seat: ustawienia maszyny per osoba (mały tag, nie rzuca się w oczy) */
export const EX = {
  latzug:         { n:'Latzug',            tag:'plecy · szerokość', step:1, sets:2, sub:[], warmup:true,
                    seat:{ martin:'siedzenie ostatnie', ana:'siedzenie przedostatnie' } },
  rudern_sitzend: { n:'Rudern sitzend',    tag:'plecy · grubość',   step:1, sets:2, sub:['tbar'],
                    seat:{ martin:'oparcie ostatnie · siedzenie ostatnie', ana:'oparcie 6 · siedzenie przedostatnie' } },
  tbar:           { n:'T-bar',             tag:'plecy · grubość',   step:1, sets:2, sub:[] },

  skos:           { n:'Skos',              tag:'klatka górna',      step:2.5, sets:2, sub:[],
                    gate:'Rozgrzej ramiona lekką serią, zanim wejdziesz na roboczy ciężar.',
                    seat:{ martin:'siedzenie najniższe' } },
  schulterpresse: { n:'Schulterpresse',    tag:'barki · przód',     step:1, sets:2, sub:[], skippable:true },
  rozpietki:      { n:'Rozpiętki',         tag:'klatka · rozciąganie', step:1, sets:2, sub:[],
                    seat:{ martin:'rączki 1 · siedzenie 5', ana:'rączki 1 · siedzenie 5' } },

  overhead:       { n:'Overhead',          tag:'TRICEPS · głowa długa',  step:1, sets:2, sub:[],
                    seat:{ martin:'wyciąg na wysokości pasa', ana:'wyciąg na wysokości pasa' } },
  pushdown:       { n:'Pushdown',          tag:'TRICEPS · głowa boczna', step:1, sets:2, sub:[],
                    seat:{ martin:'wyciąg przedostatni od góry', ana:'wyciąg przedostatni od góry' } },
  tri_extensions: { n:'Triceps extensions',tag:'TRICEPS · maszyna',      step:1, sets:2, sub:[] },
  tri_dipy:       { n:'Dipy maszyna',      tag:'TRICEPS · maszyna',      step:1, sets:2, sub:[] },

  biceps_maszyna: { n:'Biceps maszyna',    tag:'biceps',            step:1, sets:2, sub:['biceps_hantla'],
                    seat:{ martin:'siedzenie 7', ana:'siedzenie 7' } },
  biceps_hantla:  { n:'Biceps hantla',     tag:'biceps · wolny ciężar', step:1, sets:2, sub:[] },
  wznosy:         { n:'Wznosy bokiem',     tag:'barki · bok',       step:1, sets:2, sub:[],
                    seat:{ martin:'siedzenie 3', ana:'siedzenie 3' } },

  beinpresse:     { n:'Beinpresse',        tag:'nogi · całość',     step:1, sets:2, sub:[] },
  beinbeuger:     { n:'Beinbeuger',        tag:'dwugłowy uda',      step:1, sets:2, sub:[] },
  abduktor:       { n:'Abduktor',          tag:'pośladki',          step:1, sets:2, sub:[] },
  lydki:          { n:'Łydki',             tag:'łydki',             step:1, sets:2, sub:[] }
};

export const TRICEPS_POOL = ['overhead','pushdown','tri_extensions','tri_dipy'];
export const TRICEPS_MAX_SETS = 2;

export const PHASES = {
  together1: ['latzug','rudern_sitzend'],
  martin:    ['skos','schulterpresse','rozpietki'],
  ana:       ['beinpresse','beinbeuger','abduktor','lydki']
};

/* końcówka: kolejność dowolna, wybierana w trakcie */
export const FINISHERS = {
  triceps: { label:'Triceps', hint:'2 serie łącznie' },
  biceps:  { label:'Biceps',  hint:'2 serie',  def:'biceps_maszyna', alts:['biceps_maszyna','biceps_hantla'] },
  wznosy:  { label:'Wznosy',  hint:'2 serie',  def:'wznosy',         alts:['wznosy'] }
};

export const WARMUP = [ { pct:0.5, reps:'12–15' }, { pct:0.75, reps:'6–8' } ];

/* ---------- żywienie ---------- */
export const FOOD = {
  protein:{ n:'Whey Bodylab24', per:100, kcal:381, p:73, c:8.2, f:6, fiber:0,
            vit:{ B2:.5, B12:1.2 }, min:{ Ca:400, K:300, Na:200, Mg:60, P:250, Zn:1.5 } },
  milk:   { n:'Mleko 1,5%', per:100, kcal:47, p:3.3, c:4.8, f:1.5, fiber:0,
            vit:{ A:36, D:1, E:.04, K:.2, B1:.04, B2:.18, B3:.09, B5:.36, B6:.04, B9:5, B12:.44 },
            min:{ Ca:120, Fe:0, Mg:11, P:92, K:152, Na:42, Zn:.4, Cu:.01, Mn:0, Se:3.2 } },
  banana: { n:'Banan', per:100, kcal:89, p:1.1, c:23, f:.3, fiber:2.6,
            vit:{ A:3, C:8.7, E:.1, K:.5, B1:.03, B2:.07, B3:.66, B5:.33, B6:.37, B9:20 },
            min:{ Ca:5, Fe:.26, Mg:27, P:22, K:358, Na:1, Zn:.15, Cu:.08, Mn:.27, Se:1 } },
  peanut: { n:'Masło orzechowe', per:100, kcal:640, p:25, c:18, f:52, fiber:7,
            vit:{ E:9, K:.3, B1:.1, B2:.11, B3:13, B5:1.8, B6:.44, B9:87 },
            min:{ Ca:60, Fe:2.1, Mg:180, P:350, K:650, Na:10, Zn:3, Cu:.6, Mn:1.6, Se:4 } }
};
export const PORTION = { protein:40, milk:250, banana:118 };

export const NRV = { A:800, C:80, D:5, E:12, K:75, B1:1.1, B2:1.4, B3:16, B5:6, B6:1.4, B9:200, B12:2.5,
  Ca:800, Fe:14, Mg:375, P:700, K:2000, Zn:10, Cu:1, Mn:2, Se:55 };
export const UNIT = { A:'µg', C:'mg', D:'µg', E:'mg', K:'µg', B1:'mg', B2:'mg', B3:'mg', B5:'mg', B6:'mg',
  B9:'µg', B12:'µg', Ca:'mg', Fe:'mg', Mg:'mg', P:'mg', K:'mg', Na:'mg', Zn:'mg', Cu:'mg', Mn:'mg', Se:'µg' };
export const LABEL = { A:'Witamina A', C:'Witamina C', D:'Witamina D', E:'Witamina E', K:'Witamina K',
  B1:'Tiamina B1', B2:'Ryboflawina B2', B3:'Niacyna B3', B5:'Kwas pantotenowy B5', B6:'Witamina B6',
  B9:'Foliany', B12:'Witamina B12', Ca:'Wapń', Fe:'Żelazo', Mg:'Magnez', P:'Fosfor', K:'Potas',
  Na:'Sód', Zn:'Cynk', Cu:'Miedź', Mn:'Mangan', Se:'Selen' };
