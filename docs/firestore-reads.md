# Réduction des lectures Firestore

## Comportement de l'application

- Les collections métier sont chargées selon la page, dans `src/utils/dataRequirements.js`. Les permissions continuent de filtrer chaque chargement.
- Les données déjà chargées sont réutilisées en mémoire avec un délai adapté à leur nature : 60 minutes pour le catalogue des modules et Finance, 30 minutes pour les données administratives, et 15 minutes pour les présences. Une vérification légère toutes les 15 minutes réévalue uniquement les ressources expirées. La navigation réutilise également les données encore fraîches.
- Le cache local Firestore est persistant et partagé entre les onglets via IndexedDB. Une navigation ou un rechargement peut donc réutiliser les documents déjà reçus sans nouvelle lecture serveur ; les requêtes forcées et les lectures de serveur restent explicites quand l'application en a besoin.
- Les appels simultanés pour la même ressource partagent leur travail, y compris au montage en React Strict Mode. Les requêtes Firestore identiques en cours sont également regroupées.
- Les mutations continuent de mettre à jour l'état local après leur réussite. Revenir sur une page avant l'expiration du délai propre à la ressource ne réapplique pas une ancienne copie des données.
- L'actualisation est automatique pour les écrans administratifs, sans masquer les données pendant leur rechargement. Elle est suspendue lorsque l'onglet est masqué, hors ligne ou sur un portail public. Au retour sur l'application ou au rétablissement de la connexion, la vérification reprend si 15 minutes se sont écoulées depuis la précédente. Un rechargement complet du navigateur recharge aussi les données.
- Un mois de présences déjà chargé permet d'éviter une nouvelle lecture de ses journées ou séances. Les pages mensuelles ne forcent plus une lecture à chaque montage.
- Les activités sont consultées sur l'accueil par lots ponctuels de 50 événements maximum, à l'ouverture puis lors du contrôle périodique. Les nouvelles activités du poste courant sont ajoutées localement ; elles n'imposent pas une lecture temps réel aux autres sessions.
- La gestion des utilisateurs ne maintient plus une écoute de toute la collection : elle lit 50 comptes à la fois avec `orderBy('displayName')`, `limit()` et `startAfter()`. Les boutons Précédent/Suivant réutilisent les curseurs déjà obtenus ; une mutation recharge uniquement la page courante.
- Les formations continues sont chargées seulement sur leur page. Les finances restent chargées à la demande. Les anciens paiements sont normalisés en mémoire, sans migration automatique à l'ouverture de Finance.
- Les portails recherchent au maximum un profil par jeton. Le portail de présence des formateurs ne charge plus les notes. Les filières en double sont éliminées avant les requêtes.

## Isolation et fraîcheur

Le cache applicatif appartient à l'instance de l'application : un changement de compte, de rôle ou de permissions remonte le fournisseur de données et abandonne l'état métier précédent. Firestore utilise maintenant IndexedDB avec partage entre onglets pour éviter de relire les documents déjà reçus ; les données peuvent donc rester sur le navigateur après fermeture. Utiliser l'application sur un appareil de confiance et effacer les données du site sur un poste partagé. Les portails ont une portée distincte par URL.

Les profils d'authentification et les paramètres académiques conservent leurs écoutes en temps réel. La liste de gestion des utilisateurs est maintenant paginée en lectures ponctuelles ; ses filtres et sa recherche s'appliquent à la page chargée. Une modification de `lastLogin` ne recrée plus la fonction de contrôle des permissions et ne relance donc plus les chargements métier.

Les transactions financières, les contrôles serveur de gestion des comptes, la lecture préalable à une suppression globale et la vérification des sauvegardes de clôture restent des opérations serveur. Elles doivent travailler sur des données à jour.

## Effet attendu

Nombre de collections métier initiales pour un administrateur, hors profil, paramètres, journaux et présences :

| Accès direct | Avant | Après |
| --- | ---: | ---: |
| Modules | 9 | 1 |
| Gestion des utilisateurs / journaux | 9 | 0 |
| Tableau de bord | 9 | 5 |
| Formations continues | 9 | 5 |
| Finance, y compris ses 3 collections dédiées | 12 | 5 |

Une collection peut contenir beaucoup de documents : ces nombres ne représentent pas un nombre de lectures facturées. Les vues qui calculent des statistiques globales et les exports complets chargent encore les collections nécessaires en entier. L'historique financier n'est pas tronqué.

La pagination serveur est déployée sur la gestion des utilisateurs. Les tableaux Finance et les rapports utilisent encore leurs collections complètes pour calculer les soldes, arriérés et totaux historiques ; ils n'ont pas été limités artificiellement afin de ne pas produire de totaux incomplets.

Le plan gratuit Firestore Standard inclut **50 000 lectures de documents par jour**. Ce quota est partagé par les clients du projet. Les règles utilisant `get()` peuvent aussi occasionner des lectures, et une requête vide a un coût minimal. Un cache IndexedDB seul ne supprime pas les lectures serveur de `getDocs()`.

Sources : [tarification Firestore](https://firebase.google.com/docs/firestore/pricing), [cache et accès hors ligne](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Vérification en exploitation

1. Consulter l'onglet **Usage** de Firestore dans Firebase avant et après publication, sur des journées de fréquentation comparable.
2. Vérifier les lectures lors d'un accès direct à Modules, puis de navigations répétées pendant une heure et d'un changement de page après expiration du délai correspondant.
3. Ouvrir Gestion des utilisateurs et vérifier qu'une page ne lit jamais plus de 50 documents ; parcourir deux pages pour mesurer deux lots de lectures ponctuels.
4. Depuis deux sessions, modifier une donnée sur la première et attendre une vérification automatique après expiration du cache sur la seconde. Vérifier aussi la reprise après un passage de l'onglet en arrière-plan.
5. Contrôler séparément le volume des clôtures annuelles et des sauvegardes.

Ces optimisations réduisent les lectures évitables ; elles ne garantissent pas le respect du quota pour un nombre arbitraire de documents, de visiteurs ou de rechargements. Aucune mesure de consommation de production n'a été réalisée dans cette modification.
