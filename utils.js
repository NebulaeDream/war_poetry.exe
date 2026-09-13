// ============================================================
// 工具函数
// ============================================================
const U = {
  rand(min, max) { return min + Math.random() * (max - min); },
  randInt(min, max) { return Math.floor(U.rand(min, max + 1)); },
  clamp(v, a, b) { return v < a ? a : (v > b ? b : v); },
  dist(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); },
  dist2(x1, y1, x2, y2) { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; },
  // 角度插值（最短路径），返回新角度
  lerpAngle(a, b, t) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  },
  degToRad(d) { return d * Math.PI / 180; },
  angleDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  },
  // 把坐标限制在战场内
  bound(x, y, m) {
    return {
      x: U.clamp(x, m, Game.W - m),
      y: U.clamp(y, m, Game.H - m),
    };
  },
};
