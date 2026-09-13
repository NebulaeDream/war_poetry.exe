// ============================================================
// 《战争诗歌》配置表 —— 所有数值集中在这里，方便调平衡
// ============================================================
const CONFIG = {
  // 清军（玩家方，冷兵器近战流）
  qing: {
    cost: 2,            // 招募单价：两白银
    hp: 10,
    attackInterval: 1.0,// 1秒/刀
    meleeRange: 26,     // 近战索敌距离（px）
    engageRange: 95,    // 行军途中遇敌停下的距离
    speed: 82,          // 行军速度 px/s
    dmgMin: 4.5,        // 士气低迷时（手抖）伤害
    dmgBase: 6,         // 基础伤害
    dmgMax: 10,         // 怒气拉满（复仇）一刀秒杀
    angerStart: 55,     // 初始怒气（≈基础伤害8）
    angerMax: 100,
    angerPerHit: 5,     // 出手一次涨的怒气
    angerPerAllyDeath: 16, // 身边战友阵亡涨怒气
    angerDecay: 7,      // 脱离战斗后每秒回落
    radius: 11,         // 球缩小一点
  },

  // 英军（AI 方，排队枪毙流）
  british: {
    hp: 15,               // 英军更耐打
    attackInterval: 5.0,  // 5秒/枪
    range: 330,           // 滑膛枪射程
    speed: 30,
    dmg: 10,              // 子弹固定10点
    radius: 11,
    accuracy: 0.85,
    turnTime: 1.5,
    // 近战：被贴脸就砍，不开枪
    meleeDmg: 6,
    meleeInterval: 2.0,
    meleeRange: 30,
    kiteRange: 150,       // 敌人进入此距离→边退边射
    kiteSpeed: 46,
    advanceSpeed: 22,     // 没发现敌人时向前推进
    fleeLossThreshold: 0.38,
    reserveFraction: 0.20,
  },

  // 英军炮兵（两尊，范围炮击）
  artillery: {
    count: 2,
    hp: 15,
    cooldown: 10,         // 10秒一发
    range: 470,           // 比步枪远
    splash: 68,           // 爆炸半径（圈内清军全灭）
    speed: 18,
    radius: 12,
  },

  // 经济
  economy: {
    startMin: 250,
    startMax: 350,        // 平均多 50 两
    killBounty: 5,
  },

  // 战场
  battle: {
    fodderCount: 10,
    britishMin: 30,
    britishMax: 40,       // 步兵数量随机区间
  },
};
