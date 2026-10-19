# GEDU : formation professionnelle et enseignement scolaire privé

Références consultées le 18 octobre 2026, contexte marocain :

- [Ministère : système éducatif et enseignement scolaire privé](https://www.men.gov.ma/index.php/fr/%C3%A9ducation-nationale).
- [Ministère : élèves, enseignants, classes et suivi scolaire dans Massar](https://www.men.gov.ma/fr/).
- [OFPPT : organisation des formations](https://inc.ofppt.ma/fr/nos-formations).
- [OFPPT : règlement intérieur et examens de fin de module, passage et fin de formation](https://www.ofppt.ma/sites/default/files/documents/R%C3%A8glement%20Int%C3%A9rieur%20des%20EFP%20de%20l%27OFPPT_1.pdf). Ce règlement publié en 2012 sert à comprendre la différence d'organisation, pas à déclarer des coefficients actuels obligatoires.

## Différences retenues

| Organisation | Formation professionnelle | École privée scolaire |
| --- | --- | --- |
| Personnes | Stagiaires et formateurs | Élèves et enseignants |
| Parcours | Diplôme, filière, année de formation | Cycle, classe/section, niveau scolaire |
| Enseignements | Modules et compétences professionnelles | Matières et contrôles par semestre |
| Évaluation | Contrôles, examens théoriques/pratiques, stages selon le cursus | Contrôles et appréciations, bulletin semestriel et annuel |
| Progression | Passage ou fin de formation | Passage de niveau, transition de cycle, redoublement, sortie de l’établissement |

Le mode scolaire propose le primaire (six niveaux), le collège (trois niveaux) et le lycée (tronc commun, première et deuxième années du baccalauréat). Les cycles offerts sont choisis dans Établissement. Les classes et matières sont créées par l'administrateur, sans insertion automatique de classes ou de programmes. Au lycée, le parcours peut être précisé dans le nom de classe/section.

## Utilisation

1. À la première connexion, l’administrateur configure l’identité et le type d’établissement avant d’ouvrir l’accueil. Pour une école privée, choisir les cycles proposés.
2. Dans Cycles / Classes, ajouter le cycle, la section et son niveau scolaire.
3. Dans Matières, configurer les enseignements, coefficients et périodes de chaque classe.
4. Inscrire les élèves et affecter les enseignants, ou utiliser les nouveaux modèles Excel.
5. Saisir les contrôles dans Notes et consulter les bulletins dans Rapports.
6. À la clôture, choisir la décision et la classe d'accueil pour chaque passage, notamment entre cycles.

La moyenne de matière utilise les contrôles saisis sur le barème choisi par l'établissement pour chaque cycle (10 ou 20). Le barème de chaque saisie est conservé avec la note ; un changement ultérieur du barème d'affichage ne réinterprète pas une ancienne note. Les cellules vides ne sont pas converties en zéro. Les moyennes semestrielles sont pondérées par les coefficients des matières évaluées. La moyenne annuelle exige les semestres attendus de chaque matière. Il s'agit d'un bulletin de suivi interne : les examens certificatifs, leurs coefficients réglementaires et les décisions officielles ne sont pas calculés automatiquement. Le passage reste une décision explicite de l'administration.

Les données restent dans les collections existantes. Les notes scolaires sont isolées par année, matière et semestre sous `academicYears[année][matière].school.S1/S2`. Les notes professionnelles existantes ne sont pas converties. Les historiques conservent le cycle et la classe d'origine, y compris après une transition de cycle ou un redoublement. Le profil public ne contient que l'identité visuelle et le type d'enseignement ; les paramètres d'accès restent privés.
