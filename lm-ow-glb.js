/**
 * 오픈월드 GLB — pet / 탈것 / 2인용 탈것 / 오픈월드 맵 오브젝트
 */
(function (global) {
  const PET = {
    bear: 'pet/Meshy_AI_Pet_Bear_0603040027_image-to-3d-texture.glb',
    bird: 'pet/Meshy_AI_Pet_Bird_0603040141_image-to-3d-texture.glb',
    cat: 'pet/Meshy_AI_Pet_Cat_0603040105_image-to-3d-texture.glb',
    devil: 'pet/Meshy_AI_Pet_Devil_0603040138_image-to-3d-texture.glb',
    dog: 'pet/Meshy_AI_Pet_Dog_0603040005_image-to-3d-texture.glb',
    fox: 'pet/Meshy_AI_Pet_Fox_0603040017_image-to-3d-texture.glb',
    frog: 'pet/Meshy_AI_Pet_Frog_0603040123_image-to-3d-texture.glb',
    hamster: 'pet/Meshy_AI_Pet_Hamster_0603040049_image-to-3d-texture.glb',
    hedgehog: 'pet/Meshy_AI_Pet_Hedgehog_0603040132_image-to-3d-texture.glb',
    koala: 'pet/Meshy_AI_Pet_Koala_0603040053_image-to-3d-texture.glb',
    lion: 'pet/Meshy_AI_Pet_Lion_0603040045_image-to-3d-texture.glb',
    mouse: 'pet/Meshy_AI_Pet_Mouse_0603040129_image-to-3d-texture.glb',
    owl: 'pet/Meshy_AI_Pet_Owl_0603040116_image-to-3d-texture.glb',
    panda: 'pet/Meshy_AI_Pet_Panda_0603040112_image-to-3d-texture.glb',
    rabbit: 'pet/Meshy_AI_Pet_Rabbit_0603040109_image-to-3d-texture.glb',
    raccoon: 'pet/Meshy_AI_Pet_Raccoon_0603040101_image-to-3d-texture.glb',
    tiger: 'pet/Meshy_AI_Pet_Tiger_0603040057_image-to-3d-texture.glb',
    turtle: 'pet/Meshy_AI_Pet_Turtle_0603040136_image-to-3d-texture.glb'
  };

  const PET_EMOJI = {
    '🐻': 'bear',
    '🐦': 'bird',
    '🐤': 'bird',
    '🐱': 'cat',
    '😈': 'devil',
    '👿': 'devil',
    '🐶': 'dog',
    '🦊': 'fox',
    '🐸': 'frog',
    '🐹': 'hamster',
    '🦔': 'hedgehog',
    '🐨': 'koala',
    '🦁': 'lion',
    '🐭': 'mouse',
    '🦉': 'owl',
    '🐼': 'panda',
    '🐰': 'rabbit',
    '🦝': 'raccoon',
    '🐯': 'tiger',
    '🐢': 'turtle',
    '🐾': 'dog'
  };

  /** Meshy 앉기 포즈 — 안장면에 엉덩이 맞추기 (탈것별 미세 조정) */
  const MOUNT_AVATAR_SIT_BASE = 0.64;

  const MOUNT = {
    horse: {
      glb: '탈것/Meshy_AI_Mount_Horse_0603041715_image-to-3d-texture.glb',
      glb2: '2인용 탈것/Meshy_AI_Open_World_Horse_Moun_0603042850_image-to-3d-texture.glb',
      h: 2.1,
      seatY: 1.08,
      seatZ: 0.22,
      wrapperDrop: 0,
      avatarSitDrop: 0,
      pass: [[-0.42, 0.88, -0.38]]
    },
    wolf: {
      glb: '탈것/Meshy_AI_Mount_Wolf_0603041727_image-to-3d-texture.glb',
      glb2: '2인용 탈것/Meshy_AI_Open_World_Wolf_Mount_0603042857_image-to-3d-texture.glb',
      h: 1.95,
      seatY: 1.02,
      seatZ: 0.18,
      wrapperDrop: 0.05,
      avatarSitDrop: 0.1,
      pass: [[-0.38, 0.84, -0.42]]
    },
    car_ow: {
      glb: '탈것/Meshy_AI_Mount_Car_0603041734_image-to-3d-texture.glb',
      glb2: '2인용 탈것/Meshy_AI_Open_World_Car_Mount_0603042902_image-to-3d-texture.glb',
      h: 1.85,
      seatY: 0.82,
      seatZ: 0.08,
      wrapperDrop: 0.06,
      avatarSitDrop: 0.12,
      pass: [[-0.55, 0.74, -0.15], [0.55, 0.74, -0.15]]
    },
    airship: {
      glb: '탈것/Meshy_AI_Mount_Airplane_0603041741_image-to-3d-texture.glb',
      glb2: '2인용 탈것/Meshy_AI_Open_World_Airplane_M_0603042905_image-to-3d-texture.glb',
      h: 2.8,
      seatY: 0.92,
      seatZ: 0.12,
      wrapperDrop: 0.04,
      avatarSitDrop: 0.08,
      pass: [[-0.45, 0.86, 0.35]]
    },
    dragon: {
      glb: '탈것/Meshy_AI_Mount_Dragon_0603041744_image-to-3d-texture.glb',
      glb2: '2인용 탈것/Meshy_AI_Open_World_Dragon_Mou_0603042909_image-to-3d-texture.glb',
      h: 2.6,
      seatY: 1.12,
      seatZ: 0.28,
      wrapperDrop: 0.03,
      avatarSitDrop: 0.06,
      pass: [[-0.5, 1.05, -0.55]]
    }
  };

  const WORLD = {
    npc: '오픈월드/Meshy_AI_NPC_Raccoon_0603045824_image-to-3d-texture.glb',
    house: '오픈월드/Meshy_AI_Pastel_House_0603045805_image-to-3d-texture.glb',
    lamp: '오픈월드/Meshy_AI_Street_Lamp_0603045800_image-to-3d-texture.glb'
  };

  /** 오픈월드 NPC GLB — id별 메쉬 (실제 파일: 오픈월드/ 폴더) */
  const NPC = {
    default: WORLD.npc,
    wanderer: [
      '오픈월드/Meshy_AI_NPC2Ember_Cauldron_Mercha_0603085613_texture.glb',
      '오픈월드폴더/Meshy_AI_NPC2Ember_Cauldron_Mercha_0603085613_texture.glb'
    ],
    guard_capt: [
      '오픈월드/Meshy_AI_NPC3Bear_Knight_of_the_St_0603091418_texture.glb',
      '오픈월드폴더/Meshy_AI_NPC3Bear_Knight_of_the_St_0603091418_texture.glb'
    ]
  };

  const NPC_TARGET_H = {
    wanderer: 1.62,
    guard_capt: 1.88,
    default: 1.55
  };

  const cache = new Map();
  let loader = null;

  function getLoader() {
    if (loader) return loader;
    const THREE = global.THREE;
    if (!THREE || !THREE.GLTFLoader) return null;
    loader = new THREE.GLTFLoader();
    return loader;
  }

  function encodeAssetUrl(url) {
    const s = String(url || '').replace(/\\/g, '/').trim();
    if (!s) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (/%[0-9A-Fa-f]{2}/.test(s)) return s;
    const qi = s.indexOf('?');
    const base = qi >= 0 ? s.slice(0, qi) : s;
    const query = qi >= 0 ? s.slice(qi) : '';
    return base.split('/').map((seg) => encodeURIComponent(seg)).join('/') + query;
  }

  function loadGlb(url) {
    const key = url;
    if (cache.has(key)) return cache.get(key);
    const ld = getLoader();
    if (!ld) return Promise.reject(new Error('GLTFLoader missing'));
    const loadUrl = encodeAssetUrl(url);
    const p = new Promise((resolve, reject) => {
      ld.load(
        loadUrl,
        (g) => resolve(g),
        undefined,
        (err) => {
          cache.delete(key);
          console.warn('[LMOwGlb] GLB 로드 실패:', loadUrl, err && err.message ? err.message : err);
          reject(err);
        }
      );
    });
    cache.set(key, p);
    return p;
  }

  function loadGlbUrls(urls) {
    const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    if (!list.length) return Promise.reject(new Error('no glb urls'));
    const tryAt = (idx) => {
      if (idx >= list.length) {
        return Promise.reject(new Error('404 NPC GLB: ' + list.join(' | ')));
      }
      return loadGlb(list[idx]).catch(() => tryAt(idx + 1));
    };
    return tryAt(0);
  }

  function measureH(model) {
    const THREE = global.THREE;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      try {
        box.expandByObject(o, true);
      } catch (e) {
        box.expandByObject(o);
      }
    });
    if (box.isEmpty()) return 0;
    let h = box.max.y - box.min.y;
    if (h > 50) h *= 0.01;
    else if (h > 2.5) h *= 0.01;
    return h;
  }

  function applyFit(model, targetH, saved) {
    const THREE = global.THREE;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    if (saved && saved.scale > 0) {
      model.scale.setScalar(saved.scale);
      model.position.y = saved.baseY != null ? saved.baseY : 0;
      model.updateMatrixWorld(true);
      return saved.scale;
    }
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    const h = measureH(model);
    const sy = h >= 0.08 ? THREE.MathUtils.clamp(targetH / h, 0.02, 8) : 1;
    model.scale.setScalar(sy);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      box.expandByObject(o, true);
    });
    model.position.y = box.isEmpty() ? 0 : -box.min.y;
    model.updateMatrixWorld(true);
    return sy;
  }

  function disposeTree(obj) {
    if (!obj) return;
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => m && m.dispose && m.dispose());
    });
  }

  function attachModel(parent, url, targetH, name, opts) {
    opts = opts || {};
    const loader = Array.isArray(url) ? loadGlbUrls(url) : loadGlb(url);
    return loader.then((gltf) => {
      const prev = parent.getObjectByName('ow_glb_model');
      if (prev) {
        parent.remove(prev);
        disposeTree(prev);
      }
      const model = gltf.scene;
      model.name = name || 'ow_glb_model';
      const saved = parent.userData.owFitSaved;
      const sy = applyFit(model, targetH, saved);
      if (!saved) parent.userData.owFitSaved = { scale: sy, baseY: model.position.y };
      if (opts.polishMaterials && global.LMGlb && typeof global.LMGlb.polishOwGlbModel === 'function') {
        global.LMGlb.polishOwGlbModel(model);
      }
      parent.add(model);
      parent.userData.glbLoaded = true;
      if (gltf.animations && gltf.animations.length && global.THREE) {
        const root = model;
        let skin = null;
        model.traverse((o) => {
          if (!skin && o.isSkinnedMesh) skin = o;
        });
        const mixer = new global.THREE.AnimationMixer(skin || root);
        const act = mixer.clipAction(gltf.animations[0]);
        act.setLoop(global.THREE.LoopRepeat, Infinity);
        act.play();
        parent.userData.owMixer = mixer;
      }
      return model;
    });
  }

  function resolvePetKey(emoji) {
    return PET_EMOJI[emoji] || PET_EMOJI['🐾'] || 'dog';
  }

  const PET_TARGET_H = 1.42;

  function removePetProceduralLimbs(model) {
    if (!model) return;
    const old = model.getObjectByName('pet_proc_limbs');
    if (old) {
      model.remove(old);
      disposeTree(old);
    }
  }

  function attachPet(wrapper, emoji) {
    const key = resolvePetKey(emoji);
    const url = PET[key];
    wrapper.userData.petGlbKey = key;
    wrapper.userData.legs = null;
    wrapper.userData.armL = null;
    wrapper.userData.armR = null;
    return attachModel(wrapper, url, PET_TARGET_H, 'ow_glb_model').then((model) => {
      removePetProceduralLimbs(model);
      return model;
    });
  }

  /** GLB 탈것 로드 후 등(안장) 높이·전후 위치 보정 */
  function refineMountSeat(group, model, def) {
    const THREE = global.THREE;
    if (!THREE || !model || !group) return;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const h = box.max.y - box.min.y;
    const saddleY = box.min.y + h * 0.38;
    const centerZ = (box.min.z + box.max.z) * 0.5;
    const hintY = def && def.seatY != null ? def.seatY : 1.0;
    group.userData.mountSeatY = Math.min(saddleY, hintY * 0.92);
    group.userData.seatForward = def && def.seatZ != null ? def.seatZ : centerZ;
    group.userData.mountSeatComputed = true;
  }

  function applyMountRideMeta(group, def) {
    if (!group || !def) return;
    group.userData.mountAvatarSitDrop = def.avatarSitDrop != null ? def.avatarSitDrop : 0;
    group.userData.mountWrapperDrop = def.wrapperDrop != null ? def.wrapperDrop : 0;
    group.userData.mountAvatarSitBase = MOUNT_AVATAR_SIT_BASE;
  }

  /** 러브몬·하우스·미니 캔버스용 GLB 펫 그룹 */
  function createPetGroup(emoji) {
    const wrapper = new THREE.Group();
    wrapper.name = 'lm_character_wrap';
    wrapper.userData.walkPhase = 0;
    wrapper.userData.petEmoji = emoji || '🐾';
    wrapper.userData.glbUsesAnim = true;
    wrapper.userData.glbPet = true;
    wrapper.userData.lmTargetHeight = PET_TARGET_H;
    attachPet(wrapper, emoji);
    return wrapper;
  }

  function attachMount(group, mountId, opts) {
    opts = opts || {};
    const def = MOUNT[mountId];
    if (!def) return Promise.resolve();
    const dual = !!opts.dual;
    const url = dual && def.glb2 ? def.glb2 : def.glb;
    group.userData.mountSeatY = def.seatY;
    group.userData.seatForward = def.seatZ != null ? def.seatZ : 0.18;
    group.userData.mountPassSeats = def.pass;
    group.userData.mountDual = dual;
    applyMountRideMeta(group, def);
    return attachModel(group, url, def.h, 'ow_glb_model').then((model) => {
      refineMountSeat(group, model, def);
      applyMountRideMeta(group, def);
      return model;
    });
  }

  function resolveNpcUrls(npcId) {
    if (npcId && NPC[npcId]) {
      const u = NPC[npcId];
      return Array.isArray(u) ? u : [u];
    }
    const d = NPC.default || WORLD.npc;
    return Array.isArray(d) ? d : [d];
  }

  function resolveNpcHeight(npcId) {
    if (npcId && NPC_TARGET_H[npcId] != null) return NPC_TARGET_H[npcId];
    return NPC_TARGET_H.default != null ? NPC_TARGET_H.default : 1.55;
  }

  /** npcId: OW_MMO_NPCS id · group.userData.npcId 도 사용 */
  function attachNpc(group, npcId) {
    const id = npcId || (group && group.userData && group.userData.npcId) || null;
    const urls = resolveNpcUrls(id);
    const h = resolveNpcHeight(id);
    return attachModel(group, urls, h, 'ow_glb_model', { polishMaterials: true })
      .then((model) => {
        if (group && group.userData && group.userData.sprite) {
          group.userData.sprite.visible = false;
        }
        if (group && group.userData) group.userData.owNpcGlbId = id;
        return model;
      })
      .catch((err) => {
        console.warn('[LMOwGlb] NPC GLB 전부 실패 → 기본 NPC:', id, err && err.message ? err.message : err);
        if (group && group.userData && group.userData.sprite) {
          group.userData.sprite.visible = true;
        }
        return attachModel(group, WORLD.npc, h, 'ow_glb_model', { polishMaterials: true });
      });
  }

  const HOUSE_DEFAULT_H = 4.2;

  /** 오픈월드 주택 GLB — 동일 메쉬, targetH(미터)로 크기만 조절 */
  function attachHouse(group, targetH) {
    const h =
      targetH != null && Number(targetH) > 0 ? Number(targetH) : HOUSE_DEFAULT_H;
    return attachModel(group, WORLD.house, h, 'ow_glb_model');
  }

  function attachLamp(group) {
    return attachModel(group, WORLD.lamp, 3.4, 'ow_glb_model');
  }

  function tickMixers(root, dt) {
    if (!root) return;
    const step = dt != null && dt > 0 ? dt : 1 / 60;
    root.traverse((o) => {
      if (o.userData && o.userData.owMixer) o.userData.owMixer.update(step);
    });
  }

  /** GLB 펫 따라가기 — GLB 내장 모션(mixer)만 사용 */
  function updatePetLocomotion(wrapper, moving, dt) {
    if (!wrapper || !wrapper.userData.glbPet) return;
    const step = dt != null && dt > 0 ? dt : 1 / 60;
    const mixer = wrapper.userData.owMixer;
    if (mixer) {
      mixer.timeScale += ((moving ? 1.08 : 1.0) - mixer.timeScale) * 0.1;
      mixer.update(step);
    }
    if (moving) {
      wrapper.userData.walkPhase = (wrapper.userData.walkPhase || 0) + step * 11;
      const phase = wrapper.userData.walkPhase;
      wrapper.position.y = Math.abs(Math.sin(phase * 2)) * 0.045;
    } else {
      wrapper.userData.walkPhase *= 0.85;
      wrapper.position.y *= 0.82;
      if (wrapper.position.y < 0.006) wrapper.position.y = 0;
    }
  }

  function clearCache() {
    cache.clear();
  }

  function resolveMountSitYOffset(wrapper) {
    let drop = MOUNT_AVATAR_SIT_BASE;
    const parent = wrapper && wrapper.parent;
    if (parent && parent.userData) {
      if (parent.userData.mountAvatarSitBase != null) drop = parent.userData.mountAvatarSitBase;
      if (parent.userData.mountAvatarSitDrop != null) drop += parent.userData.mountAvatarSitDrop;
    }
    return -drop;
  }

  global.LMOwGlb = {
    PET,
    PET_EMOJI,
    PET_TARGET_H,
    MOUNT,
    MOUNT_AVATAR_SIT_BASE,
    resolveMountSitYOffset,
    WORLD,
    NPC,
    NPC_TARGET_H,
    resolveNpcUrls,
    loadGlbUrls,
    resolveNpcHeight,
    resolvePetKey,
    loadGlb,
    attachPet,
    createPetGroup,
    applyMountRideMeta,
    attachMount,
    attachNpc,
    HOUSE_DEFAULT_H,
    attachHouse,
    attachLamp,
    tickMixers,
    updatePetLocomotion,
    clearCache
  };
})(typeof window !== 'undefined' ? window : global);
