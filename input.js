// ============================================================
// 输入：触屏 / 鼠标统一处理 + 按钮接线
// ============================================================
const Input = {
  canvas: null,

  init(canvas) {
    this.canvas = canvas;
    const getPos = (e) => {
      const rect = canvas.getBoundingClientRect();
      const cx = (e.clientX - rect.left) * (Game.W / rect.width);
      const cy = (e.clientY - rect.top) * (Game.H / rect.height);
      return { x: cx, y: cy };
    };

    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const p = getPos(e);

      if (Game.phase === 'deploy') {
        // 点选四个框之一
        const box = this.hitBox(p.x, p.y);
        if (box) Game.selectFormationById(box.label);
        return;
      }

      if (Game.phase !== 'battle') return;

      if (Game.commandState === 'pickFormation') {
        Game.pickFormationAt(p.x, p.y);
      } else if (Game.commandState === 'drawPath') {
        Game.drawPoints = [{ x: p.x, y: p.y }];
      }
    });

    canvas.addEventListener('pointermove', (e) => {
      e.preventDefault();
      if (Game.commandState !== 'drawPath') return;
      const p = getPos(e);
      Game.pathMove(p.x, p.y);
    });

    canvas.addEventListener('pointerup', (e) => {
      e.preventDefault();
      if (Game.commandState === 'drawPath') Game.pathEnd();
    });

    // 阻止双击缩放 / 长按选中
    canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchend', e => e.preventDefault(), { passive: false });
  },

  hitBox(x, y) {
    const boxes = Game.layout.boxes;
    for (const k in boxes) {
      const b = boxes[k];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  },
};

// ============================================================
// UI：HTML 按钮 / HUD / 结算
// ============================================================
const UI = {
  el: {},
  init() {
    this.el.silver = document.getElementById('silver-label');
    this.el.kills = document.getElementById('kills-label');
    this.el.recruit = document.getElementById('btn-recruit');
    this.el.start = document.getElementById('btn-start');
    this.el.command = document.getElementById('btn-command');
    this.el.surrender = document.getElementById('btn-surrender');
    this.el.hold = document.getElementById('btn-hold');
    this.el.hud = document.getElementById('hud');
    this.el.end = document.getElementById('end-overlay');
    this.el.endTitle = document.getElementById('end-title');
    this.el.endSub = document.getElementById('end-sub');
    this.el.restart = document.getElementById('btn-restart');
    this.el.naming = document.getElementById('naming-overlay');
    this.el.nameInput = document.getElementById('battle-name-input');
    this.el.nameOk = document.getElementById('btn-name-ok');
    this.el.nameCancel = document.getElementById('btn-name-cancel');
    this.el.battleBtns = document.getElementById('battle-btns');

    this.el.recruit.addEventListener('click', () => {
      Game.recruitQing();
      this.refresh();
    });
    this.el.start.addEventListener('click', () => { Game.startBattle(); });
    this.el.command.addEventListener('click', () => Game.beginCommand());
    this.el.surrender.addEventListener('click', () => {
      if (confirm('确定要投降签约吗？这场仗就白打了。')) Game.surrender();
    });
    this.el.hold.addEventListener('click', () => {
      Game.holdPosition();
      this.refresh();
    });
    this.el.nameOk.addEventListener('click', () => this.confirmName());
    this.el.nameCancel.addEventListener('click', () => {
      this.el.naming.classList.add('hidden');
    });
    this.el.nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.confirmName();
    });
    this.el.restart.addEventListener('click', () => location.reload());

    this.refresh();
  },

  confirmName() {
    const name = this.el.nameInput.value;
    this.el.naming.classList.add('hidden');
    Game.beginBattle(name);
    this.refresh();
  },

  showNaming() {
    this.el.nameInput.value = '';
    this.el.naming.classList.remove('hidden');
    setTimeout(() => this.el.nameInput.focus(), 50);
  },

  refresh() {
    this.el.silver.textContent = `军饷：${Game.silver} 两`;
    this.el.kills.textContent = `缴获：${Game.kills} 人`;
    const deploy = Game.phase === 'deploy';
    this.el.recruit.style.display = deploy ? 'block' : 'none';
    this.el.start.style.display = deploy ? 'block' : 'none';
    const battle = Game.phase === 'battle';
    this.el.battleBtns.style.display = battle ? 'flex' : 'none';
    // 死守倒计时
    if (battle && Game.now < Game.holdUntil) {
      const left = Math.ceil(Game.holdUntil - Game.now);
      this.el.hold.textContent = `死守 ${left}s`;
      this.el.hold.classList.add('cooling');
    } else {
      this.el.hold.textContent = '死守';
      this.el.hold.classList.remove('cooling');
    }
  },

  showEnd(win, title, sub) {
    this.el.end.classList.remove('hidden');
    this.el.endTitle.textContent = title;
    this.el.endSub.textContent = sub;
    this.el.end.style.background = win
      ? 'rgba(20,40,20,0.92)' : 'rgba(40,20,20,0.92)';
  },
};
