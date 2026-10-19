export const EDUCATION_TYPES = Object.freeze({
  vocational: { label: 'Formation professionnelle', description: 'Stagiaires, formateurs, filières, modules et diplômes.' },
  private_school: { label: 'École privée', description: 'Élèves, enseignants, classes, matières et semestres.' },
});

export const SCHOOL_CYCLES = Object.freeze({
  Primaire: { years: ['1ère année primaire', '2ème année primaire', '3ème année primaire', '4ème année primaire', '5ème année primaire', '6ème année primaire'], abbreviation: 'P', nextCycle: 'Collège' },
  Collège: { years: ['1ère année collège', '2ème année collège', '3ème année collège'], abbreviation: 'C', nextCycle: 'Lycée' },
  Lycée: { years: ['Tronc commun', '1ère année baccalauréat', '2ème année baccalauréat'], abbreviation: 'L', nextCycle: null },
});

export const isSchoolCycle = cycle => Object.hasOwn(SCHOOL_CYCLES, cycle || '');
export const isSchoolStudent = student => student?.educationType === 'private_school' || isSchoolCycle(student?.diploma);
export const normalizeEducationType = value => Object.hasOwn(EDUCATION_TYPES, value) ? value : 'vocational';

export const normalizeSchoolCycles = value => {
  const cycles = Array.isArray(value) ? value.filter(isSchoolCycle) : Object.keys(SCHOOL_CYCLES);
  return [...new Set(cycles)];
};

export const normalizeSchoolGradeScales = (value = {}) => Object.fromEntries(Object.keys(SCHOOL_CYCLES).map(cycle => [cycle,
  [10, 20].includes(Number(value?.[cycle])) ? Number(value[cycle]) : cycle === 'Primaire' ? 10 : 20,
]));

export const getSchoolGradeScale = (student, institution = {}) => normalizeSchoolGradeScales(institution.schoolGradeScales)[student?.diploma] || 20;
