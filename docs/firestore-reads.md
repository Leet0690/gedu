# Réduction des lectures Firestore

## Comportement de l'application

- Les collections métier sont chargées selon la page, dans `src/utils/dataRequirements.js`. Les permissions continuent de filtrer chaque chargement.
- Les données déjà chargées sont réutilisées en mémoire pendant cinq minutes. Après ce délai, le prochain chargement demandé par une page interroge à nouveau Firestore. Aucun minuteur ne déclenche de lectures en arrière-plan.
- Les appels simultanés pour la même ressource partagent leur travail, y compris au montage en React Strict Mode. Les requêtes Firestore identiques en cours sont également regroupées.
- Les mutations continuent de mettre à jour l'état local après leur réussite. Revenir sur une page dans les cinq minutes ne réapplique pas une ancienne copie des données.
- Le bouton **Actualiser les données** dans la barre supérieure recharge les données utilisées par la page. Il permet de consulter immédiatement les changements effectués sur un autre poste. Un rechargement complet du navigateur recharge aussi les données.
- Un mois de présences déjà chargé permet d'éviter une nouvelle lecture de ses journées ou séances. Les pages mensuelles ne forcent plus une lecture à chaque montage.
- Les activités sont consultées sur l'accueil, avec une limite de 50 événements et le même délai de réutilisation. Les nouvelles activités du poste courant sont ajoutées localement. Les événements des autres postes apparaissent à la prochaine actualisation.
- Les formations continues sont chargées seulement sur leur page. Les finances restent chargées à la demande. Les anciens paiements sont normalisés en mémoire, sans migration automatique à l'ouverture de Finance.
- Les portails recherchent au maximum un profil par jeton. Le portail de présence des formateurs ne charge plus les notes. Les filières en double sont éliminées avant les requêtes.

## Isolation et fraîcheur

Le cache appartient à l'instance de l'application : un changement de compte, de rôle ou de permissions remonte le fournisseur de données et abandonne le cache précédent. Les portails ont une portée distincte par URL. Aucune donnée personnelle supplémentaire n'est persistée dans le navigateur.

Les profils d'authentification, les paramètres académiques et la liste de gestion des utilisateurs conservent leurs écoutes en temps réel. Une modification de `lastLogin` ne recrée plus la fonction de contrôle des permissions et ne relance donc plus les chargements métier.

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

Le plan gratuit Firestore Standard inclut **50 000 lectures de documents par jour**. Ce quota est partagé par les clients du projet. Les règles utilisant `get()` peuvent aussi occasionner des lectures, et une requête vide a un coût minimal. Un cache IndexedDB seul ne supprime pas les lectures serveur de `getDocs()`.

Sources : [tarification Firestore](https://firebase.google.com/docs/firestore/pricing), [cache et accès hors ligne](https://firebase.google.com/docs/firestore/manage-data/enable-offline).

## Vérification en exploitation

1. Consulter l'onglet **Usage** de Firestore dans Firebase avant et après publication, sur des journées de fréquentation comparable.
2. Vérifier les lectures lors d'un accès direct à Modules, puis de navigations répétées dans les cinq minutes.
3. Depuis deux sessions, modifier une donnée sur la première et utiliser **Actualiser les données** sur la seconde.
4. Contrôler séparément le volume des clôtures annuelles et des sauvegardes.

Ces optimisations réduisent les lectures évitables ; elles ne garantissent pas le respect du quota pour un nombre arbitraire de documents, de visiteurs ou de rechargements. Aucune mesure de consommation de production n'a été réalisée dans cette modification.
