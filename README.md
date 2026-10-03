# Carlito Soccer

Foot à grosses têtes façon *Head Soccer*, en style cartoon. Trois façons de jouer :

- **Contre l'IA** : facile, moyen ou difficile, l'IA joue toujours **Le Boss** (personnage réservé à l'IA) ;
- **2 joueurs sur le même écran** (clavier ou un téléphone/tablette partagé) ;
- **En ligne** : on attend qu'un autre joueur choisisse « En ligne », la partie démarre toute seule.
  L'accueil affiche quand quelqu'un attend déjà (« EN LIGNE · 1 JOUEUR ATTEND ! » avec sa tête).

Le jeu tient dans `public/index.html`, les visages dans `public/heads/`. `server.js` sert le jeu et met en relation
les joueurs en ligne (WebSocket).

## Contrôles

**Au doigt (téléphone en paysage), sans aucun bouton**, façon Brawl Stars : le pouce posé devient un joystick invisible.

| | Solo / en ligne | 2 joueurs même écran |
|---|---|---|
| Courir | pouce gauche : glisser ◀ ▶ | glisser ◀ ▶ dans sa moitié d'écran |
| Sauter | glisser vers le haut (n'importe quel pouce) | glisser vers le haut |
| Tirer | taper à droite (ou taper à gauche) | taper, ou poser un 2e doigt |

**Au clavier** :

| | J1 (rouge, attaque à droite) | J2 (bleu, attaque à gauche) |
|---|---|---|
| Bouger | Q / D | ← / → |
| Sauter | Z | ↑ |
| Tirer | S ou Espace | ↓ ou Entrée |

En solo et en ligne, les deux jeux de touches marchent. Échap = retour au menu.
**Super coup de Maxou** : Maxou est le seul à avoir une jauge (sous le score). Chaque touche de balle la remplit ;
quand elle est pleine, son prochain tir ou sa prochaine tête part en feu, tout droit dans le but, en traversant les joueurs.

**Tirs** : le tir change selon ce que tu fais au moment de frapper — en courant vers le but : **missile** tendu ;
en reculant : **lob** ; en l'air : **volée**. La balle prend de l'effet (sa trajectoire se courbe) et frapper au bon moment
donne plus de puissance.

**Poteaux et vent** : le haut des poteaux renvoie la balle (« POTEAU ! »). À chaque match, un vent différent
(affiché en haut à gauche) pousse la balle quand elle est en l'air.

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

## Déploiement automatique (à chaque push GitHub)

Le script [`deploy/watch-deploy.sh`](deploy/watch-deploy.sh) regarde GitHub et, s'il y a un nouveau commit, reconstruit
l'image et remplace le conteneur (si la construction échoue, l'ancienne version reste en ligne). À installer une fois
sur le Mac mini :

```bash
chmod +x ~/CarlitoSoccer/deploy/watch-deploy.sh && (crontab -l 2>/dev/null; echo "*/5 * * * * /bin/bash $HOME/CarlitoSoccer/deploy/watch-deploy.sh") | crontab -
```

Ensuite chaque push sur `main` est en ligne dans les 5 minutes. Journal : `~/CarlitoSoccer/deploy/watch-deploy.log`.
Ne fais plus de `git pull` à la main dans ce dossier, le script s'en charge.

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
