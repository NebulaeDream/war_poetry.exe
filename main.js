// ============================================================
// 启动 + 主循环
// ============================================================
(function () {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d');
  let last = performance.now();
  let rafId = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (Game.W) {
      Game.W = w; Game.H = h;
      Game.computeLayout();
      // 更新方阵框引用（resize 后 layout.boxes 是新对象）
      Game.formations.forEach(f => {
        f.box = Game.layout.boxes[f.id];
        const box = f.box;
        const gap = 15;
        const cols = Math.max(1, Math.floor((box.w - 10) / gap));
        f.soldiers.forEach((s, i) => {
          s.x = box.x + 8 + (i % cols) * gap;
          s.y = box.y + 8 + Math.floor(i / cols) * gap;
        });
      });
    }
  }

  function loop(now) {
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05; // 切后台回来别跳帧
    Game.update(dt);
    Render.draw(ctx);
    UI.refresh();
    rafId = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', resize);

  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  window.addEventListener('load', async () => {
    const w = window.innerWidth, h = window.innerHeight;
    // 先贴图后开局（加载失败就用回退手绘，不卡死）
    const [bg, qing, british] = await Promise.all([
      loadImage('bg.webp'),
      loadImage('qing.webp'),
      loadImage('british.webp'),
    ]);
    Game.images.bg = bg;
    Game.images.qing = qing;
    Game.images.british = british;

    Game.W = w; Game.H = h;
    Game.init(w, h);
    UI.init();
    Input.init(canvas);
    resize();
    // 横屏提示
    const rot = document.getElementById('rotate-hint');
    const check = () => {
      if (window.innerHeight > window.innerWidth) rot.classList.remove('hidden');
      else rot.classList.add('hidden');
    };
    window.addEventListener('resize', check);
    check();
    rafId = requestAnimationFrame(loop);
  });
})();
