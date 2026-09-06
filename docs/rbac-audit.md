# Audit et plan corrigé — RBAC et journal d’activité

Audit du plan fourni et du travail déjà présent dans le dépôt, le 6 septembre 2026. Les modifications existantes ont été conservées et corrigées. Aucun compte réel, aucune donnée métier et aucun déploiement Firebase n’ont été modifiés.

## Conclusion

Le plan initial couvrait l’interface, mais ne suffisait pas à sécuriser les données. Masquer une page ne remplace pas les règles Firestore. Une session dans `localStorage`, un mot de passe `VITE_*` ou une adresse email choisie côté client ne peuvent attribuer un rôle administrateur.

Le code local comporte désormais une authentification Firebase unique, des contrôles avant les mutations, des règles serveur testées et une fonction d’audit serveur. La mise en production nécessite la migration décrite ci-dessous, notamment celle des portails par lien. La configuration de déploiement existante `firebase.json` reste distincte de `firebase.rbac.json` pour éviter de déployer accidentellement des règles incompatibles avec les anciens portails.

## Constats et corrections appliquées

| Gravité | Problème | Correction |
| --- | --- | --- |
| Critique | Sessions administrateur acceptées depuis le stockage local et mots de passe embarqués | Suppression des deux authentifications historiques et des secrets `VITE_ADMIN_*`/`VITE_DIRECTOR_*` dans le code et le modèle de configuration. |
| Critique | Profil administrateur créé automatiquement par le navigateur | Aucun profil ni privilège créé à la connexion. Premier administrateur provisionné avec une identité serveur privilégiée. |
| Critique | Autorisations limitées aux routes et menus | Règles Firestore par collection, refus par défaut, vérification du profil actif à chaque requête. Tests directs de lecture/écriture hors interface. |
| Haute | Désactivation et changement de permissions non pris en compte pendant la session | Écoute du profil en temps réel, refus des profils absents/inactifs et des profils uniquement en cache. |
| Haute | Données conservées entre utilisateurs | État applicatif recréé lorsque l’identité ou les permissions changent, suppression des caches métier dans `localStorage`, cache Firestore en mémoire. Les anciennes bases IndexedDB peuvent subsister sur les appareils ayant utilisé la version précédente : prévoir leur purge lors de la migration. |
| Haute | Toutes les collections chargées, même sans droit de lecture | Chargements conditionnés aux permissions, Finance et présences incluses. Les migrations automatiques de paiements exigent le droit de modification. |
| Haute | Droits de lecture permettant de lancer des écritures | Contrôles au début des mutations, boutons de modification désactivés sur les principales pages, bandeau de lecture seule. Les règles constituent la protection effective contre les appels directs. |
| Haute | Journal attribué par défaut à un faux administrateur et auteur périmé dans une fermeture React | Attribution uniquement à l’utilisateur actif, dépendances React corrigées, nom et rôle vérifiés par les règles. |
| Haute | « Effacer les notifications » supprimait le journal commun | Aucun événement ne peut être modifié ou supprimé par un client, même administrateur. Le statut lu reste local à la session. |
| Haute | Échec Firestore après création Auth laissant un compte orphelin | Instance Auth secondaire en mémoire, nettoyage dans `finally`, suppression compensatoire du compte Auth si le profil échoue et erreur explicite si cette compensation échoue. |
| Haute | Suppression d’un document présentée comme suppression du compte Auth | Désactivation réversible, conservation de l’identité et de l’historique. La suppression Auth définitive reste une opération privilégiée. |
| Haute | Risque de perdre le dernier administrateur | Les administrateurs actifs ne peuvent être désactivés ou rétrogradés depuis l’application, y compris lors d’actions concurrentes. |
| Moyenne | Filtrage des activités confondant deux personnes de même nom | Identifiant UID utilisé pour les options et le filtrage. |
| Moyenne | Dates incompatibles avec Firestore Timestamp | Horodatages serveur et affichage compatible avec les anciennes dates. |
| Moyenne | Erreurs d’exécution et retours trompeurs | Import `useMemo`, notification de gestion des utilisateurs, erreurs de souscription/statut, espaces invalides et bouton de régénération simulée corrigés. |

## Journal serveur

