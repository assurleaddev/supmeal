# Captures d'écran

Les emplacements attendus sont signalés dans le manuel utilisateur par `[Capture : …]`.

Ces images ne peuvent être produites qu'en exécutant l'application :

```bash
docker compose up -d
docker compose exec server npm run db:seed   # jeu de données de démonstration
```

Les captures d'OAuth2 exigent en plus des identifiants de fournisseur, qui ne figurent
volontairement pas dans le rendu (voir la documentation technique, §2).

Convention de nommage : `NN-ecran.png`, par exemple `01-connexion.png`.
