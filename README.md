# Carlito Soccer

Foot à grosses têtes façon *Head Soccer*, à **2 joueurs sur le même écran**, en style cartoon.
Un seul fichier (`public/index.html`), les visages dans `public/heads/`.

## Contrôles

| | J1 (rouge, attaque à droite) | J2 (bleu, attaque à gauche) |
|---|---|---|
| Bouger | Q / D | ← / → |
| Sauter | Z | ↑ |
| Tirer | S ou Espace | ↓ ou Entrée |

Sur téléphone ou tablette (en paysage) : chacun ses 4 boutons en bas de l'écran.
Match de 60 secondes. Pour renommer un personnage : tableau `HEADS` en haut du script.

## Tester en local

```bash
python -m http.server 8196 --directory public
```

Puis `http://localhost:8196/` (ajoute `?debug` pour l'API de test `window.__hb`, voir `.claude/skills/qa-jeu`).

## Déployer sur le Mac mini

Première fois :

```bash
git clone https://github.com/charlit/CarlitoSoccer.git ~/CarlitoSoccer
```

Puis, à chaque mise à jour :

```bash
cd ~/CarlitoSoccer && git pull && docker build -t carlito-soccer . && docker rm -f carlito-soccer
```

```bash
docker run -d --name carlito-soccer --restart unless-stopped -p 8086:80 carlito-soccer
```

Le jeu répond alors sur le port **8086** du Mac mini (8081, 8082, 8083, 8085 et 8090 sont déjà pris).
Il est publié par la page « Mes jeux » (conteneur `hub`, Caddy) sous
`https://games-carlitos.tail736807.ts.net/carlitosoccer/` : route `handle_path /carlitosoccer/*` vers
`host.docker.internal:8086` dans `~/hub/Caddyfile`, et lien dans `~/hub/site/index.html`.
Le jeu n'utilise que des chemins relatifs, il marche donc sous n'importe quel sous-chemin.
