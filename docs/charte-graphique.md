# Charte graphique — SUPMEAL

Ce document décrit l'identité visuelle de SUPMEAL et les règles qui la rendent reproductible. Les
valeurs qui y figurent ne sont pas déclaratives : elles sont celles de
[`client/src/theme.ts`](../client/src/theme.ts), source unique du thème Material UI de
l'application. Toute évolution de la charte passe par ce fichier.

---

## 1. Positionnement

SUPMEAL est un outil de travail quotidien, utilisé les mains occupées, souvent debout dans une
cuisine, parfois sur téléphone. Trois partis pris en découlent :

| Parti pris | Conséquence visuelle |
|---|---|
| **Lisible d'un coup d'œil** | Contrastes francs, titres denses, aucun texte gris clair sur fond clair. |
| **Sobre, pas décoratif** | La couleur signale (état, action, catégorie) ; elle n'habille pas. |
| **La recette d'abord** | La photo et le titre dominent ; l'interface s'efface autour. |

Registre de langue : **vouvoiement, ton direct, sans jargon**. « Créer mon compte », pas
« Rejoignez l'aventure ».

---

## 2. Logo

L'identifiant visuel est un **monogramme** : la lettre `S` en blanc, poids 800, centrée dans un carré
à coins arrondis rempli de la couleur primaire.

| Propriété | Valeur |
|---|---|
| Fond | `#16a34a` (vert primaire) |
| Lettre | `#ffffff`, poids 800 |
| Rayon d'angle | 22 % du côté |
| Taille minimale | 24 px de côté |
| Zone de respiration | ≥ 25 % du côté sur les quatre bords |

Déclinaisons :

- **Favicon** — [`client/public/favicon.svg`](../client/public/favicon.svg)
- **En-tête applicatif** — carré 36 px, ombre portée `0 2px 10px rgba(22,163,74,0.30)`
- **Monochrome** — sur fond coloré ou photo, carré blanc et lettre `#16a34a`

Le monogramme ne doit pas être déformé, ré-incliné, ni recoloré hors des deux déclinaisons ci-dessus.

---

## 3. Palette

### 3.1 Couleurs de marque

| Rôle | Jeton | Valeur | Emploi |
|---|---|---|---|
| Primaire | `primary.main` | `#16a34a` | Actions principales, état actif, accent de marque |
| Primaire claire | `primary.light` | `#4ade80` | Survol, bordures d'accent |
| Primaire sombre | `primary.dark` | `#15803d` | Pression, texte sur fond très clair |
| Primaire ténue | `primary.50` | `#f0fdf4` | Fonds de sélection, puces |
| Secondaire | `secondary.main` | `#ea580c` | Temps de cuisson, planification, second accent |
| Secondaire claire | `secondary.light` | `#fb923c` | Survol du secondaire |
| Secondaire sombre | `secondary.dark` | `#c2410c` | Pression du secondaire |

Le vert porte l'identité et tout ce qui relève du **faire** ; l'orange, tout ce qui relève du
**temps** — cuisson, planning, échéances. Cette séparation doit rester lisible : ne pas employer
l'orange pour une action neutre.

### 3.2 Neutres

| Jeton | Valeur | Emploi |
|---|---|---|
| `grey.50` | `#f8fafc` | Fond d'application |
| `grey.100` | `#f1f5f9` | Fond de survol discret |
| `grey.200` | `#e2e8f0` | Bordures, séparateurs (`divider`) |
| `grey.300` | `#cbd5e1` | Bordures de champs au repos |
| `grey.400` | `#94a3b8` | Texte désactivé |
| `grey.500` | `#64748b` | Texte secondaire (`text.secondary`) |
| `grey.600` | `#475569` | Texte courant sur fond clair |
| `grey.700` | `#334155` | Texte appuyé |
| `grey.800` | `#1e293b` | Texte principal (`text.primary`) |
| `grey.900` | `#0f172a` | Titres de la page publique |

Fonds : `background.default` = `#f8fafc`, `background.paper` = `#ffffff`.

### 3.3 Contraste

Le texte principal `#1e293b` sur fond blanc atteint un rapport d'environ **13:1**, le texte
secondaire `#64748b` environ **5,3:1** — au-delà du seuil AA de 4,5:1.

Deux règles à respecter :

- Ne jamais descendre sous `grey.500` pour du texte porteur d'information. `grey.400` est réservé aux
  états désactivés.
- Le vert `#16a34a` sur blanc donne environ 3,1:1 : **acceptable pour du texte large ou un élément
  graphique, insuffisant pour du corps de texte**. Employer `primary.dark` lorsqu'il faut écrire en
  vert.

---

## 4. Typographie

Famille : **Inter**, avec repli `Roboto`, `Helvetica`, `Arial`, `sans-serif`.

| Niveau | Poids | Interlettrage | Emploi |
|---|:---:|---|---|
| `h1` | 700 | `-0.02em` | Titre unique de page |
| `h2` | 700 | `-0.01em` | Titre de section |
| `h3` | 600 | `-0.01em` | Sous-section |
| `h4` – `h6` | 600 | — | Titres de blocs et de cartes |
| `body1` | 400 | — | Corps de texte, interligne 1,6 |
| `body2` | 400 | — | Texte secondaire, légendes |
| `caption` | 400–500 | — | Métadonnées : durées, portions, rôles |

Les titres serrent l'interlettrage à mesure qu'ils grossissent : c'est ce qui leur donne leur densité.
L'interligne de 1,6 sur le corps de texte est un minimum — les étapes d'une recette se lisent en
cuisine, souvent de loin.

**Un seul `<h1>` par page.** Il porte le sujet de la page, pas le nom de l'application.

