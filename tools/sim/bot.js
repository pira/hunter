// Balance bot for tools/sim/balance.py: runs inside the page, drives game.step() as fast as possible.
(cls, maxLevel, maxSteps, opts = {}) => {
  game.pickClass(cls);
  game.startRun();
  if (!opts.mortal) game.player.hp = game.player.maxHp = 99; // opts.mortal: real hearts, the run ends when it dies
  const g = game;
  // opts.perks: pretend skin perks, e.g. { drops: 1 } (mythic) or { coinDrop: 0.05 } (rare)
  if (opts.perks) g.artefacts = { mult: k => 1 + (opts.perks[k] || 0) };
  // per-level economy sample: fight seconds, coins, kills, share of fight time with a ×2+ gold boost, …
  const econ = []; let cur = null;
  const startLvl = () => { cur = { L: g.level, t0: g.time, e0: g.coinsEarned, k0: g.kills, h0: g.hits || 0, g0: g.gems || 0, fight: 0, boost: 0, mult: 0, alive: 0, pu: 0 }; };
  startLvl();
  const origCollect = g.collectPowerup.bind(g);
  g.collectPowerup = pu => { if (cur) cur.pu++; return origCollect(pu); };
  let steps = 0;
  const t0 = performance.now();
  const trace = []; let last = ''; let lastAt = 0; let stuck = null;
  while (steps < maxSteps && g.level <= maxLevel && g.state !== 'gameover') {
    const tag = g.level + ':' + g.phase + ':' + (g.encounter ? g.encounter.kind + '/' + (g.encounter.id || (g.boss && g.boss.name)) : '');
    if (tag !== last) { trace.push([Math.round(g.time), tag, g.monsters.length]); last = tag; lastAt = steps; }
    if (steps - lastAt > 40000) { // stuck for ~12 minutes in one phase: report what is on the field
      stuck = { tag, player: [Math.round(g.player.x), Math.round(g.player.y)], W: Math.round(g.W), H: Math.round(g.H),
        monsters: g.monsters.slice(0, 12).map(m => ({ n: m.name || m.gkName, x: Math.round(m.x), y: Math.round(m.y), hp: Math.round(m.hp), max: m.maxHp, gk: !!m.gk, enc: m.enc === g.encounter, hidden: !!m.hidden, dead: m.dead, inv: !!m.invulnerable, sh: !!m.shielded })) };
      break;
    }
    if (g.level !== cur.L) {
      econ.push({ L: cur.L, secs: Math.round(g.time - cur.t0), fight: Math.round(cur.fight / 54), kills: g.kills - cur.k0, earned: g.coinsEarned - cur.e0,
        boost: +(cur.boost / Math.max(1, cur.fight)).toFixed(2), mult: +(cur.mult / Math.max(1, cur.fight)).toFixed(1), alive: Math.round(cur.alive / Math.max(1, cur.fight)), pu: cur.pu, coins: g.coins, hits: (g.hits || 0) - cur.h0, gems: (g.gems || 0) - cur.g0 });
      startLvl();
    }
    if (g.phase === 'fight' && g.state === 'playing') { cur.fight++; if (g.goldBoost >= 2) cur.boost++; cur.mult += g.coinMult; cur.alive += g.monsters.length; }
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
    // a barbarian has to get close to a boss: it shrugs off the bullets more
    const brave = cls === 'barbarian' && g.boss;
    for (const s of g.enemyShots) { const dx = p.x - s.x, dy = p.y - s.y, d2 = dx*dx+dy*dy+1; if (d2 < (brave ? 45 : 90) ** 2) { fx += dx/d2*1500; fy += dy/d2*1500; } }
    let best = null, bd = 1e9;
    for (const c of g.coinDrops.concat(g.powerups)) { const d = Math.hypot(c.x - p.x, c.y - p.y); if (d < bd) { bd = d; best = c; } }
    if (best && bd < 250) { fx += (best.x - p.x) / bd * 1.2; fy += (best.y - p.y) / bd * 1.2; }
    if (cls === 'barbarian' || (g.encounter && g.encounter.kind === 'gatekeeper')) { const t = g.nearestMonster(p.x, p.y); if (t) { const d = Math.hypot(t.x-p.x,t.y-p.y); if (d > (cls === 'barbarian' ? 70 : 170)) { const k = brave ? 3 : 0.9; fx += (t.x-p.x)/d*k; fy += (t.y-p.y)/d*k; } } }
    fx += (g.W / 2 - p.x) / g.W * 1.5; fy += (g.H * 0.6 - p.y) / g.H * 1.5;
    const n = Math.hypot(fx, fy) || 1;
    g.stick = { id: 1, ax: 0, ay: 0, x: 0, y: 0, dx: fx / n, dy: fy / n };
    if (g.superMeter >= 100) g.activateSuper();
    g.step(); steps++;
  }
  g.stick = { id: null, ax: 0, ay: 0, x: 0, y: 0, dx: 0, dy: 0 };
  return { cls, level: g.level, steps, secs: Math.round(g.time), hits: g.hits, kills: g.kills, coins: g.coins, ms: Math.round(performance.now() - t0), trace, rows: (window.huntStats || []).map(r => [r.L, r.secs, r.earned, r.expected, r.spent, r.hits]), econ, stacks: g.stacks, stuck };
}
