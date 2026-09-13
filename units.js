// ============================================================
// 单位：基类 + 清军 + 英军（AI 思考在 ai.js）
// ============================================================

let _uid = 1;

class Unit {
  constructor(x, y, team) {
    this.id = _uid++;
    this.team = team;          // 'qing' | 'british'
    this.x = x; this.y = y;
    this.radius = team === 'qing' ? CONFIG.qing.radius : CONFIG.british.radius;
    this.hp = team === 'qing' ? CONFIG.qing.hp : CONFIG.british.hp;
    this.maxHp = this.hp;
    this.dead = false;
    this.facing = team === 'qing' ? 0 : Math.PI; // 0=朝右, PI=朝左
    this.walkAnim = U.rand(0, Math.PI * 2);
    this.flashT = 0;          // 受击/开火闪白
  }

  get alive() { return !this.dead; }

  takeDamage(dmg, fromUnit) {
    if (this.dead) return;
    this.hp -= dmg;
    this.flashT = 0.12;
    if (this.hp <= 0) this.die(fromUnit);
  }

  die(killer) {
    this.dead = true;
    Game.onUnitDeath(this, killer);
  }
}

// ------------------------------------------------------------
// 清军：冷兵器近战，带怒气动态伤害
// ------------------------------------------------------------
class QingUnit extends Unit {
  constructor(x, y, opts = {}) {
    super(x, y, 'qing');
    this.anger = CONFIG.qing.angerStart;
    this.cooldown = 0;
    this.isFodder = !!opts.fodder;   // 开局送的一排，不可指挥
    this.formation = opts.formation || null; // 所属方阵 A/B/C/D
    // 沿路径行军
    this.path = null;        // [{x,y}, ...]
    this.wpIdx = 0;
    this.holdAtEnd = false;  // 到了终点原地盘踞
    // 每个兵在方阵里的小偏移，避免完全重叠
    this.slotOffset = opts.slotOffset || { x: 0, y: 0 };
  }

  currentDamage() {
    const t = U.clamp(this.anger / CONFIG.qing.angerMax, 0, 1);
    return CONFIG.qing.dmgMin + (CONFIG.qing.dmgMax - CONFIG.qing.dmgMin) * t;
  }

  update(dt) {
    if (this.dead) return;
    const Q = CONFIG.qing;
    this.cooldown -= dt;
    this.flashT = Math.max(0, this.flashT - dt);
    this.walkAnim += dt * 10;

    // 死守期间：怒气永远拉满，不衰减
    if (Game.now < Game.holdUntil) {
      this.anger = Q.angerMax;
      this._inCombat = false;
      this.inCombat = true;
    } else {
      // 怒气衰减（脱离战斗）
      this.inCombat = this._inCombat || false;
      if (this.inCombat) {
        this.anger = Math.min(Q.angerMax, this.anger + Q.angerPerHit * dt * 2);
      } else {
        this.anger = Math.max(0, this.anger - Q.angerDecay * dt);
      }
      this._inCombat = false;
    }

    // 找最近的英军
    const enemy = Game.nearestBritish(this.x, this.y, 2000);

    // 1) 进入近战范围 → 停下砍
    if (enemy && U.dist(this.x, this.y, enemy.x, enemy.y) <= Q.meleeRange) {
      this.moveX = 0; this.moveY = 0;
      this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
      this._inCombat = true;
      if (this.cooldown <= 0) {
        this.cooldown = Q.attackInterval;
        const dmg = this.currentDamage();
        enemy.takeDamage(dmg, this);
        this.anger = Math.min(Q.angerMax, this.anger + Q.angerPerHit);
        Game.spawnMeleeSlash(this.x, this.y, this.facing);
      }
      return;
    }

    // 2) 行军途中遇敌 → 停下先杀敌（engageRange）
    if (enemy && U.dist(this.x, this.y, enemy.x, enemy.y) <= Q.engageRange) {
      this._inCombat = true;
      // 向敌人走两步贴脸
      this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
      this.moveToward(enemy.x, enemy.y, Q.speed, dt);
      return;
    }

    // 3) 炮灰：自动冲锋
    if (this.isFodder) {
      if (enemy) {
        this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
        this.moveToward(enemy.x, enemy.y, Q.speed * 0.95, dt);
      }
      return;
    }

    // 4) 沿玩家画的路径走
    if (this.path && this.wpIdx < this.path.length) {
      const wp = this.path[this.wpIdx];
      const tx = wp.x + this.slotOffset.x;
      const ty = wp.y + this.slotOffset.y;
      this.facing = Math.atan2(ty - this.y, tx - this.x);
      this.moveToward(tx, ty, Q.speed, dt);
      if (U.dist(this.x, this.y, tx, ty) < 14) {
        this.wpIdx++;
        if (this.wpIdx >= this.path.length) this.holdAtEnd = true;
      }
      return;
    }

    // 5) 到了终点 / 没命令 → 主动逼近敌军，近身就砍
    if (this.holdAtEnd) {
      if (enemy) {
        this._inCombat = true;
        this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);
        this.moveToward(enemy.x, enemy.y, Q.speed, dt);
      } else {
        this.moveX = 0; this.moveY = 0;
      }
      return;
    }

    // 没命令也没路径 → 原地待命
    this.moveX = 0; this.moveY = 0;
  }

  moveToward(tx, ty, speed, dt) {
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 1;
    this.x += (dx / d) * speed * dt;
    this.y += (dy / d) * speed * dt;
    const b = U.bound(this.x, this.y, this.radius);
    this.x = b.x; this.y = b.y;
  }
}

