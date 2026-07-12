/**
 * 러브몬 AI — Q-Learning 강화학습 NPC 행동 에이전트
 * 논문: 브라우저 온-디바이스 강화학습을 활용한 게임 NPC 행동 최적화
 *
 * 알고리즘: Tabular Q-Learning (ε-greedy)
 * 상태공간: 5차원 이산화 (플레이어거리, 주변밀도, 시간대, 세션길이, NPC타입)
 * 행동공간: 5 (patrol, approach, flee, idle, interact)
 * 보상함수: 플레이어 상호작용 + 사회 구역 유지 - 과도한 이탈
 *
 * 가중치(Q-테이블): Supabase lm_ai_rl_agents 에 주기적 동기화
 */
(function (global) {
  'use strict';

  /* ── 상수 ── */
  const ACTIONS     = ['patrol', 'approach', 'idle', 'interact', 'flee'];
  const N_ACTIONS   = ACTIONS.length;
  const ALPHA       = 0.15;   // 학습률
  const GAMMA       = 0.90;   // 할인율
  const EPS_INIT    = 1.0;    // 초기 탐색률
  const EPS_MIN     = 0.05;   // 최소 탐색률
  const EPS_DECAY   = 0.9995; // 탐색률 감소 계수
  const SYNC_EVERY  = 300000; // Supabase 동기화 간격 (5분)
  const LOG_EVERY   = 10;     // 10 스텝마다 로그 저장

  /* ── 상태 이산화 버킷 정의 ── */
  function bucketDist(d)    { return d < 3 ? 0 : d < 8 ? 1 : d < 16 ? 2 : 3; }   // 0~3
  function bucketCrowd(n)   { return n === 0 ? 0 : n < 3 ? 1 : n < 6 ? 2 : 3; }  // 0~3
  function bucketTime()     { const h = new Date().getHours(); return h < 7 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3; }
  function bucketSession(s) { return s < 60 ? 0 : s < 300 ? 1 : s < 900 ? 2 : 3; }// 0~3

  function encodeState(ctx) {
    const d  = bucketDist(ctx.playerDist || 99);
    const c  = bucketCrowd(ctx.crowdCount || 0);
    const t  = bucketTime();
    const s  = bucketSession(ctx.sessionSec || 0);
    const nt = ctx.npcType || 0; // 0~3
    return `${d}${c}${t}${s}${nt}`;
  }

  /* ── Q-Learning 에이전트 ── */
  class QLearningAgent {
    constructor(agentId) {
      this.agentId  = agentId;
      this.qTable   = {};   // stateKey → Float32Array(N_ACTIONS)
      this.epsilon  = EPS_INIT;
      this.episode  = 0;
      this.stepCnt  = 0;
      this.rewardBuf = [];
      this._lastSync = 0;
      this._pendingLogs = [];
    }

    _getQ(state) {
      if (!this.qTable[state]) {
        this.qTable[state] = new Array(N_ACTIONS).fill(0);
      }
      return this.qTable[state];
    }

    /* ε-greedy 행동 선택 */
    selectAction(state) {
      if (Math.random() < this.epsilon) {
        return Math.floor(Math.random() * N_ACTIONS); // 탐색
      }
      const q = this._getQ(state);
      return q.indexOf(Math.max(...q)); // 활용
    }

    /* Q-테이블 업데이트 (Bellman 방정식) */
    update(state, action, reward, nextState, done) {
      const q     = this._getQ(state);
      const qNext = this._getQ(nextState);
      const target = done ? reward : reward + GAMMA * Math.max(...qNext);
      q[action]  += ALPHA * (target - q[action]);

      this.rewardBuf.push(reward);
      if (this.rewardBuf.length > 500) this.rewardBuf.shift();

      // 탐색률 감소
      if (this.epsilon > EPS_MIN) this.epsilon *= EPS_DECAY;

      this.stepCnt++;

      // 로그 버퍼링
      if (this.stepCnt % LOG_EVERY === 0) {
        this._pendingLogs.push({
          state_vec: { state, nextState },
          action: ACTIONS[action],
          reward,
          session_id: this.agentId + '_' + this.episode,
        });
      }

      // 에피소드 종료 처리
      if (done) {
        this.episode++;
        this._flushToSupabase();
      } else {
        // 주기적 동기화
        const now = Date.now();
        if (now - this._lastSync > SYNC_EVERY) {
          this._lastSync = now;
          this._syncQTable();
        }
      }
    }

    avgReward() {
      if (!this.rewardBuf.length) return 0;
      return this.rewardBuf.reduce((a, b) => a + b, 0) / this.rewardBuf.length;
    }

    /* Q-테이블 직렬화 (JSON-safe) */
    _serializeQTable() {
      const out = {};
      for (const [k, v] of Object.entries(this.qTable)) {
        out[k] = v;
      }
      return out;
    }

    /* Supabase Q-테이블 저장 */
    async _syncQTable() {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        await sb.from('lm_ai_rl_agents').upsert({
          agent_id:   this.agentId,
          q_table:    this._serializeQTable(),
          epsilon:    this.epsilon,
          episode:    this.episode,
          reward_sum: this.avgReward(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'agent_id' });
      } catch (e) { /* silent */ }
    }

    /* Supabase 로그 + Q-테이블 저장 */
    async _flushToSupabase() {
      await this._syncQTable();
      if (!this._pendingLogs.length) return;
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        const nick = global.S?.myEntry?.nick || 'anon';
        const rows = this._pendingLogs.map(l => ({ nick, ...l }));
        this._pendingLogs = [];
        await sb.from('lm_ai_player_logs').insert(rows);
      } catch (e) { this._pendingLogs = []; }
    }

    /* Supabase에서 Q-테이블 로드 */
    async loadFromSupabase() {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return false;
        const { data } = await sb.from('lm_ai_rl_agents')
          .select('q_table,epsilon,episode')
          .eq('agent_id', this.agentId)
          .maybeSingle();
        if (!data) return false;
        this.qTable  = data.q_table || {};
        this.epsilon = data.epsilon ?? EPS_INIT;
        this.episode = data.episode ?? 0;
        return true;
      } catch (e) { return false; }
    }

    /* 통계 (논문 지표) */
    stats() {
      return {
        agentId:    this.agentId,
        episode:    this.episode,
        epsilon:    +this.epsilon.toFixed(4),
        avgReward:  +this.avgReward().toFixed(4),
        stateCount: Object.keys(this.qTable).length,
        stepCount:  this.stepCnt,
      };
    }
  }

  /* ── NPC 행동 컨트롤러 ── */
  class NpcAIController {
    constructor(npcId, npcType = 0) {
      this.npcId   = npcId;
      this.agent   = new QLearningAgent('npc_' + npcType);
      this.npcType = npcType;
      this._prevState = null;
      this._prevAction = null;
      this._sessionStart = Date.now();
      this._ready = false;
      this._init();
    }

    async _init() {
      await this.agent.loadFromSupabase();
      this._ready = true;
    }

    /* 게임 틱마다 호출 — 행동 반환 */
    tick(ctx) {
      if (!this._ready) return 'patrol';
      const sessionSec = (Date.now() - this._sessionStart) / 1000;
      const state = encodeState({ ...ctx, npcType: this.npcType, sessionSec });

      // 이전 스텝 학습
      if (this._prevState !== null) {
        const reward = this._calcReward(ctx);
        this.agent.update(this._prevState, this._prevAction, reward, state, false);
      }

      const actionIdx = this.agent.selectAction(state);
      this._prevState  = state;
      this._prevAction = actionIdx;
      return ACTIONS[actionIdx];
    }

    _calcReward(ctx) {
      let r = 0;
      if (ctx.playerDist < 4)  r += 1.0;  // 플레이어 가까이
      if (ctx.playerDist < 2)  r += 0.5;  // 매우 근접
      if (ctx.crowdCount > 2)  r += 0.3;  // 사회적 구역 유지
      if (ctx.playerInteracted) r += 2.0; // 플레이어가 클릭/상호작용
      if (ctx.playerDist > 20) r -= 0.5;  // 너무 멀리 이탈
      return r;
    }

    onSessionEnd() {
      if (this._prevState !== null) {
        this.agent.update(this._prevState, this._prevAction, 0, '00000', true);
      }
    }

    stats() { return this.agent.stats(); }
  }

  /* ── 전역 에이전트 풀 ── */
  const _agents = new Map();

  function getOrCreateAgent(npcId, npcType) {
    if (!_agents.has(npcId)) {
      _agents.set(npcId, new NpcAIController(npcId, npcType));
    }
    return _agents.get(npcId);
  }

  /* ── 공개 API ── */
  global.LMAIRl = {
    getAgent: getOrCreateAgent,
    tick(npcId, npcType, ctx) {
      return getOrCreateAgent(npcId, npcType).tick(ctx);
    },
    onSessionEnd(npcId) {
      if (_agents.has(npcId)) _agents.get(npcId).onSessionEnd();
    },
    allStats() {
      return [..._agents.values()].map(a => a.stats());
    },
    /* 논문 지표 — 전체 에이전트 평균 보상 */
    avgRewardAll() {
      const stats = [..._agents.values()].map(a => a.agent.avgReward());
      if (!stats.length) return 0;
      return stats.reduce((a, b) => a + b, 0) / stats.length;
    },
  };

})(typeof window !== 'undefined' ? window : globalThis);
