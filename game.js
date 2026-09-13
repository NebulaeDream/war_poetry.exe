// ============================================================
// 游戏状态机：部署 → 战斗 → 胜负
// ============================================================
const Game = {
  W: 0, H: 0,
  phase: 'deploy',          // deploy | battle | win | lose
  silver: 0,
  kills: 0,
  units: [],                 // 所有单位
  formations: [],            // [{id,label,box,soldiers:[],path:[],wp:0}]
  bullets: [],               // 视觉弹道
  shells: [],                // 炮弹（炮兵）
  effects: [],               // 刀光/火光/烟尘
  layout: null,
  selectedFormation: null,   // 部署阶段选中的框
  commandState: 'none',      // none | pickFormation | drawPath
  commandTarget: null,
  drawPoints: [],
  fogOn: true,               // 部署阶段右侧遮罩
  startSilver: 0,
  toastQueue: [],
  bgDecor: [],
  images: { bg: null, qing: null, british: null },  // 贴图
  battleName: '',            // 本场战役名
  holdUntil: 0,             // 死守：所有清军怒气拉满到这个时间戳(秒)
  now: 0,                   // 游戏内秒表

  init(w, h) {
    this.W = w; this.H = h;
    this.computeLayout();
    this.silver = U.randInt(CONFIG.economy.startMin, CONFIG.economy.startMax);
    this.startSilver = this.silver;
    this.buildFormations();
    this.generateDecor();
    this.pushToast(this.silver <= 120
      ? `老佛爷拨下 ${this.silver} 两银子……"赢了，哀家请你吃麻辣烫！"`
      : `老佛爷拨下 ${this.silver} 两银子。"这已是哀家的体面了！"`);
  },

  computeLayout() {
    const W = this.W, H = this.H;
    const regionX = 14;
    const regionW = W * 0.38 - regionX;
    const gap = 12;
    const boxW = (regionW - gap) / 2;
    const topY = H * 0.15;
    const botY = H * 0.60;
    const boxH = (botY - topY - gap) / 2;
    this.layout = {
      W, H,
      playerRight: W * 0.40,
      fogLine: W * 0.52,
      boxes: {
        A: { x: regionX, y: topY, w: boxW, h: boxH, label: 'A' },
        B: { x: regionX + boxW + gap, y: topY, w: boxW, h: boxH, label: 'B' },
        C: { x: regionX, y: topY + boxH + gap, w: boxW, h: boxH, label: 'C' },
        D: { x: regionX + boxW + gap, y: topY + boxH + gap, w: boxW, h: boxH, label: 'D' },
      },
      fodderX: W * 0.44,
      britishFrontX: W * 0.70,
      britishBackX: W * 0.78,
    };
  },

  buildFormations() {
    this.formations = ['A', 'B', 'C', 'D'].map(id => ({
      id,
      box: this.layout.boxes[id],
      soldiers: [],
      path: null,
      commanded: false,
    }));
    this.selectedFormation = this.formations[0];
  },

  generateDecor() {
    this.bgDecor = [];
    // 树 / 石头 / 河沟 装饰
    for (let i = 0; i < 14; i++) {
      this.bgDecor.push({
        type: Math.random() < 0.7 ? 'tree' : 'rock',
        x: U.rand(this.W * 0.40, this.W * 0.95),
        y: U.rand(this.H * 0.08, this.H * 0.92),
        s: U.rand(0.7, 1.3),
      });
    }
  },

  // ---------- 经济 / 招募 ----------
  recruitQing() {
    if (this.phase !== 'deploy') return false;
    if (this.silver < CONFIG.qing.cost) {
      this.pushToast('军饷不足！老佛爷又把钱修了园子。');
      return false;
    }
    const f = this.selectedFormation;
    const box = f.box;
    // 在框里按紧凑网格找空位（扩容：间距压到 15）
    const gap = 15;
    const cols = Math.max(1, Math.floor((box.w - 10) / gap));
    const rows = Math.max(1, Math.floor((box.h - 10) / gap));
    const cap = cols * rows;
    if (f.soldiers.length >= cap) {
      this.pushToast(`${f.id} 阵已经塞满了，换个阵吧。`);
      return false;
    }
    const idx = f.soldiers.length;
    const cx = box.x + 8 + (idx % cols) * gap + U.rand(-2, 2);
    const cy = box.y + 8 + Math.floor(idx / cols) * gap + U.rand(-2, 2);
    const s = new QingUnit(cx, cy, {
      formation: f,
      slotOffset: { x: U.rand(-6, 6), y: U.rand(-6, 6) },
    });
    this.units.push(s);
    f.soldiers.push(s);
    this.silver -= CONFIG.qing.cost;
    return true;
  },

  selectFormationById(id) {
    const f = this.formations.find(x => x.id === id);
    if (f) { this.selectedFormation = f; this.commandState = 'none'; }
  },

  // ---------- 开战 ----------
  startBattle() {
    if (this.phase !== 'deploy') return false;
    // 检查至少有兵
    const totalQing = this.formations.reduce((n, f) => n + f.soldiers.length, 0);
    if (totalQing === 0) {
      this.pushToast('你连一个兵都没招，这仗怎么打？！把你自己扔上去吗？！');
      return false;
    }
    // 先弹出命名框
    UI.showNaming();
    return true;
  },

  // 玩家输完战役名后真正开战
  beginBattle(name) {
    if (this.phase !== 'deploy') return;
    this.battleName = (name && name.trim()) ? name.trim().slice(0, 12) : '无名之役';
    this.phase = 'battle';
    this.fogOn = false;
    this.now = 0;
    // 5 个自动冲锋的炮灰
    for (let i = 0; i < CONFIG.battle.fodderCount; i++) {
      const y = this.H * (0.22 + (i / (CONFIG.battle.fodderCount - 1)) * 0.56);
      const f = new QingUnit(this.layout.fodderX, y, { fodder: true });
      this.units.push(f);
    }
    // 生成英军步兵（数量随机 40~58）
    const n = U.randInt(CONFIG.battle.britishMin, CONFIG.battle.britishMax);
    const half = Math.floor(n / 2);
    for (let i = 0; i < n; i++) {
      const rank = i < half ? 0 : 1;
      const rows = Math.ceil(n / 2);
      const rowI = i % rows;
      const x = (rank === 0 ? this.layout.britishFrontX : this.layout.britishBackX) + U.rand(-8, 8);
      const y = this.H * (0.20 + (rowI / (rows - 1)) * 0.60) + U.rand(-6, 6);
      const b = new BritishUnit(x, y);
      b.rank = rank;
      this.units.push(b);
    }
    // 额外两尊炮兵（压阵后）
    for (let i = 0; i < CONFIG.artillery.count; i++) {
      const a = new ArtilleryUnit(this.layout.britishBackX + 60 + i * 40,
                                  this.H * (0.35 + i * 0.3));
      this.units.push(a);
    }
    BritishAI.setup(this.units.filter(u => u.team === 'british' && !u.isArtillery));
    this.pushToast(`—— ${this.battleName}：开战！把英国球砍成表情包。——`);
  },

  // ---------- 投降（签约） ----------
  surrender() {
    if (this.phase !== 'battle') return;
    this.lose(true);
  },

  // ---------- 死守：10秒全员怒气拉满 ----------
  holdPosition() {
    if (this.phase !== 'battle') return;
    this.holdUntil = this.now + 10;
    this.pushToast('死守！全军抱定必死之心，怒气冲天！');
  },

  // ---------- 指挥：画线 ----------
  beginCommand() {
    if (this.phase !== 'battle') return;
    this.commandState = 'pickFormation';
    this.pushToast('点击一个方阵（A/B/C/D）选择指挥对象');
  },

  pickFormationAt(x, y) {
    // 找离点击最近的、有兵的方阵
    let best = null, bestD = 60 * 60;
    this.formations.forEach(f => {
      const alive = f.soldiers.filter(s => !s.dead);
      if (alive.length === 0) return;
      const cx = alive.reduce((a, s) => a + s.x, 0) / alive.length;
      const cy = alive.reduce((a, s) => a + s.y, 0) / alive.length;
      const d2 = (cx - x) * (cx - x) + (cy - y) * (cy - y);
      if (d2 < bestD) { bestD = d2; best = { f, cx, cy }; }
    });
    if (best) {
      this.commandTarget = best.f;
      this.commandState = 'drawPath';
      this.drawPoints = [{ x, y }];
    }
  },

  pathMove(x, y) {
    if (this.commandState !== 'drawPath') return;
    const last = this.drawPoints[this.drawPoints.length - 1];
    if (U.dist(last.x, last.y, x, y) > 22) {
      this.drawPoints.push({ x, y });
    }
  },

  pathEnd() {
    if (this.commandState !== 'drawPath') return;
    if (this.drawPoints.length < 2) {
      this.commandState = 'none';
      this.commandTarget = null;
      return;
    }
    const f = this.commandTarget;
    const alive = f.soldiers.filter(s => !s.dead);
    alive.forEach(s => {
      s.path = this.drawPoints.map(p => ({ x: p.x, y: p.y }));
      s.wpIdx = 0;
      s.holdAtEnd = false;
    });
    f.commanded = true;
    this.pushToast(`${f.id} 方阵，前进！`);
    this.commandState = 'none';
    this.commandTarget = null;
    this.drawPoints = [];
  },

  // ---------- 查询 ----------
  nearestBritish(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const u of this.units) {
      if (u.team !== 'british' || u.dead) continue;
      const d2 = U.dist2(x, y, u.x, u.y);
      if (d2 < bd) { bd = d2; best = u; }
    }
    return best;
  },
  nearestQing(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const u of this.units) {
      if (u.team !== 'qing' || u.dead) continue;
      const d2 = U.dist2(x, y, u.x, u.y);
      if (d2 < bd) { bd = d2; best = u; }
    }
    return best;
  },

  // ---------- 死亡回调 ----------
  onUnitDeath(u, killer) {
    this.effects.push({ type: 'puff', x: u.x, y: u.y, t: 0.6 });
    if (u.team === 'british') {
      this.kills++;
      this.silver += CONFIG.economy.killBounty;
      // 身边清军涨怒气
      this.units.forEach(q => {
        if (q.team === 'qing' && !q.dead &&
            U.dist2(u.x, u.y, q.x, q.y) < 160 * 160) {
          q.anger = Math.min(CONFIG.qing.angerMax, q.anger + CONFIG.qing.angerPerAllyDeath);
          q._inCombat = true;
        }
      });
    }
    if (u.team === 'qing') {
      this.units.forEach(q => {
        if (q.team === 'qing' && !q.dead &&
            U.dist2(u.x, u.y, q.x, q.y) < 160 * 160) {
          q.anger = Math.min(CONFIG.qing.angerMax, q.anger + CONFIG.qing.angerPerAllyDeath);
          q._inCombat = true;
        }
      });
    }
  },

  spawnBullet(x1, y1, x2, y2, hit) {
    this.bullets.push({ x1, y1, x2, y2, t: 0.18, hit });
  },
  spawnMeleeSlash(x, y, ang) {
    this.effects.push({ type: 'slash', x, y, ang, t: 0.18 });
  },
  // 炮兵炮弹：飞行 0.9 秒后落地
  spawnShell(x1, y1, x2, y2, splash) {
    this.shells.push({ x1, y1, x2, y2, splash, t: 0.9, dur: 0.9, done: false });
  },
  explodeShell(s) {
    // 圈内清军全灭
    this.units.forEach(q => {
      if (q.team === 'qing' && !q.dead &&
          U.dist2(q.x, q.y, s.x2, s.y2) < s.splash * s.splash) {
        q.takeDamage(999, null);
      }
    });
    // 爆炸视觉
    this.effects.push({ type: 'explosion', x: s.x2, y: s.y2, r: s.splash, t: 0.5 });
  },

  pushToast(text) {
    this.toastQueue.push({ text, t: 3.2 });
    if (this.toastQueue.length > 3) this.toastQueue.shift();
  },

  // ---------- 主循环 ----------
  update(dt) {
    // toast 计时
    this.toastQueue.forEach(t => t.t -= dt);
    this.toastQueue = this.toastQueue.filter(t => t.t > 0);
    // effects
    this.effects.forEach(e => e.t -= dt);
    this.effects = this.effects.filter(e => e.t > 0);
    this.bullets.forEach(b => b.t -= dt);
    this.bullets = this.bullets.filter(b => b.t > 0);

    if (this.phase !== 'battle') return;

    this.now += dt;

    // 死守期间：全员怒气拉满
    if (this.now < this.holdUntil) {
      this.units.forEach(u => {
        if (u.team === 'qing' && !u.dead) u.anger = CONFIG.qing.angerMax;
      });
    }

    const brits = this.units.filter(u => u.team === 'british' && !u.dead);
    const qings = this.units.filter(u => u.team === 'qing' && !u.dead);

    // 更新单位（尸体保留，不再清除）
    this.units.forEach(u => u.update(dt));
    BritishAI.updateMorale(brits);
    BritishAI.separation(this.units, dt);
    BritishAI.reserveFill(brits, qings);

    // 更新炮弹（飞行→落地爆炸）
    this.shells.forEach(s => {
      s.t -= dt;
      if (s.t <= 0 && !s.done) {
        s.done = true;
        this.explodeShell(s);
      }
    });
    this.shells = this.shells.filter(s => !s.done);

    // 胜负
    const britAlive = this.units.some(u => u.team === 'british' && !u.dead);
    const qingAlive = this.units.some(u => u.team === 'qing' && !u.dead);
    if (!britAlive) this.win();
    else if (!qingAlive) this.lose();
  },

  win() {
    this.phase = 'win';
    const title = `【${this.battleName}】大捷！`;
    let sub = '你把英国球砍成了恐慌表情包，这曲《战争诗歌》响彻海疆。';
    if (this.startSilver <= 110) {
      sub = '【成就·老佛爷的麻辣烫】在仅 ' + this.startSilver +
            ' 两军费下全歼英军！全军士气上限+1。';
    }
    UI.showEnd(true, title, sub);
  },

  lose(bySurrender = false) {
    this.phase = 'lose';
    const title = bySurrender
      ? `【${this.battleName}】不战而降`
      : `【${this.battleName}】战败`;
    const subs = [
      '割地赔款，开放五口……老佛爷："这就是你打的仗？哀家把你塞进光绪的龙椅里扔出去！"',
      '条约签订：割让香港岛，赔款两千一百万银元。老佛爷："哀家的园子还没修完，你倒先败了？"',
      '军机处分明："统兵无能，着即革职，永不续用。"——你被撤了。',
    ];
    const sub = bySurrender
      ? '你亲手举起了白旗。条约已签，赔款照付，老佛爷在颐和园得知后摔了一套茶碗。'
      : subs[Math.floor(Math.random() * subs.length)];
    UI.showEnd(false, title, sub);
  },
};
