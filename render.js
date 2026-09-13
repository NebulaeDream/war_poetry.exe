// ============================================================
// 渲染：战场背景、波兰球单位、弹道、UI
// ============================================================
const Render = {

  draw(ctx) {
    const W = Game.W, H = Game.H;
    // 背景：用战场贴图 cover 铺满；没加载好就先铺绿
    const bg = Game.images.bg;
    if (bg && bg.naturalWidth) {
      // cover：按比例填满并居中裁剪
      const iw = bg.naturalWidth, ih = bg.naturalHeight;
      const scale = Math.max(W / iw, H / ih);
      const dw = iw * scale, dh = ih * scale;
      ctx.drawImage(bg, (W - dw) / 2, (H - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = '#7cae5a';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#5aa0c8';
      ctx.fillRect(0, H * 0.93, W, H * 0.07);
      this.drawHills(ctx);
      this.drawDecor(ctx);
    }

    // 部署阶段：画四个框
    if (Game.phase === 'deploy') {
      Object.values(Game.layout.boxes).forEach(box => this.drawBox(ctx, box));
    }

    // 雾：右侧敌情不可见
    if (Game.fogOn && Game.phase === 'deploy') {
      const fx = Game.layout.fogLine;
      const grad = ctx.createLinearGradient(fx - 60, 0, fx + 40, 0);
      grad.addColorStop(0, 'rgba(20,20,30,0.0)');
      grad.addColorStop(1, 'rgba(20,20,30,0.92)');
      ctx.fillStyle = grad;
      ctx.fillRect(fx - 60, 0, W - (fx - 60), H);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `bold ${Math.max(16, H * 0.045)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('？ 未 知 敌 情 ？', (fx + W) / 2, H * 0.45);
      ctx.font = `${Math.max(11, H * 0.026)}px sans-serif`;
      ctx.fillText('（开战前不许偷看英军布阵）', (fx + W) / 2, H * 0.45 + 30);
    }

    // 尸体：压扁停在原地
    Game.units.forEach(u => {
      if (u.dead) this.drawCorpse(ctx, u);
    });

    // 单位
    Game.units.forEach(u => {
      if (u.dead) return;
      if (u.team === 'qing') this.drawQing(ctx, u);
      else this.drawBritish(ctx, u);
    });

    // 弹道
    Game.bullets.forEach(b => {
      const a = U.clamp(b.t / 0.18, 0, 1);
      ctx.strokeStyle = b.hit ? `rgba(255,230,120,${a})` : `rgba(255,180,80,${a})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    });

    // 炮弹（抛物线飞行）
    Game.shells.forEach(s => {
      const p = 1 - s.t / s.dur; // 0→1
      const cx = s.x1 + (s.x2 - s.x1) * p;
      const cy = s.y1 + (s.y2 - s.y1) * p - Math.sin(p * Math.PI) * 60;
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // 特效
    Game.effects.forEach(e => {
      if (e.type === 'puff') {
        const t = 1 - e.t / 0.6;
        ctx.fillStyle = `rgba(120,120,120,${0.6 * (1 - t)})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8 + t * 16, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'slash') {
        ctx.strokeStyle = 'rgba(255,80,80,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16, e.ang - 0.6, e.ang + 0.6);
        ctx.stroke();
      } else if (e.type === 'explosion') {
        const t = 1 - e.t / 0.5;
        const rr = e.r * t;
        ctx.fillStyle = `rgba(255,120,40,${0.7 * (1 - t)})`;
        ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = `rgba(255,200,80,${(1 - t)})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, rr, 0, Math.PI * 2); ctx.stroke();
      }
    });

    // 战斗阶段：方阵标签（点选指挥用）
    if (Game.phase === 'battle') {
      Game.formations.forEach(f => {
        const alive = f.soldiers.filter(s => !s.dead);
        if (alive.length === 0) return;
        const cx = alive.reduce((a, s) => a + s.x, 0) / alive.length;
        const cy = alive.reduce((a, s) => a + s.y, 0) / alive.length;
        const isSel = (Game.commandTarget === f);
        ctx.fillStyle = isSel ? 'rgba(255,80,80,0.9)' : 'rgba(40,40,60,0.7)';
        ctx.beginPath();
        ctx.arc(cx, cy - 26, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.id, cx, cy - 26);
        ctx.textBaseline = 'alphabetic';
      });

      // 正在画的路径
      if (Game.commandState === 'drawPath' && Game.drawPoints.length > 1) {
        ctx.strokeStyle = 'rgba(255,220,80,0.9)';
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(Game.drawPoints[0].x, Game.drawPoints[0].y);
        Game.drawPoints.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // pickFormation 提示
      if (Game.commandState === 'pickFormation') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('点选一个方阵 → 然后在战场上画线', W / 2, H * 0.12);
      }
    }

    // toast
    let ty = H * 0.20;
    Game.toastQueue.forEach(t => {
      const a = U.clamp(t.t, 0, 1);
      ctx.fillStyle = `rgba(0,0,0,${0.55 * a})`;
      const tw = ctx.measureText(t.text).width || 200;
      ctx.font = 'bold 14px sans-serif';
      const w = Math.max(220, ctx.measureText(t.text).width + 40);
      ctx.fillRect(W / 2 - w / 2, ty - 18, w, 28);
      ctx.fillStyle = `rgba(255,240,200,${a})`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, W / 2, ty);
      ty += 36;
    });
  },

  drawHills(ctx) {
    // 左：黄龙旗山丘
    const lx = Game.W * 0.16, ly = Game.H * 0.10;
    ctx.fillStyle = '#8a7a4a';
    ctx.beginPath();
    ctx.moveTo(lx - 70, ly + 30);
    ctx.quadraticCurveTo(lx, ly - 20, lx + 70, ly + 30);
    ctx.fill();
    ctx.strokeStyle = '#5a4a2a'; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(lx, ly - 5);
    ctx.lineTo(lx, ly - 40);
    ctx.stroke();
    // 黄龙旗
    ctx.fillStyle = '#f5c518';
    ctx.fillRect(lx, ly - 40, 44, 28);
    ctx.fillStyle = '#1a3a8a';
    ctx.beginPath(); ctx.arc(lx + 14, ly - 26, 4, 0, Math.PI * 2); ctx.fill();

    if (!Game.fogOn || Game.phase !== 'deploy') {
      // 右：米字旗山丘
      const rx = Game.W * 0.84, ry = Game.H * 0.10;
      ctx.fillStyle = '#7a6a4a';
      ctx.beginPath();
      ctx.moveTo(rx - 70, ry + 30);
      ctx.quadraticCurveTo(rx, ry - 20, rx + 70, ry + 30);
      ctx.fill();
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(rx, ry - 5);
      ctx.lineTo(rx, ry - 40);
      ctx.stroke();
      ctx.fillStyle = '#012169';
      ctx.fillRect(rx, ry - 40, 44, 28);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rx, ry - 40); ctx.lineTo(rx + 44, ry - 12);
      ctx.moveTo(rx + 44, ry - 40); ctx.lineTo(rx, ry - 12);
      ctx.stroke();
      ctx.strokeStyle = '#C8102E'; ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx, ry - 40); ctx.lineTo(rx + 44, ry - 12);
      ctx.moveTo(rx + 44, ry - 40); ctx.lineTo(rx, ry - 12);
      ctx.stroke();
    }
  },

  drawDecor(ctx) {
    Game.bgDecor.forEach(d => {
      if (d.x < Game.layout.fogLine && Game.fogOn && Game.phase === 'deploy') return;
      if (d.type === 'tree') {
        ctx.fillStyle = '#2d6a2d';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 14 * d.s, 10 * d.s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1e4a1e';
        ctx.beginPath();
        ctx.ellipse(d.x - 4, d.y - 3, 8 * d.s, 6 * d.s, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#888';
        ctx.beginPath();
        ctx.ellipse(d.x, d.y, 8 * d.s, 6 * d.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  },

  drawBox(ctx, box) {
    const sel = Game.selectedFormation && Game.selectedFormation.box === box;
    ctx.fillStyle = sel ? 'rgba(245,197,24,0.25)' : 'rgba(255,255,255,0.12)';
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.strokeStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = sel ? 3 : 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(box.x, box.y, box.w, box.h);
    ctx.setLineDash([]);
    ctx.fillStyle = sel ? '#ffd24a' : 'rgba(255,255,255,0.8)';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(box.label + ' 阵', box.x + 6, box.y + 20);
  },

  // ---------- 波兰球（优先用贴图，回退手绘） ----------
  drawBallSprite(ctx, u, img) {
    const r = u.radius;
    if (img && img.naturalWidth) {
      ctx.save();
      ctx.translate(u.x, u.y);
      // 影子
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(0, r + 2, r * 0.9, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      // 圆形裁剪画贴图
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2);
      ctx.clip();
      const s = r * 2.7;
      ctx.drawImage(img, -s / 2, -s / 2, s, s);
      ctx.restore();
      return;
    }
    // 回退：简易圆
    ctx.save();
    ctx.translate(u.x, u.y);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, r + 2, r, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = u.team === 'qing' ? '#f5c518' : '#012169';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },

  // 尸体：压扁停在原地
  drawCorpse(ctx, u) {
    const r = u.radius;
    ctx.save();
    ctx.translate(u.x, u.y);
    // 扁椭圆：视觉上"被踩扁"
    ctx.fillStyle = u.team === 'qing' ? 'rgba(120,100,40,0.85)' : 'rgba(40,40,70,0.85)';
    ctx.beginPath();
    ctx.ellipse(0, 2, r * 1.15, r * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  },

  drawQing(ctx, u) {
    this.drawBallSprite(ctx, u, Game.images.qing);
    if (u.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${u.flashT * 4})`;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawHpBar(ctx, u);
  },

  drawBritish(ctx, u) {
    this.drawBallSprite(ctx, u, Game.images.british);
    // 枪口焰在朝向方向
    if (u.muzzleT > 0) {
      const r = u.radius;
      ctx.fillStyle = `rgba(255,200,80,${u.muzzleT * 8})`;
      ctx.beginPath();
      ctx.arc(u.x + Math.cos(u.facing) * (r + 16),
              u.y + Math.sin(u.facing) * (r + 16), 6, 0, Math.PI * 2);
      ctx.fill();
    }
    if (u.turnT > 0) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', u.x, u.y - u.radius - 8);
    }
    if (u.fleeing) {
      ctx.fillStyle = '#ff6b6b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('逃', u.x, u.y - u.radius - 8);
    }
    if (u.flashT > 0) {
      ctx.fillStyle = `rgba(255,255,255,${u.flashT * 4})`;
      ctx.beginPath();
      ctx.arc(u.x, u.y, u.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawHpBar(ctx, u);
  },

  drawHpBar(ctx, u) {
    if (u.hp >= u.maxHp) return;
    const w = u.radius * 2, h = 3;
    const x = u.x - u.radius, y = u.y - u.radius - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = u.team === 'qing' ? '#7ec850' : '#ff6b6b';
    ctx.fillRect(x, y, w * (u.hp / u.maxHp), h);
  },
};
