# IPFP Manager

Application de gestion academique de l'Institut Polytechnique de la Formation Professionnelle.

## Demarrage local

```bash
npm install
npm run dev
```

L'application Vite est disponible par defaut sur `http://localhost:5000`.

## Verification

```bash
npm run build
npm run lint
```

## Lectures Firestore

Le chargement par page, le cache en mémoire et les modalités d'actualisation sont décrits dans [le guide de réduction des lectures](docs/firestore-reads.md).

## Configuration Firebase

Copier `.env.example` vers `.env`, puis renseigner les variables locales. Le fichier `.env` contient des identifiants sensibles et ne doit pas etre versionne.

## Deploiement

```bash
npm run build
firebase deploy --only hosting
```

Firebase Hosting publie la build `dist` sur les sites configures dans `firebase.json`.
