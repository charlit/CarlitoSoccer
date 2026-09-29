---
name: qa-jeu
description: QA de Head Ball (le jeu de foot à grosses têtes, à 2 joueurs, de ce repo) — lance la suite de tests automatisés (sélection des têtes, déplacements, saut, tir, tête, buts, barre transversale, collisions, fin de match, boutons tactiles) via le mode ?debug, vérifie le rendu desktop et mobile paysage, puis corrige et re-teste. Utiliser quand on demande « qa », « teste le jeu », « vérifie que ça marche », ou après toute modification de public/index.html (physique, dessin, contrôles, têtes).
---

# QA Head Ball

Le jeu tient dans un seul fichier, `public/index.html` (canvas 960×540). Les visages sont dans `public/heads/p1.png` … `p5.png`
(la liste et les noms sont dans le tableau `HEADS`). La QA teste le jeu **image par image** grâce au mode `?debug`.
Le panneau navigateur est souvent masqué, et `requestAnimationFrame` y est alors en pause : un écran figé
n'est donc pas forcément un bug. On pilote le jeu avec `window.__hb` au lieu d'attendre la boucle.

## 1. Lancer le jeu

- Démarre la preview avec `preview_start` `{ name: "head-ball" }`. La config est dans
  `C:\Users\lesma\Github\.claude\launch.json` et sert `HeadBall/public` sur le port 8196.
  Hors de cette machine : `python -m http.server 8196 --directory public`.
- Ouvre `http://localhost:8196/?debug&v=<valeur unique>` puis vérifie avec `read_console_messages` qu'il n'y a aucune erreur.
  **Change `v` à chaque rechargement après une modification** (le serveur Python n'envoie pas d'en-tête de cache).
  Pour vérifier la version chargée, cherche dans `document.documentElement.outerHTML` un commentaire que tu viens d'ajouter.
- **Si le panneau est masqué**, le canvas fait 0 × 0 et le test « tactile » échoue : fais `resize_window` à 812×375 avant la suite.

## 2. API de debug (`window.__hb`, seulement avec `?debug`)

| Appel | Effet |
|---|---|
| `start(a, b)` | Nouveau match, J1 avec la tête `a`, J2 avec la tête `b` (0 à 4), compte à rebours sauté |
| `toSelect()` | Revient à l'écran de choix des têtes |
| `run(n)` | Avance de `n` images (60 par seconde) |
| `press(p, k)` / `release(p, k)` / `releaseAll()` | Joueur `p` (0 = J1, 1 = J2), touche `left`, `right`, `jump`, `kick` |
| `info()` | `{ state, score, timeLeft, pick, ready, touchMode }` — `state` : `select`, `countdown`, `play`, `goal`, `end` |
| `ball()` / `players()` | Objets du jeu, modifiables directement (`x`, `y`, `vx`, `vy`, `kickT`, `onGround`…) |
| `footPos(p)` | Position de la chaussure (collision du tir) |
| `setTime(s)` | Temps restant du match en secondes |
| `setTouchMode(b)` / `touchHeld()` / `btns` | Boutons tactiles : affichage, touches tenues, positions |
| `consts` / `heads` | Constantes (`W`, `GROUND`, `R`, `GOAL_W`, `BAR_Y`…) et têtes chargées |
| `render()` | Redessine une image. Obligatoire avant chaque capture quand le panneau est masqué |

## 3. Suite de tests automatisés

La suite est dans `checks.js`, à côté de ce fichier : 15 tests qui repartent chacun d'un match neuf.

1. `cp .claude/skills/qa-jeu/checks.js public/__qa_checks_tmp.js` (fichier dans le `.gitignore`).
2. Exécute-le dans la page avec `javascript_tool` :
   ```js
   const src = await fetch('/__qa_checks_tmp.js', { cache: 'no-store' }).then((r) => r.text());
   const r = (0, eval)(src);
   ({ total: r.total, echecs: r.echecs, fails: r.results.filter((x) => !x.ok) })
   ```
3. Supprime `public/__qa_checks_tmp.js` à la fin.

Tous les tests doivent passer. Pour un échec, commence par savoir si c'est **le jeu** ou **le test** qui est en cause,
corrige le bon côté, et ajoute un test à `checks.js` pour chaque nouveau bug trouvé.

Règles de jeu que la suite protège :
- Écran de choix : chaque joueur change de tête avec gauche/droite et se déclare prêt avec tir ou saut ; les deux prêts → 3, 2, 1, GO.
- Les deux joueurs bougent indépendamment (même clavier, ou chacun ses boutons tactiles, multi-touch).
- Le saut permet une tête au-dessus de la barre transversale.
- Un appui sur tir = un seul coup de pied (garder la touche enfoncée ne mitraille pas). Tir ≥ 12 px/image vers le but adverse.
- But quand la balle passe entièrement la ligne sous la barre ; un seul but compté pendant la célébration ; remise en jeu au centre.
- La balle posée sur la barre retombe côté terrain (jamais coincée), et ça ne compte pas. On peut se poser sur la barre.
- Les joueurs ne se traversent pas ; la balle ne sort jamais du terrain et ne devient jamais `NaN`.
- Fin du match (60 s) : écran victoire ou égalité ; les appuis sont ignorés pendant 1 s pour ne pas relancer par erreur.

## 4. Contrôles visuels (pas couverts par la suite)

Captures : `start`, `run`, `render()`, puis `computer screenshot`. Vérifie :
- **Têtes** : les 5 visages bien découpés, contour noir épais, retournés pour J2 (il regarde vers la gauche).
- **Chaussure** sous chaque tête, rouge pour J1, bleue pour J2, qui monte devant pendant le tir.
- **Cages** : filet, poteau et barre blancs rayés de rouge, dessinés devant la balle.
- **HUD** : visages, score, chrono (rouge sous 10 s). « BUUUT ! » + confettis + tremblement après un but.
- **Mobile paysage** : `resize_window` 812×375. Pas de défilement horizontal, les 8 boutons en bas (J1 : ◀ ▶ ▲ ⚽ à gauche,
  J2 : ⚽ ▲ ◀ ▶ à droite). En portrait sur téléphone, le message « Tourne ton téléphone » s'affiche.
  Remets ensuite le preset `desktop`.

## 5. Ce qui n'est pas testable en local

- Le **son** (Web Audio) : signale-le comme non vérifié.
- La police **Luckiest Guy** vient de Google Fonts : sans réseau, le jeu retombe sur Impact.

## 6. Rapport

Termine par un résumé en français : résultat de la suite (X/15, détail des échecs), contrôles visuels faits
(capture si quelque chose a changé), bugs corrigés avec `fichier:ligne`, ce qui n'a pas pu être vérifié.

Ne commite pas sans que l'utilisateur le demande.
