# Lecture des notes dans le portail formateur

Le portail ouvre une session Firebase temporaire dans une application secondaire, puis présente son lien notes à `teacher_grade_sessions/<uid>`. Les règles valident ce lien auprès du formateur. Chaque document de notes est ensuite lu individuellement, uniquement si le stagiaire appartient aux groupes du formateur. Les notes ne sont pas lisibles publiquement et l'énumération de la collection n'est pas autorisée par ces sessions.

Les règles vérifient le lien lors de chaque lecture : sa révocation ou un changement de groupe retire l'accès. La session de lecture expire après dix minutes et est supprimée après le chargement. Une seule identité temporaire est réutilisée pendant les actualisations du portail ; elle est supprimée lorsqu'on quitte ce portail. La session administrateur du navigateur reste indépendante.

La session technique utilise le fournisseur e-mail/mot de passe déjà activé pour l'application. Elle crée un compte temporaire avec une adresse réservée aléatoire et un mot de passe aléatoire conservé uniquement en mémoire. Aucun e-mail n'est envoyé. Le compte ne possède aucun profil d'administration ; le lien notes validé reste nécessaire pour lire les groupes du formateur. Le formateur continue d'utiliser son lien habituel sans écran de connexion.

Aucun changement de forfait Firebase, activation de connexion anonyme ou Cloud Function n'est nécessaire. Une erreur de lecture affiche un écran de reprise et bloque la saisie, pour éviter d'écraser des notes qui n'ont pas été chargées.

Déployer les règles avant le site. Aucun déploiement de Cloud Functions n'est requis.
