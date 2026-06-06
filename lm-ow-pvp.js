/**
 * 오픈월드 멀티플레이어 PVP 결투
 * - 결투 신청 / 수락 · 3초 동기화 카운트다운 · 3D 실시간 공격
 * - 명예의전당(랭킹 탭) 승/패 기록
 */
(function (global) {
  'use strict';

  const OW_PVP_DOC = 'ow_pvp_state';
  const COUNTDOWN_MS = 3000;
  const PRE_COUNTDOWN_MS = 900;
  const REQUEST_TTL_MS = 50000;
  const DUEL_RANGE = () => (global.OW_PROXIMITY || 4) * 1.8;
  const MELEE_R = 2.85;
  const SKILL_R = 5.8;

  let __pvpUnsub = null;
  let __pvpPollInt = null;
  let __lastMyHp = null;
  const __hallRecorded = new Set();
  const __rejectSeen = new Set();

  function S() { return global.S; }
  function me() { return S()?.myEntry?.nick || ''; }
  function nickEq(a, b) { return String(a || '').trim() === String(b || '').trim(); }
  function rd() { return global.__owRenderer; }
  function eventsCol() { return global.owEventsCol; }

  function pvpState() {
    return S().ow.pvpSync || { requests: [], duels: [], hall: [] };
  }

  function myDuel(data) {
    const nick = me();
    if (!nick) return null;
    return (data?.duels || []).find((d) => d && (d.p1 === nick || d.p2 === nick) && d.phase !== 'ended');
  }

  function myRequest(data) {
    const nick = me();
    if (!nick) return null;
    const now = Date.now();
    return (data?.requests || []).find((r) =>
      r && nickEq(r.to, nick) && r.status === 'pending' && (!r.expiresAt || r.expiresAt > now)
    ) || null;
  }

  function myOutgoingRequest(data) {
    const nick = me();
    if (!nick) return null;
    const now = Date.now();
    return (data?.requests || []).find((r) =>
      r && nickEq(r.from, nick) && r.status === 'pending' && (!r.expiresAt || r.expiresAt > now)
    ) || null;
  }

  function pruneRequests(requests) {
    const now = Date.now();
    return (requests || []).filter((r) => {
      if (!r) return false;
      if (r.status === 'rejected') return now - (r.rejectedAt || 0) < 12000;
      if (r.status === 'pending') return !r.expiresAt || r.expiresAt > now;
      return false;
    });
  }

  function duelRole(duel) {
    const nick = me();
    if (!nick || !duel) return null;
    if (duel.p1 === nick) return 'p1';
    if (duel.p2 === nick) return 'p2';
    return null;
  }

  function oppNick(duel) {
    const role = duelRole(duel);
    if (!role) return null;
    return role === 'p1' ? duel.p2 : duel.p1;
  }

  function myHpKey(role) { return role === 'p1' ? 'p1Hp' : 'p2Hp'; }
  function oppHpKey(role) { return role === 'p1' ? 'p2Hp' : 'p1Hp'; }

  function countdownLeft(duel) {
    if (!duel?.countdownAt) return 0;
    return Math.max(0, duel.countdownAt + COUNTDOWN_MS - Date.now());
  }

  function canFight() {
    const duel = S().ow.pvpDuel;
    if (!duel || duel.phase !== 'fighting') return false;
    return countdownLeft(duel) <= 0;
  }

  function inCountdown() {
    const duel = S().ow.pvpDuel;
    return !!(duel && duel.phase === 'fighting' && countdownLeft(duel) > 0);
  }

  async function readDoc() {
    const col = eventsCol();
    if (!col) return { requests: [], duels: [], hall: [] };
    const snap = await col.doc(OW_PVP_DOC).get().catch(() => null);
    return snap?.exists ? (snap.data() || {}) : { requests: [], duels: [], hall: [] };
  }

  async function writeDoc(patch) {
    const col = eventsCol();
    if (!col) return false;
    const ref = col.doc(OW_PVP_DOC);
    const payload = { ...patch, updatedAt: Date.now() };
    try {
      const snap = await ref.get().catch(() => null);
      if (snap?.exists) {
        await ref.update(payload);
      } else {
        await ref.set({ requests: [], duels: [], hall: [], ...payload }, { merge: true });
      }
      return true;
    } catch (e) {
      console.error('[OW_PVP] writeDoc failed', e);
      return false;
    }
  }

  function applyLocalDuel(duel) {
    if (!duel) {
      S().ow.pvpDuel = null;
      __lastMyHp = null;
      return;
    }
    const role = duelRole(duel);
    if (!role) {
      S().ow.pvpDuel = null;
      return;
    }
    const myHp = duel[myHpKey(role)] ?? duel.p1MaxHp;
    const oppHp = duel[oppHpKey(role)] ?? duel.p2MaxHp;
    const myMax = role === 'p1' ? duel.p1MaxHp : duel.p2MaxHp;
    const oppMax = role === 'p1' ? duel.p2MaxHp : duel.p1MaxHp;
    const prev = S().ow.pvpDuel;
    S().ow.pvpDuel = {
      id: duel.id,
      phase: duel.phase,
      opponent: oppNick(duel),
      opponentEmoji: role === 'p1' ? (duel.p2Emoji || '🐾') : (duel.p1Emoji || '🐾'),
      countdownAt: duel.countdownAt,
      myHp,
      myMaxHp: myMax,
      oppHp,
      oppMaxHp: oppMax,
      winner: duel.winner || null,
      endedAt: duel.endedAt || 0,
    };
    const c = S().ow.combat;
    if (c) {
      c.hp = myHp;
      c.maxHp = myMax;
      if (!prev || prev.id !== duel.id) {
        c.mp = c.maxMp || 1000;
        c.cdUntil = { basic: 0, s1: 0, s2: 0, s3: 0, dodge: 0 };
      }
      if (duel.phase === 'fighting') c.huntMode = false;
    }
    if (__lastMyHp != null && myHp < __lastMyHp && rd()) {
      const now = Date.now();
      rd()._camShakeUntil = now + 180;
      const root = document.getElementById('ow-root');
      if (root) {
        root.classList.add('ow-combat-hurt');
        setTimeout(() => document.getElementById('ow-root')?.classList.remove('ow-combat-hurt'), 250);
      }
      if (typeof global.owCombatHaptic === 'function') global.owCombatHaptic(36);
    }
    __lastMyHp = myHp;
    if (duel.phase === 'ended' && duel.winner && prev?.phase !== 'ended') {
      owShowResult(duel);
    }
  }

  function owShowResult(duel) {
    const nick = me();
    if (!nick || S().ow.pvpResultShown === duel.id) return;
    S().ow.pvpResultShown = duel.id;
    const win = duel.winner === nick;
    const opp = oppNick(duel);
    if (typeof global.owMmoToast === 'function') {
      global.owMmoToast(win ? `🏆 PVP 승리! ${global.shortNick?.(opp) || opp} 격파` : `💀 PVP 패배… ${global.shortNick?.(opp) || opp}에게 졌어요`);
    }
    if (typeof global.render === 'function') global.render();
  }

  async function recordHall(duel) {
    if (!duel?.winner || !duel.loser) return;
    const data = await readDoc();
    const hall = Array.isArray(data.hall) ? data.hall.slice() : [];
    const bump = (nick, emoji, win) => {
      let row = hall.find((h) => h.nick === nick);
      if (!row) {
        row = { nick, emoji: emoji || '🐾', wins: 0, losses: 0, updatedAt: 0 };
        hall.push(row);
      }
      if (win) row.wins = (row.wins || 0) + 1;
      else row.losses = (row.losses || 0) + 1;
      row.emoji = emoji || row.emoji;
      row.updatedAt = Date.now();
    };
    bump(duel.winner, duel.winner === duel.p1 ? duel.p1Emoji : duel.p2Emoji, true);
    bump(duel.loser, duel.loser === duel.p1 ? duel.p1Emoji : duel.p2Emoji, false);
    hall.sort((a, b) => (b.wins || 0) - (a.wins || 0) || (a.losses || 0) - (b.losses || 0));
    const mw = global.OWMMODataStore?.get?.();
    if (mw) {
      const mine = hall.find((h) => h.nick === me());
      if (mine) {
        mw.pvp = { wins: mine.wins || 0, losses: mine.losses || 0 };
        global.OWMMODataStore?.touch?.();
        if (typeof global.saveOWInventory === 'function') global.saveOWInventory(true);
      }
    }
    await writeDoc({ hall: hall.slice(0, 80) });
  }

  function cleanupEndedDuels(duels) {
    const now = Date.now();
    return (duels || []).filter((d) => {
      if (!d) return false;
      if (d.phase !== 'ended') return true;
      return (d.endedAt || 0) > now - 12000;
    });
  }

  function notifyReject(rejectedReq) {
    if (!rejectedReq?.id || __rejectSeen.has(rejectedReq.id)) return;
    __rejectSeen.add(rejectedReq.id);
    const msg = '상대방이 거절했습니다';
    if (typeof global.owMmoToast === 'function') global.owMmoToast(msg);
    else if (typeof global.alert === 'function') global.alert(msg);
  }

  function pvpUiFingerprint() {
    const s = S().ow;
    const d = s.pvpDuel;
    return JSON.stringify({
      req: s.pvpReq ? { id: s.pvpReq.id, st: s.pvpReq.status } : null,
      out: s.pvpOutgoing ? { id: s.pvpOutgoing.id, st: s.pvpOutgoing.status } : null,
      duel: d ? { id: d.id, ph: d.phase, mh: d.myHp, oh: d.oppHp, ca: d.countdownAt, w: d.winner || null } : null,
    });
  }

  function applyPvpSyncAndMaybeRender(data) {
    const before = pvpUiFingerprint();
    applyPvpSync(data);
    if (before !== pvpUiFingerprint() && S().screen === 'openworld' && typeof global.render === 'function') {
      global.render();
    }
  }

  function applyPvpSync(data) {
    data = data || { requests: [], duels: [], hall: [] };
    const nick = me();
    const prunedReqs = pruneRequests(data.requests || []);
    if (prunedReqs.length !== (data.requests || []).length) {
      data = { ...data, requests: prunedReqs };
      writeDoc({ requests: prunedReqs });
    }
    S().ow.pvpSync = data;
    S().ow.pvpHallSync = data.hall || [];
    const incoming = myRequest(data);
    const hadReqId = S().ow.pvpReq?.id;
    S().ow.pvpReq = incoming;
    S().ow.pvpOutgoing = myOutgoingRequest(data);
    if (incoming && incoming.id !== hadReqId) {
      if (typeof global.owCloseAllPanels === 'function') global.owCloseAllPanels();
    }
    const rejectedMine = (data.requests || []).find((r) =>
      r && r.status === 'rejected' && nickEq(r.from, nick)
    );
    if (rejectedMine) {
      notifyReject(rejectedMine);
      S().ow.pvpOutgoing = null;
    }
    const duels = data.duels || [];
    const active = duels.find((d) => d && d.phase !== 'ended' && (d.p1 === nick || d.p2 === nick));
    const recentEnded = duels.find((d) =>
      d && d.phase === 'ended' && (d.p1 === nick || d.p2 === nick) && S().ow.pvpDuel?.id === d.id
    );
    if (recentEnded) {
      if (recentEnded.winner && !__hallRecorded.has(recentEnded.id)) {
        __hallRecorded.add(recentEnded.id);
        recordHall(recentEnded);
      }
      applyLocalDuel(recentEnded);
      setTimeout(() => {
        if (S().ow.pvpDuel?.id === recentEnded.id) {
          S().ow.pvpDuel = null;
          if (typeof global.render === 'function') global.render();
        }
      }, 2800);
    } else {
      applyLocalDuel(active || null);
    }
  }

  async function sendDuelRequest(targetNick) {
    const nick = me();
    const renderer = rd();
    if (!nick || !targetNick || targetNick === nick) return;
    const avatar = renderer?.pet || renderer?.human;
    if (!renderer || !avatar) {
      alert('오픈월드에서만 결투할 수 있어요.');
      return;
    }
    if (S().ow.pvpDuel) {
      if (typeof global.owMmoToast === 'function') global.owMmoToast('이미 결투 중이에요');
      return;
    }
    const other = renderer.otherPetsByNick?.get?.(targetNick);
    if (!other) {
      alert('상대 유저가 보이지 않아요.');
      return;
    }
    const p = avatar.position;
    const d = Math.hypot(other.position.x - p.x, other.position.z - p.z);
    if (d > DUEL_RANGE()) {
      alert('상대와 더 가까이 가야 결투 신청이 가능해요.');
      return;
    }
    const data = await readDoc();
    const now = Date.now();
    const pending = (data.requests || []).some((r) =>
      r && r.status === 'pending' && ((nickEq(r.from, nick) && nickEq(r.to, targetNick)) || (nickEq(r.from, targetNick) && nickEq(r.to, nick)))
    );
    if (pending) {
      if (typeof global.owMmoToast === 'function') global.owMmoToast('이미 결투 신청이 진행 중이에요');
      return;
    }
    const active = (data.duels || []).some((du) => du && du.phase !== 'ended' && (du.p1 === nick || du.p2 === nick || du.p1 === targetNick || du.p2 === targetNick));
    if (active) {
      alert('상대가 다른 결투 중이에요.');
      return;
    }
    const req = {
      id: 'pvp_req_' + now + '_' + Math.random().toString(36).slice(2, 6),
      from: nick,
      fromEmoji: S().myPet?.petEmoji || '🐾',
      fromMaxHp: Math.max(400, S().ow.combat?.maxHp || 1000),
      to: targetNick,
      status: 'pending',
      createdAt: now,
      expiresAt: now + REQUEST_TTL_MS,
    };
    const nextReqs = pruneRequests([
      ...(data.requests || []).filter((r) => r && r.status === 'pending'),
      req,
    ]);
    const ok = await writeDoc({ requests: nextReqs });
    if (!ok) {
      alert('결투 신청 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    S().ow.pvpOutgoing = req;
    applyPvpSync({ ...data, requests: nextReqs });
    if (typeof global.owMmoToast === 'function') global.owMmoToast(`⚔️ ${global.shortNick?.(targetNick) || targetNick}에게 결투 신청!`);
    if (typeof global.render === 'function') global.render();
  }

  async function acceptDuel(reqId) {
    const nick = me();
    const req = S().ow.pvpReq;
    if (!nick || !req || req.id !== reqId) return;
    const data = await readDoc();
    const live = (data.requests || []).find((r) => r && r.id === reqId && r.status === 'pending');
    if (!live) {
      S().ow.pvpReq = null;
      if (typeof global.render === 'function') global.render();
      return;
    }
    const p2Max = Math.max(400, S().ow.combat?.maxHp || 1000);
    const p1Max = Math.max(400, req.fromMaxHp || 1000);
    const now = Date.now();
    const duel = {
      id: 'pvp_' + now + '_' + Math.random().toString(36).slice(2, 6),
      p1: req.from,
      p2: req.to,
      p1Emoji: req.fromEmoji || '🐾',
      p2Emoji: S().myPet?.petEmoji || '🐾',
      p1Hp: p1Max,
      p2Hp: p2Max,
      p1MaxHp: p1Max,
      p2MaxHp: p2Max,
      phase: 'fighting',
      countdownAt: now + PRE_COUNTDOWN_MS,
      winner: null,
      loser: null,
      endedAt: 0,
      updatedAt: now,
    };
    const requests = pruneRequests((data.requests || []).filter((r) => r && r.id !== reqId));
    const duels = cleanupEndedDuels([...(data.duels || []), duel]);
    const ok = await writeDoc({ requests, duels });
    if (!ok) {
      alert('결투 수락에 실패했어요.');
      return;
    }
    applyPvpSync({ ...data, requests, duels });
    S().ow.pvpReq = null;
    S().ow.pvpOutgoing = null;
    if (typeof global.owCloseAllPanels === 'function') global.owCloseAllPanels();
    if (typeof global.owMmoToast === 'function') global.owMmoToast('⚔️ 결투 수락! 3초 후 시작');
    if (typeof global.render === 'function') global.render();
  }

  async function rejectDuel(reqId) {
    const nick = me();
    const req = S().ow.pvpReq;
    if (!nick || !req || req.id !== reqId) return;
    const data = await readDoc();
    const requests = pruneRequests((data.requests || []).map((r) =>
      (r && r.id === reqId) ? { ...r, status: 'rejected', rejectedAt: Date.now() } : r
    ));
    const ok = await writeDoc({ requests });
    if (!ok) {
      alert('거절 처리에 실패했어요.');
      return;
    }
    applyPvpSync({ ...data, requests });
    S().ow.pvpReq = null;
    if (typeof global.render === 'function') global.render();
  }

  function oppPosition() {
    const duel = S().ow.pvpDuel;
    const renderer = rd();
    if (!duel || !renderer) return null;
    const opp = renderer.otherPetsByNick?.get?.(duel.opponent);
    if (!opp) return null;
    return opp.position;
  }

  function calcBasicDmg() {
    const wAtk = typeof global.owWeaponAtkBonus === 'function' ? global.owWeaponAtkBonus() : 0;
    const crit = Math.random() < 0.18;
    return { dmg: Math.floor((160 + Math.random() * 110 + wAtk) * (crit ? 1.85 : 1)), crit };
  }

  async function applyDamage(dmg) {
    const duel = S().ow.pvpDuel;
    const nick = me();
    if (!duel || !nick || !canFight()) return;
    const data = await readDoc();
    const duels = (data.duels || []).slice();
    const idx = duels.findIndex((d) => d && d.id === duel.id);
    if (idx < 0) return;
    const d = { ...duels[idx] };
    if (d.phase !== 'fighting') return;
    const role = duelRole(d);
    if (!role) return;
    const oppKey = oppHpKey(role);
    d[oppKey] = Math.max(0, (d[oppKey] || 0) - dmg);
    if (d[oppKey] <= 0) {
      d.phase = 'ended';
      d.winner = nick;
      d.loser = oppNick(d);
      d.endedAt = Date.now();
    }
    d.updatedAt = Date.now();
    duels[idx] = d;
    await writeDoc({ duels: cleanupEndedDuels(duels) });
  }

  function attackBasic() {
    const renderer = rd();
    const c = S().ow.combat;
    if (!renderer || !c || !canFight()) return;
    if (typeof global.owCombatAnimBusy === 'function' && global.owCombatAnimBusy()) return;
    const now = Date.now();
    if (now < (c.cdUntil?.basic || 0)) return;
    c.cdUntil = c.cdUntil || {};
    c.cdUntil.basic = now + 340;
    if (typeof global.owPlayAvatarCombatAnim === 'function') global.owPlayAvatarCombatAnim('attack');
    const opp = oppPosition();
    if (!opp) return;
    const p = renderer.human.position;
    const dist = Math.hypot(opp.x - p.x, opp.z - p.z);
    if (dist > MELEE_R) {
      if (typeof global.owMmoToast === 'function') global.owMmoToast('상대에게 더 가까이!');
      return;
    }
    const { dmg, crit } = calcBasicDmg();
    applyDamage(dmg);
    if (renderer.spawnMobDmg) {
      const fake = { group: { position: { x: opp.x, y: 0, z: opp.z, clone: () => ({ x: opp.x, y: 0, z: opp.z }) } }, scale: 1 };
      try { renderer.spawnMobDmg(fake, dmg, crit); } catch (e) { /* noop */ }
    }
    renderer._camShakeUntil = now + 70;
    if (typeof global.owCombatHaptic === 'function') global.owCombatHaptic(16);
    if (global.OW_MP_SYNC && typeof global.OW_MP_SYNC.publishCombatAnim === 'function') {
      global.OW_MP_SYNC.publishCombatAnim('attack');
    }
  }

  function attackSkill(n) {
    const renderer = rd();
    const c = S().ow.combat;
    if (!renderer || !c || !canFight()) return;
    if (typeof global.owCombatAnimBusy === 'function' && global.owCombatAnimBusy()) return;
    const now = Date.now();
    const key = 's' + n;
    const cds = { s1: 3200, s2: 4800, s3: 7600 };
    const costs = { s1: 100, s2: 180, s3: 260 };
    const dmgs = { s1: 520, s2: 380, s3: 440 };
    if (now < (c.cdUntil?.[key] || 0)) return;
    if (c.mp < costs[key]) {
      if (typeof global.owMmoToast === 'function') global.owMmoToast('💧 마나 부족');
      return;
    }
    c.mp = Math.max(0, c.mp - costs[key]);
    c.cdUntil[key] = now + cds[key];
    if (typeof global.owPlayAvatarCombatAnim === 'function') global.owPlayAvatarCombatAnim(n === 3 ? 'combo' : 'skill' + n);
    const opp = oppPosition();
    if (!opp) return;
    const p = renderer.human.position;
    const dist = Math.hypot(opp.x - p.x, opp.z - p.z);
    const radius = n === 3 ? 5.2 : SKILL_R;
    if (dist > radius) return;
    const wAtk = typeof global.owWeaponAtkBonus === 'function' ? global.owWeaponAtkBonus() : 0;
    const dmg = dmgs[key] + Math.floor(Math.random() * 120) + Math.floor(wAtk * 0.6);
    applyDamage(dmg);
    if (n === 3 && renderer._aoeBurst) renderer._aoeBurst(opp.x, opp.z, 4, 0xffcc33);
    if (n === 1 && renderer._slashFx) renderer._slashFx({ x: opp.x, y: 0, z: opp.z }, 0x66e0ff);
    renderer._camShakeUntil = now + (n === 3 ? 200 : 90);
    if (typeof global.owCombatHaptic === 'function') global.owCombatHaptic(22);
  }

  let __countdownLastN = -1;

  function updateCountdownOverlay() {
    const n = countdownNumber();
    if (n === __countdownLastN) return;
    __countdownLastN = n;
    const root = document.getElementById('ow-ui-root');
    let box = root && root.querySelector('.ow-pvp-countdown');
    if (!box && root) {
      box = document.createElement('div');
      box.className = 'ow-pvp-countdown';
      box.innerHTML = '<span></span>';
      root.appendChild(box);
    }
    const span = box && box.querySelector('span');
    if (span) span.textContent = String(n);
    else if (typeof global.render === 'function') global.render();
  }

  function tick(renderer, dt) {
    if (!S() || S().screen !== 'openworld') return;
    const duel = S().ow.pvpDuel;
    if (!duel) return;
    if (inCountdown()) updateCountdownOverlay();
    else __countdownLastN = -1;
    if (canFight() && duel.opponent && renderer?.human) {
      const opp = renderer.otherPetsByNick?.get?.(duel.opponent);
      if (opp) {
        const p = renderer.human.position;
        const dx = opp.position.x - p.x;
        const dz = opp.position.z - p.z;
        if (Math.hypot(dx, dz) > 0.2) {
          renderer.humanRotY = Math.atan2(dx, dz);
        }
      }
    }
  }

  function subscribe() {
    if (__pvpUnsub) {
      try { __pvpUnsub(); } catch (e) { /* noop */ }
      __pvpUnsub = null;
    }
    if (__pvpPollInt) {
      clearInterval(__pvpPollInt);
      __pvpPollInt = null;
    }
    const col = eventsCol();
    if (!col) return;
    const onData = (doc) => {
      applyPvpSyncAndMaybeRender(doc.exists ? doc.data() : { requests: [], duels: [], hall: [] });
    };
    __pvpUnsub = col.doc(OW_PVP_DOC).onSnapshot(onData);
    readDoc().then((data) => {
      applyPvpSyncAndMaybeRender(data);
    }).catch(() => {});
    __pvpPollInt = setInterval(() => {
      if (S().screen !== 'openworld') return;
      readDoc().then((data) => {
        applyPvpSyncAndMaybeRender(data);
      }).catch(() => {});
    }, 1500);
  }

  function leaveCleanup() {
    if (__pvpUnsub) {
      try { __pvpUnsub(); } catch (e) { /* noop */ }
      __pvpUnsub = null;
    }
    if (__pvpPollInt) {
      clearInterval(__pvpPollInt);
      __pvpPollInt = null;
    }
    const s = S();
    if (s?.ow) {
      s.ow.pvpDuel = null;
      s.ow.pvpReq = null;
      s.ow.pvpOutgoing = null;
      s.ow.pvpSync = null;
    }
    __lastMyHp = null;
    __countdownLastN = -1;
    __hallRecorded.clear();
    __rejectSeen.clear();
  }

  function countdownNumber() {
    const left = countdownLeft(S().ow.pvpDuel);
    if (left <= 0) return 0;
    return Math.ceil(left / 1000);
  }

  global.OW_PVP = {
    subscribe,
    leaveCleanup,
    sendDuelRequest,
    acceptDuel,
    rejectDuel,
    canFight,
    inCountdown,
    countdownNumber,
    attackBasic,
    attackSkill,
    tick,
    DUEL_RANGE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