`functions/index.js` contient `auditDocumentWrite`, déclenchée après les créations, modifications et suppressions des collections métier et des utilisateurs. L’auteur provient du contexte d’authentification Firestore, pas du message envoyé par le navigateur. L’identifiant de l’événement rend les reprises idempotentes. Le journal enregistre les noms des champs modifiés, pas leurs valeurs sensibles. Les événements sont asynchrones et peuvent arriver dans le désordre ; leur horodatage correspond à celui de l’événement.

Le tableau de bord distingue les événements serveur et ceux déclarés par l’application. Les notifications de l’application sont utiles, mais ne prouvent pas à elles seules qu’une mutation a eu lieu. Les écritures de profils et leur événement applicatif sont groupées atomiquement. La fonction serveur doit être installée et déployée pour couvrir les mutations effectuées directement via l’API. Les noms/rôles enrichis par la fonction sont ceux disponibles au traitement ; l’UID du contexte reste la référence d’attribution.

L’historique visible est limité aux 100 derniers événements accessibles, clairement indiqué dans l’interface. Le filtre utilisateur porte sur cette fenêtre. Les utilisateurs sans permission `logs` ne consultent que leurs propres événements. Une exploration exhaustive de l’historique nécessiterait une pagination serveur dédiée.

## Rôles et dépendances entre pages

`admin` désigne ici l’administrateur principal, avec compatibilité pour les profils historiques `super_admin`. Tous deux disposent des droits complets. Pour les autres rôles, la matrice enregistrée fait autorité ; une permission absente vaut `none`, et `users` reste réservé à l’administrateur. Les préréglages servent à initialiser la matrice, jamais à accorder silencieusement de nouveaux droits aux comptes existants.

Une page qui joint plusieurs collections a besoin de droits de lecture explicites sur ces données. Par exemple : notes = stagiaires + modules + notes ; présences = personnes + horaires + modules + présence concernée ; salaires = Finance + formateurs + présences formateurs. Une collection non autorisée n’est pas chargée, même si cela rend certains tableaux partiels. La publication d’horaires générés exige `edit` sur `schedule_generation` et `schedules`. Les clôtures d’année, paramètres globaux et sauvegardes sont réservés à l’administrateur.

Les documents Firestore sont lus intégralement : les règles ne masquent pas certains champs d’un document autorisé. Séparer les informations sensibles dans des documents distincts si des droits par champ sont nécessaires.

## Migration avant mise en production

1. Activer Email/Mot de passe dans Firebase Authentication et créer un compte nominatif initial. Les anciens mots de passe partagés ne permettent plus la connexion à cette version.
2. Depuis un environnement privilégié disposant des Application Default Credentials, installer les dépendances en exécutant `npm ci` dans le dossier `functions`, puis, depuis la racine du dépôt, exécuter `node functions/bootstrap-admin.js PROJECT_ID FIREBASE_AUTH_UID`. Le script refuse d’écraser un profil ou d’amorcer un autre administrateur si un administrateur actif existe déjà. Aucun mot de passe par défaut n’est créé.
3. Vérifier les profils existants : UID correspondant à Auth, `isActive` booléen, rôle valide et matrice complète. Révoquer/renouveler les anciens mots de passe partagés qui ont pu être présents dans les anciennes versions compilées.
4. **Migrer les portails `/portal`, `/teacher` et `/results` avant de déployer cet ensemble.** Ils utilisent actuellement des recherches par jeton public. Le repli sur un simple identifiant de document a été supprimé lors du second audit. Les nouvelles règles refusent ces accès anonymes et les mutations applicatives exigent un compte autorisé. Prévoir un échange de jeton validé côté serveur contre une session limitée au formateur/stagiaire, ou des comptes Firebase avec droits par groupe/document. Ne pas réintroduire une règle publique générale pour rétablir les portails. Cette migration des portails n’est pas implémentée ici et constitue un blocage de déploiement.
5. Tester sur un projet de recette les inscriptions secondaires, emails de réinitialisation, changements de mot de passe et le déclencheur serveur. L’envoi réel d’emails et le fonctionnement Cloud Functions n’ont pas été testés dans le projet de production.
6. Après cette recette et la migration des portails, déployer explicitement les règles/index et la fonction avec `firebase deploy --config firebase.rbac.json --only firestore,functions`, puis la version de l’application. Choisir une région de fonction adaptée à la base avant le déploiement. Vérifier les règles réellement publiées : celles actuellement en production n’ont pas été consultées pendant cet audit.

