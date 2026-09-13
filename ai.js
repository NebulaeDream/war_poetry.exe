// ============================================================
// AI 层：英军整体士气、预备队标记、单位间分离（防叠罗汉）
// ============================================================
const BritishAI = {

  // 开战前：给英军分前排/后排/预备队，错开装填
  setup(units) {
    const n = units.length;
    const reserveCount = Math.max(1, Math.round(n * CONFIG.british.reserveFraction));
    // 其余平分为两排（前排先射，后排补位）
    const lineCount = n - reserveCount;
    const half = Math.floor(lineCount / 2);
    units.forEach((u, i) => {
      if (i >= lineCount) {
        u.isReserve = true;
        u.reserveSlot = i - lineCount;
      } else {
        u.isReserve = false;
        // 两排：前排 y 靠前（更靠左/朝敌），后排稍右
        u.rank = (i < half) ? 0 : 1;
      }
      // 错开初始装填，形成连续火力
      u.reload = (u.rank === 0) ? U.rand(0, 1.2) : U.rand(2.0, 3.6);
    });
  },

  // 每帧调用：整体士气崩溃判定
  updateMorale(units) {
    const alive = units.filter(u => !u.dead);
    if (alive.length === 0) return;
    const startN = units.length;
    const lostFrac = (startN - alive.length) / startN;

    alive.forEach(u => {
      if (u.fleeing) return;
      // 只有整体伤亡超过阈值后，士气才开始动摇；损失越大崩得越快
      if (lostFrac > CONFIG.british.fleeLossThreshold) {
        u.loyalty -= (lostFrac - CONFIG.british.fleeLossThreshold) * 14;
      }
      // 被清军贴身肉搏 → 恐慌
      let nearQing = false;
      for (const q of Game.units) {
        if (q.team === 'qing' && !q.dead &&
            U.dist2(u.x, u.y, q.x, q.y) < 42 * 42) { nearQing = true; break; }
      }
      if (nearQing) u.loyalty -= 1.2;
      if (u.loyalty < 25) u.fleeing = true;
    });
  },

  // 简单的群体分离（友军之间别叠在一起）
  separation(units, dt) {
    const R = 20;
    for (let i = 0; i < units.length; i++) {
      const a = units[i];
      if (a.dead || a.fleeing) continue;
      for (let j = i + 1; j < units.length; j++) {
        const b = units[j];
        if (b.dead || b.fleeing) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (R - d) / R * 40 * dt;
          const nx = dx / d, ny = dy / d;
          // 预备队不怎么被挤
          const wa = a.isReserve ? 0.3 : 1;
          const wb = b.isReserve ? 0.3 : 1;
          a.x -= nx * push * wa; a.y -= ny * push * wa;
          b.x += nx * push * wb; b.y += ny * push * wb;
        }
      }
    }
  },

  // 预备队补位：前排空缺时，预备队往前顶
  reserveFill(units, qingUnits) {
    const reserves = units.filter(u => !u.dead && u.isReserve);
    if (reserves.length === 0) return;
    // 找最靠左的前线兵作为锚点
    const front = units.filter(u => !u.dead && !u.isReserve);
    if (front.length === 0) return;
    let anchorX = Math.min(...front.map(u => u.x));
    const enemy = qingUnits.find(q => !q.dead);
    reserves.forEach((r, i) => {
      // 补到前线后面一点
      const targetX = anchorX + 20 + i * 18;
      const targetY = Game.H * (0.25 + (i / (reserves.length + 1)) * 0.5);
      r.x += (targetX - r.x) * 0.02;
      r.y += (targetY - r.y) * 0.02;
    });
  },
};
