-- ================================================================
-- 러브몬 AI 시스템 — Supabase SQL Schema
-- Supabase SQL Editor에서 실행하세요.
-- ================================================================

-- 1. 강화학습 Q-테이블 저장
CREATE TABLE IF NOT EXISTS lm_ai_rl_agents (
  agent_id    text PRIMARY KEY,
  q_table     jsonb    NOT NULL DEFAULT '{}',
  epsilon     float    NOT NULL DEFAULT 1.0,
  episode     int      NOT NULL DEFAULT 0,
  reward_sum  float    NOT NULL DEFAULT 0,
  updated_at  timestamptz DEFAULT now()
);

-- 2. 플레이어 행동 로그 (RL 학습 데이터 / 논문 데이터셋)
CREATE TABLE IF NOT EXISTS lm_ai_player_logs (
  id          bigserial PRIMARY KEY,
  nick        text,
  session_id  text,
  state_vec   jsonb,
  action      text,
  reward      float,
  next_state  jsonb,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lm_ai_player_logs_nick_idx ON lm_ai_player_logs(nick);
CREATE INDEX IF NOT EXISTS lm_ai_player_logs_created_idx ON lm_ai_player_logs(created_at DESC);

-- 3. RAG 지식베이스 (게임 문서)
CREATE TABLE IF NOT EXISTS lm_ai_knowledge (
  id          bigserial PRIMARY KEY,
  category    text,           -- item / quest / lore / guide
  title       text,
  content     text NOT NULL,
  keywords    text[],         -- TF-IDF 인덱스용 키워드
  created_at  timestamptz DEFAULT now()
);

-- 4. NPC 대화 기록 (RAG 검색 결과 추적)
CREATE TABLE IF NOT EXISTS lm_ai_conversations (
  id           bigserial PRIMARY KEY,
  nick         text,
  npc_id       text,
  question     text,
  retrieved    jsonb,          -- 검색된 문서 ids
  answer       text,
  satisfaction int,            -- 플레이어 평점 1-5 (선택)
  created_at   timestamptz DEFAULT now()
);

-- 5. 아이템 동반 배치 행렬 (협업 필터링)
CREATE TABLE IF NOT EXISTS lm_ai_item_cooc (
  item_a      text,
  item_b      text,
  cnt         int DEFAULT 1,
  PRIMARY KEY (item_a, item_b)
);

-- 6. 플레이어 세션 통계 (딥러닝 분석용)
CREATE TABLE IF NOT EXISTS lm_ai_sessions (
  id           bigserial PRIMARY KEY,
  nick         text,
  session_id   text UNIQUE,
  playtime_s   int,
  actions_cnt  int,
  zones_visited text[],
  items_used   text[],
  reward_total float,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lm_ai_sessions_nick_idx ON lm_ai_sessions(nick);

-- RLS 비활성화 (anon 접근 허용 — 개발용, 실제 배포 시 RLS 설정 필요)
ALTER TABLE lm_ai_rl_agents     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_ai_player_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_ai_knowledge     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_ai_item_cooc     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lm_ai_sessions      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lm_ai_rl_agents_all     ON lm_ai_rl_agents;
DROP POLICY IF EXISTS lm_ai_player_logs_all   ON lm_ai_player_logs;
DROP POLICY IF EXISTS lm_ai_knowledge_all     ON lm_ai_knowledge;
DROP POLICY IF EXISTS lm_ai_conversations_all ON lm_ai_conversations;
DROP POLICY IF EXISTS lm_ai_item_cooc_all     ON lm_ai_item_cooc;
DROP POLICY IF EXISTS lm_ai_sessions_all      ON lm_ai_sessions;

CREATE POLICY lm_ai_rl_agents_all     ON lm_ai_rl_agents     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY lm_ai_player_logs_all   ON lm_ai_player_logs   FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY lm_ai_knowledge_all     ON lm_ai_knowledge     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY lm_ai_conversations_all ON lm_ai_conversations FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY lm_ai_item_cooc_all     ON lm_ai_item_cooc     FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY lm_ai_sessions_all      ON lm_ai_sessions      FOR ALL TO anon USING (true) WITH CHECK (true);

-- ================================================================
-- 초기 지식베이스 데이터 (RAG 문서)
-- ================================================================
INSERT INTO lm_ai_knowledge (category, title, content, keywords) VALUES
('guide',  '러브몬 기본 안내',
 '러브몬은 펫을 키우며 다른 플레이어와 소통하는 소셜 RPG입니다. 펫에게 밥을 주고, 산책시키고, 친구를 만들어 함께 성장하세요.',
 ARRAY['러브몬','펫','소셜','RPG','기본']),

('guide',  '오픈월드 안내',
 '오픈월드에서는 다른 플레이어의 캐릭터를 만날 수 있습니다. 맵을 자유롭게 탐험하고, NPC와 대화하거나 퀘스트를 수행하세요. 미니맵으로 위치를 확인할 수 있어요.',
 ARRAY['오픈월드','맵','탐험','NPC','퀘스트','미니맵']),

('guide',  '하우스 꾸미기',
 '오픈월드에 분양된 집을 구매하면 내부를 자유롭게 꾸밀 수 있습니다. 소파, 침대, 화분 등 다양한 가구를 배치해 스탯을 높이세요. 가구마다 HP, MP, ATK, DEF, EVA 스탯이 다릅니다.',
 ARRAY['하우스','집','가구','꾸미기','스탯','소파','침대','화분','HP','MP']),

('item',   '황금 소파 정보',
 '황금 소파는 32000P로 구매 가능한 최고급 소파입니다. HP+18, ATK+5, DEF+6 스탯을 제공합니다. 황금빛 외관으로 집을 화려하게 꾸밀 수 있어요.',
 ARRAY['황금소파','소파','골드','HP','ATK','DEF','가구']),

('item',   '마법 도서관 정보',
 '마법 도서관은 40000P의 고급 장식품입니다. MP+25, ATK+5, DEF+5로 마법 스탯에 특화되어 있습니다. 높이가 1.35로 크기가 큰 편입니다.',
 ARRAY['마법도서관','도서관','MP','ATK','DEF','마법','가구']),

('item',   '드래곤 조각상 정보',
 '드래곤 조각상은 45000P의 최고급 장식품으로 ATK+12, DEF+10, HP+8을 제공합니다. 공격과 방어 스탯이 높아 전투형 플레이어에게 인기 있습니다.',
 ARRAY['드래곤','조각상','ATK','DEF','HP','전투','가구']),

('quest',  'NPC 퀘스트 안내',
 'NPC와 상호작용하면 퀘스트를 받을 수 있습니다. 퀘스트를 완료하면 포인트와 희귀 아이템을 얻을 수 있어요. 상인, 약초사, 경비대장 등 다양한 NPC가 맵 곳곳에 있습니다.',
 ARRAY['NPC','퀘스트','포인트','아이템','상인','약초사','경비대장']),

('lore',   '캠프파이어 요리',
 '오픈월드의 캠프파이어에서 요리할 수 있습니다. 재료를 모아 요리하면 특별한 버프 아이템을 만들 수 있어요. 여러 플레이어가 함께 캠프파이어를 즐길 수 있습니다.',
 ARRAY['캠프파이어','요리','재료','버프','아이템','멀티']),

('guide',  '포인트 획득 방법',
 '포인트는 출석 체크, 퀘스트 완료, 펫 활동, 다른 플레이어와 교류, 낚시 등 다양한 방법으로 획득할 수 있습니다. 포인트로 가구, 아이템, 집 분양을 구매하세요.',
 ARRAY['포인트','출석','퀘스트','낚시','교류','구매']),

('guide',  '펫 스탯 성장',
 '펫의 HP, MP, ATK, DEF, EVA 스탯은 아이템 장착, 가구 배치, 퀘스트 완료를 통해 성장합니다. 균형 잡힌 스탯 분배로 다양한 콘텐츠를 즐기세요.',
 ARRAY['펫','스탯','HP','MP','ATK','DEF','EVA','성장','아이템']),

('lore',   '영토전 안내',
 '영토전에서는 길드끼리 지역을 놓고 경쟁합니다. 영토를 점령하면 보너스 포인트와 특별 아이템을 획득할 수 있습니다. 팀원과 협력이 중요합니다.',
 ARRAY['영토전','길드','점령','포인트','아이템','팀','협력']),

('guide',  '낚시 미니게임',
 '오픈월드 낚시터에서 낚시를 즐길 수 있습니다. 찌가 흔들릴 때 타이밍에 맞춰 탭하면 물고기를 잡을 수 있어요. 희귀 물고기일수록 높은 포인트를 드립니다.',
 ARRAY['낚시','물고기','미니게임','포인트','타이밍','탭'])
ON CONFLICT DO NOTHING;
