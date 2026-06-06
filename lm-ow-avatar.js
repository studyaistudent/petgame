/**
 * 오픈월드 플레이어 아바타 — Meshy standard GLB 전용 (단순 로드·스케일·idle/walk)
 * 남: boystandard.glb · 여: girlstandard.glb
 */
(function (global) {
  const TARGET_H = 1.72;
  const GENDER_FEMALE = /^(여|여성|female|f|girl|woman)/i;

  const PATHS = {
    male: {
      idle: 'Meshy_AI_Blue_Hoodie_Stance_biped/boystandard.glb',
      walk: 'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Walking_withSkin.glb',
      attack:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Weapon_Combo_1_withSkin.glb',
      combo:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Skill_03_withSkin.glb',
      skill1:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Step_in_High_Kick_withSkin.glb',
      skill2:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_mage_soell_cast_3_withSkin.glb',
      skill3:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Triple_Combo_Attack_withSkin.glb',
      sitMat:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Sit_Cross_Legged_on_Floor_withSkin.glb',
      ride:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Chair_Sit_Idle_M_withSkin.glb',
      greet:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Big_Wave_Hello_withSkin.glb',
      dance:
        'Meshy_AI_Blue_Hoodie_Stance_biped/Meshy_AI_Blue_Hoodie_Stance_biped_Animation_Boom_Dance_withSkin.glb'
    },
    female: {
      idle: 'Meshy_AI_Pastel_Bunny_Dream_biped/girlstandard.glb',
      walk: 'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Walking_withSkin.glb',
      attack:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Weapon_Combo_1_withSkin.glb',
      combo:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Skill_03_withSkin.glb',
      skill1:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Step_in_High_Kick_withSkin.glb',
      skill2:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_mage_soell_cast_3_withSkin.glb',
      skill3:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Triple_Combo_Attack_withSkin.glb',
      sitMat:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Sit_Cross_Legged_on_Floor_withSkin.glb',
      ride:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Chair_Sit_Idle_F_withSkin.glb',
      greet:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Big_Wave_Hello_withSkin.glb',
      dance:
        'Meshy_AI_Pastel_Bunny_Dream_biped/Meshy_AI_Pastel_Bunny_Dream_biped_Animation_Boom_Dance_withSkin.glb'
    }
  };

  const gltfCache = new Map();
  const clipCache = new Map();
  const loadFailWarned = new Set();
  let loader = null;

  /* ──────────────────────────────────────────────────────────
     캐시된 GLB(gltf.scene)는 단 하나의 객체다. 이를 여러 아바타에
     그대로 add 하면 Three.js가 직전 부모에서 자동 제거하므로,
     아바타를 새로 만들 때마다 기존 아바타(내 캐릭터 등)의 모델이
     "도난"당해 사라진다. → 항상 독립 복제본을 부여한다.
     스킨드 메시는 일반 clone()으로는 스켈레톤이 깨지므로
     three.js SkeletonUtils.clone 과 동일한 알고리즘으로 복제한다.
     (지오메트리/머티리얼/텍스처는 참조 공유 → 복제본 dispose 금지)
     ────────────────────────────────────────────────────────── */
  function _parallelTraverse(a, b, cb) {
    cb(a, b);
    const an = a.children, bn = b.children;
    for (let i = 0; i < an.length; i++) {
      if (bn[i]) _parallelTraverse(an[i], bn[i], cb);
    }
  }
  function cloneSkinned(source) {
    const sourceLookup = new Map();
    const cloneLookup = new Map();
    const clone = source.clone(true);
    _parallelTraverse(source, clone, (s, c) => {
      sourceLookup.set(c, s);
      cloneLookup.set(s, c);
    });
    clone.traverse((node) => {
      if (!node.isSkinnedMesh) return;
      const srcMesh = sourceLookup.get(node);
      if (!srcMesh || !srcMesh.skeleton) return;
      const srcBones = srcMesh.skeleton.bones;
      node.skeleton = srcMesh.skeleton.clone();
      node.bindMatrix.copy(srcMesh.bindMatrix);
      node.skeleton.bones = srcBones.map((b) => cloneLookup.get(b) || b);
      node.bind(node.skeleton, node.bindMatrix);
    });
    return clone;
  }

  function formatLoadError(err) {
    if (!err) return 'unknown';
    if (typeof err === 'string') return err;
    if (err.message) return err.message;
    if (err.type === 'error' && err.target && err.target.status === 0) {
      return 'network error (서버 미실행 또는 연결 끊김)';
    }
    return String(err);
  }

  function warnLoadFail(role, url, err) {
    if (loadFailWarned.has(url)) return;
    loadFailWarned.add(url);
    console.warn('[LMOwAvatar] 모션 로드 실패:', role, url, formatLoadError(err));
    if (typeof global.owMmoToast === 'function') {
      global.owMmoToast('모션 파일을 불러오지 못했어요. start-server.bat 실행 후 새로고침 해주세요.');
    }
  }

  function isFemale(gender) {
    return GENDER_FEMALE.test(String(gender || '').trim());
  }

  function pathsFor(gender) {
    return isFemale(gender) ? PATHS.female : PATHS.male;
  }

  function resolveGender(avatar, gender) {
    const id = avatar && avatar.glbModel;
    if (id === 'avatar_girl') return '여성';
    if (id === 'avatar_man') return '남성';
    return gender || '남성';
  }

  function getLoader() {
    if (loader) return loader;
    const THREE = global.THREE;
    if (!THREE || !THREE.GLTFLoader) {
      console.warn('[LMOwAvatar] THREE.GLTFLoader 없음 — vendor/GLTFLoader.js 확인');
      return null;
    }
    loader = new THREE.GLTFLoader();
    return loader;
  }

  function loadGlb(url) {
    const key = url;
    if (gltfCache.has(key)) return gltfCache.get(key);
    const ld = getLoader();
    if (!ld) return Promise.reject(new Error('GLTFLoader missing'));
    const p = new Promise((resolve, reject) => {
      ld.load(
        url,
        (gltf) => {
          loadFailWarned.delete(key);
          resolve(gltf);
        },
        undefined,
        (err) => reject(err)
      );
    }).catch((err) => {
      gltfCache.delete(key);
      throw err;
    });
    gltfCache.set(key, p);
    return p;
  }

  function disposeObject3D(obj) {
    if (!obj) return;
    obj.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      mats.forEach((m) => {
        if (!m) return;
        ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap'].forEach((k) => {
          if (m[k]) m[k].dispose();
        });
        m.dispose();
      });
    });
  }

  function measureHeightM(root) {
    const THREE = global.THREE;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (o.visible === false) return;
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

  function fitFeetOnGround(model, targetH, preserveScale, preserveY) {
    const THREE = global.THREE;
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    if (preserveScale == null || preserveScale <= 0) model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });

    let h = measureHeightM(model);
    if (h < 0.08) {
      if (preserveScale != null && preserveScale > 0) {
        model.scale.setScalar(preserveScale);
        model.position.y = preserveY != null ? preserveY : 0;
        model.updateMatrixWorld(true);
        return preserveScale;
      }
      return 1;
    }
    const sy = THREE.MathUtils.clamp(targetH / h, 0.02, 4);
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

  function findSkinnedRoot(model) {
    let skinned = null;
    model.traverse((o) => {
      if (!skinned && o.isSkinnedMesh) skinned = o;
    });
    return skinned || model;
  }

  function setupMixer(wrapper, model, animations, clipName) {
    const THREE = global.THREE;
    if (wrapper.userData.owMixer) {
      wrapper.userData.owMixer.stopAllAction();
      wrapper.userData.owMixer = null;
      wrapper.userData.owActions = null;
    }
    if (!animations || !animations.length) {
      wrapper.userData.owUsesAnim = false;
      return;
    }
    const root = findSkinnedRoot(model);
    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    animations.forEach((clip, i) => {
      actions[clip.name || 'clip_' + i] = mixer.clipAction(clip);
    });
    wrapper.userData.owMixer = mixer;
    wrapper.userData.owActions = actions;
    wrapper.userData.owUsesAnim = true;

    let play =
      (clipName && actions[clipName]) ||
      actions.idle ||
      actions.Idle ||
      actions[Object.keys(actions)[0]];
    if (play) {
      play.reset();
      play.setLoop(THREE.LoopRepeat, Infinity);
      play.setEffectiveWeight(1);
      play.play();
      wrapper.userData.owAnimMode = play.getClip().name;
      wrapper.userData.owIdleAction = play;
    }
  }

  function pickClip(anims, pattern) {
    if (!anims || !anims.length) return null;
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
    return anims.find((c) => re.test(c.name)) || anims[0];
  }

  function ensureWalkClips(wrapper) {
    if (wrapper.userData.owWalkClips) return Promise.resolve(wrapper.userData.owWalkClips);
    const paths = pathsFor(wrapper.userData.owGender);
    return loadGlb(paths.walk).then((gltf) => {
      wrapper.userData.owWalkClips = gltf.animations || [];
      return wrapper.userData.owWalkClips;
    });
  }

  function ensureRideClips(wrapper) {
    if (wrapper.userData.owRideClips) return Promise.resolve(wrapper.userData.owRideClips);
    const paths = pathsFor(wrapper.userData.owGender);
    if (!paths.ride) return Promise.resolve([]);
    return loadGlb(paths.ride).then((gltf) => {
      wrapper.userData.owRideClips = gltf.animations || [];
      return wrapper.userData.owRideClips;
    });
  }

  /** 탈것·차량 탑승 — 의자 앉기 포즈 */
  function setRideAnim(wrapper) {
    if (!wrapper || wrapper.userData.owLocoAnim === 'ride') return Promise.resolve();
    wrapper.userData.owLocoAnim = 'ride';
    wrapper.userData.owMode = 'ride';
    const mixer = wrapper.userData.owMixer;
    const model = wrapper.getObjectByName('ow_avatar_model');
    if (!mixer || !model) return Promise.resolve();

    const THREE = global.THREE;
    const fade = 0.14;
    const root = findSkinnedRoot(model);
    const idle = wrapper.userData.owIdleAction;
    const walk = wrapper.userData.owWalkAction;

    return ensureRideClips(wrapper).then((anims) => {
      const clip = pickClip(anims, /chair|ride/i) || pickClip(anims, /sit/i);
      if (!clip) return;
      if (!wrapper.userData.owRideAction) {
        const act = mixer.clipAction(clip, root);
        act.setLoop(THREE.LoopRepeat, Infinity);
        wrapper.userData.owRideAction = act;
      }
      const r = wrapper.userData.owRideAction;
      if (idle) idle.fadeOut(fade);
      if (walk) walk.fadeOut(fade);
      r.reset().setEffectiveWeight(1).fadeIn(fade).play();
      wrapper.userData.owAnimMode = 'ride';
    });
  }

  /** 걷기/대기 — 모델 교체 없이 클립만 전환 (키 재측정·경고 방지) */
  function setLocomotionAnim(wrapper, mode) {
    if (!wrapper || wrapper.userData.owLocoAnim === mode) return Promise.resolve();
    wrapper.userData.owLocoAnim = mode;
    wrapper.userData.owMode = mode;
    const mixer = wrapper.userData.owMixer;
    const model = wrapper.getObjectByName('ow_avatar_model');
    if (!mixer || !model) return Promise.resolve();

    const THREE = global.THREE;
    const fade = 0.12;
    const root = findSkinnedRoot(model);
    const idle = wrapper.userData.owIdleAction;
    const walk = wrapper.userData.owWalkAction;

    if (mode === 'walk') {
      return ensureWalkClips(wrapper).then((anims) => {
        const clip = pickClip(anims, /walk|locomotion|move/i);
        if (!clip) return;
        if (!wrapper.userData.owWalkAction) {
          const act = mixer.clipAction(clip, root);
          act.setLoop(THREE.LoopRepeat, Infinity);
          wrapper.userData.owWalkAction = act;
        }
        const w = wrapper.userData.owWalkAction;
        if (idle) idle.fadeOut(fade);
        w.reset().setEffectiveWeight(1).fadeIn(fade).play();
        wrapper.userData.owAnimMode = 'walk';
      });
    }
    if (walk) walk.fadeOut(fade);
    if (idle) idle.reset().setEffectiveWeight(1).fadeIn(fade).play();
    else {
      const acts = wrapper.userData.owActions;
      if (acts) {
        const a = acts.idle || acts.Idle || Object.values(acts)[0];
        if (a) {
          a.reset().setEffectiveWeight(1).fadeIn(fade).play();
          wrapper.userData.owIdleAction = a;
        }
      }
    }
    wrapper.userData.owAnimMode = 'idle';
    return Promise.resolve();
  }

  function removeAvatarModel(wrapper) {
    const prev = wrapper.getObjectByName('ow_avatar_model');
    if (prev) {
      wrapper.remove(prev);
      /* 모델은 캐시된 GLB의 복제본이며 지오메트리/머티리얼/텍스처를
         원본과 공유한다. 여기서 dispose 하면 같은 GLB를 쓰는 다른
         아바타(내 캐릭터·다른 유저·집 안 아바타)가 깨지므로 dispose 하지 않는다. */
    }
  }

  function attachModel(wrapper, scene, animations, srcUrl) {
    removeAvatarModel(wrapper);
    /* 캐시된 gltf.scene 을 그대로 쓰면 부모 이동으로 인해 도난당한다.
       항상 독립 복제본을 만들어 부여한다. */
    let model;
    try {
      model = cloneSkinned(scene);
    } catch (e) {
      console.warn('[LMOwAvatar] skinned clone 실패, 원본 사용', e);
      model = scene;
    }
    model.name = 'ow_avatar_model';
    model.userData.owSrc = srcUrl;
    wrapper.add(model);
    const sy = fitFeetOnGround(
      model,
      TARGET_H,
      wrapper.userData.owFitScale,
      wrapper.userData.owFitBaseY
    );
    if (wrapper.userData.owFitScale == null && sy > 0.01) {
      wrapper.userData.owFitScale = model.scale.x;
      wrapper.userData.owFitBaseY = model.position.y;
    }
    setupMixer(wrapper, model, animations);
    wrapper.userData.owReady = true;
    if (wrapper.userData._pendingEmoteRole) {
      const pending = wrapper.userData._pendingEmoteRole;
      wrapper.userData._pendingEmoteRole = null;
      triggerEmote(wrapper, pending);
    }
    wrapper.userData.owUsesOwAvatar = true;
    wrapper.userData.owMode = wrapper.userData.owMode || 'idle';
    wrapper.userData.owLocoAnim = wrapper.userData.owLocoAnim || 'idle';
    wrapper.userData.glbMultiClip = true;
    wrapper.userData.lmBodyHeight = TARGET_H;
    wrapper.userData.lmTargetHeight = TARGET_H;
    wrapper.userData.glbMixer = wrapper.userData.owMixer;
    wrapper.userData.glbUsesAnim = !!wrapper.userData.owUsesAnim;
    wrapper.userData.glbBaseY = model.position.y;
    wrapper.userData.glbModelScale = model.scale.x;
    wrapper.userData.glbLoaded = true;
    if (typeof global.owRefreshHandWeapon === 'function') {
      try {
        global.owRefreshHandWeapon();
      } catch (e) {
        /* ignore */
      }
    }
  }

  function loadClip(url) {
    if (clipCache.has(url)) return clipCache.get(url);
    const p = loadGlb(url)
      .then((gltf) => {
        const clip = gltf.animations && gltf.animations[0];
        if (!clip) throw new Error('no animation in ' + url);
        return clip;
      })
      .catch((err) => {
        clipCache.delete(url);
        throw err;
      });
    clipCache.set(url, p);
    return p;
  }


  function loadAvatarInto(wrapper, gender, opts) {
    opts = opts || {};
    const g = resolveGender(opts.avatar, gender);
    wrapper.userData.owGender = g;
    wrapper.userData.owUsesOwAvatar = true;
    wrapper.userData.owReady = false;
    const paths = pathsFor(g);
    return loadGlb(paths.idle)
      .then((gltf) => {
        attachModel(wrapper, gltf.scene, gltf.animations, paths.idle);
        if (typeof opts.onAttached === 'function') opts.onAttached();
      })
      .catch((e) => {
        console.warn('[LMOwAvatar] 아바타 로드 실패:', paths.idle, e);
      });
  }

  function createWrapper(gender, opts) {
    const THREE = global.THREE;
    const wrapper = new THREE.Group();
    wrapper.name = 'lm_character_wrap';
    wrapper.userData.walkPhase = 0;
    loadAvatarInto(wrapper, gender, opts || {});
    return wrapper;
  }

  function updateLocomotion(wrapper, moving, dt, state) {
    if (!wrapper || !wrapper.userData.owReady) return;
    state = state || {};
    const mixer = wrapper.userData.owMixer;
    const model = wrapper.getObjectByName('ow_avatar_model');
    if (!model) return;

    if (isCombatAnimPlaying(wrapper)) {
      if (mixer) mixer.update(dt || 0.016);
      model.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
      });
      return;
    }

    if (state.sitting || state.onMat) {
      wrapper.position.y = 0;
      if (mixer) mixer.update(dt || 0.016);
      return;
    }

    /* 탈것(말·늑대 등) — 안장 Y는 _updateMountMesh가 설정, 여기서 덮어쓰지 않음 */
    if (state.riding) {
      wrapper.rotation.z = 0;
      applyMountSitModelY(wrapper);
      if (wrapper.userData.owLocoAnim !== 'ride' && !wrapper.userData.owLocoLoading) {
        wrapper.userData.owLocoLoading = true;
        setRideAnim(wrapper).finally(() => {
          wrapper.userData.owLocoLoading = false;
        });
      }
      if (mixer) mixer.update(dt || 0.016);
      if (model) {
        model.traverse((o) => {
          if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
        });
      }
      return;
    }

    /* 자동차 탑승 — ride 클립 대신 idle (하차 시 walk/idle 전환 용이) */
    if (state.inCar) {
      wrapper.position.y = 0;
      wrapper.rotation.z = 0;
      wrapper.userData._lmMountSitYOffset = 0;
      if (model && wrapper.userData.glbBaseY != null) model.position.y = wrapper.userData.glbBaseY;
      if (wrapper.userData.owLocoAnim === 'ride') {
        wrapper.userData.owLocoAnim = '';
        setLocomotionAnim(wrapper, 'idle');
      } else if (wrapper.userData.owLocoAnim !== 'idle' && !wrapper.userData.owLocoLoading) {
        wrapper.userData.owLocoLoading = true;
        setLocomotionAnim(wrapper, 'idle').finally(() => {
          wrapper.userData.owLocoLoading = false;
        });
      }
      if (mixer) mixer.update(dt || 0.016);
      if (model) {
        model.traverse((o) => {
          if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
        });
      }
      return;
    }

    if (wrapper.userData.owLocoAnim === 'ride') {
      wrapper.userData.owLocoAnim = '';
      setLocomotionAnim(wrapper, 'idle');
    }
    wrapper.userData._lmMountSitYOffset = 0;
    const modelIdle = wrapper.getObjectByName('ow_avatar_model');
    if (modelIdle && wrapper.userData.glbBaseY != null) modelIdle.position.y = wrapper.userData.glbBaseY;

    const wantWalk = !!moving && !state.defeated;
    const mode = wantWalk ? 'walk' : 'idle';
    if (wrapper.userData.owLocoAnim !== mode && !wrapper.userData.owLocoLoading) {
      wrapper.userData.owLocoLoading = true;
      setLocomotionAnim(wrapper, mode).finally(() => {
        wrapper.userData.owLocoLoading = false;
      });
    }

    if (mixer) mixer.update(dt || 0.016);
    if (model) {
      model.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
      });
    }
    wrapper.position.y = 0;
    wrapper.rotation.z = 0;
  }

  function isCombatAnimPlaying(wrapper) {
    return !!(wrapper && wrapper.userData.owCombatUntil > performance.now());
  }

  function triggerCombatAnim(wrapper, role) {
    if (!wrapper || isCombatAnimPlaying(wrapper)) return false;
    if (wrapper.userData._owEmoteLoading) return false;
    const paths = pathsFor(wrapper.userData.owGender);
    const url = paths[role];
    if (!url) return false;
    if (!wrapper.userData.owReady) {
      if (role === 'greet' || role === 'dance') wrapper.userData._pendingEmoteRole = role;
      return false;
    }
    const model = wrapper.getObjectByName('ow_avatar_model');
    const mixer = wrapper.userData.owMixer;
    if (!model || !mixer) return false;

    wrapper.userData._owEmoteLoading = role;
    loadClip(url)
      .then((clip) => {
        const root = findSkinnedRoot(model);
        const action = mixer.clipAction(clip, root);
        Object.values(wrapper.userData.owActions || {}).forEach((a) => a.fadeOut(0.08));
        action.reset();
        action.setLoop(global.THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        action.setEffectiveWeight(1);
        action.fadeIn(0.06).play();
        wrapper.userData.owCombatUntil = performance.now() + clip.duration * 1000 + 80;
        wrapper.userData.owCombatAction = action;
        setTimeout(() => {
          if (wrapper.userData.owCombatAction !== action) return;
          action.fadeOut(0.12);
          setLocomotionAnim(wrapper, wrapper.userData.owLocoAnim || 'idle');
          wrapper.userData.owCombatUntil = 0;
        }, clip.duration * 1000 + 100);
      })
      .catch((e) => warnLoadFail(role, url, e))
      .finally(() => {
        if (wrapper.userData._owEmoteLoading === role) wrapper.userData._owEmoteLoading = null;
      });
    return true;
  }

  function triggerEmote(wrapper, role) {
    return triggerCombatAnim(wrapper, role);
  }

  function restoreStandY(wrapper, model) {
    model = model || (wrapper && wrapper.getObjectByName('ow_avatar_model'));
    if (!wrapper || !model) return;
    if (wrapper.userData.glbBaseY != null) model.position.y = wrapper.userData.glbBaseY;
    wrapper.position.y = 0;
  }

  function primeSitMatPose(wrapper) {
    const paths = pathsFor(wrapper.userData.owGender);
    if (!paths.sitMat) return;
    if (wrapper.userData._owSitMatLoading) return;
    wrapper.userData._owSitMatLoading = true;
    wrapper.userData.owLocoAnim = 'sit';
    wrapper.userData.owMode = 'sit';
    loadClip(paths.sitMat)
      .then((clip) => {
        const model = wrapper.getObjectByName('ow_avatar_model');
        const mixer = wrapper.userData.owMixer;
        if (!model || !mixer) return;
        const root = findSkinnedRoot(model);
        const fade = 0.14;
        if (wrapper.userData.owWalkAction) wrapper.userData.owWalkAction.fadeOut(fade);
        if (wrapper.userData.owIdleAction) wrapper.userData.owIdleAction.fadeOut(fade);
        const action = mixer.clipAction(clip, root);
        action.reset().setLoop(global.THREE.LoopRepeat, Infinity).fadeIn(fade).play();
        wrapper.userData.owSitAction = action;
        mixer.update(0);
      })
      .catch((e) => {
        warnLoadFail('sitMat', paths.sitMat, e);
        wrapper.userData.owLocoAnim = '';
        wrapper.userData.owMode = 'idle';
        setLocomotionAnim(wrapper, 'idle');
      })
      .finally(() => {
        wrapper.userData._owSitMatLoading = false;
      });
  }

  /** 돗자리 정리 등 — 앉기 포즈 해제 후 idle 대기 */
  function restoreIdlePose(wrapper) {
    if (!wrapper || !wrapper.userData.owReady) return Promise.resolve();
    wrapper.userData.owLocoAnim = '';
    wrapper.userData.owMode = 'idle';
    wrapper.userData.owLocoLoading = false;
    restoreStandY(wrapper);
    const mixer = wrapper.userData.owMixer;
    if (wrapper.userData.owSitAction) {
      wrapper.userData.owSitAction.fadeOut(0.16);
      wrapper.userData.owSitAction = null;
    }
    if (wrapper.userData.owRideAction) {
      wrapper.userData.owRideAction.fadeOut(0.16);
      wrapper.userData.owRideAction = null;
    }
    if (mixer) {
      mixer.timeScale = 1;
    }
    return setLocomotionAnim(wrapper, 'idle');
  }

  function setCombatDefeat(wrapper, defeated) {
    if (!wrapper) return;
    wrapper.userData._lmDefeated = !!defeated;
  }

  function preload(gender) {
    const paths = pathsFor(resolveGender(null, gender));
    loadGlb(paths.idle).catch(() => {});
    loadGlb(paths.walk).catch(() => {});
    if (paths.ride) loadGlb(paths.ride).catch(() => {});
    /* 돗자리·이모티콘 GLB — 오픈월드 진입 후 백그라운드 선로드 (약 32MB × 3) */
    const bg = () => {
      if (paths.sitMat) loadGlb(paths.sitMat).catch(() => {});
      if (paths.greet) loadGlb(paths.greet).catch(() => {});
      if (paths.dance) loadGlb(paths.dance).catch(() => {});
    };
    if (typeof global.setTimeout === 'function') global.setTimeout(bg, 3000);
    else bg();
  }

  function resolveMountSitYOffset(wrapper) {
    if (global.LMOwGlb && typeof global.LMOwGlb.resolveMountSitYOffset === 'function') {
      return global.LMOwGlb.resolveMountSitYOffset(wrapper);
    }
    return -0.64;
  }

  function applyMountSitModelY(wrapper) {
    if (!wrapper) return;
    const model = wrapper.getObjectByName('ow_avatar_model');
    if (!model || wrapper.userData.glbBaseY == null) return;
    const off = resolveMountSitYOffset(wrapper);
    wrapper.userData._lmMountSitYOffset = off;
    model.position.y = wrapper.userData.glbBaseY + off;
  }

  function setRideMode(wrapper, riding) {
    if (!wrapper || !wrapper.userData.owReady) return Promise.resolve();
    if (riding) {
      applyMountSitModelY(wrapper);
      return setRideAnim(wrapper);
    }
    wrapper.userData._lmMountSitYOffset = 0;
    const model = wrapper.getObjectByName('ow_avatar_model');
    if (model && wrapper.userData.glbBaseY != null) model.position.y = wrapper.userData.glbBaseY;
    if (wrapper.userData.owLocoAnim === 'ride') {
      wrapper.userData.owLocoAnim = '';
      return setLocomotionAnim(wrapper, 'idle');
    }
    return Promise.resolve();
  }

  function clearCache() {
    gltfCache.clear();
    clipCache.clear();
  }

  global.LMOwAvatar = {
    PATHS,
    TARGET_H,
    isFemale,
    resolveGender,
    pathsFor,
    createWrapper,
    loadAvatarInto,
    updateLocomotion,
    resolveMountSitYOffset,
    applyMountSitModelY,
    setRideMode,
    setRideAnim,
    triggerCombatAnim,
    isCombatAnimPlaying,
    triggerEmote,
    restoreStandY,
    restoreIdlePose,
    primeSitMatPose,
    preload,
    clearCache,
    loadGlb,
    setCombatDefeat
  };
})(typeof window !== 'undefined' ? window : global);
