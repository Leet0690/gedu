# Cohérence des notes et des exports

Les écrans, le relevé annuel, la synthèse Excel et la deuxième année de la fiche de diplôme utilisent `src/utils/gradeCalculations.js`.

- CC : moyenne de C1 et C2, avec C3 si renseigné. Une note `0` est renseignée ; un champ vide ne l'est pas.
- Moyenne d'un module : `(CC × 3 + EFCFT × 2 + EFCFP × 3) / 8`. Elle reste vide si une composante obligatoire manque.
- Synthèse annuelle : chaque catégorie est pondérée par les coefficients des modules du stagiaire. Le comportement existant est conservé : une composante manquante contribue zéro et le dénominateur reste la somme des coefficients configurés.
- Diplôme : moyenne des deux années pour chaque catégorie, puis `(CC × 3 + EFCFT × 2 + EFCFP × 3 + NSTI × 2) / 10`. Sans historique de première année ou NSTI, le résultat reste incomplet.
- Les calculs conservent leur précision ; l'arrondi à deux décimales intervient à l'affichage.

Les exports reçoivent les objets modules avec leurs coefficients et leurs anciens noms. Les alias ne sont comptés qu'une fois. Les anciennes notes hors de la liste des modules du stagiaire ne sont pas ajoutées au relevé. Les valeurs enregistrées en base ne sont pas supprimées par cette correction.

Dans `/admin/grades`, l'actualisation préserve les modules ou lignes en cours de modification. L'enregistrement individuel écrit uniquement les modules modifiés, pour éviter de réenregistrer une ancienne copie sous un autre nom.

## Vérification

`test/gradeCalculations.test.js` couvre coefficients, zéros, décimales françaises, notes invalides, champs manquants, alias, arrondis et préservation des brouillons. `test/pdfGenerator.test.js` compare le texte réellement produit dans le relevé et la ligne de deuxième année de la fiche de diplôme, avec des coefficients différents.

Ces vérifications utilisent des jeux de données de test ; elles ne constituent pas un contrôle individuel des dossiers en production. Les PDF déjà téléchargés doivent être régénérés.