// ------------------------------------------------------------
// 英军：排队枪毙（AI 思考在 BritishAI）
// ------------------------------------------------------------
class BritishUnit extends Unit {
  constructor(x, y) {
    super(x, y, 'british');
    this.reload = U.rand(0, CONFIG.british.attackInterval);
    this.turnT = 0;
    this.loyalty = U.rand(60, 100);
    this.fleeing = false;
    this.isReserve = false;
    this.muzzleT = 0;
    this.meleeCd = 0;
  }

  update(dt) {
    if (this.dead) return;
    const B = CONFIG.british;
    this.flashT = Math.max(0, this.flashT - dt);
    this.muzzleT = Math.max(0, this.muzzleT - dt);
    this.meleeCd -= dt;
    this.walkAnim += dt * 8;

    const enemy = Game.nearestQing(this.x, this.y, B.range + 120);

    // 溃逃
    if (this.fleeing) {
      this.facing = 0;
      this.x += B.speed * 1.8 * dt;
      this.y += Math.sin(this.walkAnim) * 10 * dt;
      const b = U.bound(this.x, this.y, this.radius);
      this.x = b.x; this.y = b.y;
      return;
    }

    // 没发现敌人：向左推进（向清军方向压上去），不傻站
    if (!enemy) {
      this.facing = Math.PI; // 朝左
      this.x -= B.advanceSpeed * dt;
      this.y += Math.sin(this.walkAnim) * 6 * dt;
      const b = U.bound(this.x, this.y, this.radius);
      this.x = b.x; this.y = b.y;
      this.reload = Math.min(this.reload, 0.5);
      return;
    }

    const d = U.dist(this.x, this.y, enemy.x, enemy.y);
    const wantFace = Math.atan2(enemy.y - this.y, enemy.x - this.x);

    // 转向期间不能开火/砍人
    if (this.turnT <= 0 && U.angleDiff(this.facing, wantFace) > U.degToRad(65)) {
      this.turnT = B.turnTime;
    }
    if (this.turnT > 0) {
      this.turnT -= dt;
      this.facing = U.lerpAngle(this.facing, wantFace, 3 * dt);
      return;
    }
    this.facing = wantFace;

    // —— 被贴脸：不开枪，用砍刀（6点/2秒） ——
    if (d <= B.meleeRange) {
      if (this.meleeCd <= 0) {
        this.meleeCd = B.meleeInterval;
        enemy.takeDamage(B.meleeDmg, this);
        Game.spawnMeleeSlash(this.x, this.y, this.facing);
      }
      return; // 贴脸就专心砍，不开枪
    }

    // 在射程外 → 压上去
    if (d > B.range) {
      this.x += Math.cos(this.facing) * B.speed * dt;
      this.y += Math.sin(this.facing) * B.speed * dt;
      const b = U.bound(this.x, this.y, this.radius);
      this.x = b.x; this.y = b.y;
      this.reload -= dt;
      return;
    }

    // 进入射程
    this.reload -= dt;

    // 敌人冲近但还没贴脸 → 边退边射
    if (d < B.kiteRange) {
      this.x -= Math.cos(this.facing) * B.kiteSpeed * dt;
      this.y -= Math.sin(this.facing) * B.kiteSpeed * dt;
      const b = U.bound(this.x, this.y, this.radius);
      this.x = b.x; this.y = b.y;
    }

    // 装填完毕 → 开枪
    if (this.reload <= 0) {
      this.reload = B.attackInterval;
      this.muzzleT = 0.12;
      const hit = Math.random() < B.accuracy;
      if (hit) enemy.takeDamage(B.dmg, this);
      Game.spawnBullet(this.x + Math.cos(this.facing) * this.radius,
                       this.y + Math.sin(this.facing) * this.radius,
                       enemy.x, enemy.y, hit);
    }
  }
}

// ------------------------------------------------------------
// 英军炮兵：10秒一发，范围炮击，圈内清军全灭
// ------------------------------------------------------------
class ArtilleryUnit extends Unit {
  constructor(x, y) {
    super(x, y, 'british');
    this.radius = CONFIG.artillery.radius;
    this.hp = CONFIG.artillery.hp;
    this.maxHp = this.hp;
    this.cd = U.rand(2, CONFIG.artillery.cooldown);
    this.fleeing = false;
    this.isArtillery = true;
    this.loyalty = 80;
  }

  update(dt) {
    if (this.dead) return;
    const A = CONFIG.artillery;
    this.flashT = Math.max(0, this.flashT - dt);
    this.cd -= dt;

    if (this.fleeing) {
      this.facing = 0;
      this.x += CONFIG.british.speed * 1.6 * dt;
      return;
    }

    // 找最近清军（射程远）
    const enemy = Game.nearestQing(this.x, this.y, A.range);
    if (!enemy) return; // 没目标就原地待命（炮兵不轻易挪窝）

    this.facing = Math.atan2(enemy.y - this.y, enemy.x - this.x);

    if (this.cd <= 0) {
      this.cd = A.cooldown;
      // 落在清军当前位置附近（带一点偏差，更真实）
      const tx = enemy.x + U.rand(-15, 15);
      const ty = enemy.y + U.rand(-15, 15);
      Game.spawnShell(this.x, this.y, tx, ty, A.splash);
    }
  }
}
