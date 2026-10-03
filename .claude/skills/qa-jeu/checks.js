// Suite de tests QA de Carlito Soccer.
// À exécuter dans la page ouverte avec ?debug (window.__hb doit exister), servie par `node server.js`
// (le mode en ligne a besoin du serveur WebSocket). Le script renvoie une promesse :
//   const r = await (0, eval)(src)
// Chaque test repart d'un état neuf et renvoie { test, ok, detail }.
(async () => {
  const g = window.__hb;
  if (!g) return { error: 'window.__hb absent : ouvre la page avec ?debug' };
  const C = g.consts;
  const results = [];
  const check = (test, ok, detail) => results.push({ test, ok: !!ok, detail });
  const safe = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, 'exception : ' + e.message); } g.releaseAll(); };
  const P = () => g.players();
  const B = () => g.ball();
  const park = () => Object.assign(B(), { x: C.W / 2, y: 60, vx: 0, vy: 0 }); // balle loin des joueurs
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (cond, ms = 3000) => { const t = Date.now(); while (!cond() && Date.now() - t < ms) await sleep(30); return cond(); };
  const cardX = (j) => C.W / 2 + (j - (g.pickable.length - 1) / 2) * 150; // j = rang de la carte (Le Boss n'a pas de carte)
  const cv = document.getElementById('c');
  // doigt simulé : coordonnées du jeu (960×540) → coordonnées écran
  const finger = (type, id, x, y) => {
    const r = cv.getBoundingClientRect();
    document.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true,
      clientX: r.left + x * r.width / C.W, clientY: r.top + y * r.height / C.H }));
  };
  const key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code, bubbles: true }));

  // 1. Les 5 visages sont chargés et détourés
  await safe('visages', () => {
    const bad = g.heads.filter((h) => !(h.img.complete && h.img.naturalWidth > 0 && h.sprite)).map((h) => h.src);
    check('visages', g.heads.length === 6 && bad.length === 0, bad.length ? 'non chargés : ' + bad.join(', ') : '6 visages chargés et détourés avec contour');
  });

  // 2. Menu : 5 modes, navigation au clavier et au doigt
  await safe('menu', () => {
    g.chooseMenu(0); g.toMenu(); g.key('ArrowDown'); g.key('ArrowDown'); g.key('ArrowDown'); g.key('Enter');
    const a = g.info();
    g.toMenu(); g.tap(C.W / 2, 138 + 2 * 66 + 27);
    const b = g.info();
    g.toMenu(); g.tap(C.W / 2, 138 + 4 * 66 + 27);
    const c = g.info();
    g.toMenu();
    check('menu', g.menu.length === 5 && a.mode === 'local' && a.state === 'select' && b.mode === 'ai' && b.aiLevel === 2 && c.mode === 'online' && c.state === 'select',
      JSON.stringify({ clavier: [a.mode, a.state], doigtIA: [b.mode, b.aiLevel], doigtEnLigne: c.mode }));
  });

  // 3. Sélection à 2 au clavier : chacun choisit et se déclare prêt → 3, 2, 1 → match
  await safe('sélection 2 joueurs', () => {
    g.chooseMenu(3);
    const p0 = g.info().pick[0];
    g.key('KeyD'); g.key('ArrowLeft'); g.key('KeyS');
    const mid = g.info();
    g.key('ArrowUp');
    const s1 = g.info().state;
    g.run(4 * 60);
    const s2 = g.info().state;
    check('sélection 2 joueurs', mid.pick[0] === g.pickable[(g.pickable.indexOf(p0) + 1) % g.pickable.length] && mid.ready[0] && !mid.ready[1] && mid.state === 'select' && s1 === 'countdown' && s2 === 'play',
      JSON.stringify({ p0, pick: mid.pick, ready: mid.ready, s1, s2 }));
  });

  // 4. Sélection au doigt à 2 : J1 touche sa tête, puis J2
  await safe('sélection au doigt', () => {
    g.chooseMenu(3); g.tap(cardX(1), 250);
    const a = g.info();
    g.tap(cardX(3), 250);
    const b = g.info();
    check('sélection au doigt', a.ready[0] && !a.ready[1] && a.state === 'select' && b.state === 'countdown' && b.pick.join() === '1,4', JSON.stringify({ apresJ1: a.ready, final: [b.state, b.pick] }));
  });

  // 5. Contre l'IA : une seule tête à choisir, l'IA prend une autre tête et contrôle J2
  await safe('sélection IA', () => {
    g.chooseMenu(1); g.tap(cardX(2), 250);
    const i = g.info();
    check('sélection IA', i.state === 'countdown' && i.pick[0] === 2 && i.pick[1] === g.boss && i.aiSlots.join() === ',1' && i.me === 0, JSON.stringify(i));
  });

  // 5b. Le Boss est réservé à l'IA : jamais proposé au clavier ni au doigt, toujours joué par l'IA
  await safe('Le Boss réservé à l’IA', () => {
    g.chooseMenu(3); const seen = new Set();
    for (let n = 0; n < 8; n++) { g.key('KeyD'); g.key('ArrowRight'); const pk = g.info().pick; seen.add(pk[0]); seen.add(pk[1]); }
    const taps = []; for (let j = 0; j < 6; j++) { g.chooseMenu(1); g.tap(cardX(j), 250); taps.push(g.info().pick[0]); }
    const cartes = g.pickable.length;
    g.toMenu();
    check('Le Boss réservé à l’IA', !seen.has(g.boss) && seen.size === 5 && !taps.includes(g.boss) && cartes === 5 && g.heads[g.boss].name === 'Le Boss',
      JSON.stringify({ tetesProposees: [...seen].sort(), tapsCartes: taps, cartes, boss: g.heads[g.boss].name }));
  });

  // 6. Déplacement indépendant des deux joueurs, et murs
  await safe('déplacement', () => {
    g.start(0, 3); park();
    const [a, b] = P(); const ax = a.x, bx = b.x;
    g.press(0, 'right'); g.run(20); g.release(0, 'right');
    const still = Math.abs(b.x - bx) < 1;
    const ok1 = a.x > ax + 50 && still;
    g.press(1, 'right'); g.run(200); g.release(1, 'right');
    const ok2 = b.x <= C.W && b.x > C.W - 60;
    check('déplacement', ok1 && ok2, 'J1 ' + ax.toFixed(0) + '→' + a.x.toFixed(0) + ', J2 immobile ' + still + ', J2 au mur à x=' + b.x.toFixed(0));
  });

  // 7. En solo, les deux jeux de touches (ZQSD et flèches) contrôlent mon joueur
  await safe('clavier solo', () => {
    g.start(0, 3, { mode: 'ai', ai: [null, 0] }); park();
    const a = P()[0]; const x0 = a.x;
    key('keydown', 'ArrowRight'); g.run(15); key('keyup', 'ArrowRight');
    const x1 = a.x;
    key('keydown', 'KeyA'); g.run(15); key('keyup', 'KeyA');
    check('clavier solo', x1 > x0 + 40 && a.x < x1 - 40, 'flèche droite ' + x0.toFixed(0) + '→' + x1.toFixed(0) + ', Q ' + x1.toFixed(0) + '→' + a.x.toFixed(0));
  });

  // 8. Saut : assez haut pour faire une tête au-dessus de la barre
  await safe('saut', () => {
    g.start(0, 3); park();
    const a = P()[0]; const y0 = a.y; let minY = y0;
    g.press(0, 'jump'); for (let i = 0; i < 50; i++) { g.run(1); minY = Math.min(minY, a.y); } g.release(0, 'jump'); g.run(30);
    const top = minY - C.R;
    check('saut', top < C.BAR_Y - 20 && Math.abs(a.y - y0) < 0.5, 'haut de la tête à y=' + top.toFixed(0) + ' (barre y=' + C.BAR_Y + '), retour au sol ' + (Math.abs(a.y - y0) < 0.5));
  });

  // 9. Tir : la balle devant le pied part fort vers le but adverse (pour J1 et J2)
  await safe('tir', () => {
    const out = [];
    for (const i of [0, 1]) {
      g.start(0, 3);
      const p = P()[i];
      const ft = g.footPos(p);
      Object.assign(B(), { x: ft.x + p.f * 26, y: C.GROUND - C.BALL_R, vx: 0, vy: 0 });
      g.press(i, 'kick'); let best = 0, vx = 0;
      for (let k = 0; k < 14; k++) { g.run(1); const s = Math.hypot(B().vx, B().vy); if (s > best) { best = s; vx = B().vx; } }
      out.push({ joueur: i + 1, vitesse: +best.toFixed(1), sens: Math.sign(vx) === p.f });
    }
    check('tir', out.every((o) => o.vitesse > 12 && o.sens), JSON.stringify(out));
  });

  // 9b. Types de tir (sans bouton) : en courant = MISSILE (bas et fort), en reculant = LOB (haut, rétro), en l'air = VOLÉE ;
  //     l'effet courbe la trajectoire (le lob monte plus haut qu'un tir normal, le missile reste bas)
  await safe('types de tir', () => {
    const shoot = (move, air) => {
      g.start(0, 4); P()[1].x = C.W - 60; // l'adversaire loin, pour ne pas toucher la balle
      const p = P()[0];
      if (move) g.press(0, move);
      if (air) { g.press(0, 'jump'); g.run(6); }
      g.run(air ? 0 : 6);
      const ft = g.footPos(p);
      Object.assign(B(), { x: ft.x + (move === 'left' ? 10 : 24), y: air ? ft.y - 4 : C.GROUND - C.BALL_R, vx: 0, vy: 0 }); // en reculant, la balle est plus près du pied
      g.press(0, 'kick'); g.run(2);
      let kicked = false, v0 = null, top = B().y, spin = 0;
      for (let k = 0; k < 70; k++) {
        g.run(1);
        if (!kicked && Math.hypot(B().vx, B().vy) > 9) { kicked = true; v0 = { vx: B().vx, vy: B().vy }; spin = B().spin; }
        if (kicked) top = Math.min(top, B().y);
        if (k === 10) g.releaseAll();
      }
      g.releaseAll();
      return { label: g.pop().text, vx: v0 && +v0.vx.toFixed(1), vy: v0 && +v0.vy.toFixed(1), spin: +spin.toFixed(2), hautMax: Math.round(top) };
    };
    const normal = shoot(null, false), missile = shoot('right', false), lob = shoot('left', false), volee = shoot(null, true);
    check('types de tir', missile.label === 'MISSILE !' && missile.vx > 14 && Math.abs(missile.vy) < 6
      && lob.label === 'LOB !' && lob.vx > 0 && lob.spin < 0 && lob.hautMax < normal.hautMax - 40
      && volee.label === 'VOLÉE !' && volee.vx > 14 && normal.vx > 10 && normal.spin > 0,
      JSON.stringify({ normal, missile, lob, volee }));
  });

  // 9c. Poteaux : le haut du poteau renvoie la balle (« POTEAU ! », pas de but) ; plus bas la balle passe et c'est but
  await safe('poteaux', () => {
    const out = [];
    for (const left of [true, false]) {
      for (const high of [true, false]) {
        g.start(0, 4); P()[0].x = 300; P()[1].x = 660;
        const px = left ? C.GOAL_W : C.W - C.GOAL_W, dir = left ? -1 : 1;
        Object.assign(B(), { x: px - dir * 120, y: high ? C.BAR_Y + C.BAR_H + 12 : C.GROUND - 40, vx: dir * 14, vy: high ? -1 : 0, spin: 0 });
        let bounced = false, label = '';
        for (let k = 0; k < 40 && g.info().state === 'play'; k++) {
          g.run(1); if (B().vx * dir < 0) bounced = true; if (g.pop().t > 0) label = g.pop().text;
          if (bounced && Math.abs(B().x - px) > 70) break; // repartie : on s'arrête avant qu'un joueur ne la renvoie
        }
        out.push({ but: left ? 'gauche' : 'droite', tir: high ? 'haut' : 'bas', rebond: bounced, annonce: label, score: g.info().score.join('-') });
      }
    }
    const ok = out.every((o) => o.tir === 'haut' ? o.rebond && o.annonce === 'POTEAU !' && o.score === '0-0' : o.score !== '0-0');
    check('poteaux', ok, JSON.stringify(out));
  });

  // 9d. Vent : il pousse la balle en l'air (pas au sol), il change à chaque match, et il est envoyé en ligne
  await safe('vent', () => {
    const drift = (w) => {
      g.start(0, 4, { wind: w }); P()[0].x = 100; P()[1].x = C.W - 100;
      Object.assign(B(), { x: C.W / 2, y: C.GROUND - C.BALL_R - 1, vx: 0, vy: -13, spin: 0 });
      g.run(1); let k = 0; while (k++ < 120 && B().y < C.GROUND - C.BALL_R - 0.5) g.run(1);
      return Math.round(B().x - C.W / 2);
    };
    const droite = drift(0.05), gauche = drift(-0.05), calme = drift(0);
    g.start(0, 4, { wind: 0.05 }); P()[0].x = 100; P()[1].x = C.W - 100;
    Object.assign(B(), { x: C.W / 2, y: C.GROUND - C.BALL_R, vx: 0, vy: 0, spin: 0 }); g.run(60);
    const auSol = Math.round(B().x - C.W / 2);
    const tirages = new Set();
    for (let n = 0; n < 24; n++) { g.chooseMenu(1); g.tap(cardX(0), 250); tirages.add(g.wind()); }
    const valides = [...tirages].every((w) => g.winds.includes(Math.abs(w)));
    g.toMenu();
    check('vent', droite > 40 && gauche < -40 && Math.abs(calme) < 2 && Math.abs(auSol) < 2 && tirages.size >= 3 && valides,
      JSON.stringify({ deriveVentDroite: droite, deriveVentGauche: gauche, sansVent: calme, balleAuSol: auSol, ventsTires: [...tirages].sort() }));
  });

  // 10. Un seul tir par appui : garder la touche enfoncée ne relance pas la jambe
  await safe('tir unique', () => {
    g.start(0, 3); park();
    const a = P()[0];
    g.press(0, 'kick'); g.run(1); const t1 = a.kickT; g.run(C.KICK_LEN + 10); const t2 = a.kickT;
    g.release(0, 'kick'); g.run(1); g.press(0, 'kick'); g.run(1); const t3 = a.kickT;
    check('tir unique', t1 === 1 && t2 === 0 && t3 === 1, 'kickT : ' + [t1, t2, t3].join(' / '));
  });

  // 11. Tête : une balle qui tombe sur la tête rebondit vers le haut
  await safe('tête', () => {
    g.start(0, 3);
    const a = P()[0];
    Object.assign(B(), { x: a.x + 5, y: a.y - 150, vx: 0, vy: 0 });
    let up = false; for (let k = 0; k < 40; k++) { g.run(1); if (B().vy < -3 && B().y < a.y) up = true; }
    check('tête', up, 'balle renvoyée vers le haut : ' + up);
  });

  // 12. Buts : à droite pour J1, à gauche pour J2, puis remise en jeu au centre
  await safe('buts', () => {
    g.start(0, 3);
    Object.assign(B(), { x: C.W - C.GOAL_W + 30, y: C.GROUND - 40, vx: 8, vy: 0 });
    g.run(10);
    const i1 = g.info();
    g.run(130);
    const i2 = g.info(); const bx = B().x;
    Object.assign(B(), { x: C.GOAL_W - 30, y: C.GROUND - 40, vx: -8, vy: 0 });
    g.run(10);
    const i3 = g.info();
    check('buts', i1.score.join() === '1,0' && i1.state === 'goal' && i2.state === 'play' && Math.abs(bx - C.W / 2) < 60 && i3.score.join() === '1,1',
      JSON.stringify({ apresBut1: i1.score, etat: i1.state, reprise: i2.state, balleX: +bx.toFixed(0), apresBut2: i3.score }));
  });

  // 13. Pas de double but pendant la célébration
  await safe('but unique', () => {
    g.start(0, 3);
    Object.assign(B(), { x: C.W - 20, y: C.GROUND - 20, vx: 0, vy: 0 });
    g.run(100);
    check('but unique', g.info().score.join() === '1,0', 'score ' + g.info().score.join('-'));
  });

  // 14. Barre transversale : la balle qui tombe dessus ne compte pas et ne reste pas coincée
  await safe('barre', () => {
    const out = [];
    for (const left of [true, false]) {
      g.start(0, 3);
      P()[0].x = 300; P()[1].x = 660;
      Object.assign(B(), { x: left ? C.GOAL_W / 2 : C.W - C.GOAL_W / 2, y: C.BAR_Y - 80, vx: 0, vy: 0 });
      g.run(240);
      const onBar = B().y < C.BAR_Y && (left ? B().x < C.GOAL_W + 10 : B().x > C.W - C.GOAL_W - 10);
      out.push({ but: left ? 'gauche' : 'droite', score: g.info().score.join('-'), coincee: onBar });
    }
    check('barre', out.every((o) => o.score === '0-0' && !o.coincee), JSON.stringify(out));
  });

  // 15. On peut se poser sur la barre transversale
  await safe('sur la barre', () => {
    g.start(0, 3); park();
    const a = P()[0];
    Object.assign(a, { x: C.GOAL_W / 2, y: C.BAR_Y - C.R - 80, vy: 0 });
    g.run(60);
    const feet = a.y + C.R + 31;
    check('sur la barre', Math.abs(feet - C.BAR_Y) < 1 && a.onGround, 'pieds à y=' + feet.toFixed(1) + ' (barre ' + C.BAR_Y + ')');
  });

  // 16. Les deux joueurs ne se traversent pas
  await safe('collision joueurs', () => {
    g.start(0, 3); park();
    const [a, b] = P();
    g.press(0, 'right'); g.press(1, 'left'); g.run(120);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    check('collision joueurs', d >= 2 * C.R - 1 && a.x < b.x, 'distance ' + d.toFixed(1) + ' (min ' + 2 * C.R + '), J1 reste à gauche ' + (a.x < b.x));
  });

  // 16b. Jauge (seulement Maxou) : chaque touche la remplit (tir +18, tête +12), plafonnée à 100, remise à zéro à chaque match
  const MAXOU = g.heads.findIndex((h) => h.fire);
  await safe('jauge', () => {
    g.start(MAXOU, 4);
    const a = P()[0];
    const ft = g.footPos(a);
    Object.assign(B(), { x: ft.x + 26, y: C.GROUND - C.BALL_R, vx: 0, vy: 0 });
    g.press(0, 'kick'); g.run(14); g.release(0, 'kick');
    const apresTir = a.power;
    g.run(20);
    Object.assign(B(), { x: a.x + 5, y: a.y - 150, vx: 0, vy: 0 }); g.run(30);
    const apresTete = a.power;
    let max = 0; // pleine, la tête suivante part en super coup et vide la jauge : on garde le maximum atteint
    for (let n = 0; n < 12; n++) { Object.assign(B(), { x: a.x + 5, y: a.y - 150, vx: 0, vy: 0 }); for (let k = 0; k < 30; k++) { g.run(1); max = Math.max(max, a.power); } }
    g.start(MAXOU, 4);
    const nouveau = P()[0].power;
    // les autres têtes n'ont pas de jauge : un tir ne la remplit pas, et même forcée à 100 il n'y a pas de super coup
    g.start(0, 4);
    const o = P()[0], of = g.footPos(o);
    Object.assign(B(), { x: of.x + 26, y: C.GROUND - C.BALL_R, vx: 0, vy: 0 });
    g.press(0, 'kick'); g.run(14); g.release(0, 'kick');
    const autreTir = o.power;
    g.run(20); g.setPower(0, 100);
    const of2 = g.footPos(o);
    Object.assign(B(), { x: of2.x + 26, y: C.GROUND - C.BALL_R, vx: 0, vy: 0 });
    g.press(0, 'kick'); let autreFeu = 0; for (let k = 0; k < 20; k++) { g.run(1); autreFeu = Math.max(autreFeu, B().fire); } g.release(0, 'kick');
    check('jauge', g.heads[MAXOU].name === 'Maxou' && g.heads.filter((h) => h.fire).length === 1 && apresTir === 18 && apresTete === 30 && max === 100 && nouveau === 0 && autreTir === 0 && autreFeu === 0,
      JSON.stringify({ maxou: { apresTir, apresTete, plafond: max, nouveauMatch: nouveau }, autreTete: { apresTir: autreTir, superCoup: autreFeu > 0 } }));
  });

  // 16c. Super tir de Maxou : jauge pleine, le tir part en feu, traverse le gardien et marque ; la jauge se vide
  await safe('super tir', () => {
    g.start(MAXOU, 4); g.setPower(0, 100);
    const [a, b] = P();
    b.x = C.W - 130; // l'adversaire garde son but
    const ft = g.footPos(a);
    Object.assign(B(), { x: ft.x + 26, y: C.GROUND - C.BALL_R, vx: 0, vy: 0 });
    g.press(0, 'kick'); let fire = 0, frames = 0;
    for (; frames < 150 && g.info().state === 'play'; frames++) { g.run(1); fire = Math.max(fire, B().fire); }
    g.release(0, 'kick');
    const i = g.info();
    check('super tir', fire > 0 && i.state === 'goal' && i.score.join() === '1,0' && a.power < 100,
      JSON.stringify({ enFeu: fire > 0, images: frames, etat: i.state, score: i.score, jaugeApres: a.power }));
  });

  // 16d. Super tête de Maxou en J2 : jauge pleine, une balle sur la tête part en feu vers le but de gauche
  await safe('super tête', () => {
    g.start(0, MAXOU); g.setPower(1, 100);
    const b = P()[1];
    P()[0].x = 150;
    Object.assign(B(), { x: b.x - 5, y: b.y - 150, vx: 0, vy: 0 });
    let fire = 0, frames = 0;
    for (; frames < 200 && g.info().state === 'play'; frames++) { g.run(1); fire = Math.max(fire, B().fire); }
    const i = g.info();
    check('super tête', fire > 0 && i.score.join() === '0,1', JSON.stringify({ enFeu: fire > 0, images: frames, score: i.score }));
  });

  // 17. Robustesse : la balle reste dans le terrain, jamais NaN, même frappée n'importe comment
  await safe('robustesse', () => {
    g.start(0, 3);
    let bad = null, seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 1500 && !bad; k++) {
      if (k % 25 === 0) { g.releaseAll(); for (const i of [0, 1]) for (const kk of ['left', 'right', 'jump', 'kick']) if (r() < 0.4) g.press(i, kk); }
      if (k % 200 === 0) Object.assign(B(), { vx: (r() - 0.5) * 60, vy: (r() - 0.5) * 60 });
      g.run(1);
      const b = B();
      if (![b.x, b.y, b.vx, b.vy].every(Number.isFinite) || b.x < 0 || b.x > C.W || b.y < 0 || b.y > C.GROUND) bad = { k, x: b.x, y: b.y };
      for (const p of P()) if (!Number.isFinite(p.x) || p.x < 0 || p.x > C.W || p.y > C.REST_Y + 0.01) bad = { k, joueur: p.i, x: p.x, y: p.y };
    }
    check('robustesse', !bad, bad ? JSON.stringify(bad) : '1500 images sans sortie de terrain (score ' + g.info().score.join('-') + ')');
  });

  // 18. Fin du match : appuis ignorés pendant 1 s, puis retour au choix des têtes
  await safe('fin de match', () => {
    g.start(0, 3); park();
    g.setTime(0.05); g.run(5);
    const s1 = g.info().state;
    g.key('Space'); g.run(10);
    const s2 = g.info().state;
    g.run(60); g.key('Space');
    const s3 = g.info().state;
    check('fin de match', s1 === 'end' && s2 === 'end' && s3 === 'select', JSON.stringify({ fin: s1, appuiTropTot: s2, appuiApres1s: s3 }));
  });

  // 19. IA : les niveaux sont bien ordonnés (difficile > moyen > facile), et l'IA marque contre un joueur immobile
  await safe('IA niveaux', () => {
    // buts cumulés sur 16 matchs, en changeant de côté à chaque match (les victoires seules sont trop aléatoires)
    const duel = (a, b, n) => { let ga = 0, gb = 0; for (let m = 0; m < n; m++) { const sw = m % 2; g.start(g.pickable[m % 4], g.boss, { mode: 'ai', ai: sw ? [b, a] : [a, b] }); g.run(62 * 60); const s = g.info().score; ga += sw ? s[1] : s[0]; gb += sw ? s[0] : s[1]; } return [ga, gb]; };
    const d21 = duel(2, 1, 16), d10 = duel(1, 0, 24);
    let hard = [0, 0]; for (let m = 0; m < 4; m++) { g.start(0, 3, { mode: 'ai', ai: [null, 2] }); g.run(62 * 60); const s = g.info().score; hard[0] += s[1]; hard[1] += s[0]; }
    check('IA niveaux', d21[0] > d21[1] && d10[0] > d10[1] && hard[0] >= 4 && hard[0] > hard[1],
      JSON.stringify({ 'difficile-moyen (buts)': d21, 'moyen-facile': d10, 'difficile contre immobile (buts pour-contre)': hard }));
  });

  // 20. Tactile façon Brawl Stars (solo) : pouce gauche = joystick invisible, glisser vers le haut = saut, pouce droit = tir
  await safe('tactile solo', () => {
    if (!cv.getBoundingClientRect().width) { check('tactile solo', false, 'canvas de taille 0 : panneau masqué, fais resize_window avant'); return; }
    g.start(0, 3, { mode: 'ai', ai: [null, 0] }); park();
    const a = P()[0];
    finger('pointerdown', 21, 200, 420); finger('pointermove', 21, 260, 420); g.run(10);
    const vx = a.vx, cx = g.ctl()[0].x;
    finger('pointermove', 21, 260, 360); g.run(3);
    const jumped = a.vy < 0 && !a.onGround;
    finger('pointerdown', 22, 750, 300); g.run(1);
    const kick = a.kickT;
    finger('pointerup', 22, 750, 300); finger('pointerup', 21, 260, 360);
    const empty = g.touches().length === 0;
    g.run(40); finger('pointerdown', 23, 300, 400); finger('pointerup', 23, 300, 400); g.run(1);
    const tapKick = a.kickT;
    check('tactile solo', cx === 1 && vx > 0 && jumped && kick >= 1 && empty && tapKick >= 1,
      JSON.stringify({ joystickX: cx, vitesse: vx, saut: jumped, tirPouceDroit: kick, doigtsRelaches: empty, tirTapeGauche: tapKick }));
  });

  // 21. Tactile à 2 sur le même écran : chacun sa moitié, en même temps
  await safe('tactile 2 joueurs', () => {
    if (!cv.getBoundingClientRect().width) { check('tactile 2 joueurs', false, 'canvas de taille 0'); return; }
    g.start(0, 3); park();
    finger('pointerdown', 31, 200, 400); finger('pointerdown', 32, 760, 400);
    finger('pointermove', 31, 150, 400); finger('pointermove', 32, 820, 400); g.run(2);
    const x = g.ctl().map((c) => c.x);
    finger('pointerdown', 33, 850, 300); g.run(1);
    const k = P()[1].kickT;
    ['31', '32', '33'].forEach((id) => finger('pointerup', +id, 0, 0));
    check('tactile 2 joueurs', x[0] < 0 && x[1] > 0 && k >= 1 && g.touches().length === 0, JSON.stringify({ J1x: x[0], J2x: x[1], tirJ2DeuxiemeDoigt: k }));
  });

  // 22. Pas de bouton : au doigt, on ne dessine rien d'autre qu'un joystick fantôme sous le pouce
  await safe('menu au doigt', () => {
    if (!cv.getBoundingClientRect().width) { check('menu au doigt', false, 'canvas de taille 0'); return; }
    g.toMenu(); finger('pointerdown', 41, C.W / 2, 138 + 3 * 66 + 27); finger('pointerup', 41, C.W / 2, 138 + 3 * 66 + 27);
    const i = g.info(); g.toMenu();
    check('menu au doigt', i.mode === 'local' && i.state === 'select', JSON.stringify([i.mode, i.state]));
  });

  // 23. En ligne, cette page héberge : un 2e joueur (simulé ici) arrive, ses commandes font bouger J2, son départ termine le match
  await safe('en ligne (hôte)', async () => {
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    g.chooseMenu(4); g.tap(cardX(2), 250);
    const w = g.info().state;
    await until(() => g.info().net && g.info().net.ready === 1);
    await sleep(100);
    const guest = new WebSocket(url); const got = [];
    guest.onmessage = (e) => got.push(JSON.parse(e.data));
    await until(() => guest.readyState === 1);
    guest.send(JSON.stringify({ t: 'find', head: 4 }));
    await until(() => got.some((m) => m.t === 'start') && g.info().state === 'countdown');
    const start = got.find((m) => m.t === 'start'), host = g.info();
    g.run(4 * 60);
    await until(() => got.some((m) => m.t === 's' && m.st === 'play'));
    const snapOk = got.some((m) => m.t === 's' && m.st === 'play' && Array.isArray(m.pw) && m.pw.length === 2 && 'bf' in m && 'wd' in m); // état + jauges + balle en feu + vent
    const x0 = P()[1].x;
    guest.send(JSON.stringify({ t: 'in', x: -1, j: false, k: 1, jc: 0 }));
    await sleep(200); g.run(20);
    const moved = x0 - P()[1].x, kicked = g.ctl()[1].seenK === 1; // l'hôte a reçu le tir (la boucle a pu le jouer pendant l'attente)
    guest.close();
    await until(() => g.info().state === 'end');
    const fin = g.info();
    g.run(70); g.key('Enter');
    check('en ligne (hôte)', w === 'wait' && start && start.role === 1 && start.heads.join() === '2,4' && host.net.role === 0 && host.me === 0 && snapOk && moved > 50 && kicked
      && fin.state === 'end' && fin.endNote === 'Ton adversaire est parti' && g.info().state === 'menu',
      JSON.stringify({ attente: w, invite: start, hote: host.net, etatRecu: snapOk, J2recule: +moved.toFixed(0), J2tire: kicked, fin: [fin.state, fin.endNote], apres: g.info().state }));
  });

  // 24. En ligne, cette page est invitée : elle affiche l'état reçu et envoie ses commandes (dont le tir au doigt)
  await safe('en ligne (invité)', async () => {
    g.toMenu();
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    const host = new WebSocket(url); const got = [];
    host.onmessage = (e) => got.push(JSON.parse(e.data));
    await until(() => host.readyState === 1);
    host.send(JSON.stringify({ t: 'find', head: 0 }));
    await sleep(150);
    g.chooseMenu(4); g.tap(cardX(3), 250);
    await until(() => g.info().net && g.info().net.role === 1 && got.some((m) => m.t === 'start'));
    const info = g.info();
    host.send(JSON.stringify({ t: 's', st: 'play', sc: [2, 1], tl: 42.5, cd: 0, gt: 0, ls: 0, en: '', b: [300, 200, 0], p: [[200, 399, 0, 0, 0, 1], [700, 399, 0, 0, 0, 1]], ev: [] }));
    await until(() => g.info().state === 'play');
    const snap = g.info();
    key('keydown', 'ArrowLeft'); g.run(2); key('keyup', 'ArrowLeft');
    if (cv.getBoundingClientRect().width) { finger('pointerdown', 51, 800, 300); finger('pointerup', 51, 800, 300); }
    g.run(2);
    await until(() => got.some((m) => m.t === 'in' && m.x < 0) && got.some((m) => m.t === 'in' && m.k >= 1));
    const inputs = got.filter((m) => m.t === 'in');
    host.close();
    await until(() => g.info().state === 'end');
    const fin = g.info();
    g.toMenu();
    check('en ligne (invité)', info.me === 1 && snap.state === 'play' && snap.score.join() === '2,1' && B().x === 300 && inputs.some((m) => m.x < 0) && inputs.some((m) => m.k >= 1) && fin.state === 'end',
      JSON.stringify({ role: info.net, etatAffiche: [snap.state, snap.score], commandesEnvoyees: inputs.length, gauche: inputs.some((m) => m.x < 0), tir: inputs.some((m) => m.k >= 1), fin: fin.state }));
  });

  // 25. Personne en face : l'attente s'annule d'une touche et le serveur oublie le joueur
  await safe('en ligne (annuler)', async () => {
    g.chooseMenu(4); g.tap(cardX(0), 250);
    await until(() => g.info().net && g.info().net.ready === 1);
    g.tap(10, 10);
    const s = g.info();
    await sleep(150);
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    const a = new WebSocket(url), b = new WebSocket(url); const got = [];
    b.onmessage = (e) => got.push(JSON.parse(e.data));
    a.onmessage = (e) => got.push({ de: 'a', ...JSON.parse(e.data) });
    await until(() => a.readyState === 1 && b.readyState === 1);
    // a demande Le Boss (tête 3) : le serveur le refuse et lui donne la tête 0
    a.send(JSON.stringify({ t: 'find', head: 3 })); await sleep(100); b.send(JSON.stringify({ t: 'find', head: 2 }));
    await until(() => got.some((m) => m.t === 'start'));
    const st = got.find((m) => m.t === 'start');
    a.close(); b.close();
    check('en ligne (annuler)', s.state === 'menu' && !s.net && st && st.heads.join() === '0,2', JSON.stringify({ apresAnnulation: s.state, net: s.net, nouvellePartieEntreAutres: st && st.heads, recu: got }));
  });

  // 26. Plein écran sur téléphone : manifest « fullscreen » + icônes (iPhone : écran d'accueil), liens dans la page
  await safe('plein écran', async () => {
    const m = await fetch('manifest.json', { cache: 'no-store' }).then((r) => r.json());
    const icons = await Promise.all(['icon-180.png', 'icon-192.png', 'icon-512.png'].map((f) => fetch(f, { cache: 'no-store' }).then((r) => r.status)));
    const links = ['manifest', 'apple-touch-icon'].every((rel) => document.querySelector('link[rel="' + rel + '"]'));
    const meta = document.querySelector('meta[name="apple-mobile-web-app-capable"]');
    check('plein écran', m.display === 'fullscreen' && m.orientation === 'landscape' && icons.every((c) => c === 200) && links && meta,
      JSON.stringify({ display: m.display, orientation: m.orientation, icones: icons, liens: links, iphone: !!meta }));
  });

  // 27. Accueil : on voit si un joueur attend en ligne (api/lobby, relu toutes les 3 s sur le menu)
  await safe('joueur en attente', async () => {
    g.toMenu(); await g.pollLobby();
    const avant = g.lobby();
    const url = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
    const w = new WebSocket(url);
    await until(() => w.readyState === 1);
    w.send(JSON.stringify({ t: 'find', head: 5 })); await sleep(150);
    await g.pollLobby();
    const pendant = g.lobby();
    w.close(); await sleep(150);
    await g.pollLobby();
    const apres = g.lobby();
    check('joueur en attente', avant && !avant.waiting && pendant.waiting && pendant.head === 5 && !apres.waiting,
      JSON.stringify({ avant, pendant, apres }));
  });

  g.toMenu(); g.setTouchMode(false);
  return { total: results.length, echecs: results.filter((x) => !x.ok).length, results };
})();
