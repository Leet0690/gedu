# Synchronisation du planning formateur

Le portail lit le semestre et l'année opérationnelle de `settings/app` via la callable `getTeacherPortalSettings` en `europe-west1`. Elle vérifie le lien formateur (présences ou notes) et renvoie uniquement ces deux paramètres. Le document privé et les règles Firestore restent inchangés.

Cette lecture est renouvelée avec le chargement automatique du portail. Si elle échoue, le portail propose de réessayer au lieu de présenter des séances calculées avec un ancien semestre local. La date de présence suit le calendrier local, comme les séances du tableau de bord.

Déployer la fonction avant le site :

```powershell
firebase deploy --only functions:getTeacherPortalSettings
npm run build
firebase deploy --only hosting
```
