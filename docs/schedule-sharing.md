# Partage des emplois du temps sans Cloud Functions

Le partage utilise Firestore et fonctionne avec le forfait Spark, dans ses quotas gratuits. Aucun appel Cloud Functions ni passage à Blaze n’est nécessaire.

Le bouton « Lien Stagiaire » publie une copie du planning sélectionné, puis copie un lien aléatoire `/schedule-view/<token>`. Le lien reste identique pour le même diplôme, groupe, année académique et semestre. Après modification du planning, recliquer sur le bouton pour publier la nouvelle version. Un planning vidé peut également être republié pour retirer les anciennes séances. Le stagiaire consulte la version publiée sans connexion, en lecture seule, et peut télécharger un PNG ou un PDF. La page indique la date de publication.

Les publications contiennent uniquement les informations de groupe, jour, horaire, type, modules, salle et nom du formateur. Aucun dossier stagiaire, note, coordonnées ou données financières n’est copié. La publication du document et de ses séances est atomique. La limite de 200 séances permet de supprimer et remplacer la version précédente dans un seul lot Firestore.

## Règles d’accès

- `schedule_share_scopes` : index privé associant le groupe à son token, accessible aux comptes actifs disposant du droit de consultation des emplois du temps.
- `public_schedules/<token>` : lecture directe par lien autorisée, énumération interdite.
- `public_schedules/<token>/sessions` : lecture limitée au lien connu ; seuls les comptes autorisés peuvent publier. Les règles refusent les champs non prévus.
- Supprimer le document parent révoque la consultation, y compris celle de ses séances. La prochaine publication du même groupe réactive son lien.

Le bloc de règles est conservé dans `scripts/schedule-sharing.rules.txt` et intégré à `firestore.rules`. Le générateur de compatibilité des anciens portails le reprend. Lors d’un déploiement, conserver les autres règles actives : ne pas remplacer les règles de compatibilité par les règles strictes sans migration des portails existants.

## Utilisation locale

```powershell
npm run dev -- --host 127.0.0.1 --port 5000
```

L’application locale utilise le Firestore configuré. Les règles de partage doivent être publiées sur ce projet. Un lien en `127.0.0.1` est consultable sur cet ordinateur uniquement ; pour transmettre le lien aux stagiaires, utiliser l’application hébergée une fois cette version du site déployée.

## Vérification

```powershell
npm test
npm run build
firebase emulators:exec --only firestore --config firebase.emulators.json --project demo-ipfp-rbac "node --test --test-concurrency=1 test/firestoreRules.test.js test/schedulePublicationRules.test.js"
```

Les tests couvrent les modules S1/S2, les champs publiés, la création du lien, sa réutilisation, la mise à jour, le planning vide, les accès anonymes, les refus d’écriture, la révocation et les règles RBAC existantes.
