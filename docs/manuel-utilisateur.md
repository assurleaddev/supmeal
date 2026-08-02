# Manuel Utilisateur — SUPMEAL

## Présentation

SUPMEAL est une application web de gestion de recettes et de planification de repas. Elle permet de créer, organiser et partager des recettes au sein de cookbooks collaboratifs.

---

## 1. Inscription et connexion

### Créer un compte

1. Accédez à l'application → cliquez sur **"S'inscrire"**
2. Renseignez votre **email**, un **nom d'utilisateur** (3-30 caractères alphanumériques) et un **mot de passe** (8 caractères minimum)
3. Cliquez sur **"Créer mon compte"**

### Se connecter

- **Avec email/mot de passe** : Saisissez vos identifiants sur la page de connexion
- **Avec un compte tiers** : Cliquez sur **Google**, **GitHub** ou **Microsoft** pour une connexion OAuth2 sécurisée

---

## 2. Tableau de bord (Accueil)

Le tableau de bord affiche :
- Un **message de bienvenue** avec la date du jour
- Le **menu d'aujourd'hui** (si un planning existe pour cette semaine)
- Des **statistiques** : nombre de recettes, cookbooks, repas planifiés
- Vos **recettes récentes**
- Vos **cookbooks**

---

## 3. Gestion des recettes

### Créer une recette

1. Cliquez sur **"+ Nouvelle recette"** (barre de navigation ou page Recettes)
2. Remplissez les champs :
   - **Titre** (obligatoire)
   - **Description** (optionnelle)
   - **Cookbook** : laissez vide pour une recette personnelle, ou choisissez un cookbook
   - **Temps de préparation** et **temps de cuisson** (en minutes)
   - **Nombre de portions**
   - **URL source** (si la recette vient d'ailleurs)
3. Ajoutez une **photo** (JPG, PNG, WebP — max 5 Mo)
4. Ajoutez les **ingrédients** : nom, quantité, unité, notes
5. Rédigez les **étapes** dans l'ordre
6. Ajoutez des **tags** (catégorie, régime, difficulté, cuisine)
7. Cliquez sur **"Créer la recette"**

### Modifier une recette

Sur la page de détail d'une recette dont vous êtes l'auteur, cliquez sur **"✏️ Modifier"**.

### Mettre en favoris

Cliquez sur l'icône ❤️ sur la carte ou la page de détail d'une recette.

### Planifier un repas

Sur la page de détail, cliquez sur **"📅 Planifier"** pour ajouter la recette à un planning.

### Commenter une recette

Les recettes appartenant à un cookbook partagé peuvent être commentées. Saisissez votre commentaire en bas de la page de détail.

---

## 4. Recherche et filtrage

La page **"Mes recettes"** propose des filtres puissants :

| Filtre | Description |
|---|---|
| **Recherche plein texte** | Titre, ingrédients, tags, description |
| **Cookbook** | Filtrer par cookbook ou recettes personnelles |
| **Temps de préparation** | Maximum en minutes |
| **Temps de cuisson** | Maximum en minutes |
| **Ingrédients** | Séparez plusieurs ingrédients par des virgules |
| **Tags** | Cliquez sur les tags pour les activer/désactiver |
| **Favoris** | Cochez pour n'afficher que vos favoris |

---

## 5. Cookbooks partagés

### Créer un cookbook

1. Page **"Cookbooks"** → **"+ Créer un cookbook"**
2. Donnez un nom et une description optionnelle
3. Vous êtes automatiquement **Créateur**

### Inviter des membres

1. Ouvrez le cookbook → **"📩 Inviter"**
2. Entrez l'email du membre et choisissez son rôle :
   - **Éditeur** : peut ajouter et modifier des recettes
   - **Commentateur** : peut commenter les recettes et chatter
   - **Lecteur** : lecture seule
3. Copiez le **token** généré et envoyez-le au membre

### Rejoindre un cookbook

1. Page **"Cookbooks"** → **"🔗 Rejoindre"**
2. Collez le token reçu → **"Rejoindre"**

### Onglets d'un cookbook

- **🍽 Recettes** : Toutes les recettes du groupe, avec barre de recherche dédiée
- **👥 Membres** : Liste des membres et gestion des rôles (Créateur uniquement)
- **💬 Chat** : Messagerie instantanée du groupe (temps réel)

---

## 6. Planning de repas

### Créer un planning

1. Page **"Planning"** → **"Créer le planning de la semaine"**
2. La semaine en cours est automatiquement sélectionnée

### Ajouter une recette au planning

- Cliquez sur **"+"** dans une case du calendrier (jour × repas)
- Recherchez et sélectionnez une recette
- Confirmez

ou depuis une page de détail de recette : **"📅 Planifier"**

### Générer la liste de courses

Une fois votre planning créé, cliquez sur **"🛒 Liste de courses"** pour obtenir la liste agrégée de tous les ingrédients de la semaine, avec les quantités totales.

### Naviguer entre les semaines

Utilisez les boutons **← Semaine précédente** et **Semaine suivante →**.

---

## 7. Import / Export

Page accessible via le menu utilisateur → **"Import / Export"**

### Exporter

1. Choisissez le format : **JSON** (complet, compatible Mealie) ou **CSV** (tableur)
2. Cliquez sur **"Exporter"** pour télécharger le fichier
3. ⚠️ Le fichier contient toutes vos données en clair — conservez-le en lieu sûr

### Importer

1. Cliquez sur la zone d'import et sélectionnez un fichier **.json** ou **.csv**
2. Confirmez l'avertissement
3. Le rapport d'import affiche le nombre de recettes et cookbooks créés, ainsi que les éventuelles erreurs

**Formats acceptés :**
- JSON SUPMEAL (export de cette application)
- JSON compatible Mealie
- CSV avec colonnes : `cookbook, title, description, prepTime, cookTime, portions, sourceUrl, tags, ingredients, steps`

---

## 8. Paramètres

Page accessible via le menu utilisateur → **"Paramètres"**

### Profil

Modifiez votre nom d'utilisateur.

### Mot de passe

Changez votre mot de passe en renseignant l'ancien puis le nouveau.

### Préférences culinaires

Définissez vos préférences pour personnaliser l'expérience :
- **Régime alimentaire** : végétarien, vegan, sans gluten, etc.
- **Allergies** : gluten, arachides, lactose, etc.
- **Cuisines préférées** : française, italienne, japonaise, etc.
- **Portions par défaut** : nombre de personnes pour les nouvelles recettes

### Comptes liés (OAuth2)

Associez ou dissociez des comptes Google, GitHub ou Microsoft à votre profil.
