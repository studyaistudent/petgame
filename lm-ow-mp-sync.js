/**
 * 오픈월드 멀티플레이어 동기화 확장 (15항목)
 * index.html 의 owBuildOWPositionPayload / upsertOtherPet / initOpenWorld3D 와 연동
 */
(function (global) {
  'use strict';

  const OW_WORLD_STATE_DOC = 'ow_world_state';
  let __owWorldStateUnsub = null;

  function rd() { return global.__owRenderer; }
  function me() { return global.S?.myEntry?.nick || ''; }

  function owMpSyncBuildPayloadExtras() {
    const S = global.S;
    const renderer = rd();
    if (!S || !renderer?.human) return {};
    const ex = typeof global._owGetExpandedState === 'function' ? global._owGetExpandedState() : {};
    const race = ex.race || {};
    const worldPos = typeof global.owGetLocalSyncWorldPos === 'function'
      ? global.owGetLocalSyncWorldPos(renderer)
      : null;
    const pos = worldPos
      ? { x: worldPos.x, z: worldPos.z }
      : ((race.active && S.ow.inCar && renderer.car)
        ? renderer.car.position
        : renderer.human.position);
    const mw = global.OWMMODataStore ? global.OWMMODataStore.get() : {};
    const tamed = (mw.tamedPets || []).filter(p => p.companionOn && !p.dead).slice(0, 4)
      .map(p => ({ emoji: p.emoji || '🐾', name: p.name || '펫' }));
    const lookKey = [
      global.getMyAvatar?.()?.glbModel || '',
      S.myEntry?.gender || '',
      global.getMyHeightCm?.() || 180,
      S.ow.equippedWeapon || '',
      S.myPet?.petEmoji || '',
      JSON.stringify(S.myPet?.equipment || {}),
    ].join('|');
    return {
      x: +pos.x.toFixed(2),
      z: +pos.z.toFixed(2),
      lookKey,
      equippedWeapon: S.ow.equippedWeapon || null,
      equipment: S.myPet?.equipment || {},
      fishingDetail: S.ow.fishingPhase || '',
      combatAnim: (Date.now() < (S.ow._combatAnimUntil || 0)) ? (S.ow._combatAnimRole || '') : '',
      combatAnimAt: S.ow._combatAnimAt || 0,
      combatAnimUntil: S.ow._combatAnimUntil || 0,
      combatPetActive: !!(S.ow.combat?.huntMode && S.ow.petCombat && !S.ow.petCombat.dead),
      tamedFollowers: tamed,
      npcQuest: S.ow.npcQuest ? {
        title: S.ow.npcQuest.title,
        tx: S.ow.npcQuest.tx,
        tz: S.ow.npcQuest.tz,
        r: S.ow.npcQuest.r || 8,
        npcId: S.ow.npcQuest.npcId,
      } : null,
      raceActive: !!race.active,
      raceLap: race.lap || 0,
      raceCheckpoint: race.checkpoint || 0,
      raceCar: !!(race.active && S.ow.inCar),
      state: S.ow.inCar
        ? (S.ow.isDriver ? 'driving' : 'riding')
        : (race.active ? 'racing' : (S.ow.fishingPhase ? 'fishing' : (S.ow.onMat ? 'picnic' : 'idle'))),
    };
  }

  function owMpSyncPublishCombatAnim(role) {
    const S = global.S;
    if (!S) return;
    const now = Date.now();
    S.ow._combatAnimRole = role || 'attack';
    S.ow._combatAnimAt = now;
    S.ow._combatAnimUntil = now + 900;
    if (typeof global.owPushOWPositionNow === 'function') global.owPushOWPositionNow();
  }

  function owMpSyncRefreshRemoteWeapon(human, weaponKey) {
    if (!human || !global.LMGlb) return;
    if (!weaponKey) {
      global.LMGlb.detachHandWeapon(human);
      human.userData.lmHandWeaponId = null;
      return;
    }
    const glbId = typeof global.owWeaponGlbId === 'function' ? global.owWeaponGlbId(weaponKey) : null;
    if (!glbId) return;
    if (human.userData.lmHandWeaponId === glbId) return;
    human.userData.lmHandWeaponId = glbId;
    global.LMGlb.attachHandWeapon(human, glbId).catch(() => {});
  }

  function owMpSyncTriggerRemoteCombatAnim(human, role) {
    if (!human || !role) return;
    if (typeof global.owHumanUsesOwAvatar === 'function' && global.owHumanUsesOwAvatar(human) && global.LMOwAvatar) {
      global.LMOwAvatar.triggerCombatAnim(human, role);
    } else if (global.LMGlb && typeof global.LMGlb.triggerAvatarCombatAnim === 'function') {
      global.LMGlb.triggerAvatarCombatAnim(human, role);
    }
  }

  function owMpSyncApplyRemoteEmote(human, data) {
    if (!human || !data || !data.emoteKind || !data.emoteAt) return;
    if (data.emoteAt <= (human.userData.lastEmoteAt || 0)) return;
    human.userData.lastEmoteAt = data.emoteAt;
    if (typeof global.owEmoteDef === 'function' && typeof global.owApplyEmoteOnHuman === 'function') {
      global.owApplyEmoteOnHuman(human, data.emoteKind);
      const ed = global.owEmoteDef(data.emoteKind);
      human.userData.emoteFloat = {
        emoji: ed.emoji,
        until: data.emoteUntil || (Date.now() + 2800),
      };
    }
  }

  function owMpSyncRebuildRemoteHuman(renderer, nick, data) {
    const p = renderer.otherPetsByNick.get(nick);
    if (!p) return;
    renderer.removeOtherPet(nick);
    renderer.upsertOtherPet(nick, data);
  }

  function owMpSyncEnsureOtherMount(renderer, p, data) {
    const mountId = data.mountActive || 'foot';
    const riding = mountId !== 'foot' && !data.mountPassengerOf && data.state !== 'driving' && data.state !== 'riding' && data.state !== 'racing';
    if (!riding) {
      if (p.userData._owMountMesh) {
        renderer.scene.remove(p.userData._owMountMesh);
        renderer._disposeTree(p.userData._owMountMesh);
        p.userData._owMountMesh = null;
      }
      if (p.parent && p.parent.userData?.mountId) renderer.scene.attach(p);
      p.visible = true;
      if (p.userData.companion) p.userData.companion.visible = true;
      return;
    }
    if (!p.userData._owMountMesh || p.userData._owMountId !== mountId) {
      if (p.userData._owMountMesh) {
        renderer.scene.remove(p.userData._owMountMesh);
        renderer._disposeTree(p.userData._owMountMesh);
      }
      p.userData._owMountMesh = renderer._buildMountMesh(mountId);
      p.userData._owMountId = mountId;
      renderer.scene.add(p.userData._owMountMesh);
    }
    const mm = p.userData._owMountMesh;
    const tx = data.x ?? p.position.x;
    const tz = data.z ?? p.position.z;
    const md = Math.hypot(tx - mm.position.x, tz - mm.position.z);
    const ml = md > 12 ? 1 : Math.min(0.55, 0.22 + md * 0.1);
    mm.position.x += (tx - mm.position.x) * ml;
    mm.position.z += (tz - mm.position.z) * ml;
    mm.rotation.y = p.rotation.y;
    const seatY = mm.userData.seatY != null ? mm.userData.seatY : 1.05;
    const seatF = mm.userData.seatForward != null ? mm.userData.seatForward : 0.2;
    mm.attach(p);
    p.position.set(0, seatY, seatF);
    p.rotation.set(0, 0, 0);
    if (p.userData.companion) p.userData.companion.visible = false;
  }

  function owMpSyncEnsureOtherRaceCar(renderer, p, data) {
    if (!data.raceActive || !data.raceCar) {
      if (p.userData._owRaceCar) {
        renderer.scene.remove(p.userData._owRaceCar);
        renderer._disposeTree(p.userData._owRaceCar);
        p.userData._owRaceCar = null;
      }
      p.visible = true;
      return;
    }
    if (!p.userData._owRaceCar) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 3.2), new THREE.MeshLambertMaterial({ color: 0xffd600 }));
      body.position.y = 0.35;
      g.add(body);
      renderer.scene.add(g);
      p.userData._owRaceCar = g;
      p.visible = false;
    }
    const car = p.userData._owRaceCar;
    const tx = data.x ?? p.position.x;
    const tz = data.z ?? p.position.z;
    car.position.set(tx, 0, tz);
    car.rotation.y = data.rotY || p.rotation.y;
  }

  const _fishVecA = { v: null, v2: null, v3: null };
  function owMpSyncFishVec() {
    const THREE = global.THREE;
    if (!_fishVecA.v) {
      _fishVecA.v = new THREE.Vector3();
      _fishVecA.v2 = new THREE.Vector3();
      _fishVecA.v3 = new THREE.Vector3();
    }
    return _fishVecA;
  }

  function owMpSyncDisposeGroup(g) {
    if (!g) return;
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => m && m.dispose && m.dispose());
      }
    });
  }

  function owMpSyncBuildWormMesh(THREE) {
    const worm = new THREE.Group();
    worm.name = 'ow_fish_bait_worm';
    const body = new THREE.MeshLambertMaterial({ color: 0xd32f2f });
    const band = new THREE.MeshLambertMaterial({ color: 0xff8a80 });
    const segs = [
      { x: -0.1, y: 0, z: 0, rx: 0.55, ry: 0.42 },
      { x: 0, y: 0.02, z: 0.08, rx: 0.5, ry: 0.38 },
      { x: 0.1, y: 0, z: 0.16, rx: 0.48, ry: 0.36 },
      { x: 0.18, y: -0.02, z: 0.24, rx: 0.42, ry: 0.32 },
      { x: 0.24, y: 0, z: 0.3, rx: 0.34, ry: 0.28 },
    ];
    segs.forEach((s, i) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), i % 2 ? band : body);
      m.scale.set(s.rx, s.ry, s.rx * 0.85);
      m.position.set(s.x, s.y, s.z);
      worm.add(m);
    });
    const eye = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x263238 })
    );
    eye.position.set(0.27, 0.04, 0.31);
    worm.add(eye);
    worm.rotation.x = Math.PI / 2;
    return worm;
  }

  function owMpSyncBuildRodGroup(THREE) {
    const rod = new THREE.Group();
    rod.name = 'ow_fish_rod';
    const wood = new THREE.MeshLambertMaterial({ color: 0x8d6e63 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.32, 6), wood);
    handle.position.y = 0.16;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 1.35, 6), wood);
    pole.position.set(0, 0.92, 0.08);
    pole.rotation.x = 0.42;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), wood);
    tip.position.set(0, 1.48, 0.42);
    rod.add(handle, pole, tip);
    rod.position.set(0.34, 0.62, 0.18);
    rod.rotation.set(0.1, -0.55, -0.15);
    return rod;
  }

  function owMpSyncBuildFishScene(THREE) {
    const scene = new THREE.Group();
    scene.name = 'ow_fish_scene';
    const line = new THREE.Mesh(
      new THREE.CylinderGeometry(0.003, 0.003, 1, 4),
      new THREE.MeshBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: 0.9 })
    );
    line.geometry.translate(0, 0.5, 0);
    scene.userData.line = line;
    scene.add(line);
    const bait = owMpSyncBuildWormMesh(THREE);
    scene.userData.bait = bait;
    scene.add(bait);
    return scene;
  }

  function owMpSyncLakeCenter() {
    return global.OW_LAKE_CENTER || { x: -28, z: 22, r: 14 };
  }

  function owMpSyncCastProgress(phase) {
    if (phase !== 'casting') return 1;
    const until = global.S?.ow?.fishingCastUntil || 0;
    if (!until) return 0.35;
    return Math.max(0.08, Math.min(1, 1 - (until - Date.now()) / 900));
  }

  function owMpSyncCalcBaitPos(actor, phase, t) {
    const lake = owMpSyncLakeCenter();
    const pos = actor.position;
    const dx = lake.x - pos.x;
    const dz = lake.z - pos.z;
    const dist = Math.max(0.01, Math.hypot(dx, dz));
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const cast = Math.min(7.5, Math.max(3.2, dist - lake.r * 0.35));
    const prog = owMpSyncCastProgress(phase);
    const bob = (phase === 'waiting' || phase === 'fighting' || phase === 'bite')
      ? Math.sin(t * 3.2) * 0.07 : 0;
    const wiggle = (phase === 'fighting' || phase === 'bite') ? Math.sin(t * 8) * 0.12 : 0;
    return {
      x: pos.x + dirX * cast * prog + wiggle * dirZ,
      y: 0.14 + bob,
      z: pos.z + dirZ * cast * prog - wiggle * dirX,
    };
  }

  function owMpSyncRodTipWorld(actor, out) {
    const { v } = owMpSyncFishVec();
    const o = out || v;
    if (actor.userData._owFishRod) {
      o.set(0, 1.48, 0.42);
      actor.userData._owFishRod.localToWorld(o);
    } else {
      o.set(0.3, 1.25, 0.55);
      actor.localToWorld(o);
    }
    return o;
  }

  function owMpSyncPlaceLine(lineMesh, from, to) {
    const { v, v2, v3 } = owMpSyncFishVec();
    v.copy(from);
    v2.copy(to);
    v3.subVectors(v2, v).multiplyScalar(0.5).add(v);
    const len = v.distanceTo(v2);
    lineMesh.position.copy(v3);
    lineMesh.scale.set(1, Math.max(0.05, len), 1);
    if (len > 0.02) {
      lineMesh.quaternion.setFromUnitVectors(
        new global.THREE.Vector3(0, 1, 0),
        v2.sub(v).normalize()
      );
    }
  }

  function owMpSyncClearFishingOnActor(renderer, actor) {
    if (!actor) return;
    if (actor.userData._owFishRod) {
      actor.remove(actor.userData._owFishRod);
      owMpSyncDisposeGroup(actor.userData._owFishRod);
      actor.userData._owFishRod = null;
    }
    if (actor.userData._owFishScene && renderer) {
      renderer.scene.remove(actor.userData._owFishScene);
      owMpSyncDisposeGroup(actor.userData._owFishScene);
      actor.userData._owFishScene = null;
    }
    actor.userData.fishingDetail = '';
  }

  function owMpSyncEnsureFishingVisuals(renderer, actor, phase) {
    const THREE = global.THREE;
    if (!THREE || !renderer || !actor) return;
    const on = !!phase;
    if (!on) {
      owMpSyncClearFishingOnActor(renderer, actor);
      return;
    }
    if (!actor.userData._owFishRod) {
      actor.userData._owFishRod = owMpSyncBuildRodGroup(THREE);
      actor.add(actor.userData._owFishRod);
    }
    if (!actor.userData._owFishScene) {
      actor.userData._owFishScene = owMpSyncBuildFishScene(THREE);
      renderer.scene.add(actor.userData._owFishScene);
    }
    actor.userData.fishingDetail = phase;
  }

  function owMpSyncTickFishingVisuals(renderer, actor, phase, t) {
    if (!phase || !actor) return;
    owMpSyncEnsureFishingVisuals(renderer, actor, phase);
    const scene = actor.userData._owFishScene;
    if (!scene) return;
    const baitPos = owMpSyncCalcBaitPos(actor, phase, t);
    const tip = owMpSyncRodTipWorld(actor);
    const { v2 } = owMpSyncFishVec();
    v2.set(baitPos.x, baitPos.y, baitPos.z);
    owMpSyncPlaceLine(scene.userData.line, tip, v2);
    if (scene.userData.bait) {
      scene.userData.bait.position.copy(v2);
      scene.userData.bait.rotation.y = actor.rotation.y + Math.sin(t * 2.5) * 0.25;
      scene.userData.bait.rotation.z = Math.sin(t * 4 + 0.5) * 0.35;
    }
  }

  function owMpSyncEnsureFishingRod(renderer, p, data) {
    const phase = data.fishingDetail || '';
    if (!phase) {
      owMpSyncClearFishingOnActor(renderer, p);
      return;
    }
    owMpSyncEnsureFishingVisuals(renderer, p, phase);
  }

  function owMpSyncTickLocalFishing(renderer, t) {
    const S = global.S;
    if (!S || S.screen !== 'openworld' || !renderer?.human) return;
    const phase = S.ow.fishingPhase;
    if (!phase) {
      owMpSyncClearFishingOnActor(renderer, renderer.human);
      return;
    }
    owMpSyncTickFishingVisuals(renderer, renderer.human, phase, t);
  }

  function owMpSyncTickRemoteFishing(renderer, p, t) {
    const phase = p.userData.fishingDetail;
    if (!phase) return;
    owMpSyncTickFishingVisuals(renderer, p, phase, t);
  }

  function owMpSyncSyncTamedFollowers(renderer, p, nick, data) {
    const list = data.tamedFollowers || [];
    p.userData._owTamedMeshes = p.userData._owTamedMeshes || [];
    while (p.userData._owTamedMeshes.length > list.length) {
      const tm = p.userData._owTamedMeshes.pop();
      renderer.scene.remove(tm.group);
      renderer._disposeTree(tm.group);
    }
    list.forEach((pet, i) => {
      let tm = p.userData._owTamedMeshes[i];
      if (!tm) {
        const g = renderer._buildPet(pet.emoji || '🐾', null);
        g.scale.set(0.4, 0.4, 0.4);
        renderer.scene.add(g);
        tm = { group: g, slot: i, total: list.length };
        p.userData._owTamedMeshes[i] = tm;
      }
      tm.total = list.length;
      tm.slot = i;
    });
  }

  function owMpSyncTickTamedFollowers(renderer, p, dt) {
    const tms = p.userData._owTamedMeshes;
    if (!tms?.length) return;
    const now = Date.now();
    tms.forEach((tm, idx) => {
      const ang = (idx / Math.max(1, tm.total)) * Math.PI * 2;
      const orbitR = 2 + idx * 0.4;
      const tx = p.position.x + Math.sin(ang + now * 0.0008) * orbitR;
      const tz = p.position.z + Math.cos(ang + now * 0.0008) * orbitR;
      const dx = tx - tm.group.position.x;
      const dz = tz - tm.group.position.z;
      const d = Math.hypot(dx, dz) || 1;
      tm.group.position.x += dx / d * 0.08;
      tm.group.position.z += dz / d * 0.08;
      tm.group.position.y = 0;
    });
  }

  function owMpSyncEnsureNpcQuestRing(renderer, p, data) {
    const q = data.npcQuest;
    if (!q) {
      if (p.userData._owNpcQuestRing) {
        renderer.scene.remove(p.userData._owNpcQuestRing);
        p.userData._owNpcQuestRing = null;
      }
      return;
    }
    if (!p.userData._owNpcQuestRing) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(6.5, 7.5, 32),
        new THREE.MeshBasicMaterial({ color: 0xffd600, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.rotation.x = -Math.PI / 2;
      renderer.scene.add(ring);
      p.userData._owNpcQuestRing = ring;
    }
    p.userData._owNpcQuestRing.position.set(q.tx, 0.05, q.tz);
  }

  function owMpSyncApplyRemotePlayer(renderer, nick, data) {
    const p = renderer.otherPetsByNick.get(nick);
    if (!p || !data) return;

    if (data.lookKey && data.lookKey !== p.userData._owLookKey) {
      p.userData._owLookKey = data.lookKey;
      owMpSyncRebuildRemoteHuman(renderer, nick, data);
      return;
    }

    owMpSyncRefreshRemoteWeapon(p, data.equippedWeapon);
    owMpSyncApplyRemoteEmote(p, data);

    if (data.combatAnimAt && data.combatAnim && data.combatAnimAt > (p.userData._lastCombatAnimAt || 0)) {
      p.userData._lastCombatAnimAt = data.combatAnimAt;
      owMpSyncTriggerRemoteCombatAnim(p, data.combatAnim);
    }

    if (data.combatPetActive) {
      if (p.userData.companion) {
        p.userData.companion.visible = true;
        p.userData.companion.userData._combatMode = true;
      }
    } else if (p.userData.companion) {
      p.userData.companion.userData._combatMode = false;
    }

    owMpSyncEnsureOtherMount(renderer, p, data);
    owMpSyncEnsureOtherRaceCar(renderer, p, data);
    owMpSyncEnsureFishingRod(renderer, p, data);
    owMpSyncSyncTamedFollowers(renderer, p, nick, data);
    owMpSyncEnsureNpcQuestRing(renderer, p, data);
  }

  function owMpSyncTickRemotePlayers(renderer, dt) {
    const t = Date.now() * 0.001;
    renderer.otherPetsByNick.forEach((p) => {
      owMpSyncTickTamedFollowers(renderer, p, dt);
      owMpSyncTickRemoteFishing(renderer, p, t);
      const tx = p.userData.targetX ?? p.position.x;
      const tz = p.userData.targetZ ?? p.position.z;
      const rot = p.userData.targetRotY ?? p.rotation.y;
      if (p.userData._owRaceCar) {
        const car = p.userData._owRaceCar;
        const cd = Math.hypot(tx - car.position.x, tz - car.position.z);
        const cl = cd > 12 ? 1 : Math.min(0.55, 0.22 + cd * 0.1);
        car.position.x += (tx - car.position.x) * cl;
        car.position.z += (tz - car.position.z) * cl;
        car.rotation.y = rot;
        return;
      }
      if (p.userData._owMountMesh && p.parent === p.userData._owMountMesh) {
        const mm = p.userData._owMountMesh;
        const md = Math.hypot(tx - mm.position.x, tz - mm.position.z);
        const ml = md > 12 ? 1 : Math.min(0.55, 0.22 + md * 0.1);
        mm.position.x += (tx - mm.position.x) * ml;
        mm.position.z += (tz - mm.position.z) * ml;
        mm.rotation.y = rot;
      }
    });
  }

  function owMpSyncCreateRemoteCampfireMesh(renderer, x, z) {
    const g = new THREE.Group();
    const logMat = new THREE.MeshLambertMaterial({ color: 0x6b4423 });
    for (let i = 0; i < 4; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.05, 8), logMat);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = (i * Math.PI) / 4;
      log.position.y = 0.12 + (i % 2) * 0.1;
      g.add(log);
    }
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.55, 8),
      new THREE.MeshBasicMaterial({ color: 0xff6d00, transparent: true, opacity: 0.85 })
    );
    flame.position.y = 0.42;
    g.add(flame);
    g.position.set(x, 0, z);
    renderer.scene.add(g);
    return g;
  }

  function owMpSyncCleanupRemote(renderer, nick) {
    const p = renderer.otherPetsByNick.get(nick);
    if (!p) return;
    owMpSyncClearFishingOnActor(renderer, p);
    if (p.userData._owMountMesh) {
      renderer.scene.remove(p.userData._owMountMesh);
      renderer._disposeTree(p.userData._owMountMesh);
    }
    if (p.userData._owRaceCar) {
      renderer.scene.remove(p.userData._owRaceCar);
      renderer._disposeTree(p.userData._owRaceCar);
    }
    if (p.userData._owNpcQuestRing) {
      renderer.scene.remove(p.userData._owNpcQuestRing);
    }
    (p.userData._owTamedMeshes || []).forEach(tm => {
      renderer.scene.remove(tm.group);
      renderer._disposeTree(tm.group);
    });
  }

  /* ── 공유 월드 상태 (보물·모닥불) ── */
  function owMpSyncWorldState() { return global.S?.ow?.worldStateSync || null; }

  function owMpSyncApplyWorldState() {
    const ws = owMpSyncWorldState();
    const renderer = rd();
    if (!renderer) return;

    if (ws?.treasures && renderer.featureTreasures) {
      renderer.featureTreasures.forEach(mesh => {
        const id = mesh.userData?.treasureId;
        if (id && ws.treasures[id]) mesh.visible = false;
      });
    }

    renderer._remoteCampfires = renderer._remoteCampfires || [];
    const remote = ws?.campfires || [];
    const now = Date.now();
    while (renderer._remoteCampfires.length > remote.length) {
      const c = renderer._remoteCampfires.pop();
      renderer.scene.remove(c);
      renderer._disposeTree(c);
    }
    remote.forEach((cf, i) => {
      if (!cf || (cf.until && now > cf.until)) return;
      let g = renderer._remoteCampfires[i];
      if (!g) {
        g = owMpSyncCreateRemoteCampfireMesh(renderer, cf.x, cf.z);
        g.userData.remoteCampfire = true;
        renderer._remoteCampfires[i] = g;
      } else {
        g.position.set(cf.x, 0, cf.z);
      }
    });
  }

  async function owMpSyncMarkTreasureCollected(treasureId) {
    if (!treasureId || !global.owEventsCol) return;
    const nick = me();
    const ref = global.owEventsCol.doc(OW_WORLD_STATE_DOC);
    const snap = await ref.get().catch(() => null);
    const cur = snap?.exists ? snap.data() : {};
    const treasures = { ...(cur.treasures || {}) };
    treasures[treasureId] = { by: nick, at: Date.now() };
    await ref.set({ treasures, updatedAt: Date.now() }, { merge: true }).catch(() => {});
  }

  async function owMpSyncAddCampfire(x, z, durationMs) {
    if (!global.owEventsCol) return;
    const ref = global.owEventsCol.doc(OW_WORLD_STATE_DOC);
    const snap = await ref.get().catch(() => null);
    const cur = snap?.exists ? snap.data() : {};
    const campfires = (cur.campfires || []).filter(c => !c.until || c.until > Date.now());
    campfires.push({
      x: +x.toFixed(2), z: +z.toFixed(2),
      nick: me(), until: Date.now() + (durationMs || 60000),
    });
    await ref.set({ campfires: campfires.slice(-12), updatedAt: Date.now() }, { merge: true }).catch(() => {});
  }

  function owMpSyncSubscribeWorldState() {
    if (__owWorldStateUnsub) { try { __owWorldStateUnsub(); } catch (e) {} }
    if (!global.owEventsCol) return;
    __owWorldStateUnsub = global.owEventsCol.doc(OW_WORLD_STATE_DOC).onSnapshot(doc => {
      if (global.S?.ow) global.S.ow.worldStateSync = doc.exists ? doc.data() : null;
      owMpSyncApplyWorldState();
    });
  }

  function owMpSyncLeaveCleanup() {
    if (__owWorldStateUnsub) { try { __owWorldStateUnsub(); } catch (e) {} __owWorldStateUnsub = null; }
    if (global.S?.ow) global.S.ow.worldStateSync = null;
  }

  /* ── 공유 몹 스폰 헬퍼 ── */
  async function owMpSyncSpawnSharedMob(kind, spawnList) {
    if (typeof global.owSharedBossSpawnMobs === 'function') {
      return global.owSharedBossSpawnMobs(kind, spawnList);
    }
  }

  global.OW_MP_SYNC = {
    buildPayloadExtras: owMpSyncBuildPayloadExtras,
    publishCombatAnim: owMpSyncPublishCombatAnim,
    applyRemotePlayer: owMpSyncApplyRemotePlayer,
    tickRemotePlayers: owMpSyncTickRemotePlayers,
    tickLocalFishing: owMpSyncTickLocalFishing,
    cleanupRemote: owMpSyncCleanupRemote,
    subscribeWorldState: owMpSyncSubscribeWorldState,
    leaveCleanup: owMpSyncLeaveCleanup,
    markTreasureCollected: owMpSyncMarkTreasureCollected,
    addCampfire: owMpSyncAddCampfire,
    spawnSharedMob: owMpSyncSpawnSharedMob,
  };
})(typeof window !== 'undefined' ? window : globalThis);
