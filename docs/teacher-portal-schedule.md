# Synchronisation du planning formateur

Le portail lit le semestre et l'année opérationnelle depuis `public_settings/schedule`. Ce document contient uniquement ces deux paramètres. `settings/app` reste privé. Les règles autorisent sa lecture directe et réservent sa mise à jour aux administrateurs, en interdisant les champs supplémentaires et l'énumération.

Les administrateurs synchronisent cette publication depuis les paramètres privés. Un changement de semestre met les deux documents à jour dans une transaction. Le déploiement doit initialiser la publication à partir de `settings/app` avant de publier le site.

Cette lecture est renouvelée avec le chargement automatique du portail. Si elle échoue, le portail propose de réessayer au lieu de présenter des séances calculées avec un ancien semestre local. La date de présence suit le calendrier local, comme les séances du tableau de bord.

Déployer les règles et le site (aucune Cloud Function ni forfait Blaze requis) :

```powershell
firebase deploy --only firestore:rules
npm run build
firebase deploy --only hosting
```
