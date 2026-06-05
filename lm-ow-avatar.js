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
  let loader = null;

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
        (gltf) => resolve(gltf),
        undefined,
        (err) => reject(err)
      );
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
      const clip = pickClip(anims, /sit|chair|ride|idle/i);
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
      disposeObject3D(prev);
    }
  }

  function attachModel(wrapper, scene, animations, srcUrl) {
    removeAvatarModel(wrapper);
    const model = scene;
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
    const p = loadGlb(url).then((gltf) => {
      const clip = gltf.animations && gltf.animations[0];
      if (!clip) throw new Error('no animation in ' + url);
      return clip;
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

    if (state.sitting || state.onMat) {
      wrapper.position.y = 0;
      if (mixer) mixer.update(dt || 0.016);
      return;
    }

    /* 탈것(말·보트 등) — 의자 앉기 포즈 */
    if (state.riding) {
      const onMountMesh =
        wrapper.parent && wrapper.parent.userData && wrapper.parent.userData.mountId;
      if (!onMountMesh) wrapper.position.y = 0;
      wrapper.rotation.z = 0;
      if (model && wrapper.userData.glbBaseY != null) {
        const off = wrapper.userData._lmMountSitYOffset != null ? wrapper.userData._lmMountSitYOffset : -0.1;
        wrapper.userData._lmMountSitYOffset = off;
        model.position.y = wrapper.userData.glbBaseY + off;
      }
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
    if (!wrapper || !wrapper.userData.owReady || isCombatAnimPlaying(wrapper)) return false;
    const paths = pathsFor(wrapper.userData.owGender);
    const url = paths[role];
    if (!url) return false;
    const model = wrapper.getObjectByName('ow_avatar_model');
    const mixer = wrapper.userData.owMixer;
    if (!model || !mixer) return false;

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
      .catch((e) => console.warn('[LMOwAvatar] 전투 모션:', role, e));
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
      .catch(() => {});
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
  }

  function setRideMode(wrapper, riding) {
    if (!wrapper || !wrapper.userData.owReady) return Promise.resolve();
    if (riding) {
      wrapper.userData._lmMountSitYOffset = -0.1;
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

  console.info('[LMOwAvatar] 오픈월드 아바타 모듈 준비 (boystandard / girlstandard)');
})(typeof window !== 'undefined' ? window : global);