## Vérification reproductible

`npm test` exécute les tests métier, la matrice de permissions et la description des événements serveur. Les tests des règles sont ignorés sans un émulateur local explicitement configuré.

Pour tester les règles avec Firebase CLI :

```powershell
$env:JAVA_TOOL_OPTIONS='-Duser.language=en -Duser.country=US'
$env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8085'
firebase emulators:exec --config firebase.emulators.json --project demo-ipfp-rbac --only firestore 'node --test test/firestoreRules.test.js'
```

Le projet `demo-ipfp-rbac`, le nom d’hôte local et le port sont verrouillés dans les tests. Le compte de remplissage `owner` n’est utilisé que dans l’émulateur. La locale anglaise contourne une erreur de ressources de traduction de l’émulateur Java installé sur ce poste.

Les tests couvrent l’accès anonyme, les profils absents, l’auto-promotion, lecture contre modification, la Finance, l’énumération des utilisateurs, la révocation des permissions, la désactivation, la protection des administrateurs, l’attribution et les dates du journal, son immutabilité et l’atomicité profil/journal.

Vérifications complémentaires : `npm run lint`, `npm run build`, `node --check functions/index.js`, `node --check functions/bootstrap-admin.js`. Le contrôle visuel via le navigateur intégré a été empêché par une erreur de connexion de l’outil ; aucune validation visuelle ni connexion utilisateur réelle n’est revendiquée.

## Références techniques

La séparation entre contrôle d’interface et autorisation serveur suit les [conditions de sécurité Firestore](https://firebase.google.com/docs/firestore/security/rules-conditions). L’instance Auth secondaire utilise la [persistance en mémoire documentée](https://firebase.google.com/docs/auth/web/auth-state-persistence). Le journal serveur utilise les [déclencheurs Firestore avec contexte d’authentification](https://firebase.google.com/docs/functions/firestore-events).

## Résultats de cette exécution

- Compilation Vite/PWA : réussie.
- ESLint : 0 erreur, 41 avertissements restant principalement liés à du code inutilisé et aux hooks existants.
- Suite Node après le second audit et la correction de connexion : 49 tests réussis, 0 échec, 1 groupe de tests émulateur ignoré sans variable locale.
- Exécution séparée des règles Firestore : 7 scénarios réussis (8 tests en comptant leur groupe), incluant les transactions valides et refusées et la modification de son propre nom avec journal atomique.
- Fonction serveur : dépendances installées et verrouillées, contrôle de syntaxe et import du point d’entrée réussis. Déclenchement réel Cloud Functions non testé.
- `git diff --check` : aucune erreur d’espacement restante.

Le second audit conserve le sélecteur d’année sur toutes les pages administratives, conformément à la modification présente dans le dépôt, et l’exclut des pages publiques. Le test vérifie désormais ce comportement et réussit.

## Second audit et connexion par nom d’utilisateur

- Les écritures refusées lèvent une erreur et ne déclenchent plus de faux messages de réussite. Les principaux formulaires concernés conservent leur état en cas d’échec.
- Le changement de semestre attend la confirmation Firestore avant de modifier l’état local.
- La session refuse les changements de permissions uniquement locaux, distingue les profils absents, désactivés ou mal configurés, et borne l’attente de vérification du profil.
- La création et la connexion partagent une conversion unique du nom d’utilisateur vers l’identité Firebase. La liste des utilisateurs affiche l’identifiant à saisir et ne considère plus un profil sans `isActive: true` comme actif.
- Le journal serveur couvre les créations/suppressions de documents vides et masque les identifiants de jetons. Les clients ne peuvent pas réserver les identifiants d’événements serveur.

La procédure de correction d’un compte créé manuellement est dans [Connexion avec un nom d’utilisateur](connexion-utilisateurs.md). Le compte réel signalé n’a pas été inspecté ni modifié dans Firebase ; son UID et son profil doivent encore être vérifiés. Aucun test de connexion avec ses identifiants n’a été effectué.
