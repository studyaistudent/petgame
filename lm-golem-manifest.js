/**
 * 오픈월드/golem — 애니메이션별 GLB (레비아탄·정예 골렘)
 */
(function (global) {
  'use strict';

  const DIR = '오픈월드/golem/';
  const BASE = 'Meshy_AI_내_아바타_캐릭터_biped_Animation_';

  function glb(suffix) {
    return DIR + BASE + suffix + '_withSkin.glb';
  }

  const urls = {
    walk: glb('Walking'),
    run: glb('Running'),
    attack: glb('Attack'),
    skill01: glb('Skill_01'),
    skill03: glb('Skill_03'),
    combo: glb('Triple_Combo_Attack'),
    hit: glb('BeHit_FlyUp'),
    dead: glb('Dead'),
  };

  const attackPool = ['attack', 'skill01', 'skill03', 'combo'];
  /** 월드 보스(지퍼리드·레비아탄) — Skill_01 / Skill_03 / Triple_Combo 만 */
  const bossAttackPool = ['skill01', 'skill03', 'combo'];
  const bossMoveAnim = 'walk';
  const bossDeadAnim = 'dead';

  function pickAttack(pat) {
    if (pat === 'slam') return 'skill03';
    if (pat === 'charge') return 'combo';
    if (pat === 'projectile') return 'skill01';
    if (pat === 'melee') return 'attack';
    return attackPool[Math.floor(Math.random() * attackPool.length)];
  }

  function pickBossAttack() {
    return bossAttackPool[Math.floor(Math.random() * bossAttackPool.length)];
  }

  /** 레비아탄·지퍼리드 등 월드 보스 틴트 */
  const bossTints = {
    leviathan: 0x1565c0,
    zipfer: 0xff4422,
    default: 0x90a4ae,
  };

  global.OW_GOLEM_MANIFEST = {
    urls,
    attackPool,
    bossAttackPool,
    bossMoveAnim,
    bossDeadAnim,
    pickAttack,
    pickBossAttack,
    bossTints,
    animHoldMs: {
      attack: 880,
      skill01: 920,
      skill03: 1000,
      combo: 1100,
      hit: 520,
      dead: 0,
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
