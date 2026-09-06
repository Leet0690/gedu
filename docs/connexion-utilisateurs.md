# Connexion avec un nom d’utilisateur

L’écran demande uniquement un nom d’utilisateur et un mot de passe. La création et la connexion partagent la même conversion : `aminata` correspond au compte Firebase Authentication `aminata@ipfp.edu`. Une adresse email complète reste acceptée pour les comptes existants utilisant un autre domaine. Le nom affiché (`displayName`) ne constitue pas l’identifiant de connexion.

## Corriger « Compte non autorisé ou désactivé »

Ce message était affiché lorsque Firebase Authentication avait accepté les identifiants, mais que le profil Firestore était absent ou que son champ `isActive` n’était pas le booléen `true`. Le code distingue désormais ces situations.

1. Dans le même projet Firebase que l’application, ouvrir **Authentication → Users**. Repérer le compte correspondant au nom saisi et copier son **UID**. Pour `aminata`, l’adresse attendue est `aminata@ipfp.edu`.
2. Dans **Firestore Database → users**, vérifier que **l’identifiant du document** est cet UID exact. Ajouter un champ `uid` à un document portant un identifiant automatique ne change pas l’identifiant du document et ne corrige pas le lien.
3. Vérifier que `isActive` existe et est de type **boolean**, valeur **true**. La chaîne de caractères `"true"` est refusée. Si le compte avait été volontairement suspendu, seul un administrateur doit décider de sa réactivation.
4. Vérifier le rôle et les permissions prévus pour la personne. Les rôles acceptés sont `admin`, `super_admin`, `director`, `secretary`, `instructor` et `custom`. Les profils non administrateurs ont besoin d’une matrice `permissions` explicite pour accéder aux modules.
5. Se reconnecter avec le nom et le mot de passe enregistrés dans Authentication.

Firestore contient le profil et les droits ; le mot de passe est géré par Firebase Authentication. Un document Firestore seul ne crée pas un compte de connexion. Ne pas enregistrer de champ `password` dans le profil. Voir la [documentation Firebase Authentication](https://firebase.google.com/docs/auth/web/password-auth).

## Création des prochains comptes

Depuis **Gestion Utilisateurs → Nouvel Utilisateur**, saisir le nom complet, le nom d’utilisateur, le mot de passe initial et les droits. L’application crée le compte Authentication et le document `users/<UID>` associé avec `isActive: true`.

Pour le tout premier administrateur, le script `functions/bootstrap-admin.js` prépare un profil complet pour un compte Authentication déjà créé, depuis un environnement disposant d’identifiants serveur autorisés. La procédure figure dans [l’audit RBAC](rbac-audit.md). Le script ne modifie pas un profil existant et n’accorde jamais de droits depuis l’écran de connexion.

Les adresses `@ipfp.edu` servent d’identifiants techniques : aucune boîte mail n’est créée automatiquement. Un lien de réinitialisation par email ne peut être reçu que si la boîte correspondante existe réellement.
