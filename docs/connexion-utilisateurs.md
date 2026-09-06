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

## Gestion déléguée sans Finance

Un profil `secretary` peut recevoir `edit` sur tous les modules et `none` sur `finance`, y compris `edit` sur `users`. Ce profil accède à la gestion des comptes ordinaires. Il ne peut ni créer un administrateur, ni attribuer Finance, ni modifier/désactiver les comptes administrateurs ou les comptes qui possèdent déjà un accès Finance. Les contrôles portent sur le profil existant et sur le profil proposé, dans l’interface, le service et les règles Firestore.

La gestion déléguée des utilisateurs ne se combine pas avec un droit Finance pour un compte non administrateur. Les paramètres globaux, clôtures et sauvegardes restent réservés à l’administrateur, car ils peuvent contenir ou modifier des données financières. Les droits `finance: none` concernent le module Finance et ses collections ; les montants présents dans les formations continues ou les fiches formateurs restent rattachés à ces modules.

## Changement manuel de mot de passe par l'administrateur

Depuis l'action **Changer le mot de passe** (icône clé) dans **Gestion Utilisateurs**, l'administrateur peut saisir directement un nouveau mot de passe pour le compte, sans envoi de lien par email :
- Pour son **propre compte**, la modification s'applique immédiatement en session via l'authentification Firebase.
- Pour un **autre compte**, la modification sécurisée sans lien passe par la Cloud Function `adminSetUserPassword` (lorsque déployée) ou par la commande locale d'administration :
  ```bash
  node functions/set-user-password.js PROJECT_ID NOM_UTILISATEUR_OU_EMAIL NOUVEAU_MOT_DE_PASSE
  ```
  Exemple :
  ```bash
  node functions/set-user-password.js ipfp-4802c aminata MonNouveauPass123
  ```

Les mots de passe de comptes réels ne doivent jamais être ajoutés au dépôt ni aux fichiers de configuration de déploiement.

