// Balance bot for tools/sim/balance.py: runs inside the page, drives game.step() as fast as possible.
(cls, maxLevel, maxSteps) => {
  game.pickClass(cls);
  game.startRun();
  game.player.hp = game.player.maxHp = 99;
  const g = game;
  let steps = 0;
  const t0 = performance.now();
  const trace = []; let last = '';
  while (steps < maxSteps && g.level <= maxLevel && g.state !== 'gameover') {
    const tag = g.level + ':' + g.phase + ':' + (g.encounter ? g.encounter.kind + '/' + (g.encounter.id || (g.boss && g.boss.name)) : '');
    if (tag !== last) { trace.push([Math.round(g.time), tag, g.monsters.length]); last = tag; }
    if (g.state === 'transition') { g.finishBurn(); }
    if (g.state === 'levelup') {
      g.cardsReadyAt = 0;
      const order = g.cardChoices.map((c, i) => [c, i]).sort((a, b) => (a[0].share ? 1 : 0) - (b[0].share ? 1 : 0));
      for (const [c, i] of order) if (c.price <= g.coins) g.buyCard(i);
      g.closeShop();
      continue;
    }
    if (g.state === 'bossStats') { g.bossStatsAt = 0; g.closeBossStats(); continue; }
    if (g.state === 'dying') { g.step(); steps++; continue; }
    // kite: flee nearby monsters, drift to coins, stay mid-screen
    const p = g.player;
    let fx = 0, fy = 0;
    for (const m of g.monsters) {
      if (m.dead) continue;
      const dx = p.x - m.x, dy = p.y - m.y, d2 = dx * dx + dy * dy + 1;
      const reach = (cls === 'barbarian' ? 60 : 150) + m.size;
      if (d2 < reach * reach) { fx += dx / d2 * 900; fy += dy / d2 * 900; }
    }
    for (const s of g.enemyShots) { const dx = p.x - s.x, dy = p.y - s.y, d2 = dx*dx+dy*dy+1; if (d2 < 90*90) { fx += dx/d2*1500; fy += dy/d2*1500; } }
    let best = null, bd = 1e9;
    for (const c of g.coinDrops.concat(g.powerups)) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
    if (best && bd < 250) { fx += (best.x - p.x) / bd * 1.2; fy += (best.y - p.y) / bd * 1.2; }
    if (cls === 'barbarian' || (g.encounter && g.encounter.kind === 'gatekeeper')) { const t = g.nearestMonster(p.x, p.y); if (t) { const d = Math.hypot(t.x-p.x,t.y-p.y); if (d > (cls === 'barbarian' ? 70 : 170)) { fx += (t.x-p.x)/d*0.9; fy += (t.y-p.y)/d*0.9; } } }
    fx += (g.W / 2 - p.x) / g.W * 1.5; fy += (g.H * 0.6 - p.y) / g.H * 1.5;
    const n = Math.hypot(fx, fy) || 1;
    g.stick = { id: 1, ax: 0, ay: 0, x: 0, y: 0, dx: fx / n, dy: fy / n };
    if (g.superMeter >= 100) g.activateSuper();
    g.step(); steps++;
  }
  g.stick = { id: null, ax: 0, ay: 0, x: 0, y: 0, dx: 0, dy: 0 };
  return { cls, level: g.level, steps, secs: Math.round(g.time), hits: g.hits, kills: g.kills, coins: g.coins, ms: Math.round(performance.now() - t0), trace, rows: (window.huntStats || []).map(r => [r.L, r.secs, r.earned, r.expected, r.spent, r.hits]) };
}
