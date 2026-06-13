/**
 * 러브몬 AI — 협업 필터링 기반 가구 추천 시스템
 * 논문: 아이템 동반 배치 데이터를 활용한 게임 내 콘텐츠 추천
 *
 * 알고리즘: Item-based Collaborative Filtering (Cosine Similarity)
 * 데이터:   실제 플레이어 가구 배치 데이터 (Supabase lm_ow_house_decor)
 * 출력:     현재 배치된 가구와 가장 잘 어울리는 가구 Top-K 추천
 *
 * 추가 기능:
 * - 플레이어 행동 패턴 분석 (세션 통계)
 * - 스탯 최적화 추천 (목표 스탯 기반 그리디)
 */
(function (global) {
  'use strict';

  /* ── 아이템 메타데이터 ── */
  const ITEM_STATS = {
    wood_sofa:          { hp:8,  def:3 },
    pink_sofa:          { hp:10, def:4, eva:1 },
    gold_sofa:          { hp:18, atk:5, def:6 },
    chair_1:            { hp:4,  def:2 },
    chair_2:            { hp:5,  def:2, eva:1 },
    chair_3:            { hp:5,  def:3, mp:2 },
    wood_bed:           { hp:15, mp:5 },
    pink_bed:           { hp:20, mp:8,  def:2 },
    table_1:            { hp:5,  mp:4,  def:2 },
    table_2:            { hp:7,  mp:6,  atk:2 },
    magic_desk:         { mp:10, atk:2 },
    deluxe_magic_desk:  { mp:18, atk:4, def:2 },
    dressing_table:     { mp:8,  eva:2 },
    magic_library:      { mp:25, atk:5, def:5 },
    lucky_pot:          { hp:5,  eva:3 },
    rose_pot:           { hp:6,  eva:3 },
    cherry_tree:        { hp:12, mp:10, eva:4 },
    bedroom_lamp:       { mp:4,  hp:3 },
    bedroom_lamp2:      { mp:5,  hp:3 },
    star_lamp:          { mp:6,  atk:1 },
    ceiling_lamp:       { mp:7,  def:2 },
    dragon_statue:      { atk:12, def:10, hp:8 },
    dragon_fireplace:   { hp:20, def:8,  atk:4 },
    large_fountain:     { hp:15, mp:20, def:6 },
    aquarium:           { mp:15, hp:10, eva:5 },
    piano:              { mp:12, atk:6, def:4 },
  };

  const STAT_KEYS = ['hp', 'mp', 'atk', 'def', 'eva'];

  /* ── 동반 배치 행렬 (in-memory) ── */
  class CooccurrenceMatrix {
    constructor() {
      this._mat = {}; // item_a → { item_b: count }
      this._loaded = false;
    }

    _key(a, b) { return [a, b].sort().join('|'); }

    add(itemA, itemB) {
      if (itemA === itemB) return;
      if (!this._mat[itemA]) this._mat[itemA] = {};
      if (!this._mat[itemB]) this._mat[itemB] = {};
      this._mat[itemA][itemB] = (this._mat[itemA][itemB] || 0) + 1;
      this._mat[itemB][itemA] = (this._mat[itemB][itemA] || 0) + 1;
    }

    /* 코사인 유사도 (동반 배치 벡터 기반) */
    similarity(itemA, itemB) {
      const vecA = this._mat[itemA] || {};
      const vecB = this._mat[itemB] || {};
      const keys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
      let dot = 0, normA = 0, normB = 0;
      for (const k of keys) {
        const a = vecA[k] || 0;
        const b = vecB[k] || 0;
        dot   += a * b;
        normA += a * a;
        normB += b * b;
      }
      if (!normA || !normB) return 0;
      return dot / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    /* 아이템 A 기반 Top-K 추천 (이미 배치된 아이템 제외) */
    topK(itemA, k = 5, excludeSet = new Set()) {
      const scores = {};
      const neighbors = this._mat[itemA] || {};
      // 아이템 A의 동반 아이템들에서 유사도 계산
      for (const candidate of Object.keys(ITEM_STATS)) {
        if (candidate === itemA || excludeSet.has(candidate)) continue;
        scores[candidate] = this.similarity(itemA, candidate);
      }
      return Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, k)
        .map(([id, score]) => ({ id, score: +score.toFixed(3) }));
    }

    /* 배치 목록 전체 기반 추천 (앙상블) */
    topKForSet(placedIds, k = 5) {
      const placedSet = new Set(placedIds);
      const scoreSum = {};

      for (const placed of placedIds) {
        const topItems = this.topK(placed, 20, placedSet);
        for (const { id, score } of topItems) {
          scoreSum[id] = (scoreSum[id] || 0) + score;
        }
      }

      return Object.entries(scoreSum)
        .sort(([, a], [, b]) => b - a)
        .slice(0, k)
        .map(([id, score]) => ({ id, score: +score.toFixed(3) }));
    }

    get loaded() { return this._loaded; }
    set loaded(v) { this._loaded = v; }
    get itemCount() { return Object.keys(this._mat).length; }
  }

  /* ── 스탯 최적화 추천 (그리디 알고리즘) ── */
  function statOptimizedRecommend(targetStat, budget, placedIds, k = 5) {
    const placed = new Set(placedIds);
    const candidates = Object.entries(ITEM_STATS)
      .filter(([id]) => !placed.has(id))
      .map(([id, stats]) => ({
        id,
        statVal: stats[targetStat] || 0,
        stats,
      }))
      .filter(c => c.statVal > 0)
      .sort((a, b) => b.statVal - a.statVal);

    return candidates.slice(0, k).map(c => ({
      id: c.id,
      targetStatGain: c.statVal,
      stats: c.stats,
    }));
  }

  /* ── 추천 시스템 메인 ── */
  class RecommendationSystem {
    constructor() {
      this._matrix = new CooccurrenceMatrix();
      this._sessionStart = Date.now();
      this._actionLog = [];
    }

    async init() {
      if (this._matrix.loaded) return;
      await Promise.all([
        this._loadCooccurrence(),
        this._buildFromExistingDecor(),
      ]);
      this._matrix.loaded = true;
    }

    /* Supabase에서 동반 배치 데이터 로드 */
    async _loadCooccurrence() {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        const { data } = await sb.from('lm_ai_item_cooc')
          .select('item_a,item_b,cnt')
          .limit(5000);
        if (!data) return;
        for (const { item_a, item_b, cnt } of data) {
          for (let i = 0; i < cnt; i++) this._matrix.add(item_a, item_b);
        }
      } catch (e) { /* silent */ }
    }

    /* 실제 배치 데이터(ow_house_decor)에서 동반 배치 자동 학습 */
    async _buildFromExistingDecor() {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        const { data } = await sb.from('lm_ow_house_decor')
          .select('placements')
          .not('placements', 'is', null)
          .limit(500);
        if (!data) return;

        const pairsToUpsert = [];

        for (const row of data) {
          let placements = row.placements;
          if (typeof placements === 'string') {
            try { placements = JSON.parse(placements); } catch { continue; }
          }
          if (!Array.isArray(placements)) continue;
          const ids = placements.map(p => p.itemId).filter(Boolean);

          // 모든 쌍 동반 배치 기록
          for (let i = 0; i < ids.length; i++) {
            for (let j = i + 1; j < ids.length; j++) {
              this._matrix.add(ids[i], ids[j]);
              const [a, b] = [ids[i], ids[j]].sort();
              pairsToUpsert.push({ item_a: a, item_b: b, cnt: 1 });
            }
          }
        }

        // Supabase에 동반 배치 행렬 저장 (배치 upsert)
        if (pairsToUpsert.length) {
          const sb2 = typeof global.__supabaseDb === 'function'
            ? global.__supabaseDb() : global.__supabaseDb;
          // 중복 집계
          const agg = {};
          for (const { item_a, item_b } of pairsToUpsert) {
            const k = item_a + '|' + item_b;
            agg[k] = (agg[k] || { item_a, item_b, cnt: 0 });
            agg[k].cnt++;
          }
          const rows = Object.values(agg);
          // 청크 단위 업서트
          for (let i = 0; i < rows.length; i += 100) {
            await sb2.from('lm_ai_item_cooc')
              .upsert(rows.slice(i, i + 100), { onConflict: 'item_a,item_b' })
              .catch(() => {});
          }
        }
      } catch (e) { /* silent */ }
    }

    /* 협업 필터링 추천 */
    async recommend(placedIds, k = 5) {
      if (!this._matrix.loaded) await this.init();
      return this._matrix.topKForSet(placedIds, k);
    }

    /* 스탯 최적화 추천 */
    statRecommend(targetStat, placedIds, k = 5) {
      return statOptimizedRecommend(targetStat, Infinity, placedIds, k);
    }

    /* 배치 이벤트 학습 (새 가구 배치 시 실시간 업데이트) */
    onItemPlaced(newItemId, currentItems) {
      for (const id of currentItems) {
        if (id !== newItemId) this._matrix.add(newItemId, id);
      }
      // Supabase 비동기 저장
      this._persistPair(newItemId, currentItems);
    }

    async _persistPair(newItem, existingItems) {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        const rows = existingItems
          .filter(id => id !== newItem)
          .map(id => {
            const [a, b] = [newItem, id].sort();
            return { item_a: a, item_b: b, cnt: 1 };
          });
        if (!rows.length) return;
        await sb.from('lm_ai_item_cooc')
          .upsert(rows, { onConflict: 'item_a,item_b' })
          .catch(() => {});
      } catch (e) { /* silent */ }
    }

    /* 플레이어 세션 저장 */
    async saveSession(nick, actions) {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        const playtimeSec = Math.round((Date.now() - this._sessionStart) / 1000);
        await sb.from('lm_ai_sessions').insert({
          nick,
          session_id: nick + '_' + this._sessionStart,
          playtime_s: playtimeSec,
          actions_cnt: actions.length,
          items_used: [...new Set(actions.map(a => a.item).filter(Boolean))],
          created_at: new Date().toISOString(),
        }).catch(() => {});
      } catch (e) { /* silent */ }
    }

    /* 논문 지표 — 추천 다양성 (Intra-List Diversity) */
    diversity(recommendations) {
      if (recommendations.length < 2) return 1;
      let totalSim = 0, cnt = 0;
      for (let i = 0; i < recommendations.length; i++) {
        for (let j = i + 1; j < recommendations.length; j++) {
          totalSim += this._matrix.similarity(recommendations[i].id, recommendations[j].id);
          cnt++;
        }
      }
      return cnt > 0 ? +(1 - totalSim / cnt).toFixed(3) : 1;
    }

    get ready() { return this._matrix.loaded; }
  }

  /* ── 싱글턴 ── */
  const _rec = new RecommendationSystem();

  /* ── 공개 API ── */
  global.LMAIRec = {
    init()                              { return _rec.init(); },
    recommend(placedIds, k)             { return _rec.recommend(placedIds, k); },
    statRecommend(stat, placedIds, k)   { return _rec.statRecommend(stat, placedIds, k); },
    onItemPlaced(newItem, currentItems) { _rec.onItemPlaced(newItem, currentItems); },
    saveSession(nick, actions)          { return _rec.saveSession(nick, actions); },
    diversity(recs)                     { return _rec.diversity(recs); },
    itemStats:                          ITEM_STATS,
    get ready()                         { return _rec.ready; },
  };

})(typeof window !== 'undefined' ? window : globalThis);
