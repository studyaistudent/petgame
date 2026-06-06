/**
 * Firestore-compat layer for Supabase (러브몬 index.html)
 * 브라우저에는 anon key 만 사용하세요. service_role 금지.
 */
(function (global) {
  'use strict';

  const SUPABASE_URL = 'https://artffbwsalrcockbwoel.supabase.co';
  const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFydGZmYndzYWxyY29ja2J3b2VsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NjI4MTcsImV4cCI6MjA5NTMzODgxN30.jLShpG45WaMapZ27wsWyUa-em-JXd0IBZOMF7pSlDY0';

  const DELETE_FIELD = Symbol('sb-delete');
  const INC_FIELD = Symbol('sb-inc');

  const CAMEL_TO_SNAKE = {
    isAdminChecked: 'is_admin_checked',
    petEmoji: 'pet_emoji',
    petName: 'pet_name',
    petDesc: 'pet_desc',
    isBred: 'is_bred',
    lastLogin: 'last_login',
    loginStreak: 'login_streak',
    nameChangeCount: 'name_change_count',
    affectionMap: 'affection_map',
    diceStats: 'dice_stats',
    currentHp: 'current_hp',
    currentMp: 'current_mp',
    currentSp: 'current_sp',
    petInventory: 'pet_inventory',
    pendingFurniture: 'pending_furniture',
    dailyQuests: 'daily_quests',
    dungeonKills: 'dungeon_kills',
    dungeonBattleCount: 'dungeon_battle_count',
    dungeonCooldownStart: 'dungeon_cooldown_start',
    rebirthCount: 'rebirth_count',
    activeCardSkin: 'active_card_skin',
    activeTitle: 'active_title',
    mafiaRecord: 'mafia_record',
    onecardRecord: 'oncard_record',
    owData: 'ow_data',
    parent1Nick: 'parent1_nick',
    parent2Nick: 'parent2_nick',
    parent1Emoji: 'parent1_emoji',
    parent2Emoji: 'parent2_emoji',
    parent1Pet: 'parent1_pet',
    parent2Pet: 'parent2_pet',
    childEmoji: 'child_emoji',
    childName: 'child_name',
    childDesc: 'child_desc',
    fromEmoji: 'from_emoji',
    fromPetName: 'from_pet_name',
    toEmoji: 'to_emoji',
    toPetName: 'to_pet_name',
    babyEmoji: 'baby_emoji',
    babyName: 'baby_name',
    babyDesc: 'baby_desc',
    hatchTime: 'hatch_time',
    hatchReduction: 'hatch_reduction',
    babyLevel: 'baby_level',
    babyXp: 'baby_xp',
    babyPoints: 'baby_points',
    babyStats: 'baby_stats',
    feedLog: 'feed_log',
    petPosition: 'pet_position',
    activeVisitors: 'active_visitors',
    visitorHistory: 'visitor_history',
    isOpen: 'is_open',
    isCorrect: 'is_correct',
    roomName: 'room_name',
    chatLog: 'chat_log',
    nightActions: 'night_actions',
    dayVotes: 'day_votes',
    updatedAt: 'updated_at',
    sellerNick: 'seller_nick',
    sellerEmoji: 'seller_emoji',
    itemKind: 'item_kind',
    startPrice: 'start_price',
    bidIncrement: 'bid_increment',
    currentBid: 'current_bid',
    topBidder: 'top_bidder',
    topBidderEmoji: 'top_bidder_emoji',
    bidCount: 'bid_count',
    endsAt: 'ends_at',
    winnerNick: 'winner_nick',
    settledAt: 'settled_at',
    heightCm: 'height_cm',
    rotY: 'rot_y',
    inCar: 'in_car',
    isDriver: 'is_driver',
    chatMsg: 'chat_msg',
    chatExpire: 'chat_expire',
    fromNick: 'from_nick',
    toNick: 'to_nick',
    itemName: 'item_name',
    itemEmoji: 'item_emoji',
    strokeData: 'stroke_data',
    startedAt: 'started_at',
    senderGender: 'sender_gender',
    receiverGender: 'receiver_gender',
    user1Gender: 'user1_gender',
    user2Gender: 'user2_gender',
  };

  const SNAKE_TO_CAMEL = Object.fromEntries(
    Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
  );

  const COL_META = {
    mbti_entries: { pk: 'id', known: ['nick', 'pin', 'gender', 'mbti', 'time', 'is_admin_checked', 'extra'] },
    balance_entries: { pk: 'id', known: ['nick', 'gender', 'answers', 'time', 'extra'] },
    dating_entries: { pk: 'id', known: ['nick', 'gender', 'answers', 'time', 'extra'] },
    roses: { pk: 'id', known: ['sender', 'sender_gender', 'receiver', 'receiver_gender', 'date', 'extra'] },
    mutual_roses: { pk: 'id', known: ['user1', 'user1_gender', 'user2', 'user2_gender', 'date', 'extra'] },
    lm_pets: { pk: 'nick', overflowCol: 'data', known: ['nick', 'gender', 'mbti', 'pet_emoji', 'pet_name', 'pet_desc', 'level', 'xp', 'points', 'is_bred', 'last_login', 'login_streak', 'name_change_count', 'affection_map', 'iq', 'dice_stats', 'current_hp', 'current_mp', 'current_sp', 'inventory', 'pet_inventory', 'equipment', 'pending_furniture', 'daily_quests', 'dungeon_kills', 'dungeon_battle_count', 'dungeon_cooldown_start', 'rebirth_count', 'active_card_skin', 'active_title', 'mafia_record', 'oncard_record', 'ow_data', 'data'] },
    lm_game: { pk: 'doc_key', dataBlob: true },
    lm_chat: { pk: 'id', known: ['nick', 'message', 'is_correct', 'type', 'extra'] },
    lm_breed_requests: { pk: 'id', alias: { from: 'from_nick', to: 'to_nick' }, known: ['from_nick', 'from_emoji', 'from_pet_name', 'to_nick', 'to_emoji', 'to_pet_name', 'status', 'extra'] },
    lm_family: { pk: 'id', known: ['parent1_nick', 'parent1_emoji', 'parent1_pet', 'parent2_nick', 'parent2_emoji', 'parent2_pet', 'child_emoji', 'child_name', 'child_desc', 'extra'] },
    lm_feed_logs: { pk: 'id', alias: { from: 'from_nick', to: 'to_nick' }, known: ['from_nick', 'to_nick', 'item', 'emoji', 'xp', 'extra'] },
    lm_baby_pets: { pk: 'id', known: ['parent1_nick', 'parent2_nick', 'parent1_emoji', 'parent2_emoji', 'baby_emoji', 'baby_name', 'baby_desc', 'hatch_time', 'hatch_reduction', 'hatched', 'baby_level', 'baby_xp', 'baby_points', 'baby_stats', 'rarity', 'feed_log', 'extra'] },
    lm_houses: { pk: 'nick', known: ['nick', 'tier', 'wallpaper', 'floor', 'furniture', 'inventory', 'visitors', 'guestbook', 'is_open', 'pet_position', 'active_visitors', 'visitor_history', 'extra'] },
    lm_gifts: { pk: 'id', alias: { from: 'from_nick', to: 'to_nick' }, known: ['from_nick', 'from_emoji', 'to_nick', 'type', 'item_name', 'item_emoji', 'read', 'extra'] },
    lm_cm_strokes: { pk: 'id', strokeBlob: true },
    lm_cm_guesses: { pk: 'id', known: ['nick', 'message', 'is_correct', 'extra'] },
    lm_mafia_rooms: { pk: 'id', known: ['room_name', 'host', 'status', 'players', 'chat_log', 'night_actions', 'day_votes', 'extra'] },
    lm_auctions: { pk: 'id', known: ['seller_nick', 'seller_emoji', 'item_kind', 'item', 'start_price', 'bid_increment', 'current_bid', 'top_bidder', 'top_bidder_emoji', 'bid_count', 'ends_at', 'status', 'winner_nick', 'settled_at', 'extra'] },
    lm_openworld_players: { pk: 'nick', known: ['nick', 'emoji', 'gender', 'avatar', 'height_cm', 'x', 'z', 'rot_y', 'state', 'in_car', 'is_driver', 'chat_msg', 'chat_expire', 'ts', 'extra'] },
    lm_openworld_trades: { pk: 'id', alias: { from: 'from_nick', to: 'to_nick' }, known: ['from_nick', 'from_emoji', 'to_nick', 'status', 'participants', 'seller_offer', 'buyer_offer', 'seller_locked', 'buyer_locked', 'extra'] },
    lm_openworld_cars: { pk: 'doc_key', dataBlob: true },
    lm_openworld_events: { pk: 'doc_key', dataBlob: true },
    lm_ow_world_events: { pk: 'id', dataBlob: true, startedCol: 'started_at' },
    lm_ow_economy: { pk: 'doc_key', dataBlob: true },
    lm_ow_territories: { pk: 'id', dataBlob: true },
    lm_ow_world_boss: { pk: 'doc_key', dataBlob: true },
    lm_ow_house_trade: { pk: 'doc_key', dataBlob: true },
    lm_ow_house_plots: { pk: 'plot_id', known: ['plot_id', 'owner', 'purchased_at', 'cost', 'extra'] },
  };

  const ORDER_MAP = {
    timestamp: 'created_at',
    updatedAt: 'updated_at',
    startedAt: 'started_at',
    ts: 'ts',
  };

  /** 스키마에 created_at 없음 */
  const NO_CREATED_AT = new Set([
    'lm_game',
    'lm_openworld_players',
    'lm_openworld_cars',
    'lm_openworld_events',
    'lm_ow_world_events',
    'lm_ow_economy',
    'lm_ow_territories',
    'lm_ow_world_boss',
    'lm_ow_house_trade',
    'lm_ow_house_plots',
  ]);

  /** Firestore timestamp = 활동 시각(updated_at) */
  const TIMESTAMP_USES_UPDATED_AT = new Set(['lm_pets', 'lm_houses']);

  /** created_at 없는 테이블용 기본 정렬 컬럼 */
  const DEFAULT_ORDER_COL = {
    lm_openworld_players: 'ts',
    lm_openworld_cars: 'updated_at',
    lm_openworld_events: 'updated_at',
    lm_ow_economy: 'updated_at',
    lm_ow_territories: 'updated_at',
    lm_ow_world_boss: 'updated_at',
    lm_ow_house_trade: 'updated_at',
    lm_ow_house_plots: 'purchased_at',
    lm_ow_world_events: 'started_at',
    lm_game: 'updated_at',
  };

  function defaultOrderFor(table) {
    if (DEFAULT_ORDER_COL[table]) return DEFAULT_ORDER_COL[table];
    if (NO_CREATED_AT.has(table)) return 'updated_at';
    return 'created_at';
  }

  function orderColForTimestamp(table) {
    if (table === 'lm_openworld_players') return 'ts';
    if (TIMESTAMP_USES_UPDATED_AT.has(table)) return 'updated_at';
    if (NO_CREATED_AT.has(table)) return DEFAULT_ORDER_COL[table] || 'updated_at';
    return 'created_at';
  }

  function camelKey(k) {
    return SNAKE_TO_CAMEL[k] || k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
  function snakeKey(k) {
    if (CAMEL_TO_SNAKE[k]) return CAMEL_TO_SNAKE[k];
    return k.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase());
  }

  function isIncrement(v) {
    return v && v.__op === 'increment';
  }
  function isDelete(v) {
    return v === DELETE_FIELD || (v && v.__op === 'delete');
  }
  function isServerTimestamp(v) {
    return v && v.__op === 'serverTimestamp';
  }

  const META_SKIP_KEYS = new Set(['id', 'timestamp', 'createdAt', 'updatedAt', 'doc_key']);

  function meta(table) {
    return COL_META[table] || { pk: 'id', known: [], overflowCol: 'extra' };
  }

  function stripDocMeta(data) {
    if (!data || typeof data !== 'object') return data;
    const o = Array.isArray(data) ? [...data] : { ...data };
    if (!Array.isArray(o)) {
      META_SKIP_KEYS.forEach((k) => delete o[k]);
    }
    return o;
  }

  function sanitizeRow(row) {
    try {
      return JSON.parse(
        JSON.stringify(row, (_k, v) => {
          if (v === undefined) return undefined;
          if (typeof v === 'number' && !Number.isFinite(v)) return 0;
          return v;
        })
      );
    } catch (e) {
      console.error('[supabase] JSON sanitize failed', e, row);
      throw new Error('저장 데이터 직렬화 실패(순환 참조 등)');
    }
  }

  function applyAliases(data, alias) {
    if (!alias) return { ...data };
    const out = { ...data };
    for (const [from, to] of Object.entries(alias)) {
      if (from in out) {
        out[to] = out[from];
        delete out[from];
      }
    }
    return out;
  }

  function unalias(data, alias) {
    if (!alias) return { ...data };
    const rev = Object.fromEntries(Object.entries(alias).map(([a, b]) => [b, a]));
    const out = { ...data };
    for (const [snake, camel] of Object.entries(rev)) {
      if (snake in out) {
        out[camel] = out[snake];
        if (camel !== snake) delete out[snake];
      }
    }
    return out;
  }

  function rowToDoc(table, row) {
    if (!row) return {};
    const m = meta(table);
    let doc = {};

    if (m.dataBlob) {
      const key = row[m.pk];
      doc = { ...(row.data || {}) };
      doc.id = key;
      if (m.pk === 'doc_key') doc.id = key;
    } else if (m.strokeBlob) {
      doc = { ...(row.stroke_data || {}) };
      doc.id = row.id;
    } else {
      const known = new Set([m.pk, 'created_at', 'updated_at', 'data', 'stroke_data', 'started_at', ...(m.known || [])]);
      for (const [k, v] of Object.entries(row)) {
        if (v === null || v === undefined) continue;
        const ck = camelKey(k);
        if (known.has(k) || m.known?.includes(k)) doc[ck] = v;
        else if (k === 'extra' && v && typeof v === 'object') Object.assign(doc, unalias(v, m.alias));
        else if (k === 'data' && v && typeof v === 'object') Object.assign(doc, v);
      }
      doc.id = row[m.pk];
      if (m.pk === 'nick') doc.id = row.nick;
    }

    doc = unalias(doc, m.alias);
    /* Supabase 컬럼명(snake) 폴백 — 예전 데이터 호환 */
    if (table === 'lm_pets') {
      /* cardSkins / titles / gachaHistory 등은 data JSON overflow — 최상위로 펼침 */
      if (doc.data && typeof doc.data === 'object' && !Array.isArray(doc.data)) {
        const blob = doc.data;
        delete doc.data;
        for (const [bk, bv] of Object.entries(blob)) {
          if (bv === null || bv === undefined) continue;
          if (doc[bk] === undefined) doc[bk] = bv;
        }
      }
      if (!doc.petEmoji && doc.pet_emoji) doc.petEmoji = doc.pet_emoji;
      if (!doc.petName && doc.pet_name) doc.petName = doc.pet_name;
      if (!doc.petDesc && doc.pet_desc) doc.petDesc = doc.pet_desc;
      if (doc.isBred == null && doc.is_bred != null) doc.isBred = doc.is_bred;
      if (!doc.petEmoji) doc.petEmoji = '🐾';
      if (doc.dungeonBattleCount == null && row.dungeon_battle_count != null) {
        doc.dungeonBattleCount = row.dungeon_battle_count;
      }
      if (doc.dungeonCooldownStart == null && row.dungeon_cooldown_start != null) {
        doc.dungeonCooldownStart = Number(row.dungeon_cooldown_start);
      }
    }
    if (row.created_at) {
      doc.timestamp = row.created_at;
      doc.createdAt = row.created_at;
    }
    if (row.updated_at) doc.updatedAt = row.updated_at;
    if (row.started_at != null) doc.startedAt = row.started_at;

    return doc;
  }

  function docToRow(table, data, merge) {
    const m = meta(table);
    let d = applyAliases(stripDocMeta({ ...data }), m.alias);
    const row = {};

    if (m.dataBlob) {
      const key = d.id || d.doc_key;
      const payload = { ...d };
      delete payload.id;
      delete payload.doc_key;
      row[m.pk] = key;
      row.data = merge && payload.__mergeData ? payload.__mergeData : payload;
      return row;
    }

    if (m.strokeBlob) {
      const payload = { ...d };
      delete payload.id;
      delete payload.timestamp;
      row.stroke_data = payload;
      return row;
    }

    const known = new Set(m.known || []);
    const overflow = {};
    const overflowCol = m.overflowCol || (known.has('data') ? 'data' : known.has('extra') ? 'extra' : null);

    for (const [k, v] of Object.entries(d)) {
      if (v === undefined || v === null) continue;
      if (isServerTimestamp(v)) continue;
      if (isIncrement(v) || isDelete(v)) continue;
      if (META_SKIP_KEYS.has(k)) continue;
      const sk = snakeKey(k);
      if (known.has(sk)) row[sk] = v;
      else overflow[k] = v;
    }
    if (overflowCol && Object.keys(overflow).length) {
      row[overflowCol] = { ...(row[overflowCol] || {}), ...overflow };
    }
    if (d.id && m.pk === 'id') row.id = d.id;
    if (d.nick && m.pk === 'nick') row.nick = d.nick;
    if (m.pk === 'doc_key' && d.id) row.doc_key = d.id;
    if (d.startedAt != null && m.startedCol) row.started_at = d.startedAt;
    return row;
  }

  function setByPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {};
      cur = cur[p];
    }
    const last = parts[parts.length - 1];
    if (isDelete(value)) delete cur[last];
    else cur[last] = value;
  }

  function getByPath(obj, path) {
    return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), obj);
  }

  function applyUpdatePatch(existing, patch) {
    const out = JSON.parse(JSON.stringify(existing || {}));
    for (const [k, v] of Object.entries(patch)) {
      if (k.includes('.')) setByPath(out, k, isDelete(v) ? DELETE_FIELD : isIncrement(v) ? (getByPath(out, k) || 0) + v.by : v);
      else if (isDelete(v)) delete out[k];
      else if (isIncrement(v)) out[k] = (Number(out[k]) || 0) + v.by;
      else out[k] = v;
    }
    return out;
  }

  /* Supabase Auth — 메모리 스토리지 + 클라이언트 싱글톤 (GoTrue 중복 경고 방지) */
  const __sbAuthMem = {};
  const sbAuthStorage = {
    getItem: (key) => (__sbAuthMem[key] ?? null),
    setItem: (key, val) => {
      __sbAuthMem[key] = val;
    },
    removeItem: (key) => {
      delete __sbAuthMem[key];
    },
  };

  let __sbRestClient = null;
  const __baseFetch = global.fetch.bind(global);

  /** HTTP 헤더는 Latin-1만 허용 — 한글 닉은 Base64(UTF-8)만 전송 */
  function lmB64Utf8(s) {
    if (s == null || s === '') return '';
    try {
      if (typeof TextEncoder !== 'undefined') {
        const bytes = new TextEncoder().encode(String(s));
        let bin = '';
        bytes.forEach((b) => {
          bin += String.fromCharCode(b);
        });
        return btoa(bin);
      }
      return btoa(unescape(encodeURIComponent(String(s))));
    } catch (_) {
      return '';
    }
  }

  function lmReadUser() {
    let nick = '';
    let pin = '';
    try {
      const raw = global.localStorage && global.localStorage.getItem('lmg_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u && u.nick) {
          nick = String(u.nick).trim();
          pin = String(u.pin || '').trim();
        }
      }
    } catch (_) {}
    if (!nick && typeof document !== 'undefined') {
      const n = document.getElementById('nickI');
      const p = document.getElementById('pinI');
      if (n && n.value && String(n.value).trim()) {
        nick = String(n.value).trim();
        pin = p && p.value ? String(p.value).trim() : '';
      }
    }
    /* MBTI 완료 등 입력 폼이 사라진 뒤에도 S.nick/S.pin 으로 RLS 헤더 유지 */
    if (!nick && global.S) {
      if (global.S.myEntry?.nick) {
        nick = String(global.S.myEntry.nick).trim();
        pin = String(global.S.myEntry.pin || global.S.pin || '').trim();
      } else if (global.S.nick) {
        nick = String(global.S.nick).trim();
        pin = String(global.S.pin || '').trim();
      }
    }
    return { nick, pin };
  }

  function lmAuthHeaders() {
    const { nick, pin } = lmReadUser();
    const out = {};
    const nb = nick ? lmB64Utf8(nick) : '';
    const pb = pin ? lmB64Utf8(pin) : '';
    if (nb && /^[A-Za-z0-9+/=]+$/.test(nb)) out['x-lm-nick-b64'] = nb;
    if (pb && /^[A-Za-z0-9+/=]+$/.test(pb)) out['x-lm-pin-b64'] = pb;
    return out;
  }

  function lmStripLegacyAuthHeaders(headers) {
    ['x-lm-nick', 'x-lm-pin', 'X-Lm-Nick', 'X-Lm-Pin'].forEach((h) => {
      try {
        headers.delete(h);
      } catch (_) {}
    });
  }

  function getRestClient() {
    if (__sbRestClient) return __sbRestClient;
    __sbRestClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storageKey: 'lm-lovemon-auth',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: sbAuthStorage,
      },
      realtime: { params: { eventsPerSecond: 20 } },
      global: {
        fetch: (input, init = {}) => {
          const opts = { ...init };
          delete opts.headers;
          const headers = new Headers(init.headers || {});
          lmStripLegacyAuthHeaders(headers);
          const extra = lmAuthHeaders();
          for (const [k, v] of Object.entries(extra)) {
            const val = String(v);
            if ((k === 'x-lm-nick-b64' || k === 'x-lm-pin-b64') && /^[A-Za-z0-9+/=]+$/.test(val)) {
              headers.set(k, val);
            }
          }
          return __baseFetch(input, { ...opts, headers });
        },
      },
    });
    return __sbRestClient;
  }

  const __tableMissingWarned = new Set();
  const __tableMissingDead = new Set();

  function isTableMissingError(e) {
    const code = e && (e.code || e.details);
    const msg = String((e && e.message) || e || '');
    return code === 'PGRST205' || msg.indexOf('Could not find the table') >= 0 || msg.indexOf('PGRST205') >= 0;
  }

  function isTableDead(table) {
    return __tableMissingDead.has(table);
  }

  function warnTableMissing(table) {
    if (__tableMissingWarned.has(table)) return;
    __tableMissingWarned.add(table);
    const hint = table === 'lm_ow_house_plots'
      ? ' — Supabase SQL Editor에서 supabase_lm_ow_house_plots.sql 실행'
      : '';
    console.warn('[supabase]', table, '테이블 없음' + hint);
  }

  function markTableMissingDead(table) {
    if (__tableMissingDead.has(table)) return;
    __tableMissingDead.add(table);
    warnTableMissing(table);
    for (const [key, entry] of __rtChannels.entries()) {
      if (key === `col:${table}` || key.startsWith(`doc:${table}:`)) {
        entry.dead = true;
        stopPollFallback(entry);
        teardownRtEntry(getRestClient(), entry);
      }
    }
  }

  /** 테이블당 Realtime 채널 1개 — WebSocket 실패 시 REST 폴링 폴백 */
  const __rtChannels = new Map();
  const __rtWarnedTables = new Set();
  let __rtStaggerMs = 0;
  let __rtPollOnly = false;

  function pollIntervalFor(table) {
    if (table === 'lm_openworld_players') return 2000;
    if (table === 'lm_openworld_events' || table === 'lm_ow_world_events') return 2500;
    if (table === 'lm_mafia_rooms' || table === 'lm_chat') return 3000;
    return 5000;
  }

  function rtNotifyCallbacks(entry, table) {
    entry.callbacks.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error('[supabase]', table, e);
      }
    });
  }

  function startPollFallback(entry, table) {
    if (entry.pollTimer || entry.dead || isTableDead(table)) return;
    const ms = pollIntervalFor(table);
    if (!__rtWarnedTables.has(table)) {
      __rtWarnedTables.add(table);
      console.warn('[supabase realtime]', table, '→ REST polling (' + ms + 'ms) — WebSocket unavailable');
    }
    entry.pollTimer = setInterval(() => rtNotifyCallbacks(entry, table), ms);
  }

  function stopPollFallback(entry) {
    if (!entry.pollTimer) return;
    clearInterval(entry.pollTimer);
    entry.pollTimer = null;
  }

  function teardownRtEntry(client, entry) {
    if (!entry || entry.tearingDown) return;
    entry.tearingDown = true;
    entry.dead = true;
    stopPollFallback(entry);
    const ch = entry.channel;
    entry.channel = null;
    entry.subscribed = false;
    entry.subscribing = false;
    if (ch) {
      try {
        client.removeChannel(ch);
      } catch (_) {}
    }
    entry.tearingDown = false;
  }

  function subscribeRealtime(client, table, filter, listener) {
    if (isTableDead(table)) return () => {};
    const key = filter ? `doc:${table}:${filter}` : `col:${table}`;
    let entry = __rtChannels.get(key);
    if (!entry) {
      const callbacks = new Set();
      entry = { channel: null, callbacks, subscribed: false, subscribing: false, pollTimer: null, dead: false, tearingDown: false };
      __rtChannels.set(key, entry);

      if (__rtPollOnly) {
        startPollFallback(entry, table);
      } else {
        const chName = ('lm-' + key).replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 100);
        const opts = { event: '*', schema: 'public', table };
        if (filter) opts.filter = filter;
        const channel = client.channel(chName).on('postgres_changes', opts, () => rtNotifyCallbacks(entry, table));
        entry.channel = channel;
        const delay = __rtStaggerMs;
        __rtStaggerMs += 120;
        setTimeout(() => {
          if (entry.dead || entry.tearingDown) return;
          entry.subscribing = true;
          channel.subscribe((status, err) => {
            entry.subscribing = false;
            if (entry.dead || entry.tearingDown) return;
            if (status === 'SUBSCRIBED') {
              entry.subscribed = true;
              stopPollFallback(entry);
              return;
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              if (entry.dead || entry.tearingDown) return;
              __rtPollOnly = true;
              if (err && !__rtWarnedTables.has(table)) {
                __rtWarnedTables.add(table);
                console.warn('[supabase realtime]', table, err.message || err);
              }
              startPollFallback(entry, table);
            }
          });
        }, delay);
        setTimeout(() => {
          if (entry.dead || entry.tearingDown) return;
          if (!entry.subscribed && !entry.pollTimer && !isTableDead(table)) {
            startPollFallback(entry, table);
          }
        }, 9000);
      }
    }
    entry.callbacks.add(listener);
    return () => {
      entry.callbacks.delete(listener);
      if (entry.callbacks.size === 0) {
        __rtChannels.delete(key);
        teardownRtEntry(client, entry);
      }
    };
  }

  let __dbWrapper = null;

  class SupabaseClient {
    constructor() {
      this._client = getRestClient();
      this._channels = [];
    }

    collection(name) {
      return new CollectionRef(this, name);
    }

    batch() {
      return new WriteBatch(this);
    }

    async runTransaction(fn) {
      let lastErr;
      for (let attempt = 0; attempt < 5; attempt++) {
        const tx = new Transaction(this);
        try {
          await fn(tx);
          await tx._commit();
          return;
        } catch (e) {
          lastErr = e;
          if (attempt >= 4) throw e;
          await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
        }
      }
      throw lastErr;
    }
  }

  class CollectionRef {
    constructor(db, table) {
      this._db = db;
      this._table = table;
      this._filters = [];
      this._order = null;
      this._limitN = null;
    }

    doc(id) {
      if (id === undefined || id === null) id = crypto.randomUUID();
      return new DocRef(this._db, this._table, id);
    }

    async add(data) {
      const ref = this.doc(crypto.randomUUID());
      await ref.set({ ...data, id: ref.id });
      return ref;
    }

    where(field, op, value) {
      const c = new CollectionRef(this._db, this._table);
      c._filters = [...this._filters, { field, op, value }];
      c._order = this._order;
      c._limitN = this._limitN;
      return c;
    }

    orderBy(field, dir = 'asc') {
      const c = new CollectionRef(this._db, this._table);
      c._filters = [...this._filters];
      c._order = { field, dir };
      c._limitN = this._limitN;
      return c;
    }

    limit(n) {
      const c = new CollectionRef(this._db, this._table);
      c._filters = [...this._filters];
      c._order = this._order;
      c._limitN = n;
      return c;
    }

    _camelField(f) {
      const m = meta(this._table);
      if (m.alias && m.alias[f]) return m.alias[f];
      return snakeKey(f);
    }

    async _fetchRows() {
      if (isTableDead(this._table)) return [];
      let q = this._db._client.from(this._table).select('*');
      for (const f of this._filters) {
        const col = this._camelField(f.field);
        if (f.op === '==') q = q.eq(col, f.value);
        else if (f.op === 'in') q = q.in(col, f.value);
      }
      if (this._order) {
        let col = ORDER_MAP[this._order.field] || snakeKey(this._order.field);
        if (this._order.field === 'timestamp') col = orderColForTimestamp(this._table);
        q = q.order(col, { ascending: this._order.dir === 'asc', nullsFirst: false });
      } else {
        const defCol = defaultOrderFor(this._table);
        if (defCol) q = q.order(defCol, { ascending: false, nullsFirst: false });
      }
      if (this._limitN) q = q.limit(this._limitN);
      else if (this._table === 'lm_openworld_players') q = q.limit(64);
      const { data, error } = await q;
      if (error) {
        if (isTableMissingError(error)) {
          markTableMissingDead(this._table);
          return [];
        }
        throw error;
      }
      let rows = data || [];
      for (const f of this._filters) {
        if (f.op === 'array-contains') {
          const col = this._camelField(f.field);
          rows = rows.filter((r) => {
            const doc = rowToDoc(this._table, r);
            const arr = doc[f.field];
            return Array.isArray(arr) && arr.includes(f.value);
          });
        }
      }
      return rows;
    }

    async get() {
      const rows = await this._fetchRows();
      return new QuerySnapshot(this._db, this._table, rows);
    }

    onSnapshot(cb, errCb) {
      const table = this._table;
      const debounceMs =
        table === 'lm_openworld_players' ? 400
        : table === 'lm_mafia_rooms' ? 250
        : 0;
      let inflight = false;
      let queued = false;
      let timer = null;
      let failDelay = 0;

      const exec = async () => {
        if (isTableDead(table)) {
          cb(new QuerySnapshot(this._db, this._table, []));
          return;
        }
        if (inflight) {
          queued = true;
          return;
        }
        inflight = true;
        try {
          const rows = await this._fetchRows();
          failDelay = 0;
          cb(new QuerySnapshot(this._db, this._table, rows));
        } catch (e) {
          if (isTableMissingError(e)) {
            markTableMissingDead(table);
            cb(new QuerySnapshot(this._db, this._table, []));
            return;
          }
          if (errCb) errCb(e);
          if (failDelay === 0) console.error('[supabase]', table, e);
          failDelay = Math.min(12000, Math.max(800, (failDelay || 400) * 2));
        } finally {
          inflight = false;
          if (queued) {
            queued = false;
            schedule();
          } else if (failDelay) {
            clearTimeout(timer);
            timer = setTimeout(exec, failDelay);
          }
        }
      };

      const schedule = () => {
        clearTimeout(timer);
        const wait = debounceMs || failDelay;
        if (wait > 0) timer = setTimeout(exec, wait);
        else exec();
      };

      schedule();
      return subscribeRealtime(this._db._client, this._table, null, schedule);
    }
  }

  class DocRef {
    constructor(db, table, id) {
      this._db = db;
      this._table = table;
      this.id = id;
    }

    async get() {
      if (isTableDead(this._table)) return new DocumentSnapshot(this._table, this.id, null);
      const m = meta(this._table);
      const pkVal = this.id;
      const { data, error } = await this._db._client.from(this._table).select('*').eq(m.pk, pkVal).maybeSingle();
      if (error) {
        if (isTableMissingError(error)) {
          markTableMissingDead(this._table);
          return new DocumentSnapshot(this._table, this.id, null);
        }
        throw error;
      }
      return new DocumentSnapshot(this._table, this.id, data);
    }

    async set(data, opts) {
      const merge = opts && opts.merge;
      const payload = stripDocMeta({ ...data });
      if (merge) {
        const cur = await this.get();
        const merged = applyUpdatePatch(cur.exists ? cur.data() : {}, payload);
        return this._upsert(merged, true);
      }
      return this._upsert(payload, false);
    }

    async _upsert(data, isMerge) {
      const m = meta(this._table);
      let row = docToRow(this._table, { ...data, id: this.id });
      row[m.pk] = this.id;

      if (m.dataBlob) {
        if (isMerge) {
          const cur = await this.get();
          row.data = { ...(cur.exists ? cur.data() : {}), ...(row.data || {}) };
        }
      } else if (isMerge && m.overflowCol === 'data' && row.data) {
        const cur = await this.get();
        if (cur.exists && cur._row?.data) {
          row.data = { ...(cur._row.data || {}), ...(row.data || {}) };
        }
      }

      row = sanitizeRow(row);
      const { error } = await this._db._client.from(this._table).upsert(row, { onConflict: m.pk });
      if (error) {
        console.error('[supabase] upsert failed', this._table, row, error);
        throw error;
      }
    }

    async update(patch) {
      const m = meta(this._table);
      const stripped = stripDocMeta(patch);
      const needsMerge =
        m.dataBlob ||
        m.strokeBlob ||
        Object.keys(stripped).some(
          (k) => k.includes('.') || isDelete(stripped[k]) || isIncrement(stripped[k])
        );

      let row;
      if (needsMerge) {
        const snap = await this.get();
        if (!snap.exists) {
          const err = new Error('No document to update: ' + this._table + '/' + this.id);
          err.code = 'not-found';
          throw err;
        }
        const merged = applyUpdatePatch(snap.data(), stripped);
        row = docToRow(this._table, { ...merged, id: this.id });
      } else {
        row = docToRow(this._table, { ...stripped, id: this.id });
      }

      delete row[m.pk];
      if (row.id && m.pk !== 'id') delete row.id;
      row = sanitizeRow(row);
      if (!Object.keys(row).length) return;

      if (row.extra && typeof row.extra === 'object') {
        const cur = await this.get();
        if (cur.exists && cur._row?.extra && typeof cur._row.extra === 'object') {
          row.extra = { ...cur._row.extra, ...row.extra };
        }
      }
      if (row.data && typeof row.data === 'object') {
        const cur = await this.get();
        if (cur.exists && cur._row?.data && typeof cur._row.data === 'object') {
          row.data = { ...cur._row.data, ...row.data };
        }
      }

      const { error } = await this._db._client.from(this._table).update(row).eq(m.pk, this.id);
      if (error) {
        console.error('[supabase] update failed', this._table, this.id, row, error);
        throw error;
      }
    }

    async delete() {
      const m = meta(this._table);
      const { error } = await this._db._client.from(this._table).delete().eq(m.pk, this.id);
      if (error) throw error;
    }

    onSnapshot(cb, errCb) {
      const m = meta(this._table);
      let inflight = false;
      let queued = false;
      let timer = null;
      let failDelay = 0;
      const debounceMs = this._table === 'lm_openworld_players' ? 200 : 0;

      const exec = async () => {
        if (isTableDead(this._table)) {
          cb(new DocumentSnapshot(this._table, this.id, null));
          return;
        }
        if (inflight) {
          queued = true;
          return;
        }
        inflight = true;
        try {
          cb(await this.get());
          failDelay = 0;
        } catch (e) {
          if (isTableMissingError(e)) {
            markTableMissingDead(this._table);
            cb(new DocumentSnapshot(this._table, this.id, null));
            return;
          }
          if (errCb) errCb(e);
          failDelay = Math.min(12000, Math.max(800, (failDelay || 400) * 2));
        } finally {
          inflight = false;
          if (queued) {
            queued = false;
            schedule();
          } else if (failDelay) {
            clearTimeout(timer);
            timer = setTimeout(exec, failDelay);
          }
        }
      };

      const schedule = () => {
        clearTimeout(timer);
        const wait = debounceMs || failDelay;
        if (wait > 0) timer = setTimeout(exec, wait);
        else exec();
      };

      schedule();
      const filter = `${m.pk}=eq.${this.id}`;
      return subscribeRealtime(this._db._client, this._table, filter, schedule);
    }
  }

  class DocumentSnapshot {
    constructor(table, id, row) {
      this._table = table;
      this.id = id;
      this._row = row;
      this.exists = !!row;
    }
    data() {
      if (!this._row) return undefined;
      return rowToDoc(this._table, this._row);
    }
  }

  class QuerySnapshot {
    constructor(db, table, rows) {
      const list = rows || [];
      this.empty = list.length === 0;
      this.size = list.length;
      this.docs = list.map((r) => {
        const m = meta(table);
        const id = r[m.pk];
        return {
          id,
          ref: new DocRef(db, table, id),
          data: () => rowToDoc(table, r),
        };
      });
    }
    forEach(fn) {
      this.docs.forEach(fn);
    }
  }

  class WriteBatch {
    constructor(db) {
      this._db = db;
      this._ops = [];
    }
    set(ref, data, opts) {
      this._ops.push(() => ref.set(data, opts));
      return this;
    }
    update(ref, data) {
      this._ops.push(() => ref.update(data));
      return this;
    }
    delete(ref) {
      this._ops.push(() => ref.delete());
      return this;
    }
    async commit() {
      for (const op of this._ops) await op();
    }
  }

  class Transaction {
    constructor(db) {
      this._db = db;
      this._gets = [];
      this._writes = [];
    }
    async get(ref) {
      const snap = await ref.get();
      this._gets.push({ ref, snap });
      return snap;
    }
    set(ref, data, opts) {
      this._writes.push({ type: 'set', ref, data, opts });
    }
    update(ref, data) {
      this._writes.push({ type: 'update', ref, data });
    }
    delete(ref) {
      this._writes.push({ type: 'delete', ref });
    }
    async _commit() {
      for (const w of this._writes) {
        if (w.type === 'set') await w.ref.set(w.data, w.opts);
        else if (w.type === 'update') await w.ref.update(w.data);
        else if (w.type === 'delete') await w.ref.delete();
      }
    }
  }

  const FieldValue = {
    serverTimestamp: () => ({ __op: 'serverTimestamp' }),
    increment: (n) => ({ __op: 'increment', by: Number(n) || 0 }),
    delete: () => DELETE_FIELD,
  };

  function createDb() {
    if (!__dbWrapper) __dbWrapper = new SupabaseClient();
    return __dbWrapper;
  }

  const firestoreFactory = createDb;
  firestoreFactory.FieldValue = FieldValue;

  global.firebase = {
    initializeApp: () => ({}),
    analytics: () => ({ logEvent: () => {} }),
    firestore: firestoreFactory,
  };

  global.__supabaseDb = createDb;

  global.checkSupabaseHealth = async function () {
    try {
      const url = SUPABASE_URL + '/rest/v1/lm_pets?select=nick&limit=1';
      const res = await __baseFetch(url, {
        method: 'GET',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
          Accept: 'application/json',
        },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        return { message: j.message || res.statusText, code: String(res.status) };
      }
      return null;
    } catch (e) {
      return e;
    }
  };

  /** RLS-safe row patch (upsert 금지 — 수신자 거래 수락/거절 등) */
  global.lmPatchRow = async function lmPatchRow(table, id, patch) {
    const db = createDb();
    const ref = db.collection(table).doc(id);
    return ref.update(patch);
  };

  global.__lmShimVersion = '14';
  global.__lmIsTableDead = isTableDead;
})(typeof window !== 'undefined' ? window : globalThis);
