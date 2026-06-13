/**
 * 러브몬 AI — RAG (Retrieval-Augmented Generation) NPC 대화 시스템
 * 논문: BM25 기반 지식 검색과 템플릿 생성을 결합한 게임 NPC 대화 시스템
 *
 * 파이프라인:
 *   1. 플레이어 질문 → 한국어 형태소 근사 토크나이저
 *   2. BM25 알고리즘으로 lm_ai_knowledge 검색 (Top-k)
 *   3. 검색된 컨텍스트 + NPC 페르소나 → 응답 생성
 *   4. 대화 기록 → Supabase lm_ai_conversations 저장
 *
 * 토큰 비용 없이 완전 온-디바이스/온-서버 동작
 */
(function (global) {
  'use strict';

  /* ── BM25 파라미터 ── */
  const K1 = 1.5;
  const B  = 0.75;

  /* ── 한국어 근사 토크나이저 (형태소 없이 n-gram + 띄어쓰기) ── */
  function tokenize(text) {
    if (!text) return [];
    const tokens = text.toLowerCase()
      .replace(/[^가-힣A-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0);

    // 2-gram 추가 (한국어 복합어 처리)
    const bigrams = [];
    for (let i = 0; i < tokens.length - 1; i++) {
      bigrams.push(tokens[i] + tokens[i + 1]);
    }
    return [...tokens, ...bigrams];
  }

  /* ── BM25 인덱서 ── */
  class BM25 {
    constructor(docs) {
      this.docs    = docs;
      this.N       = docs.length;
      this.idf     = {};
      this.tf      = [];
      this.avgdl   = 0;
      this._build();
    }

    _build() {
      const df = {};
      let totalLen = 0;

      // 각 문서 토큰화
      this.tf = this.docs.map(doc => {
        const tokens = tokenize(doc.content + ' ' + (doc.title || '') + ' ' + (doc.keywords || []).join(' '));
        totalLen += tokens.length;
        const freq = {};
        tokens.forEach(t => { freq[t] = (freq[t] || 0) + 1; });
        // DF 카운트
        Object.keys(freq).forEach(t => { df[t] = (df[t] || 0) + 1; });
        return { freq, len: tokens.length };
      });

      this.avgdl = this.N > 0 ? totalLen / this.N : 1;

      // IDF 계산
      for (const [t, n] of Object.entries(df)) {
        this.idf[t] = Math.log((this.N - n + 0.5) / (n + 0.5) + 1);
      }
    }

    /* BM25 스코어링 */
    score(queryTokens, docIdx) {
      const { freq, len } = this.tf[docIdx];
      let score = 0;
      for (const t of queryTokens) {
        if (!freq[t]) continue;
        const idf = this.idf[t] || 0;
        const tf  = freq[t];
        const num = tf * (K1 + 1);
        const den = tf + K1 * (1 - B + B * len / this.avgdl);
        score += idf * num / den;
      }
      return score;
    }

    /* Top-k 검색 */
    retrieve(query, k = 3) {
      const qTokens = tokenize(query);
      if (!qTokens.length) return [];

      const scored = this.docs.map((doc, i) => ({
        doc,
        score: this.score(qTokens, i),
      }));

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, k)
        .filter(r => r.score > 0);
    }
  }

  /* ── NPC 페르소나 정의 ── */
  const NPC_PERSONAS = {
    shop_keeper: {
      name: '상인 그레고르',
      greeting: '어서오세요! 무엇을 찾고 계신가요?',
      style: '친절하고 상업적인 말투로',
      suffix: '더 궁금한 점 있으면 언제든 물어보세요! 😊',
    },
    herbalist: {
      name: '약초사 리나',
      greeting: '안녕하세요! 자연의 힘으로 도움이 필요하신가요?',
      style: '따뜻하고 자연 친화적인 말투로',
      suffix: '자연의 힘이 함께하길 바랍니다. 🌿',
    },
    guard_capt: {
      name: '경비대장 브란',
      greeting: '무슨 일이오? 용건을 말하시오.',
      style: '군인처럼 단호하고 간결하게',
      suffix: '더 필요한 것이 있으면 말하시오. ⚔️',
    },
    wanderer: {
      name: '방랑자 셀린',
      greeting: '반가워요~ 여기저기 돌아다니다 만나네요!',
      style: '자유분방하고 친근하게',
      suffix: '다음에 또 봐요! 세상이 넓으니 어딘가에서 또 만날 거예요~ 🌟',
    },
  };

  /* ── 응답 생성기 (템플릿 기반 + 검색 컨텍스트) ── */
  function generateResponse(npcId, query, retrievedDocs) {
    const persona = NPC_PERSONAS[npcId] || NPC_PERSONAS['wanderer'];

    if (!retrievedDocs.length) {
      return `${persona.name}: 음... 그건 저도 잘 모르겠네요. 다른 NPC에게 물어보시는 건 어떨까요?\n${persona.suffix}`;
    }

    // 가장 관련성 높은 문서의 내용을 기반으로 응답 구성
    const topDoc = retrievedDocs[0].doc;
    const content = topDoc.content;

    // 문장 추출 (최대 2문장)
    const sentences = content.split(/[.!?。]\s*/).filter(s => s.trim().length > 0);
    const answer = sentences.slice(0, 2).join('. ') + '.';

    // 복수 문서 참조 시 추가 정보 언급
    let extra = '';
    if (retrievedDocs.length > 1) {
      const secondDoc = retrievedDocs[1].doc;
      const extraSentences = secondDoc.content.split(/[.!?。]\s*/).filter(s => s.trim().length > 0);
      if (extraSentences[0] && extraSentences[0] !== sentences[0]) {
        extra = '\n\n추가로, ' + extraSentences[0] + '.';
      }
    }

    return `${persona.name}: ${answer}${extra}\n\n${persona.suffix}`;
  }

  /* ── RAG 시스템 ── */
  class RAGSystem {
    constructor() {
      this._bm25    = null;
      this._docs    = [];
      this._loading = false;
      this._ready   = false;
    }

    async init() {
      if (this._ready || this._loading) return;
      this._loading = true;
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) { this._loading = false; return; }

        const { data } = await sb.from('lm_ai_knowledge')
          .select('id,category,title,content,keywords')
          .limit(200);

        if (data && data.length) {
          this._docs = data;
          this._bm25 = new BM25(data);
          this._ready = true;
        }
      } catch (e) { /* silent */ }
      this._loading = false;
    }

    /* RAG 쿼리 실행 */
    async query(npcId, question, k = 3) {
      if (!this._ready) await this.init();
      if (!this._bm25) return { answer: this._fallback(npcId), docs: [] };

      const retrieved = this._bm25.retrieve(question, k);
      const answer    = generateResponse(npcId, question, retrieved);

      // 대화 기록 비동기 저장
      this._logConversation(npcId, question, retrieved, answer);

      return {
        answer,
        docs: retrieved.map(r => ({ id: r.doc.id, title: r.doc.title, score: +r.score.toFixed(3) })),
        confidence: retrieved.length > 0 ? +retrieved[0].score.toFixed(3) : 0,
      };
    }

    _fallback(npcId) {
      const p = NPC_PERSONAS[npcId] || NPC_PERSONAS['wanderer'];
      return `${p.name}: 흠, 그건 제가 알기 어렵네요. 다음에 알아봐 드릴게요!\n${p.suffix}`;
    }

    async _logConversation(npcId, question, retrieved, answer) {
      try {
        const sb = typeof global.__supabaseDb === 'function'
          ? global.__supabaseDb() : global.__supabaseDb;
        if (!sb) return;
        const nick = global.S?.myEntry?.nick || 'anon';
        await sb.from('lm_ai_conversations').insert({
          nick,
          npc_id:   npcId,
          question,
          retrieved: retrieved.map(r => r.doc.id),
          answer,
        });
      } catch (e) { /* silent */ }
    }

    /* BM25 인덱스에 새 문서 동적 추가 (실시간 게임 이벤트 반영) */
    addDoc(doc) {
      this._docs.push(doc);
      this._bm25 = new BM25(this._docs); // 재인덱싱
    }

    /* 준비 상태 */
    get ready() { return this._ready; }
    get docCount() { return this._docs.length; }

    /* 논문 지표 — 검색 정밀도 평가 샘플 */
    async evalSample() {
      const testQueries = [
        { q: '소파 스탯', expectedCat: 'item' },
        { q: '포인트 얻는 방법', expectedCat: 'guide' },
        { q: '영토전 어떻게 해', expectedCat: 'lore' },
      ];
      let hits = 0;
      for (const { q, expectedCat } of testQueries) {
        const r = this._bm25?.retrieve(q, 1) || [];
        if (r.length && r[0].doc.category === expectedCat) hits++;
      }
      return { precision: hits / testQueries.length, total: testQueries.length };
    }
  }

  /* ── 싱글턴 ── */
  const _rag = new RAGSystem();

  /* ── 공개 API ── */
  global.LMAIRag = {
    init()                          { return _rag.init(); },
    query(npcId, question, k)       { return _rag.query(npcId, question, k); },
    addDoc(doc)                     { _rag.addDoc(doc); },
    get ready()                     { return _rag.ready; },
    get docCount()                  { return _rag.docCount; },
    personas:                       NPC_PERSONAS,
    eval()                          { return _rag.evalSample(); },
  };

})(typeof window !== 'undefined' ? window : globalThis);
