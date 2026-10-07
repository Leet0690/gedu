# Lecture des notes dans le portail formateur

Le portail ouvre une session Firebase temporaire dans une application secondaire, puis présente son lien notes à `teacher_grade_sessions/<uid>`. Les règles valident ce lien auprès du formateur. Chaque document de notes est ensuite lu individuellement, uniquement si le stagiaire appartient aux groupes du formateur. Les notes ne sont pas lisibles publiquement et l'énumération de la collection n'est pas autorisée par ces sessions.

Les règles vérifient le lien lors de chaque lecture : sa révocation ou un changement de groupe retire l'accès. La session de lecture expire après dix minutes et est supprimée après le chargement. Une seule identité temporaire est réutilisée pendant les actualisations du portail ; elle est supprimée lorsqu'on quitte ce portail. La session administrateur du navigateur reste indépendante.

Le fournisseur de connexion anonyme doit être activé dans Firebase Authentication. Il permet d'identifier la session technique ; il ne donne pas accès aux notes sans le lien notes validé. Le formateur continue d'utiliser son lien habituel sans écran de connexion.

Déployer les règles avant le site. Aucun déploiement de Cloud Functions n'est requis.
