// Suite de tests QA de Head Ball.
// À exécuter dans la page ouverte avec ?debug (window.__hb doit exister).
// Chaque test repart d'un match neuf via g.start(tête J1, tête J2) et renvoie
// { test, ok, detail }. Le résultat global est la dernière expression.
(() => {
  const g = window.__hb;
  if (!g) return { error: 'window.__hb absent : ouvre la page avec ?debug' };
  const C = g.consts;
  const results = [];
  const check = (test, ok, detail) => results.push({ test, ok: !!ok, detail });
  const safe = (name, fn) => { try { fn(); } catch (e) { check(name, false, 'exception : ' + e.message); } g.releaseAll(); };
  const P = () => g.players();
  const B = () => g.ball();
  const park = () => Object.assign(B(), { x: C.W / 2, y: 60, vx: 0, vy: 0 }); // balle loin des joueurs

  // 1. Les 5 visages sont chargés
  safe('visages', () => {
    const bad = g.heads.filter((h) => !(h.img.complete && h.img.naturalWidth > 0)).map((h) => h.src);
    check('visages', g.heads.length === 5 && bad.length === 0, bad.length ? 'non chargés : ' + bad.join(', ') : '5 visages chargés');
  });

  // 2. Sélection : chaque joueur choisit sa tête et se déclare prêt → compte à rebours → match
  safe('sélection', () => {
    g.toSelect(); g.run(1);
    const p0 = g.info().pick[0];
    g.press(0, 'right'); g.run(1); g.release(0, 'right'); g.run(1);
    const p0b = g.info().pick[0];
    g.press(1, 'left'); g.run(1); g.release(1, 'left'); g.run(1);
    g.press(0, 'kick'); g.run(1); g.release(0, 'kick'); g.run(1);
    const mid = g.info();
    g.press(1, 'jump'); g.run(1); g.release(1, 'jump');
    const s1 = g.info().state;
    g.run(4 * 60);
    const s2 = g.info().state;
    check('sélection', p0b === (p0 + 1) % 5 && mid.ready[0] && !mid.ready[1] && mid.state === 'select' && s1 === 'countdown' && s2 === 'play',
      JSON.stringify({ p0, p0b, mid: mid.ready, s1, s2 }));
  });

  // 3. Déplacement indépendant des deux joueurs, et murs
  safe('déplacement', () => {
    g.start(0, 3); park();
    const [a, b] = P(); const ax = a.x, bx = b.x;
    g.press(0, 'right'); g.run(20); g.release(0, 'right');
    const still = Math.abs(b.x - bx) < 1;
    const ok1 = a.x > ax + 50 && still;
    g.press(1, 'right'); g.run(200); g.release(1, 'right');
    const ok2 = b.x <= C.W && b.x > C.W - 60;
    check('déplacement', ok1 && ok2, 'J1 ' + ax.toFixed(0) + '→' + a.x.toFixed(0) + ', J2 immobile ' + still + ', J2 au mur à x=' + b.x.toFixed(0));
  });

  // 4. Saut : assez haut pour faire une tête au-dessus de la barre
  safe('saut', () => {
    g.start(0, 3); park();
    const a = P()[0]; const y0 = a.y; let minY = y0;
    g.press(0, 'jump'); for (let i = 0; i < 50; i++) { g.run(1); minY = Math.min(minY, a.y); } g.release(0, 'jump'); g.run(30);
    const top = minY - C.R;
    check('saut', top < C.BAR_Y - 20 && Math.abs(a.y - y0) < 0.5, 'haut de la tête à y=' + top.toFixed(0) + ' (barre y=' + C.BAR_Y + '), retour au sol ' + (Math.abs(a.y - y0) < 0.5));
  });

  // 5. Tir : la balle devant le pied part fort vers le but adverse (pour J1 et J2)
  safe('tir', () => {
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

  // 6. Un seul tir par appui : garder la touche enfoncée ne relance pas la jambe
  safe('tir unique', () => {
    g.start(0, 3); park();
    const a = P()[0];
    g.press(0, 'kick'); g.run(1); const t1 = a.kickT; g.run(C.KICK_LEN + 10); const t2 = a.kickT;
    g.release(0, 'kick'); g.run(1); g.press(0, 'kick'); g.run(1); const t3 = a.kickT;
    check('tir unique', t1 === 1 && t2 === 0 && t3 === 1, 'kickT : ' + [t1, t2, t3].join(' / '));
  });

  // 7. Tête : une balle qui tombe sur la tête rebondit vers le haut
  safe('tête', () => {
    g.start(0, 3);
    const a = P()[0];
    Object.assign(B(), { x: a.x + 5, y: a.y - 150, vx: 0, vy: 0 });
    let up = false; for (let k = 0; k < 40; k++) { g.run(1); if (B().vy < -3 && B().y < a.y) up = true; }
    check('tête', up, 'balle renvoyée vers le haut : ' + up);
  });

  // 8. Buts : à droite pour J1, à gauche pour J2, puis remise en jeu au centre
  safe('buts', () => {
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

  // 9. Pas de double but pendant la célébration
  safe('but unique', () => {
    g.start(0, 3);
    Object.assign(B(), { x: C.W - 20, y: C.GROUND - 20, vx: 0, vy: 0 });
    g.run(100);
    check('but unique', g.info().score.join() === '1,0', 'score ' + g.info().score.join('-'));
  });

  // 10. Barre transversale : la balle qui tombe dessus ne compte pas et ne reste pas coincée
  safe('barre', () => {
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

  // 11. On peut se poser sur la barre transversale
  safe('sur la barre', () => {
    g.start(0, 3); park();
    const a = P()[0];
    Object.assign(a, { x: C.GOAL_W / 2, y: C.BAR_Y - C.R - 80, vy: 0 });
    g.run(60);
    const feet = a.y + C.R + 31;
    check('sur la barre', Math.abs(feet - C.BAR_Y) < 1 && a.onGround, 'pieds à y=' + feet.toFixed(1) + ' (barre ' + C.BAR_Y + ')');
  });

  // 12. Les deux joueurs ne se traversent pas
  safe('collision joueurs', () => {
    g.start(0, 3); park();
    const [a, b] = P();
    g.press(0, 'right'); g.press(1, 'left'); g.run(120);
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    check('collision joueurs', d >= 2 * C.R - 1 && a.x < b.x, 'distance ' + d.toFixed(1) + ' (min ' + 2 * C.R + '), J1 reste à gauche ' + (a.x < b.x));
  });

  // 13. Robustesse : la balle reste dans le terrain, jamais NaN, même frappée n'importe comment
  safe('robustesse', () => {
    g.start(0, 3);
    let bad = null, seed = 7;
    const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 1500 && !bad; k++) {
      if (k % 25 === 0) { g.releaseAll(); for (const i of [0, 1]) for (const key of ['left', 'right', 'jump', 'kick']) if (r() < 0.4) g.press(i, key); }
      if (k % 200 === 0) Object.assign(B(), { vx: (r() - 0.5) * 60, vy: (r() - 0.5) * 60 });
      g.run(1);
      const b = B();
      if (![b.x, b.y, b.vx, b.vy].every(Number.isFinite) || b.x < 0 || b.x > C.W || b.y < 0 || b.y > C.GROUND) bad = { k, x: b.x, y: b.y };
      for (const p of P()) if (!Number.isFinite(p.x) || p.x < 0 || p.x > C.W || p.y > C.REST_Y + 0.01) bad = { k, joueur: p.i, x: p.x, y: p.y };
    }
    check('robustesse', !bad, bad ? JSON.stringify(bad) : '1500 images sans sortie de terrain (score ' + g.info().score.join('-') + ')');
  });

  // 14. Fin du match : victoire, égalité, et pas de relance accidentelle pendant 1 s
  safe('fin de match', () => {
    g.start(0, 3); park();
    g.info(); g.setTime(0.05); g.run(5);
    const s1 = g.info().state;
    g.press(0, 'kick'); g.run(10); g.release(0, 'kick'); g.run(1);
    const s2 = g.info().state;
    g.run(60); g.press(0, 'kick'); g.run(1); g.release(0, 'kick');
    const s3 = g.info().state;
    check('fin de match', s1 === 'end' && s2 === 'end' && s3 === 'select', JSON.stringify({ fin: s1, appuiTropTot: s2, appuiApres1s: s3 }));
  });

  // 15. Boutons tactiles : un doigt sur ▶ de J1 et un sur ▲ de J2 en même temps, puis glissé
  safe('tactile', () => {
    const cv = document.getElementById('c'); const rect = cv.getBoundingClientRect();
    if (!rect.width) { check('tactile', false, 'canvas de taille 0 : panneau masqué, fais resize_window avant'); return; }
    g.setTouchMode(true);
    const at = (b) => ({ clientX: rect.left + b.x * rect.width / C.W, clientY: rect.top + b.y * rect.height / C.H });
    const btn = (p, k) => g.btns.find((b) => b.p === p && b.k === k);
    const ev = (type, id, b) => cv.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', bubbles: true, cancelable: true, ...at(b) }));
    ev('pointerdown', 11, btn(0, 'right')); ev('pointerdown', 12, btn(1, 'jump'));
    const h1 = g.touchHeld().sort().join();
    ev('pointermove', 11, btn(0, 'left'));
    const h2 = g.touchHeld().sort().join();
    ev('pointerup', 11, btn(0, 'left')); ev('pointerup', 12, btn(1, 'jump'));
    const h3 = g.touchHeld().join();
    check('tactile', h1 === '0:right,1:jump' && h2 === '0:left,1:jump' && h3 === '', JSON.stringify({ h1, h2, h3 }));
  });

  g.toSelect();
  return { total: results.length, echecs: results.filter((x) => !x.ok).length, results };
})();
