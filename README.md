# Carlito Soccer

Foot à grosses têtes façon *Head Soccer*, en style cartoon. Trois façons de jouer :

- **Contre l'IA** : facile, moyen ou difficile, l'IA joue toujours **Le Boss** (personnage réservé à l'IA) ;
- **2 joueurs sur le même écran** (clavier ou un téléphone/tablette partagé) ;
- **En ligne** : on attend qu'un autre joueur choisisse « En ligne », la partie démarre toute seule.
  L'accueil affiche quand quelqu'un attend déjà (« EN LIGNE · 1 JOUEUR ATTEND ! » avec sa tête).

Le jeu tient dans `public/index.html`, les visages dans `public/heads/`. `server.js` sert le jeu et met en relation
les joueurs en ligne (WebSocket).

## Contrôles

**Au doigt (téléphone en paysage)**, comme dans Carlito Fighter : le pouce posé devient un joystick invisible,
et deux boutons **SAUT** et **TIR** sont affichés.

| | Solo / en ligne | 2 joueurs même écran |
|---|---|---|
| Courir | pouce gauche : glisser ◀ ▶ | glisser ◀ ▶ dans sa moitié d'écran |
| Sauter | bouton SAUT (ou glisser le pouce vers le haut) | bouton SAUT de sa moitié (ou glisser vers le haut) |
| Tirer | bouton TIR, en bas à droite | bouton TIR de sa moitié, vers le centre |

**Au clavier** :

| | J1 (rouge, attaque à droite) | J2 (bleu, attaque à gauche) |
|---|---|---|
| Bouger | Q / D | ← / → |
| Sauter | Z | ↑ |
| Tirer | S ou Espace | ↓ ou Entrée |

En solo et en ligne, les deux jeux de touches marchent. Échap = retour au menu.
**Super coup de Maxou** : Maxou est le seul à avoir une jauge (sous le score). Chaque touche de balle la remplit ;
quand elle est pleine, son prochain tir ou sa prochaine tête part en feu, tout droit dans le but, en traversant les joueurs.

Match de 60 secondes. Pour renommer un personnage : tableau `HEADS` en haut du script.

## Tester en local

```bash
npm install
```

```bash
PORT=8196 node server.js
```

Puis `http://localhost:8196/` (ajoute `?debug` pour l'API de test `window.__hb`, voir `.claude/skills/qa-jeu`).
Pour tester le mode en ligne, ouvre le jeu dans deux onglets et choisis « En ligne » dans les deux.

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
docker run -d --name carlito-soccer --restart unless-stopped -p 8086:8080 carlito-soccer
```

Le jeu répond alors sur le port **8086** du Mac mini (8081, 8082, 8083, 8085 et 8090 sont déjà pris).
Il est publié par la page « Mes jeux » (conteneur `hub`, Caddy) sous
`https://games-carlitos.tail736807.ts.net/carlitosoccer/` : route `handle_path /carlitosoccer/*` vers
`host.docker.internal:8086` dans `~/hub/Caddyfile`, et lien dans `~/hub/site/index.html`.
Le jeu n'utilise que des chemins relatifs (y compris le WebSocket `…/carlitosoccer/ws`, que Caddy relaie tout seul),
il marche donc sous n'importe quel sous-chemin.
