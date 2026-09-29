# Head Ball

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
git clone https://github.com/charlit/CarlitoSoccer.git ~/HeadBall
```

Puis, à chaque mise à jour :

```bash
cd ~/HeadBall && git pull && docker build -t headball . && docker rm -f headball
```

```bash
docker run -d --name headball --restart unless-stopped -p 8083:80 headball
```

Le jeu répond alors sur le port **8083** du Mac mini. Ajoute la route (par ex. `/headball/`) dans la page « Mes jeux » (conteneur `hub`).
Le jeu n'utilise que des chemins relatifs, il marche donc sous n'importe quel sous-chemin.
