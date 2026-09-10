// ── Modules par Filière et Année ──
// Structure: MODULES_DATA[diploma][filière][année] = [modules]

export const FIRST_YEAR = '1ère année';
export const SECOND_YEAR = '2ème année';

export const DIPLOMA_CONFIG = {
  'Technicien Spécialisé': { years: [FIRST_YEAR, SECOND_YEAR], semesterCount: 4, abbreviation: 'TS' },
  'Technicien': { years: [FIRST_YEAR, SECOND_YEAR], semesterCount: 4, abbreviation: 'T' },
  'Licence Professionnelle': { years: [FIRST_YEAR], semesterCount: 2, abbreviation: 'LP' },
  'Master spécialisé': { years: [FIRST_YEAR, SECOND_YEAR], semesterCount: 4, abbreviation: 'MS' },
};

export const ALL_STUDY_YEARS = [FIRST_YEAR, SECOND_YEAR];

const MAJOR_ABBREVIATIONS = {
  'Génie industriel': 'GI',
  'Ingénierie des Systèmes Informatiques et Logiciels': 'ISIL',
  'Ingénierie en électromécanique et maintenance industrielle': 'IEMI',
  'Qualité, santé, sécurité et environnement': 'QHSE',
  'Transport-Logistique et Supply chain': 'TLSC',
  'Administration et managment des ressources humaines': 'AMRH',
  'Génie industriel : Maintenance et maîtrise des risques industriels': 'GIMMRI',
  'Génie industriel : Ingénierie de la production et conception de produits': 'GIIPCP',
  'Managment de la qualité, hygiene, securite, sûreté et environnement': 'MQHSSE',
  'Managment industriel et système logistique': 'MISL',
  'Management des ressources humaine et RSE': 'MRHRSE',
  'Ingénierie infomatique : Cyber sécurité et Big Data': 'IICBD',
};

const emptyYearModules = (diploma) =>
  Object.fromEntries(DIPLOMA_CONFIG[diploma].years.map(year => [year, []]));

export const MODULES_DATA = {
  'Technicien Spécialisé': {
    'Développement Informatique': {
      '1ère année': [
        'Algorithmique et programmation structurée avec Python',
        'Conception et Modélisation d\'un SI avec UML',
        'Programmation Orientée Objet avec JAVA',
        'Conception et Modélisation d\'un SI avec Merise',
        'Développement web (HTML/PHP/CSS/JavaScript)',
        'SGBD (MySQL)',
        'Management et organisation des Entreprises',
        'Entreprenariat',
        'Architecture et système d\'exploitation',
        'Bureautique',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication',
        'Stage en Entreprise',
      ],
      '2ème année': [
        'Framework web : Laravel (back end)',
        'Framework WordPress CMS',
        'Développement Mobile natif-hybride',
        'Programmation client-serveur : JAVA',
        'Déploiement d\'application',
        'Réseaux informatiques',
        'Fondamentaux de la cybersécurité',
        'Administration des bases de données',
        'Gestion de projet (MS Project)',
        'ERP',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication',
        'Techniques de rédaction des travaux de fin d\'étude',
        'Stage en Entreprise',
      ],
    },
    'Gestion de Transport et Logistique': {
      '1ère année': [
        'Introduction à la logistique',
        'Géographie mondiale',
        'Commerce international et incoterms',
        'Transport International',
        'Droit du transport et règlementation',
        'Comptabilité générale',
        'Mathématiques Financières',
        'Statistiques descriptive',
        'Management et Organisation des E/ses',
        'Entreprenariat',
        'Bureautique',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication',
        'Stage en Entreprise',
      ],
      '2ème année': [
        'Gestion Logistique et supply chain',
        'Transactions Commerciales internationales',
        'Entreposage et gestion des entrepôts',
        'Qualité appliquée dans le domaine de la logistique',
        'Gestion des risques',
        'Comptabilité analytique',
        'Gestion d\'approvisionnement de stock et de production',
        'Lean Manufacturing',
        'Administration des bases de données',
        'Gestion de projet (MS Project)',
        'ERP',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication',
        'Techniques de rédaction des travaux de fin d\'étude',
        'Stage en Entreprise',
      ],
    },
    'Gestion des Entreprises': {
      '1ère année': [
        'Comptabilité générale',
        'Logiciel de gestion comptable (Sage-Saari 100)',
        'Comptabilité des sociétés',
        'Mathématiques Financières',
        'Statistiques descriptive',
        'Management et Organisation des E/ses',
        'Droit de travail',
        'Entreprenariat',
        'Droit des entreprises',
        'Architecture et Système d\'exploitation',
        'Bureautique',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication',
        'Stage en Entreprise',
      ],
      '2ème année': [
        'Diagnostic financier',
        'Traitement des salaires et charges sociales (Logiciel de paie)',
        'Gestion budgétaire',
        'Management des RH',
        'Comptabilité analytique',
        'Gestion d\'approvisionnement de stock et de production',
        'Lean Manufacturing',
        'Administration des bases de données',
        'Gestion de projet (MS Project)',
        'ERP',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication',
        'Techniques de rédaction des travaux de fin d\'étude',
        'Stage en Entreprise',
      ],
    },
  },
  'Technicien': {
    'Gestion Informatisée': {
      '1ère année': [
        'Comptabilité générale',
        'Logiciel de gestion comptable (sage-Saari 100)',
        'Comptabilité des sociétés',
        'Mathématiques Financières',
        'Statistiques descriptives',
        'Management et Organisation des entreprises',
        'Droit de travail',
        'Entreprenariat',
        'Droit des entreprises',
        'Architecture et Système d\'exploitation',
        'Bureautique',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication'
      ],
      '2ème année': [
        'Diagnostic financier',
        'Traitement des salaires et charges sociales (Logiciel de paie)',
        'Comptabilité analytique',
        'Gestion d\'approvisionnement de stock et de production',
        'Lean Manufacturing',
        'Réseaux informatiques',
        'Fondamentaux de la cybersécurité',
        'Administration des bases de données.',
        'Gestion de projet (MS Project)',
        'ERP',
        'Soft skills et Techniques de communication',
        'Anglais : Techniques de communication'
      ],
    },
  },
  'Licence Professionnelle': {
    'Génie industriel': emptyYearModules('Licence Professionnelle'),
    'Ingénierie des Systèmes Informatiques et Logiciels': emptyYearModules('Licence Professionnelle'),
    'Ingénierie en électromécanique et maintenance industrielle': emptyYearModules('Licence Professionnelle'),
    'Qualité, santé, sécurité et environnement': emptyYearModules('Licence Professionnelle'),
    'Transport-Logistique et Supply chain': emptyYearModules('Licence Professionnelle'),
    'Administration et managment des ressources humaines': emptyYearModules('Licence Professionnelle'),
  },
  'Master spécialisé': {
    'Génie industriel : Maintenance et maîtrise des risques industriels': emptyYearModules('Master spécialisé'),
    'Génie industriel : Ingénierie de la production et conception de produits': emptyYearModules('Master spécialisé'),
    'Managment de la qualité, hygiene, securite, sûreté et environnement': emptyYearModules('Master spécialisé'),
    'Managment industriel et système logistique': emptyYearModules('Master spécialisé'),
    'Management des ressources humaine et RSE': emptyYearModules('Master spécialisé'),
    'Ingénierie infomatique : Cyber sécurité et Big Data': emptyYearModules('Master spécialisé'),
  },
};