---

## 5. Formes, espacement, profondeur

### 5.1 Rayons d'angle

| Élément | Rayon |
|---|---|
| Base du thème | `10 px` |
| Bouton | `8 px` |
| Champ de saisie | `6 px` |
| Carte, panneau, boîte de dialogue | `12 px` |
| Puce (`Chip`) | `pill` |

### 5.2 Espacement

Unité de base **8 px**. Les écarts suivent l'échelle MUI (`1` = 8 px) : `1`, `1.5`, `2`, `3`, `4`.

| Contexte | Écart |
|---|---|
| Entre libellé et champ | `1` |
| Entre champs d'un même bloc | `2` |
| Padding interne d'une carte | `3` |
| Entre sections d'une page | `3` à `4` |
| Sections de la page publique | `10` à `14` |

### 5.3 Profondeur

L'application n'emploie **pas** les ombres MUI par défaut. La hiérarchie repose sur la bordure
`1px solid #e2e8f0` et les fonds. Deux exceptions :

- Bouton primaire — `0 2px 10px rgba(22,163,74,0.25)`
- Barre de navigation — `0 1px 0 0 #e2e8f0`, c'est-à-dire un simple filet

---

## 6. Composants

### 6.1 Boutons

| Variante | Emploi | Apparence |
|---|---|---|
| `contained` primaire | Action principale, une seule par écran | Fond `#16a34a`, texte blanc, poids 600 |
| `outlined` | Action secondaire | Bordure `divider`, texte `text.secondary` |
| `text` | Action tertiaire, navigation | Sans fond ni bordure |
| `contained` `error` | Action destructrice | Fond rouge, toujours précédée d'une confirmation |

Les libellés sont des **verbes à l'infinitif ou à la première personne** : « Créer la recette »,
« Ajouter un ingrédient », « Créer mon compte ». Jamais en majuscules forcées.

### 6.2 États

Tout écran qui charge des données doit prévoir les quatre états :

| État | Traitement |
|---|---|
| Chargement | Squelettes de la forme du contenu attendu, pas de *spinner* centré |
| Vide | Icône, phrase explicative, et l'action qui permet de sortir de l'état vide |
| Erreur | Message en clair et moyen de réessayer — jamais « Erreur » seul |
| Rempli | Contenu |

### 6.3 Retours utilisateur

Notifications via `react-hot-toast` : succès en vert, erreur en rouge, en haut de l'écran, 4 s.
Une action destructrice demande une confirmation explicite ; un export demande une reconnaissance
d'avertissement.

---

## 7. Iconographie

`@mui/icons-material`, style **outlined**, dans l'application authentifiée.

| Taille | Emploi |
|---|---|
| 14–16 px | Dans un texte, une puce |
| 18–20 px | Bouton-icône, élément de liste |
| 24 px | Navigation |
| 48 px+ | État vide |

Une icône seule n'est jamais suffisante : tout bouton-icône porte un `aria-label` explicite.

Correspondances stables, à ne pas permuter :

| Notion | Icône |
|---|---|
| Recette | `RestaurantMenu` |
| Cookbook | `CollectionsBookmark` / `MenuBook` |
| Planning | `CalendarMonth` / `EventNote` |
| Favori | `Favorite` |
| Recherche | `Search` |
| Liste de courses | `ShoppingCart` |
| Import / export | `CloudUpload` / `Download` |

---

## 8. Mise en page et réactivité

Points de rupture MUI : `xs` 0, `sm` 600, `md` 900, `lg` 1200.

| Plage | Navigation | Grilles |
|---|---|---|
| `xs` – `sm` | Barre inférieure fixe, avec zone de sécurité iOS | Une colonne |
| `md` | Barre latérale | Deux colonnes |
| `lg` et au-delà | Barre latérale, contenu limité à `lg` | Trois à quatre colonnes |

Deux règles de fond :

- **Rien ne dépasse horizontalement.** Un contenu large — la grille de planning à sept colonnes —
  défile dans son propre conteneur, il n'est jamais rogné.
- **Aucune action réservée au survol.** Une commande visible seulement au `:hover` est inatteignable
  au doigt comme au clavier. Sur écran tactile elle est pleinement visible ; ailleurs elle peut être
  atténuée, jamais masquée, et doit répondre à `:focus-visible`.

---

## 9. Accessibilité

| Exigence | Application |
|---|---|
| Contraste | AA minimum sur tout texte porteur d'information (§3.3) |
| Structure | Un `<h1>` par page, hiérarchie de titres continue |
| Boutons-icônes | `aria-label` systématique |
| Images | `alt` décrivant le contenu, ou `alt=""` si purement décoratif |
| Clavier | Tout parcours réalisable sans souris, focus visible |
| Formulaires | Libellé lié au champ, erreur annoncée sous le champ concerné |
| Décoratif | `aria-hidden="true"` sur les éléments purement visuels |

---

## 10. Ce qui a été écarté

Consigner les refus évite de les rejouer :

- **Mode sombre** — non implémenté. Le thème n'expose qu'une palette claire ; l'ajouter demanderait
  de dupliquer chaque jeton et de revérifier tous les contrastes.
- **Second système de style** — Tailwind a été employé un temps pour un composant, puis retiré. MUI
  est le seul système. Un fragment stylé autrement est un écart, pas une variante.
- **Illustrations et photos d'ambiance** — les seules images de l'interface sont les photos de
  recettes téléversées par les utilisateurs. Aucune image distante n'est chargée.
- **Animations d'entrée dans l'application authentifiée** — réservées à la page publique. Un outil
  utilisé plusieurs fois par jour ne doit pas faire attendre.
