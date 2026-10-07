# Notes du portail stagiaire

Le lien `/results/<token>` identifie le stagiaire. Le portail lit l'année
académique publiée dans `public_settings/schedule`, pour afficher les notes de
la bonne année au lieu de dépendre d'une ancienne valeur du navigateur.

La lecture des notes utilise le fournisseur e-mail/mot de passe déjà utilisé
par le portail formateur, dans une application Firebase secondaire. Une session
`student_grade_sessions/<uid>` valide le jeton du stagiaire puis autorise la
lecture individuelle de `grades/<studentId>`. Elle ne permet ni de lister les
notes, ni de lire les notes des camarades, ni de modifier des notes.

Les lectures sont séquentielles sur chaque connexion pour éviter qu'une
actualisation supprime une session encore utilisée par une autre lecture.
La session est supprimée après la lecture. Si ce nettoyage échoue, son
autorisation expire après dix minutes ; une révocation du jeton retire
également l'accès. La connexion secondaire est nettoyée à la sortie du portail,
sans déconnecter l'administrateur.

Le classement de classe n'est pas calculé avec une seule copie personnelle des
notes : il reste indisponible jusqu'à la publication d'un classement agrégé.

Cette correction ne requiert ni Cloud Functions, ni nouveau fournisseur de
connexion, ni changement de plan Firebase. Elle ne modifie pas les données de
notes existantes.

Pour activer cette correction sur un site, les nouvelles règles Firestore
doivent être publiées avant le code du site. Un serveur localhost utilise aussi
les règles en ligne tant qu'il n'est pas connecté aux émulateurs.

Les tests `studentGradePortalRules.test.js` vérifient les autorisations avec
l'émulateur Firestore sur `127.0.0.1:8085`. Les tests de session et de file de
lecture vérifient également le nettoyage et les chargements simultanés.
