---
name: qa-jeu
description: QA de Carlito Soccer (le jeu de foot à grosses têtes de ce repo : contre l'IA à 3 niveaux, à 2 sur le même écran, ou en ligne) — lance la suite de tests automatisés (menu, sélection des têtes, physique, buts, barre, fin de match, niveaux d'IA, tactile sans boutons façon Brawl Stars, mode en ligne hôte/invité) via le mode ?debug, vérifie le rendu desktop et mobile paysage, puis corrige et re-teste. Utiliser quand on demande « qa », « teste le jeu », « vérifie que ça marche », ou après toute modification de public/index.html ou server.js.
---

# QA Carlito Soccer

- `public/index.html` : tout le jeu (canvas 960×540, rendu à la densité de l'écran). Visages dans `public/heads/p1.png` … `p6.png`,
  liste et noms dans le tableau `HEADS`.
- `server.js` : sert le jeu **et** fait la mise en relation en ligne (WebSocket sur `…/ws`, dépendance `ws`).
  Le 1er joueur qui cherche attend ; le 2e lance la partie. L'hôte (role 0, J1 rouge) fait tourner la partie et envoie
  l'état à chaque image ; l'invité (role 1, J2 bleu) n'envoie que ses commandes.

La QA teste le jeu **image par image** grâce au mode `?debug`. Le panneau navigateur est souvent masqué, et
`requestAnimationFrame` y est alors en pause : un écran figé n'est pas forcément un bug. On pilote avec `window.__hb`.

## 1. Lancer le jeu

- `npm install` une fois (installe `ws`), puis `preview_start` `{ name: "carlito-soccer" }` : la config dans
  `C:\Users\lesma\Github\.claude\launch.json` lance `node CarlitoSoccer/server.js` sur le port 8196.
  Hors de cette machine : `PORT=8196 node server.js`. **Pas de `python -m http.server`** : il n'a pas de WebSocket.
- Ouvre `http://localhost:8196/?debug&v=<valeur unique>`, vérifie `read_console_messages` (aucune erreur).
  **Change `v` à chaque rechargement après une modification.** Après une modification de `server.js`, redémarre la preview.
- **Si le panneau est masqué**, le canvas fait 0 × 0 et les tests tactiles échouent : `resize_window` 960×540 avant la suite.

## 2. API de debug (`window.__hb`, seulement avec `?debug`)

| Appel | Effet |
|---|---|
| `start(a, b, { mode, ai })` | Match direct, J1 tête `a`, J2 tête `b` (0 à 4). `mode` : `local` (défaut), `ai`, `online`. `ai: [niveau J1, niveau J2]` (0 facile, 1 moyen, 2 difficile, `null` = humain) — on peut faire jouer l'IA contre l'IA |
| `toMenu()` / `chooseMenu(k)` / `toSelect()` | Menu (0-2 = IA facile/moyen/difficile, 3 = 2 joueurs, 4 = en ligne), puis choix des têtes |
| `key(code)` | Appui de menu (même logique que le clavier : `ArrowDown`, `Enter`, `KeyD`, `Escape`…) |
| `tap(x, y)` | Toucher de menu en coordonnées du jeu (cartes des têtes à `y = 250`, x = 180, 330, 480, 630, 780) |
| `run(n)` | Avance de `n` images (60 par seconde) |
| `press(p, k)` / `release(p, k)` / `releaseAll()` | Joueur `p` (0 = J1, 1 = J2), touche `left`, `right`, `jump`, `kick` |
| `info()` | `{ state, mode, aiLevel, aiSlots, me, score, timeLeft, pick, ready, touchMode, endNote, waitMsg, net }` — `state` : `menu`, `select`, `wait`, `countdown`, `play`, `goal`, `end` |
| `ball()` / `players()` / `ctl()` / `touches()` | Objets du jeu ; `ctl()` = commandes unifiées de chaque joueur (`x`, `jump`, `kickQ`, `sentK`, `seenK`…) |
| `footPos(p)` / `setTime(s)` / `setTouchMode(b)` / `render()` | Chaussure, chrono, mode tactile (aides à l'écran), redessin (obligatoire avant une capture si le panneau est masqué) |
| `consts` / `heads` / `menu` / `aiLevels` | Constantes (`W`, `GROUND`, `R`, `GOAL_W`, `BAR_Y`, `STICK`, `SWIPE_UP`…), têtes, menu, réglages de l'IA |

## 3. Suite de tests automatisés

La suite est dans `checks.js`, à côté de ce fichier : 30 tests, dont 3 en ligne (la page se connecte au serveur,
le test simule l'autre joueur avec son propre WebSocket). Le script est **asynchrone** :

1. `cp .claude/skills/qa-jeu/checks.js public/__qa_checks_tmp.js` (fichier dans le `.gitignore`).
2. Dans la page, avec `javascript_tool` :
   ```js
   const src = await fetch('/__qa_checks_tmp.js', { cache: 'no-store' }).then((r) => r.text());
   const r = await (0, eval)(src);
   ({ total: r.total, echecs: r.echecs, fails: r.results.filter((x) => !x.ok) })
   ```
3. Supprime `public/__qa_checks_tmp.js` à la fin.

Durée : ~20 s (le test « IA niveaux » joue 36 matchs en accéléré). Tous les tests doivent passer.
Pour un échec, commence par savoir si c'est **le jeu** ou **le test** qui est en cause, corrige le bon côté, et ajoute
un test pour chaque nouveau bug trouvé. Piège connu : pendant un `await sleep()`, la vraie boucle du jeu tourne aussi
(si le panneau est visible), un état bref (coup de pied) peut donc être déjà fini — vérifie plutôt un compteur.

Règles de jeu que la suite protège :
- Menu : IA facile / moyen / difficile, 2 joueurs même écran, en ligne. Clavier (↑ ↓ Entrée) et doigt.
- **Le Boss** (tête 3) est réservé à l'IA : jamais proposé (5 cartes), toujours joué par l'IA en facile/moyen/difficile, refusé par le serveur en ligne.
- 2 joueurs : chacun choisit et se déclare prêt (clavier), ou au doigt J1 touche sa tête puis J2. Solo et en ligne : une seule tête à toucher.
- En solo, ZQSD **et** les flèches contrôlent mon joueur. À 2, ZQSD = J1, flèches = J2.
- Physique : saut au-dessus de la barre, un appui = un seul tir (≥ 12 px/image), tête qui renvoie la balle, but seulement sous la barre,
  un seul but par célébration, balle jamais coincée sur la barre, on peut se poser sur la barre, joueurs qui ne se traversent pas, jamais de `NaN`.
- **Jauge de super coup, seulement pour Maxou** (`fire: true` dans `HEADS`) : les autres têtes n'ont ni jauge ni super coup. Tir +18, tête +12, simple contact +5 (une fois par 12 images), plafond 100, remise à 0 à chaque match.
  Pleine : le prochain tir ou la prochaine tête part **en feu** (`superShot`) : ligne droite vers le fond du but adverse,
  sans gravité, elle **traverse les joueurs** ; elle s'éteint sur un mur, le sol ou une barre. La jauge se vide.
  En ligne, l'état envoyé contient `pw` (jauges) et `bf` (balle en feu).
- Fin du match (60 s) : appuis ignorés 1 s ; ensuite retour au choix des têtes (menu en ligne).
- **IA** : difficile > moyen > facile en buts cumulés sur 16 matchs, et l'IA difficile bat un joueur immobile.
  Bug historique : l'IA qui court vers son but à travers la balle marque contre son camp → elle saute par-dessus.
- **Tactile sans aucun bouton** (façon Brawl Stars) : le pouce posé devient le centre d'un joystick invisible qui le suit ;
  glisser ◀ ▶ = courir, glisser vers le haut = sauter, taper = tirer. Solo : moitié gauche = joystick, moitié droite = tir (tap) / saut (glisser vers le haut).
  À 2 : une moitié d'écran par joueur, un 2e doigt dans sa moitié = tir. Seul un joystick fantôme s'affiche sous le pouce.
- **En ligne** : attente d'un adversaire (annulable), mise en relation, commandes de l'invité appliquées par l'hôte (tir compris, sans perte
  d'un tap rapide grâce aux compteurs `k`/`jc`), état affiché chez l'invité, départ d'un joueur = fin du match « Ton adversaire est parti ».

## 4. Contrôles visuels (pas couverts par la suite)

Captures : `start`, `run`, `render()`, puis `computer screenshot`. Vérifie :
- **Menu** : titre, 5 grandes pastilles de couleur. **Choix des têtes** : « ← MENU » en haut à gauche, cadres J1/J2 ou TOI.
- **Têtes** détourées au ras des cheveux, contour noir qui suit la silhouette, retournées pour J2 ; étiquettes TOI / IA / ADV / J1 / J2.
- **Jauge de Maxou** sous le score, de son côté (aucune jauge pour les autres têtes) (se remplissent vers le centre, clignotent avec « 🔥 SUPER ! » quand elles sont pleines),
  aura de feu autour de la tête chargée, balle orange avec traînée de flammes et « 🔥 SUPER TIR ! » au déclenchement
  (`setPower(i, 100)` puis un tir pour le voir).
- **Chaussure** rouge (J1) / bleue (J2) qui monte pendant le tir. **Cages**, **HUD** (niveau d'IA sous le score), « BUUUT ! » + confettis.
- **Mobile paysage** : `resize_window` 812×375, `setTouchMode(true)`. Pas de défilement horizontal, **aucun bouton**.
  Pendant le compte à rebours, l'aide (« Pouce gauche… / Pouce droit… », ou une par moitié à 2 avec la ligne pointillée)
  est dans les tribunes, sans cacher les joueurs. Un doigt posé montre un cercle fantôme et un point de la couleur du joueur.
  Remets ensuite le preset `desktop`.
- **Plein écran téléphone** : Android passe en plein écran (et verrouille le paysage) au 1er toucher dans un menu (`goFullscreen`).
  iPhone : impossible pour une page web, le menu affiche « Plein écran sur iPhone : Partager ⬆ puis Sur l'écran d'accueil »
  (seulement sur iOS hors app) ; lancé depuis l'icône, le jeu s'ouvre sans barre (manifest `display: fullscreen`, icône `icon-180.png`).
  Non testable ici sans vrai téléphone.
- **Attente en ligne** : « Recherche d'un adversaire… », sa tête qui bouge, « Touche l'écran pour annuler ».

## 5. Ce qui n'est pas testable en local

- Le **son** (Web Audio) : signale-le comme non vérifié.
- Le **vrai jeu en ligne entre deux téléphones** à travers Tailscale et le `hub` Caddy : après déploiement, vérifie depuis ici
  que `wss://games-carlitos.tail736807.ts.net/carlitosoccer/ws` accepte une connexion (script node avec `ws`).
- La latence ressentie par l'invité (il a un aller-retour réseau de retard).

## 6. Rapport

Termine par un résumé en français : résultat de la suite (X/30, détail des échecs), contrôles visuels faits
(capture si quelque chose a changé), bugs corrigés avec `fichier:ligne`, ce qui n'a pas pu être vérifié.

Ne commite pas sans que l'utilisateur le demande.
