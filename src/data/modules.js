// ── Modules par Filière et Année ──
// Structure: MODULES_DATA[diploma][filière][année] = [modules]

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
        'Statistiques descriptive',
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
};

// Flat list of filières per diploma for dropdowns
export const FILIERES = Object.fromEntries(
  Object.entries(MODULES_DATA).map(([diploma, filieres]) => [diploma, Object.keys(filieres)])
);

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
