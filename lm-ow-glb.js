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
      seatY: 1.08,
      seatZ: 0.12,
      saddleRatio: 0.62,
      wrapperDrop: 0.02,
      avatarSitDrop: 0.04,
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

  /** 캐시된 GLB는 scene 공유 — 인스턴스마다 복제 (테이밍 펫 다수 표시) */
  function cloneGltfScene(gltf) {
    const model = gltf.scene.clone(true);
    model.traverse((o) => {
      if ((o.isMesh || o.isSkinnedMesh) && o.geometry) {
        o.geometry = o.geometry.clone();
      }
    });
    return model;
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
      const model = cloneGltfScene(gltf);
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

  /** 펫 종별 체형 — 장비 소켓 오프셋 미세 조정 */
  const PET_BODY_KIND = {
    bear: 'quad', bird: 'bird', cat: 'quad', devil: 'biped', dog: 'quad', fox: 'quad',
    frog: 'low', hamster: 'small', hedgehog: 'small', koala: 'quad', lion: 'quad',
    mouse: 'small', owl: 'bird', panda: 'quad', rabbit: 'quad', raccoon: 'quad',
    tiger: 'quad', turtle: 'low',
  };

  const PET_EQUIP_BONE_PATTERNS = {
    head: [/mixamorighead/i, /^head$/i, /^head_/i, /skull/i, /cranium/i, /\.head$/i],
    neck: [/mixamorigneck/i, /^neck/i, /\.neck$/i],
    spine: [/mixamorigspine2/i, /mixamorigspine1/i, /^chest/i, /^torso/i, /^spine2/i, /^spine1/i,
      /mixamorigspine/i, /^spine/i],
    handR: [/mixamorigrighthand/i, /righthand/i, /right_hand/i, /hand_r/i, /hand\.r/i,
      /right.*front/i, /front.*right/i, /right.*paw/i, /right.*leg/i, /leg.*r/i, /arm.*r/i],
    handL: [/mixamoriglefthand/i, /lefthand/i, /left_hand/i, /hand_l/i, /hand\.l/i,
      /left.*front/i, /front.*left/i, /left.*paw/i, /left.*leg/i, /leg.*l/i],
    back: [/mixamorigspine2/i, /upper.*back/i, /^back/i, /spine2/i],
  };

  const PET_EQUIP_SOCKET_KEY = {
    head: 'head', weapon: 'handR', armor: 'spine', wing: 'back', accessory: 'neck', special: 'head',
  };

  /** 슬롯별 기본 회전·피벗 (스케일·위치는 bbox로 자동 산출) */
  const PET_EQUIP_SLOT_CFG = {
    head:      { socket: 'head',  bone: 'head',  rot: [0, 0, 0], meshPivot: { y: 0, z: 0 } },
    weapon:    { socket: 'handR', bone: 'handR', rot: [0.15, 0.2, -0.75], meshPivot: { y: 0, z: 0 } },
    armor:     { socket: 'spine', bone: 'spine', rot: [0, 0, 0], meshPivot: { y: 0, z: 0 } },
    wing:      { socket: 'back',  bone: 'back',  rot: [0, 0, 0], meshPivot: { y: 0, z: 0 } },
    accessory: { socket: 'neck',  bone: 'neck',  rot: [0, 0, 0], meshPivot: { y: 0, z: 0 } },
    special:   { socket: 'head',  bone: 'head',  rot: [0, 0, 0], meshPivot: { y: 0.06, z: 0 } },
  };

  const PET_SLOT_IDEAL_HEIGHT = {
    head: 0.8, handR: 0.17, handL: 0.17, spine: 0.44, neck: 0.6, back: 0.48,
  };

  const PET_KIND_SOCKET_RATIOS = {
    small: { headY: 0.76, spineY: 0.42, handY: 0.13, handX: 0.17, handZ: 0.02 },
    quad:  { headY: 0.8, spineY: 0.46, handY: 0.18, handX: 0.22, handZ: 0.05 },
    bird:  { headY: 0.78, spineY: 0.45, handY: 0.35, handX: 0.28, handZ: 0.1 },
    low:   { headY: 0.8, spineY: 0.42, handY: 0.14, handX: 0.22, handZ: 0.05 },
    biped: { headY: 0.86, spineY: 0.52, handY: 0.38, handX: 0.3, handZ: 0.08 },
  };

  function findSkinnedRoot(model) {
    let skinned = null;
    model.traverse((o) => {
      if (!skinned && o.isSkinnedMesh && o.skeleton) skinned = o;
    });
    return skinned;
  }

  function collectPetBones(model) {
    const seen = new Set();
    const list = [];
    const add = (b) => {
      if (!b || seen.has(b)) return;
      seen.add(b);
      list.push(b);
    };
    model.traverse((o) => { if (o.isBone) add(o); });
    const skinned = findSkinnedRoot(model);
    if (skinned && skinned.skeleton && skinned.skeleton.bones) {
      skinned.skeleton.bones.forEach(add);
    }
    return list;
  }

  function boneHeightRatio(local, box) {
    if (!box || box.isEmpty()) return 0.5;
    const h = box.max.y - box.min.y;
    if (h < 0.05) return 0.5;
    return (local.y - box.min.y) / h;
  }

  function scoreBoneForSlot(model, bone, box, slotKey, patternIdx) {
    const local = boneToModelLocal(model, bone);
    if (!isBoneValidForSlot(local, box, slotKey)) return -1;
    const ideal = PET_SLOT_IDEAL_HEIGHT[slotKey] != null ? PET_SLOT_IDEAL_HEIGHT[slotKey] : 0.5;
    const ratio = boneHeightRatio(local, box);
    const heightFit = 60 - Math.abs(ratio - ideal) * 140;
    return (100 - patternIdx) + heightFit;
  }

  function findPetBone(model, slotKey, box) {
    const pats = PET_EQUIP_BONE_PATTERNS[slotKey];
    if (!pats) return null;
    const bones = collectPetBones(model);
    let best = null;
    let bestScore = -1;
    bones.forEach((b) => {
      const nl = b.name.toLowerCase();
      pats.forEach((re, idx) => {
        if (!re.test(b.name) && !re.test(nl)) return;
        const score = box && !box.isEmpty()
          ? scoreBoneForSlot(model, b, box, slotKey, idx)
          : (100 - idx);
        if (score > bestScore) { bestScore = score; best = b; }
      });
    });
    return best;
  }

  /** 장비 메쉬 bbox → 소켓에 맞는 피벗 (왕관 밑단·검 손잡이·흉갑 가슴) */
  function computeEquipMeshAlign(mesh, slot) {
    const THREE = global.THREE;
    if (!mesh || !THREE) return { x: 0, y: 0, z: 0 };
    const box = new THREE.Box3().setFromObject(mesh);
    if (box.isEmpty()) return { x: 0, y: 0, z: 0 };
    const cx = (box.min.x + box.max.x) * 0.5;
    const cy = (box.min.y + box.max.y) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const h = box.max.y - box.min.y;
    const d = box.max.z - box.min.z;
    if (slot === 'head' || slot === 'special') {
      return { x: -cx, y: -box.min.y + 0.02, z: -cz + Math.max(d * 0.2, 0.1) };
    }
    if (slot === 'weapon') {
      return { x: -cx, y: -box.min.y - 0.02, z: -cz + d * 0.08 };
    }
    if (slot === 'armor') {
      return { x: -cx, y: -cy + h * 0.08, z: -cz + Math.max(d * 0.38, 0.12) };
    }
    if (slot === 'accessory') {
      return { x: -cx, y: -cy, z: -cz + d * 0.22 };
    }
    if (slot === 'wing') {
      return { x: -cx, y: -cy, z: -cz - d * 0.15 };
    }
    return { x: -cx, y: -cy, z: -cz };
  }

  /** 펫 GLB 메쉬만 — model 로컬 좌표 bbox (월드 좌표 혼입 방지) */
  function measurePetLocalBox(model) {
    const THREE = global.THREE;
    const box = new THREE.Box3();
    const corner = new THREE.Vector3();
    const inv = new THREE.Matrix4();
    if (!model) return box;
    model.updateMatrixWorld(true);
    inv.copy(model.matrixWorld).invert();
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (o.name && o.name.indexOf('pet_equip') === 0) return;
      let p = o.parent;
      while (p && p !== model) {
        if (p.name && p.name.indexOf('pet_equip') === 0) return;
        p = p.parent;
      }
      const geom = o.geometry;
      if (!geom) return;
      if (!geom.boundingBox) geom.computeBoundingBox();
      if (!geom.boundingBox) return;
      const bb = geom.boundingBox;
      const pts = [
        [bb.min.x, bb.min.y, bb.min.z], [bb.max.x, bb.min.y, bb.min.z],
        [bb.min.x, bb.max.y, bb.min.z], [bb.max.x, bb.max.y, bb.min.z],
        [bb.min.x, bb.min.y, bb.max.z], [bb.max.x, bb.min.y, bb.max.z],
        [bb.min.x, bb.max.y, bb.max.z], [bb.max.x, bb.max.y, bb.max.z],
      ];
      pts.forEach((pt) => {
        corner.set(pt[0], pt[1], pt[2]);
        corner.applyMatrix4(o.matrixWorld);
        corner.applyMatrix4(inv);
        box.expandByPoint(corner);
      });
    });
    return box;
  }

  function boneToModelLocal(model, bone) {
    const THREE = global.THREE;
    const v = new THREE.Vector3();
    if (!bone || !model) return v;
    model.updateMatrixWorld(true);
    bone.getWorldPosition(v);
    v.applyMatrix4(new THREE.Matrix4().copy(model.matrixWorld).invert());
    return v;
  }

  function isBoneValidForSlot(local, box, boneKey) {
    if (!box || box.isEmpty()) return false;
    const h = box.max.y - box.min.y;
    if (h < 0.05) return false;
    const footY = box.min.y;
    const ratio = (local.y - footY) / h;
    if (boneKey === 'head') return ratio > 0.62 && ratio < 0.94;
    if (boneKey === 'handR' || boneKey === 'handL') return ratio > 0.07 && ratio < 0.3;
    if (boneKey === 'spine') return ratio > 0.32 && ratio < 0.56;
    if (boneKey === 'neck') return ratio > 0.45 && ratio < 0.78;
    if (boneKey === 'back') return ratio > 0.32 && ratio < 0.65;
    return false;
  }

  function getPetModelSockets(model, petKey) {
    const box = measurePetLocalBox(model);
    if (box.isEmpty()) {
      return {
        head: { x: 0, y: 1.15, z: 0.08 }, neck: { x: 0, y: 0.95, z: 0.1 },
        spine: { x: 0, y: 0.65, z: 0.1 }, handR: { x: 0.28, y: 0.28, z: 0.12 },
        back: { x: 0, y: 0.68, z: -0.12 },
      };
    }
    const kind = PET_BODY_KIND[petKey] || 'quad';
    const r = PET_KIND_SOCKET_RATIOS[kind] || PET_KIND_SOCKET_RATIOS.quad;
    const h = box.max.y - box.min.y;
    const w = Math.max(box.max.x - box.min.x, 0.01);
    const d = Math.max(box.max.z - box.min.z, 0.01);
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const footY = box.min.y;
    const frontZ = box.max.z;
    const backZ = box.min.z;
    const headTopY = box.max.y + h * 0.03;
    return {
      head: { x: cx, y: headTopY, z: cz + d * 0.14 },
      neck: { x: cx, y: footY + h * (r.headY - 0.12), z: cz + d * 0.06 },
      spine: { x: cx, y: footY + h * r.spineY, z: cz + d * 0.07 },
      orbit: { x: cx, y: footY + h * 0.4, z: cz },
      handR: {
        x: cx + w * r.handX,
        y: footY + h * r.handY,
        z: frontZ - d * r.handZ,
      },
      back: { x: cx, y: footY + h * (r.spineY + 0.04), z: backZ + d * 0.1 },
    };
  }

  function resolvePetEquipCfg(slot, petKey, box) {
    const base = Object.assign({ pos: [0, 0, 0], scale: 0.4 }, PET_EQUIP_SLOT_CFG[slot] || {});
    const kind = PET_BODY_KIND[petKey] || 'quad';
    if (box && !box.isEmpty()) {
      const h = box.max.y - box.min.y;
      const w = box.max.x - box.min.x;
      if (slot === 'head') {
        base.scale = Math.max(0.24, Math.min(0.58, (w * 0.58) / 0.72));
        base.pos = [0, 0.02, 0.02];
      } else if (slot === 'armor') {
        base.scale = Math.max(0.28, Math.min(0.62, (w * 0.82) / 0.92));
      } else if (slot === 'weapon') {
        base.scale = Math.max(0.2, Math.min(0.42, (h * 0.28) / 1.0));
      } else if (slot === 'wing') {
        base.scale = Math.max(0.28, Math.min(0.55, (w * 0.9) / 1.2));
      } else if (slot === 'accessory') {
        base.scale = Math.max(0.2, Math.min(0.42, (w * 0.35) / 0.5));
      } else if (slot === 'special') {
        base.scale = Math.max(0.22, Math.min(0.48, (w * 0.4) / 0.6));
      }
      if (kind === 'small') {
        if (slot === 'head') {
          base.scale *= 1.08;
          base.pos = [0, 0.03, 0.05];
        } else {
          base.scale *= 0.9;
        }
        if (slot === 'armor') base.scale *= 0.88;
        if (slot === 'armor') base.pos = [0, -0.02, 0.05];
      }
      if (kind === 'bird') base.scale *= 0.88;
    }
    return base;
  }

  function buildPetEquipMesh(slot, item) {
    if (typeof global.buildEquipMesh3DNew === 'function') {
      return global.buildEquipMesh3DNew(slot, item);
    }
    return null;
  }

  function detachPetEquipment(wrapper) {
    if (!wrapper) return;
    const model = wrapper.getObjectByName && wrapper.getObjectByName('ow_glb_model');
    if (model) {
      const stale = [];
      model.traverse((o) => {
        if (!o.name) return;
        if (o.name === 'pet_equip_rig' || o.name.indexOf('pet_equip_socket_') === 0) stale.push(o);
      });
      stale.forEach((o) => {
        if (o.parent) o.parent.remove(o);
        disposeTree(o);
      });
    }
    wrapper.userData.wing = null;
    wrapper.userData.special = null;
    wrapper.userData.weaponOrbit = null;
    wrapper.userData.equipOrbits = null;
    wrapper.userData.petEquipNodes = null;
  }

  const PET_ORBIT_SLOTS = { weapon: 0, accessory: 1, special: 2 };
  const PET_ORBIT_PHASE = { weapon: 0, accessory: Math.PI * 0.67, special: Math.PI * 1.34 };
  const PET_ORBIT_RADIUS_MUL = { weapon: 1.0, accessory: 0.78, special: 0.92 };
  const PET_ORBIT_Y_OFFSET = { weapon: 0, accessory: -0.05, special: 0.07 };
  const PET_ORBIT_SPEED = { weapon: 1.75, accessory: 1.55, special: 1.35 };

  /** 무기·장신구·특수 — 펫 중심 공전 오비트 */
  function attachEquipOrbit(rig, box, mesh, cfg, slot) {
    if (!mesh || !rig || !box || box.isEmpty()) return { mesh, orbit: null };
    const h = box.max.y - box.min.y;
    const w = box.max.x - box.min.x;
    const cx = (box.min.x + box.max.x) * 0.5;
    const cz = (box.min.z + box.max.z) * 0.5;
    const footY = box.min.y;
    const orbit = new THREE.Group();
    orbit.name = 'pet_equip_socket_' + slot + '_orbit';
    orbit.position.set(cx, footY + h * 0.4, cz);
    rig.add(orbit);
    const baseRadius = Math.max(w * 0.5, h * 0.3);
    const radius = baseRadius * (PET_ORBIT_RADIUS_MUL[slot] || 1);
    const autoPivot = computeEquipMeshAlign(mesh, slot);
    const sc = cfg.scale != null ? cfg.scale : 0.34;
    mesh.position.set(
      radius + autoPivot.x,
      h * 0.1 + autoPivot.y + (PET_ORBIT_Y_OFFSET[slot] || 0),
      autoPivot.z
    );
    if (slot === 'weapon') {
      mesh.rotation.set(-0.35, Math.PI * 0.5, -0.5);
    } else if (slot === 'accessory') {
      mesh.rotation.set(0.15, Math.PI * 0.35, 0.2);
    } else {
      mesh.rotation.set(-0.12, Math.PI * 0.2, 0.15);
    }
    mesh.scale.setScalar(sc);
    orbit.add(mesh);
    orbit.rotation.y = PET_ORBIT_PHASE[slot] || 0;
    orbit.userData._orbitBaseY = orbit.position.y;
    orbit.userData._orbitRadius = radius;
    orbit.userData._orbitSlot = slot;
    orbit.userData._orbitSpeed = PET_ORBIT_SPEED[slot] || 1.6;
    return { mesh, orbit };
  }

  function attachEquipToModelSocket(rig, model, box, sockets, mesh, slot, cfg) {
    if (!mesh || !rig || !sockets) return mesh;
    const boneKey = cfg.bone || PET_EQUIP_SOCKET_KEY[slot] || 'spine';
    const skKey = cfg.socket || boneKey;
    const sk = sockets[skKey] || sockets.spine;
    const pos = cfg.pos || [0, 0, 0];
    const rot = cfg.rot || [0, 0, 0];
    const sc = cfg.scale != null ? cfg.scale : 0.38;
    const manualPivot = cfg.meshPivot || { x: 0, y: 0, z: 0 };
    const autoPivot = computeEquipMeshAlign(mesh, slot);
    const anchor = new THREE.Group();
    anchor.name = 'pet_equip_socket_' + slot;

    const bone = model ? findPetBone(model, boneKey, box) : null;
    const skipBone = slot === 'head' || slot === 'special' || slot === 'weapon' || slot === 'accessory';
    const useBone = !skipBone && bone && box && isBoneValidForSlot(boneToModelLocal(model, bone), box, boneKey);
    if (useBone) {
      bone.add(anchor);
      anchor.position.set(pos[0], pos[1], pos[2]);
    } else {
      anchor.position.set(
        (sk.x || 0) + pos[0],
        (sk.y || 0) + pos[1],
        (sk.z || 0) + pos[2]
      );
      rig.add(anchor);
    }

    mesh.position.set(
      (manualPivot.x || 0) + autoPivot.x,
      (manualPivot.y || 0) + autoPivot.y,
      (manualPivot.z || 0) + autoPivot.z
    );
    mesh.rotation.set(rot[0], rot[1], rot[2]);
    mesh.scale.setScalar(sc);
    anchor.add(mesh);
    if (slot === 'head' || slot === 'special') {
      mesh.traverse((c) => {
        if (c.isMesh) c.renderOrder = 12;
      });
    }
    return mesh;
  }

  function attachPetEquipment(wrapper, equipment) {
    if (!wrapper) return Promise.resolve();
    equipment = equipment || {};
    const hasEq = ['head', 'weapon', 'armor', 'wing', 'accessory', 'special']
      .some((s) => equipment[s]);
    detachPetEquipment(wrapper);
    if (!hasEq) return Promise.resolve();

    const model = wrapper.getObjectByName('ow_glb_model');
    if (!model || !wrapper.userData.glbLoaded) {
      wrapper.userData._pendingPetEquipment = equipment;
      return Promise.resolve();
    }
    wrapper.userData._pendingPetEquipment = null;

    const petKey = wrapper.userData.petGlbKey || 'dog';
    const THREE = global.THREE;
    const rig = new THREE.Group();
    rig.name = 'pet_equip_rig';
    model.add(rig);
    const box = measurePetLocalBox(model);
    const sockets = getPetModelSockets(model, petKey);

    const nodes = {};
    const orbits = [];
    const slots = ['head', 'weapon', 'armor', 'wing', 'accessory', 'special'];

    slots.forEach((slot) => {
      const item = equipment[slot];
      if (!item) return;
      const mesh = buildPetEquipMesh(slot, item);
      if (!mesh) return;
      const cfg = resolvePetEquipCfg(slot, petKey, box);
      let attached;
      if (PET_ORBIT_SLOTS[slot] != null) {
        const wo = attachEquipOrbit(rig, box, mesh, cfg, slot);
        attached = wo.mesh;
        if (wo.orbit) {
          orbits.push(wo.orbit);
          if (slot === 'weapon') wrapper.userData.weaponOrbit = wo.orbit;
        }
      } else {
        attached = attachEquipToModelSocket(rig, model, box, sockets, mesh, slot, cfg);
      }
      attached.name = 'pet_equip_' + slot;
      nodes[slot] = attached;
      if (slot === 'wing') {
        attached.userData._baseScaleX = attached.scale.x;
        wrapper.userData.wing = attached;
      }
    });

    wrapper.userData.equipOrbits = orbits.length ? orbits : null;
    wrapper.userData.petEquipNodes = nodes;
    return Promise.resolve();
  }

  function attachPet(wrapper, emoji, equipment) {
    const key = resolvePetKey(emoji);
    const url = PET[key];
    wrapper.userData.petGlbKey = key;
    wrapper.userData.legs = null;
    wrapper.userData.armL = null;
    wrapper.userData.armR = null;
    if (equipment) wrapper.userData._pendingPetEquipment = equipment;
    return attachModel(wrapper, url, PET_TARGET_H, 'ow_glb_model').then((model) => {
      removePetProceduralLimbs(model);
      const eq = wrapper.userData._pendingPetEquipment;
      if (eq && Object.keys(eq).some((k) => eq[k])) {
        return attachPetEquipment(wrapper, eq).then(() => model);
      }
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
    const ratio = def && def.saddleRatio != null ? def.saddleRatio : 0.58;
    const saddleY = box.min.y + h * ratio;
    const centerZ = (box.min.z + box.max.z) * 0.5;
    const hintY = def && def.seatY != null ? def.seatY : 1.0;
    group.userData.mountSeatY = Math.max(saddleY, Math.min(hintY, hintY * 0.98));
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
  function createPetGroup(emoji, equipment) {
    const wrapper = new THREE.Group();
    wrapper.name = 'lm_character_wrap';
    wrapper.userData.walkPhase = 0;
    wrapper.userData.petEmoji = emoji || '🐾';
    wrapper.userData.glbUsesAnim = true;
    wrapper.userData.glbPet = true;
    wrapper.userData.lmTargetHeight = PET_TARGET_H;
    attachPet(wrapper, emoji, equipment);
    return wrapper;
  }

  function refreshPetEquipment(wrapper, equipment) {
    return attachPetEquipment(wrapper, equipment || {});
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
    const t = performance.now() * 0.001;
    if (wrapper.userData.wing) {
      const w = wrapper.userData.wing;
      w.rotation.y = Math.sin(t * 3) * 0.28;
      w.scale.x = (w.userData._baseScaleX || 1) * (1 + Math.sin(t * 3) * 0.08);
    }
    const orbits = wrapper.userData.equipOrbits;
    if (orbits && orbits.length) {
      orbits.forEach((orbit, i) => {
        const spd = orbit.userData._orbitSpeed || (1.6 - i * 0.12);
        orbit.rotation.y += step * spd;
        const baseY = orbit.userData._orbitBaseY;
        if (baseY != null) {
          const bob = orbit.userData._orbitSlot === 'special' ? 0.045 : 0.035;
          orbit.position.y = baseY + Math.sin(t * 2.2 + i * 0.9) * bob;
        }
      });
    } else if (wrapper.userData.weaponOrbit) {
      const orbit = wrapper.userData.weaponOrbit;
      orbit.rotation.y += step * 1.75;
      const baseY = orbit.userData._orbitBaseY;
      if (baseY != null) {
        orbit.position.y = baseY + Math.sin(t * 2.2) * 0.035;
      }
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
    attachPetEquipment,
    refreshPetEquipment,
    detachPetEquipment,
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