// Flat list of filières per diploma for dropdowns
export const FILIERES = Object.fromEntries(
  Object.entries(MODULES_DATA).map(([diploma, filieres]) => [diploma, Object.keys(filieres)])
);

export const getStudyYearsForDiploma = (diploma) =>
  DIPLOMA_CONFIG[diploma]?.years || ALL_STUDY_YEARS;

export const getStudyYearsForDiplomas = (diplomas = []) =>
  Array.from(new Set(diplomas.flatMap(getStudyYearsForDiploma)));

export const getDiplomaForMajor = (major) =>
  Object.keys(FILIERES).find(diploma => FILIERES[diploma].includes(major)) || '';

export const getStudyYearsForMajor = (major) =>
  getStudyYearsForDiploma(getDiplomaForMajor(major));

export const getNextStudyYear = (diploma, year) => {
  const years = getStudyYearsForDiploma(diploma);
  const currentIndex = years.indexOf(year);
  return currentIndex >= 0 ? years[currentIndex + 1] || null : null;
};

export const isKnownStudyYear = (diploma, year) =>
  getStudyYearsForDiploma(diploma).includes(year);

export const getDiplomaAbbreviation = (diploma) =>
  DIPLOMA_CONFIG[diploma]?.abbreviation || diploma?.split(' ').map(word => word[0]).join('').toUpperCase() || '';

export const getClassCode = (diploma, major = '', year = '') => {
  const resolvedDiploma = diploma || getDiplomaForMajor(major);
  const normalizedMajor = major.toLowerCase();
  let majorCode = MAJOR_ABBREVIATIONS[major] || '';
  if (!majorCode) {
    if (normalizedMajor.includes('développement')) majorCode = 'DI';
    else if (normalizedMajor.includes('gestion informatisée')) majorCode = 'GI';
    else if (normalizedMajor.includes('transport') || normalizedMajor.includes('logistique')) majorCode = 'GTL';
    else if (normalizedMajor.includes('entreprises')) majorCode = 'GE';
    else majorCode = major.split(' ').filter(word => word.length > 2).map(word => word[0]).join('').toUpperCase();
  }
  const yearNumber = year.match(/\d+/)?.[0] || '';
  return `${getDiplomaAbbreviation(resolvedDiploma)}${majorCode}${yearNumber}`;
};

// Get modules for a student based on their diploma, major, and year
export const getModulesForStudent = (student) => {
  if (!student?.diploma || !student?.major || !student?.year) return [];
  return MODULES_DATA[student.diploma]?.[student.major]?.[student.year] || [];
};

// Get modules for a filière + year (without needing a student object)
export const getModulesForFiliere = (diploma, major, year) => {
  if (!diploma || !major || !year) return [];
  return MODULES_DATA[diploma]?.[major]?.[year] || [];
};
