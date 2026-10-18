# Gestion EFP

Plateforme de gestion académique pour les écoles et instituts de formation professionnelle.

## Démarrage local

```bash
npm install
npm run dev
```

L’application Vite est disponible par défaut sur `http://localhost:5000`.

## Personnaliser pour un établissement

Copiez `.env.example` vers `.env`, puis renseignez la configuration Firebase et les variables `VITE_INSTITUTION_*` : nom, sigle, logo, portail public, domaine email technique et préfixe des matricules.

Après connexion avec un compte administrateur, la page **Administration → Établissement** permet aussi d’enregistrer le profil dans Firestore (`settings/app`). Le logo peut être une URL HTTPS accessible par les utilisateurs.

Le référentiel académique peut être personnalisé depuis **Modules**. Pour une nouvelle installation qui ne doit pas afficher le catalogue de démarrage existant, définissez `VITE_USE_STARTER_CATALOG=false`, puis créez les niveaux, filières, années et modules de l’établissement.

## Vérification

```bash
npm run lint
npm test
npm run build
```

## Configuration Firebase

Copiez `.env.example` vers `.env`. Les identifiants Firebase peuvent être exposés côté client, mais le fichier `.env` ne doit pas être versionné. Les règles Firestore et les profils utilisateurs restent obligatoires pour protéger les données.

## Déploiement

```bash
npm run build
firebase deploy --only hosting
```
