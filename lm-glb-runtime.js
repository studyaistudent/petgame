/**
 * GLB 로더 · 3D 미리보기 · 오픈월드 아바타/펫/NPC 적용
 */
(function () {
  if (typeof THREE === 'undefined') return;

  const cache = new Map();
  const meshyPackCache = new Map();
  const meshyBootstrapCache = new Map();
  const meshyPackLoading = new Map();
  let gltfLoader = null;
  let fbxLoader = null;

  function catalog() {
    return window.LM_GLB_CATALOG || [];
  }

  function entryById(id) {
    return catalog().find((e) => e.id === id) || null;
  }

  function resolveUrl(entry) {
    if (!entry) return null;
    if (entry.id === 'builtin' || (!entry.url && !entry.localUrl)) return null;
    return entry.localUrl || entry.url;
  }

  function resolveLocalUrls(entry) {
    const list = [];
    if (entry.localUrl) list.push(entry.localUrl);
    if (entry.altLocalUrls) list.push.apply(list, entry.altLocalUrls);
    return list;
  }

  function loadFirstAvailable(urls, loadFromUrl, idx) {
    if (!urls.length) return Promise.reject(new Error('no local urls'));
    const i = idx || 0;
    if (i >= urls.length) {
      return Promise.reject(new Error('404 local model: ' + urls.join(', ')));
    }
    return loadFromUrl(urls[i]).catch(() => loadFirstAvailable(urls, loadFromUrl, i + 1));
  }

  function isFbxUrl(url) {
    return /\.fbx$/i.test(url || '');
  }

  function getGltfLoader() {
    if (!gltfLoader) {
      if (!THREE.GLTFLoader) {
        console.warn('[LMGlb] GLTFLoader 없음 — vendor/GLTFLoader.js 확인');
        return null;
      }
      gltfLoader = new THREE.GLTFLoader();
    }
    return gltfLoader;
  }

  function getFbxLoader() {
    if (!fbxLoader) {
      if (!THREE.FBXLoader) {
        console.warn('[LMGlb] FBXLoader 없음 — vendor/FBXLoader.js 확인');
        return null;
      }
      fbxLoader = new THREE.FBXLoader();
    }
    return fbxLoader;
  }

  const TEX_SLOTS = [
    'map', 'normalMap', 'emissiveMap', 'roughnessMap', 'metalnessMap',
    'aoMap', 'bumpMap', 'alphaMap', 'lightMap', 'displacementMap'
  ];

  /** FBX 등 — map은 있는데 image가 비어 WebGL 경고 나는 경우 */
  function isTextureReady(tex) {
    if (!tex) return false;
    const img = tex.image;
    if (!img) return false;
    if (img.data !== undefined && img.width > 0 && img.height > 0) return true;
    if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap && img.width > 0) {
      return true;
    }
    if (img instanceof HTMLImageElement) {
      return img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
    }
    if (typeof img.width === 'number' && typeof img.height === 'number') {
      return img.width > 0 && img.height > 0;
    }
    return false;
  }

  function sanitizeBrokenTextures(root) {
    let fixed = 0;
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        TEX_SLOTS.forEach((key) => {
          const tex = m[key];
          if (!tex) return;
          if (!isTextureReady(tex)) {
            m[key] = null;
            try {
              if (tex.dispose) tex.dispose();
            } catch (e) { /* ignore */ }
            fixed++;
          } else if (THREE.sRGBEncoding && (key === 'map' || key === 'emissiveMap')) {
            tex.encoding = THREE.sRGBEncoding;
          }
        });
        if (m.map && isTextureReady(m.map)) {
          m.map.needsUpdate = true;
        }
        m.needsUpdate = true;
      });
    });
    if (fixed > 0) {
      console.info('[LMGlb] 깨진 텍스처 맵 제거:', fixed);
    }
  }

  /** FBX 텍스처 폴더 — entry.textureDir 우선 ('' = index.html과 같은 폴더) */
  function deriveFbxTextureDir(fbxUrl, entry) {
    if (entry && entry.textureDir !== undefined && entry.textureDir !== null) {
      const d = String(entry.textureDir);
      if (d === '' || d === '.') return './';
      return d.endsWith('/') ? d : d + '/';
    }
    const base = (fbxUrl || '').replace(/^.*\//, '').replace(/\.fbx$/i, '');
    return base + '/textures/maya file.fbm/';
  }

  function resolveFbxResourcePath(fbxUrl, entry) {
    return deriveFbxTextureDir(fbxUrl, entry);
  }

  function fbxAssetBase(fbxUrl) {
    return (fbxUrl || '').replace(/^.*\//, '').replace(/\.fbx$/i, '');
  }

  function getFbxManifestFiles(fbxUrl) {
    const base = fbxAssetBase(fbxUrl);
    const m = window.LM_FBX_TEXTURE_MANIFEST || {};
    return m[base] || [];
  }

  function getEntryManifestFiles(entry, url) {
    const m = window.LM_FBX_TEXTURE_MANIFEST || {};
    if (entry && entry.textureManifest && m[entry.textureManifest]) {
      return m[entry.textureManifest];
    }
    return getFbxManifestFiles(url || (entry && entry.localUrl) || '');
  }

  function isFixedWorldAvatar(entry) {
    return !!(
      entry &&
      entry.category &&
      entry.category.includes('avatar') &&
      (entry.fixedWorldHeight || (entry.targetHeight && entry.targetHeight < 1.2))
    );
  }

  function resolveAvatarTargetHeight(entry, heightCm) {
    let targetH = (entry && entry.targetHeight) || 1.75;
    if (
      entry &&
      entry.category &&
      entry.category.includes('avatar') &&
      heightCm &&
      !isFixedWorldAvatar(entry)
    ) {
      targetH *= Math.max(0.88, Math.min(1.22, heightCm / 170));
    }
    if (entry && entry.maxHeight) targetH = Math.min(targetH, entry.maxHeight);
    return targetH;
  }

  function matchManifestTexture(matName, files, kind) {
    if (!matName || !files.length) return null;
    const norm = matName.trim().replace(/\s+/g, '_');
    const prefixes = norm === matName.trim() ? [norm] : [matName.trim(), norm];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const fl = f.toLowerCase();
      for (let p = 0; p < prefixes.length; p++) {
        const pl = prefixes[p].toLowerCase();
        if (!fl.startsWith(pl + '_')) continue;
        if (kind === 'diffuse' && /_diffuse\.(png|jpg|jpeg)$/i.test(f)) return f;
        if (kind === 'normal' && /_normal\.(png|jpg|jpeg)$/i.test(f)) return f;
        if (kind === 'opacity' && /_opacity\.(png|jpg|jpeg)$/i.test(f)) return f;
      }
    }
    return null;
  }

  function loadTextureFile(loader, url) {
    return new Promise((resolve) => {
      loader.load(
        url,
        (tex) => resolve(tex),
        undefined,
        () => resolve(null)
      );
    });
  }

  function loadTextureCandidate(loader, dir, names) {
    const list = []
      .concat(names || [])
      .filter(Boolean)
      .map(String);
    if (!list.length) return Promise.resolve(null);
    let i = 0;
    const tryNext = () => {
      if (i >= list.length) return Promise.resolve(null);
      const file = list[i++];
      const url = dir + encodeURIComponent(file);
      return loadTextureFile(loader, url).then((tex) => (tex ? tex : tryNext()));
    };
    return tryNext();
  }

  function textureDirsForEntry(entry) {
    const dirs = ['./', ''];
    if (entry && entry.textureDir !== undefined && entry.textureDir !== null) {
      const raw = String(entry.textureDir);
      if (raw !== '' && raw !== '.') {
        const d = raw.endsWith('/') ? raw : raw + '/';
        dirs.push(d);
      }
    }
    if (entry && entry.textureDirs) {
      entry.textureDirs.forEach((d) => {
        dirs.push(d.endsWith('/') ? d : d + '/');
      });
    }
    const seen = {};
    return dirs.filter((d) => {
      const k = d.toLowerCase();
      if (seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  function loadTextureCandidateDirs(loader, dirs, names) {
    const list = []
      .concat(names || [])
      .filter(Boolean)
      .map(String);
    if (!list.length || !dirs.length) return Promise.resolve(null);
    let di = 0;
    let ni = 0;
    const tryNext = () => {
      if (di >= dirs.length) return Promise.resolve(null);
      const url = dirs[di] + encodeURIComponent(list[ni]);
      return loadTextureFile(loader, url).then((tex) => {
        if (tex) return tex;
        ni++;
        if (ni >= list.length) {
          ni = 0;
          di++;
        }
        return tryNext();
      });
    };
    return tryNext();
  }

  /** mantextures / womantextures — 세트 텍스처를 메쉬에 적용 */
  function applyEntryTextureSet(root, entry) {
    const ts = entry.textureSet;
    const dirs = textureDirsForEntry(entry);
    const loader = new THREE.TextureLoader();
    const loads = {};
    const keys = [
      'diffuse',
      'bodyDiffuse',
      'faceDiffuse',
      'normal',
      'roughness',
      'metalness',
      'specular'
    ];
    keys.forEach((key) => {
      if (!ts[key]) return;
      loads[key] = loadTextureCandidateDirs(loader, dirs, ts[key]);
    });

    return Promise.all(
      Object.keys(loads).map((key) => loads[key].then((tex) => ({ key, tex })))
    ).then((pairs) => {
      const texByKey = {};
      pairs.forEach(({ key, tex }) => {
        if (tex) texByKey[key] = tex;
      });
      let n = 0;
      root.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        const label = ((o.name || '') + ' ' + ((mats[0] && mats[0].name) || '')).toLowerCase();
        const useFace =
          /face|head|eye|hair|brow|lash|lip|image_face|face-girl/i.test(label) &&
          texByKey.faceDiffuse;
        const useBody =
          !useFace &&
          /body|torso|shirt|cloth|leg|arm|skin|image_body|girl_black_0/i.test(label) &&
          texByKey.bodyDiffuse;
        const onlyDiffuse = texByKey.diffuse && !texByKey.bodyDiffuse && !texByKey.faceDiffuse;

        mats.forEach((m) => {
          if (!m) return;
          let diff = texByKey.diffuse;
          if (useBody) diff = texByKey.bodyDiffuse;
          else if (useFace) diff = texByKey.faceDiffuse;
          else if (onlyDiffuse) diff = texByKey.diffuse;
          else if (texByKey.bodyDiffuse && !texByKey.faceDiffuse) diff = texByKey.bodyDiffuse;
          else if (texByKey.faceDiffuse && !texByKey.bodyDiffuse) diff = texByKey.faceDiffuse;
          if (diff) {
            if (THREE.sRGBEncoding) diff.encoding = THREE.sRGBEncoding;
            m.map = diff;
            n++;
          }
          if (texByKey.normal) m.normalMap = texByKey.normal;
          if (texByKey.roughness) m.roughnessMap = texByKey.roughness;
          if (texByKey.metalness) m.metalnessMap = texByKey.metalness;
          if (texByKey.specular && !texByKey.roughness) {
            m.roughnessMap = texByKey.specular;
            if (m.roughness != null) m.roughness = 0.55;
          }
          if (o.isSkinnedMesh) m.skinning = true;
          m.needsUpdate = true;
        });
      });
      if (n > 0) {
        console.info('[LMGlb] 텍스처 세트:', dirs.join(' | '), n + '개 메쉬');
      } else {
        console.warn(
          '[LMGlb] 텍스처 로드 실패 — 폴더 확인:',
          dirs.join(' '),
          Object.keys(ts).join(', ')
        );
      }
      return root;
    });
  }

  function repairFbxTextures(root, fbxUrl, entry) {
    if (entry && entry.textureSet) {
      return applyEntryTextureSet(root, entry).then(() => {
        sanitizeBrokenTextures(root);
        ensureSkinnedMaterials(root);
        return root;
      });
    }

    const dir = deriveFbxTextureDir(fbxUrl, entry);
    const files = getEntryManifestFiles(entry, fbxUrl);
    const loader = new THREE.TextureLoader();
    const tasks = [];
    let bound = 0;

    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        const matName = (m.name || o.name || '').trim();
        if (!matName) return;

        if (!isTextureReady(m.map)) {
          const diffuse = matchManifestTexture(matName, files, 'diffuse');
          if (diffuse) {
            tasks.push(
              loadTextureFile(loader, dir + diffuse).then((tex) => {
                if (!tex) return;
                if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
                m.map = tex;
                m.needsUpdate = true;
                bound++;
              })
            );
          }
        }

        if (!isTextureReady(m.normalMap)) {
          const normal = matchManifestTexture(matName, files, 'normal');
          if (normal) {
            tasks.push(
              loadTextureFile(loader, dir + normal).then((tex) => {
                if (!tex) return;
                m.normalMap = tex;
                m.needsUpdate = true;
              })
            );
          }
        }
      });
    });

    return Promise.all(tasks).then(() => {
      sanitizeBrokenTextures(root);
      ensureSkinnedMaterials(root);
      if (bound > 0) {
        console.info('[LMGlb] 텍스처 매칭:', fbxAssetBase(fbxUrl), bound + '개');
      }
      return root;
    });
  }

  /** GLB/FBX — textureSet 우선, 없으면 내장·manifest */
  function repairModelTextures(root, url, entry) {
    if (entry && entry.textureSet) {
      return applyEntryTextureSet(root, entry).then(() => {
        sanitizeBrokenTextures(root);
        ensureSkinnedMaterials(root);
        return root;
      });
    }
    if (entry && entry.preferEmbeddedTextures !== false && modelHasTextures(root)) {
      console.info('[LMGlb] 내장 텍스처 사용:', entry.localUrl || url);
      sanitizeBrokenTextures(root);
      ensureSkinnedMaterials(root);
      return Promise.resolve(root);
    }
    const manifestFiles = getEntryManifestFiles(entry, url);
    if (entry && entry.textureDir && manifestFiles.length) {
      return repairFbxTextures(root, url, entry);
    }
    sanitizeBrokenTextures(root);
    ensureSkinnedMaterials(root);
    return Promise.resolve(root);
  }

  function freezeSkinnedPose(model) {
    if (!model) return;
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) {
        o.skeleton.pose();
        o.skeleton.update();
      }
    });
  }

  /** Tripo — Root 본 회전만 제거(클립이 루트를 돌리면 90° 눕음). 골반·다리는 클립 그대로 */
  function isTripoRootAnimTrack(trackName) {
    const n = (trackName || '').toLowerCase();
    if (!/\.(quaternion|rotation)$/.test(n)) return false;
    return n.split('.')[0] === 'root';
  }

  function sanitizeAnimClip(clip, entry, role) {
    if (!clip || !clip.tracks) return clip;
    const out = clip.clone();
    const strip = !entry || entry.stripAnimRootMotion !== false;
    const stripRootOnly =
      entry && entry.animClips && (role === 'walk' || role === 'run');
    out.tracks = out.tracks.filter((track) => {
      const n = track.name || '';
      const bone = n.split('.')[0].toLowerCase();
      if (/\.scale/i.test(n)) return false;
      if (
        strip &&
        /\.position$/i.test(n) &&
        /hips|pelvis|root|mixamorig|armature|^char\d|spine\d*$/.test(bone)
      ) {
        return false;
      }
      if (stripRootOnly && isTripoRootAnimTrack(n)) return false;
      return true;
    });
    return out;
  }

  function resolveModelYaw(entry, wrapper) {
    if (wrapper && wrapper.userData.glbModelYaw != null) {
      return wrapper.userData.glbModelYaw;
    }
    if (entry && entry.modelYaw != null) return entry.modelYaw;
    if (entry && entry.animClips && !entry.meshyAnims) return -Math.PI / 2;
    return 0;
  }

  /** Tripo GLB — X/Z만 고정, Y는 이동 방향 대비 뒷모습 보정 */
  function resetTripoModelOrientation(model, yaw) {
    if (!model) return;
    model.rotation.x = 0;
    model.rotation.z = 0;
    if (yaw != null) model.rotation.y = yaw;
    model.updateMatrixWorld(true);
  }

  function usesBindIdlePose(entry) {
    return !!(entry && (entry.idlePose === 'bind' || entry.useBindPoseIdle));
  }

  /** GLB/FBX 로드 직후 스켈레톤 바인드 포즈(팔 내림) 저장 */
  function captureSkeletonBindPose(model, force) {
    if (!model) return;
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.pose();
    });
    model.traverse((o) => {
      if (!o.isBone) return;
      if (force || !o.userData._lmBindCaptured) {
        o.userData._lmRestQuat = o.quaternion.clone();
        o.userData._lmRestPos = o.position.clone();
        o.userData._lmRestScale = o.scale.clone();
        o.userData._lmBindCaptured = true;
      }
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function cacheBoneRestPose(model) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      if (!o.userData._lmRestQuat) o.userData._lmRestQuat = o.quaternion.clone();
      if (!o.userData._lmRestPos) o.userData._lmRestPos = o.position.clone();
      if (!o.userData._lmRestScale) o.userData._lmRestScale = o.scale.clone();
    });
  }

  function restoreRestPose(model) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      if (o.userData._lmRestQuat) o.quaternion.copy(o.userData._lmRestQuat);
      if (o.userData._lmRestPos) o.position.copy(o.userData._lmRestPos);
      if (o.userData._lmRestScale) o.scale.copy(o.userData._lmRestScale);
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function normalizeBoneScales(model, forceUnit) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      if (forceUnit) o.scale.set(1, 1, 1);
      else if (o.userData._lmRestScale) o.scale.copy(o.userData._lmRestScale);
      else o.scale.set(1, 1, 1);
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function resetAnimRootBones(model) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      const nl = o.name.toLowerCase();
      if (!/hips|pelvis|^root$|mixamorighips|armature/i.test(nl)) return;
      if (o.userData._lmRestPos) o.position.copy(o.userData._lmRestPos);
      if (o.userData._lmRestQuat) o.quaternion.copy(o.userData._lmRestQuat);
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function isUpperArmBone(nl) {
    if (/forearm|lowerarm|hand|finger|clavicle|shoulder$|collar/.test(nl)) return false;
    if (/^leftarm$|^rightarm$/.test(nl)) return true;
    return (
      /upperarm|uparm|shoulderarm|(^|[^a-z])(left|right)arm($|[^a-z])|mixamorig(left|right)arm$|\.l_arm|\.r_arm|arm\.l|arm\.r/.test(
        nl
      ) && /arm/.test(nl)
    );
  }

  function isForeArmBone(nl) {
    if (/^leftforearm$|^rightforearm$/.test(nl)) return true;
    return /forearm|lowerarm|mixamorig(left|right)forearm/.test(nl) && !/hand|finger/.test(nl);
  }

  function getMeshyArmature(model) {
    let arm = null;
    model.traverse((o) => {
      if (!arm && /^armature$/i.test(o.name)) arm = o;
    });
    return arm;
  }

  /** Meshy — 스킨 행렬만 갱신 (pose/bind 금지 — pose 시 화면 0.02m 붕괴) */
  function rebindMeshySkins(model) {
    if (!model) return;
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  const updateSkinnedMeshes = rebindMeshySkins;

  function normalizeMeshyHeightMeters(h) {
    if (!h || h <= 0) return 0;
    if (h > 50) h *= 0.01;
    else if (h > 2.5 && h <= 50) h *= 0.01;
    return h;
  }

  /** Meshy 키 — 스킨 메쉬 bbox (포즈에 따라 0.02m로 붕괴할 수 있음) */
  function measureMeshyMeshScreenHeight(model, entry) {
    if (!model) return 0;
    rebindMeshySkins(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    expandVisualBox(box, model);
    if (box.isEmpty()) return 0;
    return normalizeMeshyHeightMeters(measureHeightFromGround(model, box, entry).height);
  }

  /** Meshy 키 — 변형 정점 기준(실제 화면 체감, bbox 붕괴 시 사용) */
  function measureMeshyVertexScreenHeight(model, entry) {
    if (!model) return 0;
    rebindMeshySkins(model);
    model.updateMatrixWorld(true);
    const bottomY = measureModelBottomY(model);
    let maxY = -Infinity;
    const v = new THREE.Vector3();
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (o.visible === false) return;
      const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (!pos) return;
      const step = Math.max(1, Math.floor(pos.count / 1600));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(o.matrixWorld);
        maxY = Math.max(maxY, v.y);
      }
    });
    if (!isFinite(maxY)) return 0;
    return normalizeMeshyHeightMeters(Math.max(maxY - bottomY, 0.001));
  }

  function restoreMeshyArmatureBindScale(model) {
    const arm = getMeshyArmature(model);
    if (!arm) return;
    if (arm.userData._lmArmBindScale == null) arm.userData._lmArmBindScale = arm.scale.x;
    arm.scale.setScalar(arm.userData._lmArmBindScale);
  }

  /** Meshy — glb_model 루트 스케일(Armature 0.01 유지) */
  function applyMeshyRootScale(model, sy, entry) {
    restoreMeshyArmatureBindScale(model);
    sy = THREE.MathUtils.clamp(sy, 0.008, 3);
    const s = (entry && entry.scale != null ? entry.scale : 1) * sy;
    model.scale.set(s, s, s);
    model.userData._lmMeshyModelScale = s;
    model.updateMatrixWorld(true);
    rebindMeshySkins(model);
    return s;
  }

  /** Meshy fit — 정점·bbox 우선; bbox 0.02m + 본 1.7m 착시면 본만 쓰지 않음 */
  function computeMeshyFitHeight(model, entry) {
    rebindMeshySkins(model);
    model.updateMatrixWorld(true);
    const bboxH = measureMeshyMeshScreenHeight(model, entry);
    const vertH = measureMeshyVertexScreenHeight(model, entry);
    const boneH = normalizeMeshyHeightMeters(measureBoneWorldSpan(model));
    if (vertH >= 0.35 && vertH <= 2.8) return vertH;
    if (bboxH >= 0.35 && bboxH <= 2.8) return bboxH;
    if (bboxH > 0.01 && bboxH < 0.35 && boneH > bboxH * 4) {
      if (vertH >= 0.35) return vertH;
      return boneH;
    }
    if (boneH >= 0.45 && boneH <= 2.8 && vertH < 0.2) {
      const arm = getMeshyArmature(model);
      const armS = arm && arm.scale.x > 0 && arm.scale.x < 0.2 ? arm.scale.x : 1;
      if (armS < 0.2) return boneH * armS;
    }
    let h = Math.max(bboxH, vertH, boneH);
    return THREE.MathUtils.clamp(normalizeMeshyHeightMeters(h), 0.12, 2.8);
  }

  /** bbox 붕괴(0.02m)·본 1.7m 불일치 시 루트 스케일 추가 축소 */
  function meshyBboxBoneCollapseFactor(model) {
    const bboxH = measureMeshyMeshScreenHeight(model, null);
    const boneH = normalizeMeshyHeightMeters(measureBoneWorldSpan(model));
    if (bboxH > 0.008 && bboxH < 0.35 && boneH > bboxH * 4) {
      return THREE.MathUtils.clamp(bboxH / boneH, 0.008, 1);
    }
    return 1;
  }

  function refineMeshyAvatarScale(root, entry, targetH) {
    if (!root || !entry || !entry.meshyAnims || !targetH) return root.scale.x;
    let sy = root.scale.x / (entry.scale != null ? entry.scale : 1);
    const vertH = measureMeshyVertexScreenHeight(root, entry);
    const bboxH = measureMeshyMeshScreenHeight(root, entry);
    const screenH = vertH >= 0.35 ? vertH : bboxH >= 0.35 ? bboxH : Math.max(vertH, bboxH);
    if (screenH < 0.08) {
      sy *= meshyBboxBoneCollapseFactor(root);
      return applyMeshyRootScale(root, sy, entry);
    }
    const mul = THREE.MathUtils.clamp(targetH / screenH, 0.008, 3);
    if (Math.abs(mul - 1) > 0.06) sy = THREE.MathUtils.clamp(sy * mul, 0.008, 3);
    return applyMeshyRootScale(root, sy, entry);
  }

  /** Meshy T-포즈 바인드 → 양팔 내림·손 허리 (walk 0프레임은 T-포즈라 사용 안 함) */
  function applyMeshyTPoseToStand(model) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      const nl = o.name.toLowerCase();
      if (o.userData._lmRestQuat) o.quaternion.copy(o.userData._lmRestQuat);
      if (/finger|thumb|toe|hand|foot|neck|head|spine|hips|pelvis|jaw/.test(nl)) return;
      const isL = /left|_l\b|\.l$|_l_|_l\.|\.l_|^l_/.test(nl);
      if (isClavicleBone(nl)) {
        o.rotateZ(isL ? 0.16 : -0.16);
        return;
      }
      if (isUpperArmBone(nl)) {
        if (/^leftarm$|^rightarm$/.test(nl)) {
          o.rotateZ(isL ? 1.38 : -1.38);
        } else {
          o.rotateZ(isL ? 1.44 : -1.44);
        }
        o.rotateX(-0.2);
        return;
      }
      if (isForeArmBone(nl)) {
        o.rotateX(0.48);
      }
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function saveLocomotionBasePose(model) {
    model.traverse((o) => {
      if (!o.isBone) return;
      o.userData._lmLocoQuat = o.quaternion.clone();
      if (o.userData._lmRestPos) o.position.copy(o.userData._lmRestPos);
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  /** Meshy — 팔 내린 서기 기준 포즈 저장 */
  function ensureMeshyRelaxedIdleBase(wrapper, model, entry) {
    if (!model) return;
    if (model.userData._lmMeshyLocoVer !== 5) {
      model.userData._lmMeshyLocoReady = false;
      model.userData._lmMeshyLocoVer = 5;
    }
    if (model.userData._lmMeshyLocoReady) return;
    applyMeshyTPoseToStand(model);
    saveLocomotionBasePose(model);
    model.userData._lmMeshyLocoReady = true;
  }

  /** Meshy 정지 — 유휴 GLB 루프 (Swim_Idle 등), 없으면 T-포즈 보정 */
  function playMeshyIdleAnimPose(wrapper, model, entry) {
    if (!wrapper || !model) return false;
    if (!ensureMeshyAnimMixer(wrapper, model)) return false;
    const actions = wrapper.userData.glbActions;
    const role = actions.idle ? 'idle' : actions.alert ? 'alert' : null;
    if (!role) return false;
    restoreMeshyStandBaseY(wrapper, model);
    restoreMeshyArmatureBindScale(model);
    if (wrapper.userData._lmMeshyModelScale != null) {
      model.scale.setScalar(wrapper.userData._lmMeshyModelScale);
    }
    const mixer = wrapper.userData.glbMixer;
    Object.keys(actions).forEach((key) => {
      if (key === role) return;
      actions[key].stop();
      actions[key].setEffectiveWeight(0);
    });
    const act = actions[role];
    act.reset();
    act.setLoop(THREE.LoopRepeat, Infinity);
    act.setEffectiveWeight(1);
    act.play();
    mixer.update(0);
    rebindMeshySkins(model);
    wrapper.userData.glbAnimMode = role;
    wrapper.userData._walkPlaying = false;
    wrapper.userData._animOnceUntil = 0;
    wrapper.userData._lmSitMatAligned = false;
    return true;
  }

  function playMeshyIdlePose(wrapper, model, entry) {
    if (!model) return;
    const mixer = wrapper.userData.glbMixer;
    if (mixer) mixer.stopAllAction();
    restoreMeshyArmatureBindScale(model);
    if (wrapper.userData._lmMeshyModelScale != null) {
      model.scale.setScalar(wrapper.userData._lmMeshyModelScale);
    }
    if (!playMeshyIdleAnimPose(wrapper, model, entry)) {
      if (model.userData._lmMeshyLocoVer !== 5) {
        model.userData._lmMeshyLocoReady = false;
        model.userData._lmMeshyLocoVer = 5;
      }
      applyMeshyTPoseToStand(model);
      saveLocomotionBasePose(model);
      model.userData._lmMeshyLocoReady = true;
      rebindMeshySkins(model);
      wrapper.userData.glbAnimMode = 'idle';
    }
    wrapper.userData.glbModelScale = model.scale.x;
    wrapper.userData._walkPlaying = false;
    wrapper.userData._animOnceUntil = 0;
    wrapper.userData._lmSitMatAligned = false;
  }

  function rememberMeshyStandBaseY(wrapper, model) {
    if (!wrapper || !model) return;
    if (wrapper.userData._lmStandBaseY == null) {
      wrapper.userData._lmStandBaseY = model.position.y;
    }
  }

  /** 앉기 포즈 — 변형 메쉬 최하단 Y (bbox만으로는 공중에 뜸) */
  function measureModelBottomY(model) {
    if (!model) return 0;
    let minY = Infinity;
    const v = new THREE.Vector3();
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      if (o.visible === false) return;
      const pos = o.geometry && o.geometry.attributes && o.geometry.attributes.position;
      if (!pos) return;
      const step = Math.max(1, Math.floor(pos.count / 800));
      for (let i = 0; i < pos.count; i += step) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(o.matrixWorld);
        minY = Math.min(minY, v.y);
      }
    });
    const boneY = estimateFeetYFromBones(model);
    if (boneY != null) minY = Math.min(minY, boneY);
    const box = new THREE.Box3();
    expandVisualBox(box, model);
    if (!box.isEmpty()) minY = Math.min(minY, box.min.y);
    return isFinite(minY) ? minY : 0;
  }

  function settleSitMatClipPose(root, role) {
    const actions = root.userData.glbActions;
    const act = actions && actions[role];
    const mixer = root.userData.glbMixer;
    if (!act || !mixer) return;
    const clip = act.getClip();
    if (!clip || !clip.duration) return;
    act.time = Math.min(clip.duration * 0.32, clip.duration - 0.04);
    for (let i = 0; i < 5; i++) mixer.update(1 / 30);
  }

  /** 돗자리(sitMat) — glb_model Y만 조정 (래퍼는 0 유지) */
  function alignMeshySitMatToGround(wrapper, model, entry, surfaceY) {
    if (!wrapper || !model) return model.position.y;
    const target = surfaceY != null ? surfaceY : 0.04;
    rememberMeshyStandBaseY(wrapper, model);
    const mixer = wrapper.userData.glbMixer;
    if (mixer) {
      for (let i = 0; i < 4; i++) mixer.update(1 / 30);
    }
    const yOff = entry.sitMatYOffset || 0;
    for (let pass = 0; pass < 18; pass++) {
      rebindMeshySkins(model);
      model.updateMatrixWorld(true);
      const bottomY = measureModelBottomY(model);
      const delta = target - bottomY + yOff;
      if (Math.abs(delta) < 0.01) break;
      model.position.y += delta;
    }
    wrapper.userData.glbBaseY = model.position.y;
    wrapper.userData._lmMountSitYOffset = 0;
    model.updateMatrixWorld(true);
    return model.position.y;
  }

  function restoreMeshyStandBaseY(wrapper, model) {
    if (!wrapper || !model) return;
    if (wrapper.userData._lmStandBaseY != null) {
      model.position.y = wrapper.userData._lmStandBaseY;
      wrapper.userData.glbBaseY = wrapper.userData._lmStandBaseY;
    }
    wrapper.userData._lmMountSitYOffset = 0;
    wrapper.userData._lmStandBaseY = null;
    model.updateMatrixWorld(true);
  }

  function primeSitMatPose(wrapper, surfaceY) {
    if (!wrapper) return false;
    const model = wrapper.getObjectByName('glb_model');
    if (!model) return false;
    const entry = resolveAnimEntry(entryById(wrapper.userData.glbId), wrapper);
    if (!entry) return false;
    ensureMeshyAnimMixer(wrapper, model);
    if (!wrapper.userData.glbActions || !wrapper.userData.glbActions.sitMat) return false;
    playAvatarAnim(wrapper, 'sitMat', { force: true });
    settleSitMatClipPose(wrapper, 'sitMat');
    alignMeshySitMatToGround(wrapper, model, entry, surfaceY != null ? surfaceY : 0.04);
    return true;
  }

  /** sit 등 — 애니 적용 후 바닥 맞춤 */
  function alignMeshyModelToGround(wrapper, model, entry, extraY) {
    if (!wrapper || !model) return model.position.y;
    rememberMeshyStandBaseY(wrapper, model);
    rebindMeshySkins(model);
    model.updateMatrixWorld(true);
    const bottomY = measureModelBottomY(model);
    const target = (extraY != null ? extraY : entry.sitMatYOffset || 0);
    const y = model.position.y + (target - bottomY) + (entry.yOffset || 0);
    model.position.y = y;
    wrapper.userData.glbBaseY = y;
    wrapper.userData._lmMountSitYOffset = 0;
    model.updateMatrixWorld(true);
    return y;
  }

  function storeMeshyFitMetrics(wrapper, model, entry) {
    if (!wrapper || !model || !entry || !entry.meshyAnims) return;
    restoreMeshyArmatureBindScale(model);
    wrapper.userData._lmMeshyModelScale =
      model.userData._lmMeshyModelScale != null ? model.userData._lmMeshyModelScale : model.scale.x;
    wrapper.userData._lmMeshyFitHeight = measureMeshyMeshScreenHeight(model, entry);
    wrapper.userData._lmMeshyFitScale = wrapper.userData._lmMeshyModelScale;
  }

  function pruneGlbOnlyChildren(wrapper) {
    if (!wrapper) return;
    const remove = [];
    wrapper.children.forEach((ch) => {
      if (ch.name === 'builtin_mesh' || ch.name === 'builtin_placeholder') remove.push(ch);
    });
    remove.forEach((ch) => {
      wrapper.remove(ch);
      disposeTree(ch);
    });
  }

  function meshHasUsableTexture(mesh) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    return mats.some((m) => m && isTextureReady(m.map));
  }

  function pruneDuplicateSkinnedMeshes(model) {
    if (!model) return;
    const skinned = [];
    model.traverse((o) => {
      if (o.isSkinnedMesh) skinned.push(o);
    });
    if (skinned.length <= 1) return;
    let keep = skinned.find(meshHasUsableTexture) || skinned[0];
    skinned.forEach((m) => {
      m.visible = m === keep;
    });
  }

  function isClavicleBone(nl) {
    return /clavicle|collar|shoulder_(l|r)|_shoulder\b/.test(nl) && !/upperarm|forearm/.test(nl);
  }

  /** 바인드(T-포즈)에서 팔이 수평인지 */
  function boneRestLooksTPose(bone) {
    if (!bone || !bone.userData._lmRestQuat) return false;
    const e = new THREE.Euler().setFromQuaternion(bone.userData._lmRestQuat, 'XYZ');
    return (
      Math.abs(Math.abs(e.z) - Math.PI / 2) < 0.55 ||
      Math.abs(e.x) > 0.85 ||
      Math.abs(e.y) > 1.2
    );
  }

  /** Meshy 등 — 팔이 앞으로 뻗은 A-포즈(정면) */
  function boneRestLooksForwardArms(bone) {
    if (!bone || !bone.userData._lmRestQuat) return false;
    const e = new THREE.Euler().setFromQuaternion(bone.userData._lmRestQuat, 'XYZ');
    const zOff = Math.abs(Math.abs(e.z) - Math.PI / 2);
    return Math.abs(e.x) > 0.28 && zOff > 0.42 && Math.abs(e.y) < 1.05;
  }

  function detectTPoseRig(model, rig) {
    const candidates = [
      rig && rig.arms && rig.arms.L_upper,
      rig && rig.arms && rig.arms.R_upper
    ].filter(Boolean);
    if (candidates.some(boneRestLooksTPose)) return true;
    let hits = 0;
    model.traverse((o) => {
      if (!o.isBone) return;
      if (!isUpperArmBone(o.name.toLowerCase())) return;
      if (boneRestLooksTPose(o)) hits++;
    });
    return hits >= 1;
  }

  /** T-포즈 / A-포즈(앞으로) → 팔·어깨 내린 서기 */
  function applyRelaxedStandPose(model, opts) {
    opts = opts || {};
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      const nl = o.name.toLowerCase();
      if (o.userData._lmRestQuat) o.quaternion.copy(o.userData._lmRestQuat);
      if (/finger|thumb|toe|hand|foot|neck|head|spine|hips|pelvis|jaw/.test(nl)) return;
      const isL = /left|_l\b|\.l$|_l_|_l\.|\.l_|^l_/.test(nl);
      const isR = /right|_r\b|\.r$|_r_|_r\.|\.r_|^r_/.test(nl);
      const forward =
        opts.forceMeshy ||
        opts.forceForward ||
        (!opts.forceTPose && boneRestLooksForwardArms(o));
      const tPose = !forward && (opts.forceTPose || boneRestLooksTPose(o));
      if (isClavicleBone(nl)) {
        if (forward) o.rotateX(-0.1);
        else if (tPose) o.rotateZ(isL ? 0.14 : -0.14);
        return;
      }
      if (isUpperArmBone(nl)) {
        if (forward) {
          o.rotateX(1.48);
          o.rotateZ(isL ? -0.07 : 0.07);
        } else if (tPose && (/^leftarm$|^rightarm$/.test(nl))) {
          o.rotateZ(isL ? 1.38 : -1.38);
        } else if (tPose && (/mixamo|cc_base|upleg|uparm/.test(nl) || /^cc_base_/.test(nl))) {
          o.rotateZ(isL ? 1.42 : -1.42);
        } else if (tPose && /^l_upperarm$|^r_upperarm$/i.test(o.name)) {
          o.rotateX(-1.22);
          o.rotateZ(isL ? 0.06 : -0.06);
        } else {
          o.rotateX(-1.12);
        }
        o.userData._lmTPoseLimb = !!tPose;
        o.userData._lmForwardLimb = !!forward;
      } else if (isForeArmBone(nl)) {
        if (forward) o.rotateX(0.34);
        else o.rotateX(tPose ? 0.32 : 0.28);
      }
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  /** 걷기·앉기·대기 기준 포즈 저장 (T-포즈 보정 후) */
  function applyLocomotionBasePose(model, opts) {
    applyRelaxedStandPose(model, opts);
    model.traverse((o) => {
      if (!o.isBone) return;
      o.userData._lmLocoQuat = o.quaternion.clone();
      if (o.userData._lmRestPos) o.position.copy(o.userData._lmRestPos);
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function restoreLocomotionBasePose(model) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      if (o.userData._lmLocoQuat) o.quaternion.copy(o.userData._lmLocoQuat);
      else if (o.userData._lmRestQuat) o.quaternion.copy(o.userData._lmRestQuat);
      if (o.userData._lmRestPos) o.position.copy(o.userData._lmRestPos);
      if (o.userData._lmRestScale) o.scale.copy(o.userData._lmRestScale);
    });
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  function getBoneLocoQuat(bone) {
    return bone.userData._lmLocoQuat || bone.userData._lmRestQuat;
  }

  function initAvatarTPoseLocomotion(wrapper, model, entry, rig) {
    const force = !!(entry && (entry.tPoseBind || entry.forceProceduralAnim));
    const detected = detectTPoseRig(model, rig);
    wrapper.userData.lmTPoseBind = force || detected;
    if (!wrapper.userData.lmTPoseBind) return false;
    applyLocomotionBasePose(model, { forceTPose: true });
    console.info(
      '[LMGlb] T-포즈 → 서기·걷기 기준 포즈 적용:',
      (entry && entry.localUrl) || wrapper.userData.glbId || ''
    );
    return true;
  }

  function lockModelTransform(wrapper, model) {
    if (!wrapper || !model) return;
    if (wrapper.userData._lmMeshyModelScale != null) {
      restoreMeshyArmatureBindScale(model);
      model.scale.setScalar(wrapper.userData._lmMeshyModelScale);
    } else {
      const s = wrapper.userData.glbModelScale;
      if (s != null) model.scale.setScalar(s);
    }
    if (wrapper.userData.glbBaseY != null) {
      model.position.y =
        wrapper.userData.glbBaseY + (wrapper.userData._lmMountSitYOffset || 0);
    }
    model.position.x = 0;
    model.position.z = 0;
    model.rotation.x = 0;
    model.rotation.z = 0;
    if (wrapper.userData.glbModelYaw != null) {
      model.rotation.y = wrapper.userData.glbModelYaw;
    }
  }

  /** 걷기 중 화면 키 — 정지 시 같은 스케일 유지용 */
  function saveAvatarWalkScale(wrapper, model) {
    if (!wrapper || !model) return;
    wrapper.userData._lmWalkScale =
      wrapper.userData._lmMeshyModelScale != null
        ? wrapper.userData._lmMeshyModelScale
        : model.scale.x;
    wrapper.userData._lmWalkBaseY = model.position.y;
  }

  /** 정지·걷기 동일 화면 키 (바닥→머리 = lmTargetHeight) */
  function maintainAvatarDisplayHeight(wrapper, model, entry) {
    const targetH = wrapper.userData.lmTargetHeight;
    if (!targetH || !model || !entry || !isFixedWorldAvatar(entry)) return;

    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
    model.updateMatrixWorld(true);

    if (entry.meshyAnims) {
      lockModelTransform(wrapper, model);
      return;
    }

    let rh = measureMeshHeightFromGround(model, entry);
    if (rh < 0.08) return;

    const ratio = targetH / rh;
    if (ratio < 0.94 || ratio > 1.06) {
      if (ratio < 1) {
        console.warn('[LMGlb] 키 축소 스킵:', rh.toFixed(2), 'm');
        return;
      }
      if (ratio < 0.25) {
        console.warn('[LMGlb] 키 보정 스킵(과도 축소):', rh.toFixed(3), '→', targetH.toFixed(2));
        return;
      }
      model.scale.multiplyScalar(ratio);
      if (entry.meshyAnims) updateSkinnedMeshes(model);
      wrapper.userData.glbModelScale = model.scale.x;
      const box = new THREE.Box3();
      expandVisualBox(box, model);
      const gy = resolveGroundY(model, box, entry);
      model.position.y = -gy + (entry.yOffset || 0);
      wrapper.userData.glbBaseY = model.position.y;
      wrapper.userData.lmBodyHeight = targetH;
      wrapper.userData.lmLookAtOffsetY = model.position.y + targetH * 0.42;
    }
    lockModelTransform(wrapper, model);
  }

  function enforceAvatarWorldHeight(wrapper, model, entry) {
    maintainAvatarDisplayHeight(wrapper, model, entry);
    wrapper.userData._lmHeightEnforced = true;
  }

  function enterStandPose(wrapper, model, mixer, walkAction, entry) {
    if (!model) return;
    if (mixer) {
      mixer.stopAllAction();
      if (walkAction) {
        walkAction.stop();
        walkAction.reset();
      }
      mixer.update(0);
    }
    let hasLoco = false;
    model.traverse((o) => {
      if (o.isBone && o.userData._lmLocoQuat) hasLoco = true;
    });
    if (hasLoco) restoreLocomotionBasePose(model);
    else if (usesBindIdlePose(entry)) restoreRestPose(model);
    else applyRelaxedStandPose(model);
    resetAnimRootBones(model);
    if (wrapper.userData._lmWalkScale != null) {
      model.scale.setScalar(wrapper.userData._lmWalkScale);
      if (wrapper.userData._lmWalkBaseY != null) model.position.y = wrapper.userData._lmWalkBaseY;
      wrapper.userData.glbModelScale = model.scale.x;
      wrapper.userData.glbBaseY = model.position.y;
    }
    maintainAvatarDisplayHeight(wrapper, model, entry);
    lockModelTransform(wrapper, model);
  }

  function ensureSkinnedMaterials(root) {
    root.traverse((o) => {
      if (!o.isSkinnedMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        m.skinning = true;
        m.needsUpdate = true;
      });
    });
  }

  function normalizeFbxRoot(group, entry) {
    if (entry && entry.fbxRotX) group.rotation.x = entry.fbxRotX;
    ensureSkinnedMaterials(group);
    group.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return group;
  }

  function getPref(kind) {
    const k = 'lm_glb_' + kind;
    try {
      return localStorage.getItem(k) || '';
    } catch (e) {
      return '';
    }
  }

  /** 성별·저장값 기준 아바타 id (기본: man1 / woman1) */
  function resolveAvatarGlbId(avatar, gender) {
    const av = avatar || {};
    if (av.glbModel && av.glbModel !== 'builtin') return av.glbModel;
    const pref = getPref('avatar');
    if (pref && pref !== 'builtin') return pref;
    const g =
      gender ||
      (typeof window !== 'undefined' && window.S && window.S.myEntry && window.S.myEntry.gender) ||
      '남성';
    return g === '여성' ? 'avatar_girl' : 'avatar_man';
  }

  function setPref(kind, id) {
    const k = 'lm_glb_' + kind;
    try {
      if (!id || id === 'builtin') localStorage.removeItem(k);
      else localStorage.setItem(k, id);
    } catch (e) { /* ignore */ }
  }

  function getNpcPref(npcId) {
    try {
      return localStorage.getItem('lm_glb_npc_' + npcId) || getPref('npc') || '';
    } catch (e) {
      return getPref('npc');
    }
  }

  function setNpcPref(npcId, id) {
    try {
      if (!id || id === 'builtin') localStorage.removeItem('lm_glb_npc_' + npcId);
      else localStorage.setItem('lm_glb_npc_' + npcId, id);
    } catch (e) { /* ignore */ }
  }

  function disposeTree(root) {
    if (!root) return;
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          if (m.map) m.map.dispose();
          if (m.dispose) m.dispose();
        });
      }
    });
  }

  function col(hex) {
    return new THREE.Color(typeof hex === 'number' ? hex : 0xffe0bd);
  }

  function meshKind(name, matName) {
    const s = ((name || '') + ' ' + (matName || '')).toLowerCase();
    if (/hair|bang|ponytail|wig|머리/.test(s)) return 'hair';
    if (/eye|pupil|iris|눈/.test(s)) return 'eye';
    if (/lip|mouth|입/.test(s)) return 'lip';
    if (/cloth|dress|shirt|pants|skirt|jacket|coat|shoe|boot|의상|옷|바지|치마/.test(s)) return 'outfit';
    if (/face|head|cheek|skin|neck|body|arm|leg|hand|torso|naked|character|avatar|얼굴/.test(s)) {
      return 'skin';
    }
    return 'skin';
  }

  function wantsCuteFace(entry) {
    if (entry && entry.cuteFaceOverlay) return true;
    try {
      return localStorage.getItem('lm_glb_cute_face') !== '0';
    } catch (e) {
      return true;
    }
  }

  /**
   * Tripo 등 무텍스처·무릭 정적 GLB — 높이(Y)로 머리/얼굴/피부/옷 구분 + 피부 PBR
   */
  function applyRealisticSkinByHeight(root, avatar) {
    const av = avatar || {};
    const skin = col(av.skin || 0xffe0bd);
    const hair = col(av.hairColor || 0x5a3825);
    const outfit = col(av.outfitColor || 0xff6b9d);
    const shoe = col(av.shoeColor || 0x2a2a2a);
    const tmp = new THREE.Vector3();

    root.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const pos = o.geometry.attributes.position;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const bb = o.geometry.boundingBox;
      const y0 = bb.min.y;
      const yr = Math.max(bb.max.y - y0, 0.001);

      const colors = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        tmp.fromBufferAttribute(pos, i);
        const t = (tmp.y - y0) / yr;
        let c;
        if (t > 0.9) c = hair;
        else if (t > 0.72) c = skin;
        else if (t > 0.66) c = skin.clone().lerp(col(av.lipColor || 0xd63b5a), 0.08);
        else if (t > 0.38) c = outfit;
        else if (t > 0.12) c = outfit.clone().multiplyScalar(0.92);
        else c = shoe;
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      o.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const old = o.material;
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.48,
        metalness: 0.02,
        clearcoat: 0.12,
        clearcoatRoughness: 0.38,
        transmission: 0.1,
        thickness: 0.45,
        ior: 1.42,
        emissive: skin.clone().multiplyScalar(0.04),
        emissiveIntensity: 0.35
      });
      if (old) {
        const ms = Array.isArray(old) ? old : [old];
        ms.forEach((m) => m && m.dispose && m.dispose());
      }
      o.material = mat;
    });
  }

  /** 검은 실루엣·무텍스처 GLB → 게임 아바타 색 + 부드러운 피부 */
  function beautifyGlbMaterials(root, avatar) {
    sanitizeBrokenTextures(root);
    const av = avatar || {};
    const skin = col(av.skin || 0xffe0bd);
    const hair = col(av.hairColor || 0x5a3825);
    const lip = col(av.lipColor || 0xd63b5a);
    const eye = col(av.eyeColor || 0x2c1810);
    const outfit = col(av.outfitColor || 0xff6b9d);

    root.traverse((o) => {
      if (!o.isMesh) return;
      const kind = meshKind(o.name, o.material && (Array.isArray(o.material) ? o.material[0] : o.material).name);
      const mats = Array.isArray(o.material) ? o.material.slice() : [o.material];

      const pick = (k) =>
        k === 'hair' ? hair : k === 'eye' ? eye : k === 'lip' ? lip : k === 'outfit' ? outfit : skin;

      const next = mats.map((m) => {
        if (!m) return m;
        const base = pick(kind);
        const hasTex =
          isTextureReady(m.map) ||
          isTextureReady(m.emissiveMap) ||
          isTextureReady(m.normalMap);
        const sum = m.color ? m.color.r + m.color.g + m.color.b : 0;
        const tooDark = sum < 0.12;

        if (hasTex && !tooDark) {
          if (o.isSkinnedMesh) m.skinning = true;
          if (m.map && isTextureReady(m.map) && THREE.sRGBEncoding) {
            m.map.encoding = THREE.sRGBEncoding;
            m.map.needsUpdate = true;
          }
          if (m.metalness != null) m.metalness = Math.min(m.metalness, 0.12);
          if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.42);
          m.needsUpdate = true;
          return m;
        }

        const nm = new THREE.MeshPhysicalMaterial({
          color: base.clone(),
          roughness: kind === 'hair' ? 0.72 : kind === 'eye' ? 0.25 : kind === 'lip' ? 0.45 : 0.55,
          metalness: kind === 'eye' ? 0.25 : 0.03,
          clearcoat: kind === 'skin' || kind === 'lip' ? 0.18 : 0.06,
          clearcoatRoughness: 0.32,
          emissive: base.clone().multiplyScalar(kind === 'lip' ? 0.12 : 0.06),
          emissiveIntensity: kind === 'skin' || kind === 'lip' ? 0.22 : 0.1,
          skinning: !!o.isSkinnedMesh
        });
        if (m.dispose) m.dispose();
        return nm;
      });

      o.material = next.length === 1 ? next[0] : next;
    });
  }

  function removeCuteFace(wrapper) {
    const old = wrapper.getObjectByName('lm_cute_face');
    if (old) {
      wrapper.remove(old);
      disposeTree(old);
    }
  }

  /** 베이스 메쉬 위 귀여운 눈·볼·입 (컨셉 아트 느낌) */
  function addCuteFaceOverlay(wrapper, model, avatar) {
    removeCuteFace(wrapper);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y;
    if (h < 0.3) return;
    const headY = box.max.y - h * 0.1;
    const headR = Math.max((box.max.x - box.min.x) * 0.2, h * 0.09);
    const z = box.max.z + headR * 0.55;
    const av = avatar || {};
    const eyeC = col(av.eyeColor || 0x2c1810);
    const lipC = col(av.lipColor || 0xd63b5a);
    const fg = new THREE.Group();
    fg.name = 'lm_cute_face';

    for (const sx of [-1, 1]) {
      const ew = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 0.1, 12, 12),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 0.65 })
      );
      ew.position.set(sx * headR * 0.26, headY + headR * 0.06, z);
      fg.add(ew);
      const pu = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 0.052, 10, 10),
        new THREE.MeshPhysicalMaterial({ color: eyeC, roughness: 0.2, metalness: 0.15 })
      );
      pu.position.set(sx * headR * 0.26, headY + headR * 0.06, z + headR * 0.07);
      fg.add(pu);
      const hi = new THREE.Mesh(
        new THREE.SphereGeometry(headR * 0.02, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      hi.position.set(sx * headR * 0.3, headY + headR * 0.1, z + headR * 0.1);
      fg.add(hi);
      const blush = new THREE.Mesh(
        new THREE.CircleGeometry(headR * 0.11, 14),
        new THREE.MeshBasicMaterial({
          color: 0xff8a9b,
          transparent: true,
          opacity: 0.38,
          depthWrite: false,
          side: THREE.DoubleSide
        })
      );
      blush.position.set(sx * headR * 0.4, headY - headR * 0.06, z - headR * 0.02);
      blush.rotation.y = sx * 0.2;
      fg.add(blush);
    }

    const lip = new THREE.Mesh(
      new THREE.SphereGeometry(headR * 0.055, 10, 8),
      new THREE.MeshPhysicalMaterial({ color: lipC, roughness: 0.38, clearcoat: 0.45 })
    );
    lip.scale.set(1.35, 0.5, 0.75);
    lip.position.set(0, headY - headR * 0.17, z + headR * 0.02);
    fg.add(lip);

    wrapper.add(fg);
    wrapper.userData.cuteFace = fg;
  }

  /** 오픈월드·미리보기와 비슷한 중성 3점 조명 (캐릭터만 밝게) */
  function addAvatarLights(wrapper) {
    if (wrapper.userData.lmAvatarLights) return;
    const key = new THREE.DirectionalLight(0xfff7d6, 0.72);
    key.name = 'lm_avatar_key';
    key.position.set(2.2, 4.5, 3.2);
    wrapper.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.42);
    fill.name = 'lm_avatar_fill';
    fill.position.set(-2.4, 2.2, 2.0);
    wrapper.add(fill);
    const rim = new THREE.DirectionalLight(0xe8e0ff, 0.28);
    rim.name = 'lm_avatar_rim';
    rim.position.set(0.2, 2.8, -3.5);
    wrapper.add(rim);
    wrapper.userData.lmAvatarLights = true;
  }

  function modelHasTextures(model) {
    let found = false;
    model.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        if (!m) return;
        TEX_SLOTS.forEach((key) => {
          if (isTextureReady(m[key])) found = true;
        });
        if (m.map && isTextureReady(m.map)) found = true;
      });
    });
    return found;
  }

  function applyTextureColorSpace(tex) {
    if (!tex || !isTextureReady(tex)) return;
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    else if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    tex.needsUpdate = true;
  }

  function polishTripoGlbMaterials(model) {
    ensureSkinnedMaterials(model);
    model.traverse((o) => {
      if ((!o.isMesh && !o.isSkinnedMesh) || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        applyTextureColorSpace(m.map);
        if (m.metalness != null) m.metalness = Math.min(m.metalness, 0.35);
        if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.35);
        m.side = THREE.FrontSide;
        m.needsUpdate = true;
      });
    });
  }

  /** 오픈월드 NPC·집 GLB — LMOwGlb 로더 경로용 (내장 텍스처·검은 실루엣 방지) */
  function polishOwGlbModel(model) {
    if (!model) return;
    ensureSkinnedMaterials(model);
    sanitizeBrokenTextures(model);
    polishTripoGlbMaterials(model);
    preserveOriginalGlbColors(model);
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (m) m.vertexColors = false;
      });
    });
  }

  /** GLB 텍스처 원색 — 오픈월드에서도 뷰어처럼 (Lambert + 맵) */
  function preserveOriginalGlbColors(model) {
    ensureSkinnedMaterials(model);
    model.traverse((o) => {
      if ((!o.isMesh && !o.isSkinnedMesh) || !o.material) return;
      o.castShadow = false;
      o.receiveShadow = true;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        if (!m) return m;
        applyTextureColorSpace(m.map);
        applyTextureColorSpace(m.normalMap);
        const hasTex = isTextureReady(m.map);
        if (hasTex) {
          const lamb = new THREE.MeshLambertMaterial({
            map: m.map,
            color: 0xffffff,
            transparent: m.transparent,
            opacity: m.opacity != null ? m.opacity : 1
          });
          if (m.normalMap) lamb.normalMap = m.normalMap;
          if (m.alphaMap) lamb.alphaMap = m.alphaMap;
          lamb.skinning = !!o.isSkinnedMesh;
          return lamb;
        }
        if (m.metalness != null) m.metalness = 0;
        if (m.roughness != null) m.roughness = 0.82;
        if (m.emissive) m.emissive.setRGB(0, 0, 0);
        if (m.emissiveIntensity != null) m.emissiveIntensity = 0;
        if (m.color) m.color.setRGB(1, 1, 1);
        m.side = THREE.FrontSide;
        m.needsUpdate = true;
        return m;
      });
      o.material = next.length === 1 ? next[0] : next;
    });
  }

  /** 오픈월드 파스텔 배경·펫과 어울리게 — 핑크 톤·부드러운 명암 (씬 조명은 그대로) */
  function applyTripoAvatarColorHarmony(model, entry) {
    if (!model) return;
    const isGirl = entry && (entry.id === 'avatar_girl' || entry.avatarPinkTone);
    const tintSky = new THREE.Color(0xffd8ec);
    const tintDress = new THREE.Color(0xffb8dc);
    const tintSkin = new THREE.Color(0xffa8c8);
    const tintHair = new THREE.Color(0x5c3048);

    model.traverse((o) => {
      if ((!o.isMesh && !o.isSkinnedMesh) || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        let c = m.color ? m.color.clone() : new THREE.Color(0xcccccc);
        const lum = c.r * 0.299 + c.g * 0.587 + c.b * 0.114;
        if (isGirl) {
          if (lum < 0.22) c.lerp(tintHair, 0.12);
          else if (lum > 0.52) c.lerp(tintDress, 0.26);
          else c.lerp(tintSkin, 0.22);
        } else {
          c.lerp(tintSky, 0.08);
        }
        m.color.copy(c);
        if (!m.emissive) m.emissive = new THREE.Color(0, 0, 0);
        m.emissive.copy(c).multiplyScalar(isGirl ? 0.22 : 0.18);
        m.emissiveIntensity = isGirl ? 0.58 : 0.5;
        if (m.roughness != null) m.roughness = Math.min(m.roughness, 0.78);
        if (m.metalness != null) m.metalness = Math.min(m.metalness, 0.08);
        if (m.map && THREE.sRGBEncoding) {
          m.map.encoding = THREE.sRGBEncoding;
          m.map.needsUpdate = true;
        }
        m.needsUpdate = true;
      });
    });
  }

  function harmonizeTripoAvatarForOw(wrapper, model, entry) {
    if (!model) return;
    polishTripoGlbMaterials(model);
    applyTripoAvatarColorHarmony(model, entry);
    model.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = false;
      o.receiveShadow = true;
    });
  }

  function polishAvatarGlb(wrapper, model, entry, opts) {
    const av =
      opts.avatar ||
      (typeof window.getMyAvatar === 'function' ? window.getMyAvatar() : {});
    removeCuteFace(wrapper);

    if (entry && (entry.preserveGlbColors || entry.forceProceduralAnim || entry.tPoseBind)) {
      preserveOriginalGlbColors(model);
      model.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        o.castShadow = false;
        o.receiveShadow = true;
      });
      return;
    }

    if (entry && entry.animClips) {
      harmonizeTripoAvatarForOw(wrapper, model, entry);
      return;
    }

    if (entry && entry.format === 'fbx') {
      ensureSkinnedMaterials(model);
      model.traverse((o) => {
        if (!o.isMesh && !o.isSkinnedMesh) return;
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => {
          if (!m) return;
          if (m.map && isTextureReady(m.map) && THREE.sRGBEncoding) {
            m.map.encoding = THREE.sRGBEncoding;
            m.map.needsUpdate = true;
          }
          if (m.metalness != null) m.metalness = Math.min(m.metalness, 0.15);
          if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.38);
          m.needsUpdate = true;
        });
      });
      if (!modelHasTextures(model)) sanitizeBrokenTextures(model);
      ensureSkinnedMaterials(model);
      return;
    }

    sanitizeBrokenTextures(model);
    if (modelHasTextures(model)) {
      beautifyGlbMaterials(model, av);
    } else if (entry && entry.realisticSkin) {
      applyRealisticSkinByHeight(model, av);
    } else if (!entry || entry.beautify !== false) {
      beautifyGlbMaterials(model, av);
    }
    ensureSkinnedMaterials(model);
    if (entry && entry.cuteFaceOverlay && wantsCuteFace(entry)) {
      addCuteFaceOverlay(wrapper, model, av);
    }
  }

  /** 리깅 FBX — 발/발목 본 월드 Y (치마·바닥 메쉬보다 정확) */
  function estimateFeetYFromBones(root) {
    const ys = [];
    const v = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isBone) return;
      const n = o.name.toLowerCase();
      if (/finger|thumb|hand|wrist|arm|forearm|shoulder|spine|neck|head|eye|jaw|pelvis|hip(?!s)|chest|clavicle/.test(n)) {
        return;
      }
      if (/foot|toe|ankle|heel|ball|leg.*end|_l_foot|_r_foot/.test(n)) {
        v.setFromMatrixPosition(o.matrixWorld);
        ys.push(v.y);
      }
    });
    if (!ys.length) return null;
    return Math.min(...ys);
  }

  function resolveGroundY(root, box, entry) {
    if (entry && entry.footAlign === 'bbox') return box.min.y;
    if (entry && entry.footAlign === 'feet') {
      const boneY = estimateFeetYFromBones(root);
      if (boneY != null) return boneY;
      return estimateFeetY(root, box);
    }
    return box.min.y;
  }

  /** 치마 등으로 bbox.min이 발보다 아래일 때 — 하단 12% 꼭짓점 기준 */
  function estimateFeetY(root, box) {
    const h = Math.max(box.max.y - box.min.y, 0.001);
    const bandTop = box.min.y + h * 0.14;
    const ys = [];
    const v = new THREE.Vector3();
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isMesh || !o.geometry?.attributes?.position) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        v.applyMatrix4(o.matrixWorld);
        if (v.y <= bandTop) ys.push(v.y);
      }
    });
    if (!ys.length) return box.min.y;
    ys.sort((a, b) => a - b);
    const n = Math.max(1, Math.ceil(ys.length * 0.35));
    let sum = 0;
    for (let i = 0; i < n; i++) sum += ys[i];
    return sum / n;
  }

  function expandVisualBox(box, root) {
    root.updateMatrixWorld(true);
    root.traverse((o) => {
      if (!o.isSkinnedMesh && !o.isMesh) return;
      if (o.visible === false) return;
      try {
        box.expandByObject(o, true);
      } catch (e) {
        box.expandByObject(o);
      }
    });
  }

  /** Meshy — Armature 0.01 + cm 본 → 본 월드 높이 우선 */
  function measureMeshyAvatarHeight(model, entry) {
    if (!model) return 0;
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
    model.updateMatrixWorld(true);
    const boneH = measureBoneWorldSpan(model);
    if (boneH >= 0.45 && boneH <= 2.8) return boneH;
    const meshH = measureMeshHeightFromGround(model, entry);
    if (meshH >= 0.45 && meshH <= 2.8) return meshH;
    if (boneH >= 0.12) return boneH;
    return meshH;
  }

  /** GLB Armature 0.01 등 — 자식 scale을 1로 올리지 않음 (올리면 화면만 수십 m로 커짐) */
  function noteGlbImportScales(root) {
    let mul = 1;
    root.traverse((o) => {
      if (o === root || o.isBone) return;
      const sx = o.scale.x;
      const sy = o.scale.y;
      const sz = o.scale.z;
      if (Math.abs(sx - sy) > 0.08 || Math.abs(sy - sz) > 0.08) return;
      if (sx < 0.12 || sx > 8) mul *= sx;
    });
    if (mul !== 1) {
      console.info('[LMGlb] GLB 노드 스케일(유지): ×', mul.toFixed(4));
    }
    return mul;
  }

  /** 본 월드 Y 범위 — 스킨 메쉬 bbox보다 실제 체감 크기에 가까움 */
  function measureBoneWorldSpan(model) {
    let minY = Infinity;
    let maxY = -Infinity;
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isBone) return;
      const v = new THREE.Vector3();
      v.setFromMatrixPosition(o.matrixWorld);
      minY = Math.min(minY, v.y);
      maxY = Math.max(maxY, v.y);
    });
    if (!isFinite(minY) || !isFinite(maxY)) return 0;
    return Math.max(maxY - minY, 0);
  }

  function measureMeshHeightFromGround(model, entry) {
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
    model.updateMatrixWorld(true);
    const box = new THREE.Box3();
    expandVisualBox(box, model);
    if (box.isEmpty()) return 0;
    let h = measureHeightFromGround(model, box, entry).height;
    if (isFixedWorldAvatar(entry) && h < 0.15) {
      const boneH = measureBoneWorldSpan(model);
      if (boneH >= 0.2 && boneH <= 1.2) h = boneH;
    }
    return h;
  }

  function measureVisualHeight(model, entry) {
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
    model.updateMatrixWorld(true);
    const meshH = measureMeshHeightFromGround(model, entry);
    if (isFixedWorldAvatar(entry)) return meshH;
    const boneH = measureBoneWorldSpan(model);
    return Math.max(meshH, boneH);
  }

  /** 블록 펫(buildFullBodyPet3D) — 바닥~머리 targetHeight(m) 맞춤 */
  function fitBuiltinToHeight(wrapper, targetH) {
    const built = wrapper.getObjectByName('builtin_mesh');
    if (!built || !targetH) return;
    built.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(built);
    let h = Math.max(box.max.y - box.min.y, 0.001);
    if (h < 0.02) return;
    const s = targetH / h;
    built.scale.multiplyScalar(s);
    built.updateMatrixWorld(true);
    box.setFromObject(built);
    built.position.y -= box.min.y;
    built.updateMatrixWorld(true);
    wrapper.userData.lmBodyHeight = targetH;
    wrapper.userData.lmLookAtOffsetY = built.position.y + targetH * 0.42;
    console.info('[LMGlb] 펫(블록) 바닥→머리:', h.toFixed(2), 'm →', targetH.toFixed(2), 'm');
  }

  /** 아바타 키 — 바닥(발) ~ 머리 Y 거리 (T-포즈 bbox 높이와 별개) */
  function measureHeightFromGround(root, box, entry) {
    const groundY = resolveGroundY(root, box, entry);
    let h = Math.max(box.max.y - groundY, 0.001);
    if (h > 50) h *= 0.01;
    else if (h > 2.5 && h <= 50) h *= 0.01;
    return { height: h, groundY };
  }

  function computeModelHeight(root, entry) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    expandVisualBox(box, root);
    if (box.isEmpty()) box.setFromObject(root);
    const size = box.getSize(new THREE.Vector3());

    if (isFixedWorldAvatar(entry)) {
      const fg = measureHeightFromGround(root, box, entry);
      let h =
        entry && entry.meshyAnims
          ? computeMeshyFitHeight(root, entry)
          : measureMeshHeightFromGround(root, entry);
      if (h < 0.12) h = fg.height;
      if (entry.format === 'fbx' && h > 1.5) h *= 0.01;
      else if (h > 50) h *= 0.01;
      else if (h > 2.5 && h <= 50) h *= 0.01;
      h = THREE.MathUtils.clamp(h, 0.12, 3);
      return { box, size, height: h, groundY: fg.groundY };
    }

    let h = size.y;
    if (entry && entry.format === 'fbx') {
      if (h > 50) h *= 0.01;
      else if (h < 0.45) {
        const alt = Math.max(size.x, size.z);
        h = alt > 50 ? alt * 0.01 : alt;
      }
      h = THREE.MathUtils.clamp(h, 0.9, 2.4);
    } else {
      if (h > 20) h *= 0.01;
      h = Math.max(h, 0.001);
    }

    return { box, size, height: h };
  }

  function measureAppliedHeight(root, entry) {
    return measureVisualHeight(root, entry);
  }

  function fitModel(root, entry, heightCm) {
    const isGlb =
      (entry && entry.format === 'glb') ||
      (entry && entry.localUrl && /\.glb$/i.test(entry.localUrl));
    if (isGlb) noteGlbImportScales(root);
    if (entry && entry.meshyAnims) rebindMeshySkins(root);

    const measured = computeModelHeight(root, entry);
    const box = measured.box;
    let targetH = resolveAvatarTargetHeight(entry, heightCm);
    const fixed = isFixedWorldAvatar(entry);
    const minSy =
      entry && entry.meshyAnims ? 0.008 : fixed || (entry && entry.format === 'fbx') ? 0.02 : 0.5;
    const maxSy = entry && entry.meshyAnims ? 3 : fixed ? 3 : 2.5;
    const fitH = measured.height;
    let sy = THREE.MathUtils.clamp(targetH / Math.max(fitH, 0.12), minSy, maxSy);
    if (entry && entry.meshyAnims) sy *= meshyBboxBoneCollapseFactor(root);
    if (entry && entry.fitScaleAdjust) sy *= entry.fitScaleAdjust;
    const s = (entry.scale || 1) * sy;
    if (entry && entry.meshyAnims) {
      let rootS = applyMeshyRootScale(root, sy, entry);
      rootS = refineMeshyAvatarScale(root, entry, targetH);
      if (entry.format === 'glb' || fixed) {
        const arm = getMeshyArmature(root);
        const screenH = measureMeshyVertexScreenHeight(root, entry);
        const dispH =
          screenH >= 0.35 ? screenH : measureMeshyMeshScreenHeight(root, entry);
        console.info(
          '[LMGlb] 크기',
          entry.localUrl || '',
          '측정(m):',
          measured.height.toFixed(3),
          'Armature:',
          arm ? arm.scale.x.toFixed(4) : '-',
          '목표×:',
          rootS.toFixed(2),
          '화면:',
          dispH.toFixed(2) + 'm',
          '(키',
          targetH.toFixed(2) + 'm)'
        );
      }
    } else {
      root.scale.setScalar(s);
      if (entry && (entry.format === 'fbx' || fixed)) {
        console.info(
          '[LMGlb] 크기',
          entry.localUrl || '',
          '바닥→머리(m):',
          measured.height.toFixed(3),
          '→ 배율:',
          s.toFixed(3),
          '목표:',
          targetH.toFixed(2) + 'm'
        );
      }
    }
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    box.makeEmpty();
    expandVisualBox(box, root);
    if (box.isEmpty()) box.setFromObject(root);
    const groundY = resolveGroundY(root, box, entry);
    root.position.x = -(box.min.x + box.max.x) / 2;
    root.position.z = -(box.min.z + box.max.z) / 2;
    root.position.y = -groundY + (entry.yOffset || 0);

    const tuneH =
      entry &&
      entry.category &&
      entry.category.includes('avatar') &&
      entry.targetHeight &&
      entry.targetHeight < 1.5;
    if (tuneH) {
      let fh = fixed
        ? measureMeshHeightFromGround(root, entry)
        : measured.height * root.scale.x;
      if (fixed) {
        console.info(
          '[LMGlb] 적용 후 키(바닥→머리):',
          fh.toFixed(2),
          'm (목표',
          targetH.toFixed(2),
          'm)'
        );
      } else {
        root.updateMatrixWorld(true);
        const fb = new THREE.Box3();
        expandVisualBox(fb, root);
        if (fb.isEmpty()) fb.setFromObject(root);
        fh = fb.max.y - fb.min.y;
        if (fh > 50) fh *= 0.01;
        else if (fh > 2.5 && fh <= 50) fh *= 0.01;
        if (fh >= 0.12 && fh <= 2.5 && Math.abs(fh - targetH) / targetH > 0.12) {
          const mul = targetH / fh;
          if (mul >= 0.25 && mul <= 4) {
            root.scale.multiplyScalar(mul);
            root.updateMatrixWorld(true);
            const box2 = new THREE.Box3();
            expandVisualBox(box2, root);
            const gy2 = resolveGroundY(root, box2, entry);
            root.position.y = -gy2 + (entry.yOffset || 0);
            fh = box2.max.y - box2.min.y;
            if (fh > 50) fh *= 0.01;
          }
        }
        console.info('[LMGlb] 적용 후 키:', fh.toFixed(2), 'm (목표', targetH.toFixed(2), 'm)');
      }
    }

    if (fixed && !entry.meshyAnims) {
      const expectedH = measured.height * root.scale.x;
      let sh = measureMeshHeightFromGround(root, entry);
      if (sh < 0.15 && expectedH >= targetH * 0.55) sh = expectedH;
      if (sh < targetH * 0.82 || sh > targetH * 1.18) {
        const mul = targetH / Math.max(sh, 0.12);
        if (mul >= 0.55 && mul <= 1.45) {
          root.scale.multiplyScalar(mul);
        }
        root.updateMatrixWorld(true);
        const box3 = new THREE.Box3();
        expandVisualBox(box3, root);
        const gy3 = resolveGroundY(root, box3, entry);
        root.position.y = -gy3 + (entry.yOffset || 0);
      }
    }

    root.traverse((c) => {
      if (c.isMesh || c.isSkinnedMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
      }
    });
    ensureSkinnedMaterials(root);
  }

  /** 오픈월드 카메라용 — FBX bbox(172m 등) 대신 실제 키 사용 */
  function stampCameraHints(wrapper, model, entry, heightCm) {
    if (!wrapper || !model) return;
    const targetH = resolveAvatarTargetHeight(entry, heightCm);
    wrapper.userData.lmBodyHeight = targetH;
    wrapper.userData.lmLookAtOffsetY = model.position.y + targetH * 0.42;
  }

  function hasSkinnedMesh(root) {
    let ok = false;
    root.traverse((o) => {
      if (o.isSkinnedMesh) ok = true;
    });
    return ok;
  }

  function findAnimClip(clips, names, fallbackRe) {
    if (!clips || !clips.length) return null;
    const list = []
      .concat(names || [])
      .filter(Boolean)
      .map(String);
    for (const n of list) {
      const hit = clips.find(
        (c) => c.name === n || c.name.toLowerCase() === n.toLowerCase()
      );
      if (hit) return hit;
    }
    for (const n of list) {
      const sub = n.toLowerCase();
      const hit = clips.find((c) => c.name.toLowerCase().includes(sub));
      if (hit) return hit;
    }
    if (fallbackRe) {
      const hit = clips.find((c) => fallbackRe.test(c.name));
      if (hit) return hit;
    }
    return null;
  }

  function resolveClipByRole(clips, entry, role) {
    if (!clips || !clips.length || !entry || !entry.animClips) return null;
    const idx = entry.animClips[role];
    if (idx == null || idx < 0 || idx >= clips.length) return null;
    return clips[idx] || null;
  }

  const LM_ANIM_ONCE = {
    greet: 1,
    fall: 1,
    attack: 1,
    combo: 1,
    skill1: 1,
    skill2: 1,
    skill3: 1,
    arise: 1,
    dance: 1,
    cheer: 1,
    heart: 1,
    shine: 1
  };

  function isAnimOnceRole(role) {
    return !!LM_ANIM_ONCE[role];
  }

  function isCombatAnimRole(role) {
    return (
      role === 'attack' ||
      role === 'combo' ||
      role === 'skill1' ||
      role === 'skill2' ||
      role === 'skill3'
    );
  }

  /** 전투 원샷 모션 재생 중 — 연타 시 재시작하지 않음 */
  function isAvatarCombatAnimPlaying(wrapper) {
    if (!wrapper) return false;
    return (
      wrapper.userData._animOnceUntil &&
      performance.now() < wrapper.userData._animOnceUntil &&
      isCombatAnimRole(wrapper.userData.glbAnimMode)
    );
  }

  function pickPrimaryAnimClip(clips) {
    if (!clips || !clips.length) return null;
    for (let i = 0; i < clips.length; i++) {
      if (/baselayer/i.test(clips[i].name)) return clips[i];
    }
    let best = clips[0];
    for (let i = 1; i < clips.length; i++) {
      if (clips[i].duration > best.duration) best = clips[i];
    }
    return best;
  }

  function loadAnimClipsFromUrl(url, entry) {
    return loadGlbFromUrl(entry, url).then((res) => res.animations || []);
  }

  /** Meshy 모션 팩 — GLB마다 클립 1개씩 로드해 역할별 인덱스 구성 */
  function buildMeshyAnimPack(entry, baseAnimations) {
    const pack = entry.meshyAnims;
    if (!pack) {
      return Promise.resolve({
        animations: baseAnimations || [],
        animClips: entry.animClips || null
      });
    }
    const merged = [];
    const animClips = {};
    const baseUrl = (entry.localUrl || '').replace(/\\/g, '/');
    const roleOrder = [
      'idle',
      'alert',
      'walk',
      'run',
      'attack',
      'combo',
      'skill1',
      'skill2',
      'skill3',
      'fall',
      'greet',
      'arise',
      'sit',
      'sitMat',
      'dance',
      'cheer',
      'heart',
      'shine'
    ];

    function pushClip(role, raw) {
      if (!raw) return;
      const c = sanitizeAnimClip(raw.clone(), entry, role);
      c.name = 'lm_' + role;
      animClips[role] = merged.length;
      merged.push(c);
    }

    const tasks = roleOrder.map((role) => {
      const url = pack[role];
      if (!url) return Promise.resolve();
      const norm = url.replace(/\\/g, '/');
      if (norm === baseUrl && baseAnimations && baseAnimations.length) {
        pushClip(role, pickPrimaryAnimClip(baseAnimations));
        return Promise.resolve();
      }
      return loadAnimClipsFromUrl(norm, entry)
        .then((clips) => pushClip(role, pickPrimaryAnimClip(clips)))
        .catch((e) => console.warn('[LMGlb] Meshy 모션 로드 실패:', role, norm, e));
    });

    return Promise.all(tasks).then(() => {
      if (!animClips.walk && !animClips.alert) {
        console.warn('[LMGlb] Meshy 팩 — walk/alert 없음');
      }
      console.info('[LMGlb] Meshy 모션 팩:', Object.keys(animClips).join(', '));
      return { animations: merged, animClips };
    });
  }

  /** 오픈월드 빠른 표시 — idle/walk/alert만 먼저 */
  function buildMeshyAnimPackBootstrap(entry, baseAnimations) {
    const pack = entry.meshyAnims;
    if (!pack) {
      return Promise.resolve({
        animations: baseAnimations || [],
        animClips: entry.animClips || null
      });
    }
    const merged = [];
    const animClips = {};
    const baseUrl = (entry.localUrl || '').replace(/\\/g, '/');

    function pushClip(role, raw) {
      if (!raw) return;
      const c = sanitizeAnimClip(raw.clone(), entry, role);
      c.name = 'lm_' + role;
      animClips[role] = merged.length;
      merged.push(c);
    }

    if (baseAnimations && baseAnimations.length) {
      pushClip('walk', pickPrimaryAnimClip(baseAnimations));
    }

    const bootRoles = ['idle', 'alert', 'walk'];
    const tasks = bootRoles.map((role) => {
      const url = pack[role];
      if (!url) return Promise.resolve();
      if (animClips[role] != null) return Promise.resolve();
      const norm = url.replace(/\\/g, '/');
      if (norm === baseUrl && baseAnimations && baseAnimations.length) {
        pushClip(role, pickPrimaryAnimClip(baseAnimations));
        return Promise.resolve();
      }
      return loadAnimClipsFromUrl(norm, entry)
        .then((clips) => pushClip(role, pickPrimaryAnimClip(clips)))
        .catch(() => {});
    });

    return Promise.all(tasks).then(() => {
      if (animClips.walk != null && animClips.idle == null) animClips.idle = animClips.walk;
      if (animClips.alert == null && animClips.idle != null) animClips.alert = animClips.idle;
      if (!animClips.walk && !animClips.idle) {
        console.warn('[LMGlb] Meshy 부트스트랩 — walk/idle 없음');
      }
      return { animations: merged, animClips };
    });
  }

  function applyMeshyAnimPackUpgrade(wrapper, entry, built) {
    if (!wrapper || !built) return;
    entry = resolveAnimEntry(Object.assign({}, entry, { animClips: built.animClips }), wrapper);
    wrapper.userData._lmMeshyGltfClips = built.animations;
    wrapper.userData.lmAnimClips = built.animClips;
    wrapper.userData._lmMeshyGltfEntry = entry;
    if (wrapper.userData.glbMixer) {
      wrapper.userData.glbMixer.stopAllAction();
      wrapper.userData.glbMixer = null;
      wrapper.userData.glbActions = null;
      wrapper.userData.glbAnimMode = null;
    }
    const model = wrapper.getObjectByName('glb_model');
    if (model) {
      rebindMeshySkins(model);
      playMeshyIdlePose(wrapper, model, entry);
    }
  }

  function loadMeshyAnimPackFull(entry, baseAnimations, id) {
    if (meshyPackCache.has(id)) {
      return Promise.resolve(meshyPackCache.get(id));
    }
    if (meshyPackLoading.has(id)) return meshyPackLoading.get(id);
    const p = buildMeshyAnimPack(entry, baseAnimations).then((built) => {
      meshyPackCache.set(id, built);
      meshyPackLoading.delete(id);
      return built;
    });
    meshyPackLoading.set(id, p);
    return p;
  }

  function preloadOpenWorldAvatars(opts) {
    opts = opts || {};
    const ids = [];
    if (opts.avatarId && opts.avatarId !== 'builtin') ids.push(opts.avatarId);
    if (opts.petId && opts.petId !== 'builtin') ids.push(opts.petId);
    ids.forEach((id) => {
      loadEntry(id)
        .then((gltf) => {
          const entry = gltf.entry || entryById(id);
          if (!entry || !entry.meshyAnims) return;
          const baseAnims = gltf.animations || [];
          if (!meshyBootstrapCache.has(id)) {
            buildMeshyAnimPackBootstrap(entry, baseAnims)
              .then((boot) => {
                meshyBootstrapCache.set(id, boot);
              })
              .catch(() => {});
          }
          if (!meshyPackCache.has(id)) {
            loadMeshyAnimPackFull(entry, baseAnims, id).catch(() => {});
          }
        })
        .catch(() => {});
    });
  }

  function resolveAnimEntry(entry, wrapper) {
    if (!entry) return entry;
    if (wrapper && wrapper.userData.lmAnimClips) {
      return Object.assign({}, entry, {
        animClips: wrapper.userData.lmAnimClips,
        forceProceduralAnim: false,
        tPoseBind: false,
        idleUseBindPose: entry.idleUseBindPose !== false
      });
    }
    return entry;
  }

  function createGlbClipActions(model, clips, entry) {
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    const roles = Object.keys(entry.animClips);
    roles.forEach((role) => {
      const clip = resolveClipByRole(clips, entry, role);
      if (!clip) return;
      const sanitized = sanitizeAnimClip(clip, entry, role);
      const act = mixer.clipAction(sanitized);
      const once = isAnimOnceRole(role);
      act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
      act.clampWhenFinished = true;
      actions[role] = act;
    });
    return { mixer, actions };
  }

  /** Meshy — 로드 시 믹서 없음(대기 메쉬 유지), 이동·전투 시 lazy 생성 */
  function setupMeshyDeferredAnimations(wrapper, model, gltf, entry, clips) {
    entry = resolveAnimEntry(entry, wrapper);
    if (!entry || !entry.animClips || !clips.length) return false;

    wrapper.userData._lmMeshyGltfClips = clips;
    wrapper.userData._lmMeshyGltfEntry = entry;
    wrapper.userData.glbMixer = null;
    wrapper.userData.glbActions = null;
    wrapper.userData.glbMultiClip = true;
    wrapper.userData.glbUsesAnim = true;
    wrapper.userData.glbWalkOnly = false;
    wrapper.userData.glbIdleAction = null;
    wrapper.userData.glbWalkAction = null;
    wrapper.userData.glbRunAction = null;
    wrapper.userData.glbAnimMode = null;
    wrapper.userData._walkPlaying = false;
    wrapper.userData.legs = null;
    wrapper.userData.arms = null;

    const rig = cacheAvatarWalkBones(wrapper, model);
    wrapper.userData.avatarWalk = rig;
    wrapper.userData.tripoWalk = rig;
    wrapper.userData.lmTPoseBind = false;
    wrapper.userData.glbProceduralWalk = false;
    wrapper.userData.glbProceduralSit = entry.meshyProceduralSit !== false;

    rebindMeshySkins(model);
    playMeshyIdlePose(wrapper, model, entry);
    console.info('[LMGlb] Meshy 대기(믹서 지연):', entry.localUrl || entry.id);
    return true;
  }

  function ensureMeshyAnimMixer(wrapper, model) {
    if (!wrapper || !model) return false;
    if (wrapper.userData.glbMixer) return true;
    const clips = wrapper.userData._lmMeshyGltfClips;
    let entry = wrapper.userData._lmMeshyGltfEntry || entryById(wrapper.userData.glbId);
    entry = resolveAnimEntry(entry, wrapper);
    if (!clips || !clips.length || !entry || !entry.animClips) return false;

    const built = createGlbClipActions(model, clips, entry);
    if (!built.actions.walk && !built.actions.alert && !built.actions.idle) return false;

    wrapper.userData.glbMixer = built.mixer;
    wrapper.userData.glbActions = built.actions;
    wrapper.userData.glbWalkAction = built.actions.walk || null;
    wrapper.userData.glbRunAction = built.actions.run || null;
    wrapper.userData.glbIdleAction = built.actions.idle || null;
    console.info('[LMGlb] Meshy 믹서 시작:', Object.keys(built.actions).join(', '));
    return true;
  }

  function setupMultiClipAnimations(wrapper, model, gltf, entry) {
    entry = resolveAnimEntry(entry, wrapper);
    const clips = gltf.animations || [];
    if (!entry || !entry.animClips || !clips.length) return false;

    if (entry.meshyAnims) {
      return setupMeshyDeferredAnimations(wrapper, model, gltf, entry, clips);
    }

    const built = createGlbClipActions(model, clips, entry);
    const actions = built.actions;
    if (!actions.walk && !actions.alert && !actions.idle) return false;

    wrapper.userData.glbMixer = built.mixer;
    wrapper.userData.glbActions = actions;
    wrapper.userData.glbMultiClip = true;
    wrapper.userData.glbUsesAnim = true;
    wrapper.userData.glbWalkOnly = false;
    wrapper.userData.glbIdleAction = actions.idle || null;
    wrapper.userData.glbWalkAction = actions.walk || null;
    wrapper.userData.glbRunAction = actions.run || null;
    wrapper.userData.glbAnimMode = null;
    wrapper.userData._walkPlaying = false;
    wrapper.userData.legs = null;
    wrapper.userData.arms = null;

    captureSkeletonBindPose(model, true);
    wrapper.userData.glbProceduralWalk = false;
    const procSit = !!(entry.meshyProceduralSit || actions.sit);
    wrapper.userData.glbProceduralSit = procSit || !!actions.sit;
    if (entry.idleUseBindPose !== false) enterBindIdlePose(wrapper, model, entry);
    else if (actions.idle) playAvatarAnim(wrapper, 'idle', { force: true });
    else if (actions.alert) playAvatarAnim(wrapper, 'alert', { force: true });
    console.info('[LMGlb] 멀티 애니:', entry.localUrl || entry.id, Object.keys(actions).join(', '));
    return true;
  }

  const _tripoSwingAxis = new THREE.Vector3(1, 0, 0);
  const _tripoDeltaQ = new THREE.Quaternion();

  function isAvatarTorsoBoneName(nl) {
    return (
      /^(root|pelvis|waist|hip|hips|spine|spine01|spine02|spine1|spine2|neck|head|armature)$/.test(
        nl
      ) ||
      /necktwist|cc_base_spine|cc_base_waist|cc_base_hip|cc_base_neck|cc_base_head/.test(nl) ||
      /mixamorig(spine|hips|neck|head)/.test(nl)
    );
  }

  function disposeGlbAnimState(wrapper) {
    if (!wrapper) return;
    if (wrapper.userData.glbMixer) {
      try {
        wrapper.userData.glbMixer.stopAllAction();
      } catch (e) { /* ignore */ }
    }
    wrapper.userData.glbMixer = null;
    wrapper.userData.glbActions = null;
    wrapper.userData.glbMultiClip = false;
    wrapper.userData.glbWalkOnly = false;
    wrapper.userData._walkPlaying = false;
  }

  function lockAvatarTorsoBones(model) {
    if (!model) return;
    model.traverse((o) => {
      if (!o.isBone) return;
      const nl = o.name.toLowerCase();
      if (!isAvatarTorsoBoneName(nl)) return;
      const q = getBoneLocoQuat(o);
      if (q) o.quaternion.copy(q);
      if (o.userData._lmRestPos) o.position.copy(o.userData._lmRestPos);
    });
  }

  const lockTripoTorsoBones = lockAvatarTorsoBones;

  /** Tripo / CC_Base / Mixamo 등 본 이름 자동 매칭 */
  function boneMatchesRole(nl, role) {
    const rules = {
      L_thigh: [
        /^l_thigh$/,
        /^cc_base_l_thigh$/,
        /mixamorigleftupleg/,
        /^leftupleg$/,
        /left_thigh/,
        /thigh\.l$/,
        /\.l\.thigh/
      ],
      R_thigh: [
        /^r_thigh$/,
        /^cc_base_r_thigh$/,
        /mixamorigrightupleg/,
        /^rightupleg$/,
        /right_thigh/,
        /thigh\.r$/
      ],
      L_calf: [
        /^l_calf$/,
        /^cc_base_l_calf$/,
        /mixamorigleftleg/,
        /^leftleg$/,
        /left_calf/,
        /shin\.l/
      ],
      R_calf: [
        /^r_calf$/,
        /^cc_base_r_calf$/,
        /mixamorigrightleg/,
        /^rightleg$/,
        /right_calf/,
        /shin\.r/
      ],
      L_upper: [
        /^l_upperarm$/,
        /^cc_base_l_upperarm$/,
        /mixamorigleftarm$/,
        /^leftarm$/,
        /left_upperarm/,
        /upperarm\.l/
      ],
      R_upper: [
        /^r_upperarm$/,
        /^cc_base_r_upperarm$/,
        /mixamorigrightarm$/,
        /^rightarm$/,
        /right_upperarm/,
        /upperarm\.r/
      ],
      L_fore: [
        /^l_forearm$/,
        /^cc_base_l_forearm$/,
        /mixamorigleftforearm/,
        /^leftforearm$/,
        /left_forearm/
      ],
      R_fore: [
        /^r_forearm$/,
        /^cc_base_r_forearm$/,
        /mixamorigrightforearm/,
        /^rightforearm$/,
        /right_forearm/
      ],
      R_hand: [
        /^r_hand$/,
        /^cc_base_r_hand$/,
        /mixamorigrighthand/,
        /^righthand$/,
        /right_hand/,
        /hand_r/,
        /hand\.r/,
        /\.r\.hand/,
        /wrist\.r/,
        /rightwrist/
      ],
      L_hand: [
        /^l_hand$/,
        /^cc_base_l_hand$/,
        /mixamoriglefthand/,
        /^lefthand$/,
        /left_hand/,
        /hand_l/,
        /hand\.l/,
        /\.l\.hand/,
        /wrist\.l/,
        /leftwrist/
      ]
    };
    const list = rules[role];
    if (!list) return false;
    return list.some((re) => re.test(nl));
  }

  function cacheAvatarWalkBones(wrapper, model) {
    const pick = { legs: {}, arms: {} };
    const found = { legs: {}, arms: {} };
    model.traverse((o) => {
      if (!o.isBone) return;
      const nl = o.name.toLowerCase();
      const roles = [
        ['legs', 'L_thigh'],
        ['legs', 'R_thigh'],
        ['legs', 'L_calf'],
        ['legs', 'R_calf'],
        ['arms', 'L_upper'],
        ['arms', 'R_upper'],
        ['arms', 'L_fore'],
        ['arms', 'R_fore']
      ];
      roles.forEach(([grp, key]) => {
        if (!boneMatchesRole(nl, key)) return;
        if (!found[grp][key]) {
          found[grp][key] = o;
          pick[grp][key] = o;
        }
      });
      const exact = {
        L_Thigh: ['legs', 'L_thigh'],
        R_Thigh: ['legs', 'R_thigh'],
        L_Calf: ['legs', 'L_calf'],
        R_Calf: ['legs', 'R_calf'],
        L_Upperarm: ['arms', 'L_upper'],
        R_Upperarm: ['arms', 'R_upper'],
        L_Forearm: ['arms', 'L_fore'],
        R_Forearm: ['arms', 'R_fore']
      };
      const slot = exact[o.name];
      if (slot) pick[slot[0]][slot[1]] = o;
    });
    wrapper.userData.avatarWalk = pick;
    wrapper.userData.tripoWalk = pick;
    const nLeg = Object.keys(pick.legs).length;
    const nArm = Object.keys(pick.arms).length;
    if (nLeg + nArm > 0) {
      console.info('[LMGlb] 프로시저럴 본:', entryById(wrapper.userData.glbId)?.localUrl || '', '다리', nLeg, '팔', nArm);
    }
    return pick;
  }

  const cacheTripoWalkBones = cacheAvatarWalkBones;

  function avatarRigUsable(rig) {
    if (!rig) return false;
    return !!(rig.legs.L_thigh && rig.legs.R_thigh);
  }

  function setupProceduralAvatarAnimations(wrapper, model, entry) {
    captureSkeletonBindPose(model, true);
    const rig = cacheAvatarWalkBones(wrapper, model);
    if (!avatarRigUsable(rig)) return false;

    initAvatarTPoseLocomotion(wrapper, model, entry, rig);

    const mixer = new THREE.AnimationMixer(model);
    wrapper.userData.glbMixer = mixer;
    wrapper.userData.glbActions = {};
    wrapper.userData.glbMultiClip = true;
    wrapper.userData.glbUsesAnim = true;
    wrapper.userData.glbWalkOnly = false;
    wrapper.userData.glbProceduralWalk = true;
    wrapper.userData.glbProceduralSit = true;
    wrapper.userData.glbIdleAction = null;
    wrapper.userData.glbWalkAction = null;
    wrapper.userData.glbRunAction = null;
    wrapper.userData.glbAnimMode = null;
    wrapper.userData._walkPlaying = false;
    wrapper.userData.legs = null;
    wrapper.userData.arms = null;
    enterBindIdlePose(wrapper, model, entry);
    console.info('[LMGlb] 프로시저럴 locomotion:', entry.localUrl || entry.id);
    return true;
  }

  /** Meshy/Mixamo — 차·탈것 앉기 (허벅지 앞·종아리 아래) */
  function applyMeshySitPose(root) {
    const model = root.getObjectByName('glb_model');
    const rig = root.userData.avatarWalk || root.userData.tripoWalk;
    if (!model || !rig) return false;
    if (model.userData._lmMeshyLocoReady) restoreLocomotionBasePose(model);
    else ensureMeshyRelaxedIdleBase(root, model, entryById(root.userData.glbId));
    lockAvatarTorsoBones(model);
    const thigh = -1.1;
    const calf = 0.9;
    const arm = -0.5;
    const fore = -0.2;
    swingTripoBone(rig.legs.L_thigh, thigh);
    swingTripoBone(rig.legs.R_thigh, thigh);
    swingTripoBone(rig.legs.L_calf, calf);
    swingTripoBone(rig.legs.R_calf, calf);
    swingTripoBone(rig.arms.L_upper, arm);
    swingTripoBone(rig.arms.R_upper, arm);
    swingTripoBone(rig.arms.L_fore, fore);
    swingTripoBone(rig.arms.R_fore, fore);
    rebindMeshySkins(model);
    return true;
  }

  function applyProceduralSitPose(root) {
    const entry = entryById(root.userData.glbId);
    if (entry && entry.meshyAnims) return applyMeshySitPose(root);
    const model = root.getObjectByName('glb_model');
    const rig = root.userData.avatarWalk || root.userData.tripoWalk;
    if (!model || !rig) return false;
    restoreLocomotionBasePose(model);
    lockAvatarTorsoBones(model);
    const tPose = !!root.userData.lmTPoseBind;
    const thigh = 1.18;
    const calf = -1.02;
    const arm = tPose ? -0.22 : -0.42;
    const fore = tPose ? -0.42 : -0.18;
    swingTripoBone(rig.legs.L_thigh, thigh);
    swingTripoBone(rig.legs.R_thigh, thigh);
    swingTripoBone(rig.legs.L_calf, calf);
    swingTripoBone(rig.legs.R_calf, calf);
    swingTripoBone(rig.arms.L_upper, arm);
    swingTripoBone(rig.arms.R_upper, arm);
    swingTripoBone(rig.arms.L_fore, fore);
    swingTripoBone(rig.arms.R_fore, fore);
    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
    return true;
  }

  function swingTripoBone(bone, angle) {
    const base = getBoneLocoQuat(bone);
    if (!bone || !base) return;
    bone.quaternion.copy(base);
    if (!angle) return;
    _tripoDeltaQ.setFromAxisAngle(_tripoSwingAxis, angle);
    bone.quaternion.multiply(_tripoDeltaQ);
  }

  /** GLB 걷기 클립 대신 — 상체 고정, 팔·다리만 앞뒤 스윙 (Tripo 스켈레톤) */
  function updateTripoProceduralWalk(root, moving, phase, walkOpts) {
    const model = root.getObjectByName('glb_model');
    const rig = root.userData.tripoWalk;
    if (!model || !rig) return;

    lockAvatarTorsoBones(model);

    if (!moving) {
      restoreLocomotionBasePose(model);
      lockAvatarTorsoBones(model);
      model.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
      });
      return;
    }

    restoreLocomotionBasePose(model);
    lockAvatarTorsoBones(model);

    walkOpts = walkOpts || {};
    const thighAmp = walkOpts.thighAmp != null ? walkOpts.thighAmp : 0.34;
    const calfAmp = walkOpts.calfAmp != null ? walkOpts.calfAmp : 0.26;
    const armAmp = walkOpts.armAmp != null ? walkOpts.armAmp : 0.28;
    const foreAmp = walkOpts.foreAmp != null ? walkOpts.foreAmp : 0.14;

    const sL = Math.sin(phase);
    const sR = Math.sin(phase + Math.PI);

    swingTripoBone(rig.legs.L_thigh, sL * thighAmp);
    swingTripoBone(rig.legs.R_thigh, sR * thighAmp);
    swingTripoBone(rig.legs.L_calf, Math.max(0, sL) * calfAmp);
    swingTripoBone(rig.legs.R_calf, Math.max(0, sR) * calfAmp);
    swingTripoBone(rig.arms.L_upper, -sL * armAmp);
    swingTripoBone(rig.arms.R_upper, -sR * armAmp);
    swingTripoBone(rig.arms.L_fore, Math.max(0, -sL) * foreAmp);
    swingTripoBone(rig.arms.R_fore, Math.max(0, -sR) * foreAmp);

    model.traverse((o) => {
      if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
    });
  }

  /** 정지 = GLB 기본 포즈(외모 미리보기와 동일), 걷기/달리기만 클립 재생 */
  function enterBindIdlePose(wrapper, model, entry) {
    const mixer = wrapper.userData.glbMixer;
    if (mixer) mixer.stopAllAction();
    if (model) {
      if (wrapper.userData.lmTPoseBind) {
        restoreLocomotionBasePose(model);
        lockAvatarTorsoBones(model);
      } else if (entry && entry.idleUseBindPose !== false) {
        if (entry.meshyAnims) playMeshyIdlePose(wrapper, model, entry);
        else {
          model.traverse((o) => {
            if (o.isSkinnedMesh && o.skeleton) {
              o.skeleton.pose();
              o.skeleton.update();
            }
          });
        }
        if (!entry.meshyAnims) lockAvatarTorsoBones(model);
      } else {
        applyRelaxedStandPose(model);
      }
    }
    wrapper.userData.glbAnimMode = 'idle';
    wrapper.userData._walkPlaying = false;
    wrapper.userData._animOnceUntil = 0;
  }

  function playAvatarAnim(wrapper, mode, opts) {
    opts = opts || {};
    const model = wrapper.getObjectByName('glb_model');
    if (wrapper.userData._lmMeshyGltfClips && model) ensureMeshyAnimMixer(wrapper, model);
    const mixer = wrapper.userData.glbMixer;
    const actions = wrapper.userData.glbActions;
    if (!mixer) return false;
    let role = mode;

    if (wrapper.userData.glbProceduralWalk && (role === 'walk' || role === 'run')) {
      if (!opts.force && wrapper.userData.glbAnimMode === role) return true;
      const model = wrapper.getObjectByName('glb_model');
      if (actions) {
        Object.keys(actions).forEach((key) => {
          actions[key].stop();
          actions[key].setEffectiveWeight(0);
        });
      }
      mixer.stopAllAction();
      if (model) {
        if (wrapper.userData.lmTPoseBind) restoreLocomotionBasePose(model);
        else {
          model.traverse((o) => {
            if (o.isSkinnedMesh && o.skeleton) {
              o.skeleton.pose();
              o.skeleton.update();
            }
          });
        }
        lockAvatarTorsoBones(model);
      }
      wrapper.userData.glbAnimMode = role;
      wrapper.userData._walkPlaying = true;
      wrapper.userData._animOnceUntil = 0;
      return true;
    }

    if (
      (role === 'sit' || role === 'fall') &&
      wrapper.userData.glbProceduralSit &&
      (!actions || !actions[role]) &&
      (wrapper.userData.avatarWalk || wrapper.userData.tripoWalk)
    ) {
      const model = wrapper.getObjectByName('glb_model');
      if (model) {
        if (mixer) mixer.stopAllAction();
        const ent = entryById(wrapper.userData.glbId);
        if (ent && ent.meshyAnims) rebindMeshySkins(model);
        else {
          model.traverse((o) => {
            if (o.isSkinnedMesh && o.skeleton) {
              o.skeleton.pose();
              o.skeleton.update();
            }
          });
        }
        applyProceduralSitPose(wrapper);
        wrapper.userData.glbAnimMode = role;
        wrapper.userData._walkPlaying = false;
        wrapper.userData._animOnceUntil = 0;
        return true;
      }
    }

    if (!actions) return false;
    if (!actions[role]) {
      if (role === 'run' && actions.walk) role = 'walk';
      else if (role === 'skill2' && actions.run) role = 'run';
      else if (role === 'fall' && actions.sit) role = 'sit';
      else if (role === 'fall' && actions.idle) role = 'idle';
      else if (role === 'attack' && actions.combo) role = 'combo';
      else return false;
    }
    if (!opts.force && wrapper.userData.glbAnimMode === role) return true;

    const fade = opts.fade != null ? opts.fade : 0.15;
    const act = actions[role];

    Object.keys(actions).forEach((key) => {
      const a = actions[key];
      if (key === role) return;
      a.stop();
      a.setEffectiveWeight(0);
    });

    act.reset();
    act.setEffectiveWeight(1);
    const once = isAnimOnceRole(role);
    act.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    act.clampWhenFinished = true;
    if (role === 'run' || role === 'skill2') act.timeScale = 1.2;
    else if (role === 'walk') act.timeScale = 1;
    else if (role === 'attack' || role === 'combo') act.timeScale = 1.05;
    if (fade > 0 && opts.force !== true && wrapper.userData.glbAnimMode) {
      act.fadeIn(fade);
    }
    act.play();

    if (once) {
      const dur = (act.getClip() && act.getClip().duration) || 1;
      wrapper.userData._animOnceUntil = performance.now() + dur * 1000 + 80;
      let ret = opts.returnMode;
      if (!ret) {
        if (role === 'fall') ret = 'idle';
        else if (role === 'arise') ret = 'idle';
        else ret = wrapper.userData._lmCombatStance ? 'alert' : 'idle';
      }
      wrapper.userData._animOnceReturn = ret;
    } else {
      wrapper.userData._animOnceUntil = 0;
    }

    wrapper.userData.glbAnimMode = role;
    wrapper.userData._walkPlaying = role === 'walk' || role === 'run';
    return true;
  }

  function pickLocomotionAnimRole(wrapper, entry, moving, state) {
    entry = resolveAnimEntry(entry, wrapper);
    if (state.defeated) {
      if (entry.animClips && entry.animClips.fall != null) return 'fall';
      if (entry.animClips && entry.animClips.sit != null) return 'sit';
      return 'idle';
    }
    if (state.inCar || state.riding) {
      if (entry.animClips && entry.animClips.sit != null) return 'sit';
    }
    if (state.onMat || (state.sitting && !state.inCar && !state.riding)) {
      if (entry.animClips && entry.animClips.sitMat != null) return 'sitMat';
    }
    if (state.sitting || state.inCar || state.riding) return 'sit';
    if (!moving && state.combat && entry.animClips && entry.animClips.alert != null) return 'alert';
    if (!moving) {
      if (entry.animClips && entry.animClips.idle != null) return 'idle';
      if (entry.meshyAnims) return 'idle';
      if (entry.idleUseBindPose !== false) return 'idle';
      return entry.animClips && entry.animClips.alert != null ? 'alert' : 'idle';
    }
    const runThr = (entry && entry.runSpeedMult) || 1.65;
    const mult = state.speedMult != null ? state.speedMult : 1;
    if (entry.animClips && entry.animClips.run != null && mult >= runThr) return 'run';
    return 'walk';
  }

  function updateMultiClipLocomotion(root, moving, dt, state) {
    const model = root.getObjectByName('glb_model');
    let entry = entryById(root.userData.glbId);
    entry = resolveAnimEntry(entry, root);
    if (!model || !entry) return;

    root.userData._lmCombatStance = !!state.combat;

    const roleEarly = pickLocomotionAnimRole(root, entry, moving, state);
    const meshyIdleOnly =
      entry.meshyAnims &&
      !moving &&
      !state.combat &&
      !state.defeated &&
      roleEarly === 'idle' &&
      !(root.userData._animOnceUntil && performance.now() < root.userData._animOnceUntil);

    if (
      entry.meshyAnims &&
      root.userData._lmEmoteDanceUntil &&
      performance.now() < root.userData._lmEmoteDanceUntil
    ) {
      ensureMeshyAnimMixer(root, model);
      const dm = root.userData.glbMixer;
      if (dm) {
        if (root.userData.glbAnimMode !== 'dance') {
          playAvatarAnim(root, 'dance', { force: true, returnMode: 'idle' });
        }
        dm.update(dt);
      }
      lockModelTransform(root, model);
      return;
    }

    if (meshyIdleOnly) {
      ensureMeshyAnimMixer(root, model);
      const mixer = root.userData.glbMixer;
      const actions = root.userData.glbActions;
      const idleRole = actions && actions.idle ? 'idle' : actions && actions.alert ? 'alert' : null;
      if (mixer && idleRole) {
        if (root.userData.glbAnimMode !== idleRole) playMeshyIdleAnimPose(root, model, entry);
        mixer.update(dt);
      } else if (root.userData.glbAnimMode !== 'idle') {
        playMeshyIdlePose(root, model, entry);
      }
      root.userData._lmMountSitYOffset = 0;
      lockModelTransform(root, model);
      return;
    }

    if (entry.meshyAnims) ensureMeshyAnimMixer(root, model);
    const mixer = root.userData.glbMixer;
    if (!mixer) return;

    if (root.userData._animOnceUntil && performance.now() < root.userData._animOnceUntil) {
      mixer.update(dt);
      lockModelTransform(root, model);
      return;
    }

    if (root.userData._animOnceUntil && performance.now() >= root.userData._animOnceUntil) {
      root.userData._animOnceUntil = 0;
      const ret = root.userData._animOnceReturn || 'idle';
      if (ret === 'idle' && entry.meshyAnims) playMeshyIdlePose(root, model, entry);
      else if (ret === 'idle' && entry.idleUseBindPose !== false) enterBindIdlePose(root, model, entry);
      else playAvatarAnim(root, ret, { force: true });
    }

    if (root.userData._lmEmoteGreetUntil && performance.now() < root.userData._lmEmoteGreetUntil) {
      if (root.userData.glbAnimMode !== 'greet') playAvatarAnim(root, 'greet', { force: true });
      mixer.update(dt);
      lockModelTransform(root, model);
      return;
    }

    if (state.defeated) {
      const fallRole =
        entry.animClips && entry.animClips.fall != null
          ? 'fall'
          : root.userData.glbProceduralSit || (entry.animClips && entry.animClips.sit != null)
            ? 'sit'
            : 'idle';
      if (root.userData.glbAnimMode !== fallRole) playAvatarAnim(root, fallRole, { force: true });
      if (fallRole !== 'sit' || (root.userData.glbActions && root.userData.glbActions.sit)) {
        mixer.update(dt);
      }
      lockModelTransform(root, model);
      return;
    }

    const role = pickLocomotionAnimRole(root, entry, moving, state);
    if (role === 'sit' || role === 'sitMat') {
      if (state.riding) {
        const drop =
          global.LMOwGlb && typeof global.LMOwGlb.resolveMountSitYOffset === 'function'
            ? global.LMOwGlb.resolveMountSitYOffset(root)
            : -0.64;
        root.userData._lmMountSitYOffset = drop;
      }
      else if (state.inCar) root.userData._lmMountSitYOffset = -0.12;
      else root.userData._lmMountSitYOffset = 0;
      const entrySitProc =
        entry.meshyProceduralSit ||
        (entry.meshyAnims && !entry.animClips?.sit && !entry.animClips?.sitMat);
      const hasSitClip =
        root.userData.glbActions &&
        root.userData.glbActions[role] &&
        !entrySitProc;
      if (!hasSitClip && root.userData.glbProceduralSit) {
        if (root.userData.glbAnimMode !== role) playAvatarAnim(root, role, { force: true });
        lockModelTransform(root, model);
        return;
      }
      if (root.userData.glbAnimMode !== role) {
        playAvatarAnim(root, role, { force: true });
        if (role === 'sitMat') settleSitMatClipPose(root, role);
        mixer.update(0);
      }
      mixer.update(dt);
      if (role === 'sitMat' && state.onMat && !root.userData._lmSitMatAligned) {
        const surfaceY = state.matSurfaceY != null ? state.matSurfaceY : 0.04;
        alignMeshySitMatToGround(root, model, entry, surfaceY);
        root.userData._lmSitMatAligned = true;
      }
      lockModelTransform(root, model);
    } else if (role === 'idle' && entry.meshyAnims) {
      root.userData._lmMountSitYOffset = 0;
      root.userData._lmSitMatAligned = false;
      const idleRole =
        root.userData.glbActions && root.userData.glbActions.idle
          ? 'idle'
          : root.userData.glbActions && root.userData.glbActions.alert
            ? 'alert'
            : null;
      if (idleRole && root.userData.glbAnimMode !== idleRole) {
        playMeshyIdleAnimPose(root, model, entry);
      } else if (!idleRole && root.userData.glbAnimMode !== 'idle') {
        playMeshyIdlePose(root, model, entry);
      }
      if (root.userData.glbMixer) root.userData.glbMixer.update(dt);
      lockModelTransform(root, model);
    } else if (role === 'idle' && entry.idleUseBindPose !== false && !entry.meshyAnims) {
      root.userData._lmMountSitYOffset = 0;
      if (root.userData.glbAnimMode !== 'idle') enterBindIdlePose(root, model, entry);
    } else if (
      (role === 'walk' || role === 'run') &&
      root.userData.glbProceduralWalk
    ) {
      playAvatarAnim(root, role, { force: false });
      const phase = (root.userData.walkPhase || 0) * (role === 'run' ? 1.35 : 1);
      updateTripoProceduralWalk(root, true, phase, {
        thighAmp: role === 'run' ? 0.36 : 0.3,
        calfAmp: role === 'run' ? 0.26 : 0.22,
        armAmp: role === 'run' ? 0.28 : 0.24
      });
    } else {
      if (root.userData._lmSitMatAligned) {
        restoreMeshyStandBaseY(root, model);
        root.userData._lmSitMatAligned = false;
      }
      playAvatarAnim(root, role, { force: false });
      mixer.update(dt);
    }

    if (role === 'walk' || role === 'run') saveAvatarWalkScale(root, model);
    const skipHeightSync =
      state.onMat ||
      role === 'sitMat' ||
      role === 'sit' ||
      state.sitting ||
      state.inCar ||
      state.riding;
    if (!root.userData._lmHeightSynced && !skipHeightSync) {
      maintainAvatarDisplayHeight(root, model, entry);
      root.userData._lmHeightSynced = true;
    }
    resetTripoModelOrientation(model, resolveModelYaw(entry, root));
    lockModelTransform(root, model);
  }

  function triggerAvatarGreet(wrapper) {
    if (!wrapper || !wrapper.userData.glbMultiClip) return;
    if (!wrapper.userData.glbActions || !wrapper.userData.glbActions.greet) return;
    wrapper.userData._lmEmoteGreetUntil = performance.now() + 2200;
    playAvatarAnim(wrapper, 'greet', { force: true, returnMode: 'idle' });
  }

  function triggerAvatarDance(wrapper) {
    return triggerAvatarEmote(wrapper, 'dance');
  }

  function triggerAvatarEmote(wrapper, role) {
    if (!wrapper || !wrapper.userData.glbMultiClip) return false;
    const model = wrapper.getObjectByName('glb_model');
    if (wrapper.userData._lmMeshyGltfClips && model) ensureMeshyAnimMixer(wrapper, model);
    const actions = wrapper.userData.glbActions;
    if (!actions || !actions[role]) return false;
    wrapper.userData._lmEmoteGreetUntil = 0;
    wrapper.userData._lmEmoteDanceUntil = 0;
    return playAvatarAnim(wrapper, role, { force: true, returnMode: 'idle' });
  }

  function setAvatarCombatDefeat(wrapper, active) {
    if (!wrapper) return;
    wrapper.userData._lmDefeated = !!active;
    if (!active) {
      wrapper.userData._animOnceUntil = 0;
      if (wrapper.userData.glbActions && wrapper.userData.glbActions.arise) {
        triggerAvatarCombatAnim(wrapper, 'arise', { returnMode: 'idle' });
      }
    }
  }

  function triggerAvatarCombatAnim(wrapper, role, opts) {
    opts = opts || {};
    const model = wrapper && wrapper.getObjectByName('glb_model');
    if (wrapper && wrapper.userData._lmMeshyGltfClips && model) ensureMeshyAnimMixer(wrapper, model);
    if (!wrapper || !wrapper.userData.glbMixer) return false;
    if (!wrapper.userData.glbMultiClip && !wrapper.userData.glbActions) return false;
    if (isAvatarCombatAnimPlaying(wrapper)) return false;
    const entry = resolveAnimEntry(entryById(wrapper.userData.glbId), wrapper);
    if (!entry || !entry.animClips) return false;
    let r = role;
    if (!wrapper.userData.glbActions || !wrapper.userData.glbActions[r]) {
      if (r === 'skill2' && wrapper.userData.glbActions.skill1) r = 'skill1';
      else if (wrapper.userData.glbActions.attack) r = 'attack';
      else return false;
    }
    const ret =
      opts.returnMode ||
      (wrapper.userData._lmCombatStance && entry.animClips.alert != null ? 'alert' : 'idle');
    return playAvatarAnim(wrapper, r, {
      force: true,
      fade: opts.fade != null ? opts.fade : 0.1,
      returnMode: ret
    });
  }

  function setupAnimations(wrapper, model, gltf, entry) {
    wrapper.userData.glbStatic = false;
    wrapper.userData.glbUsesAnim = false;
    wrapper.userData.glbMixer = null;
    wrapper.userData.glbBaseY = null;

    entry = resolveAnimEntry(entry, wrapper);
    const clips = gltf.animations || [];
    const skinned = hasSkinnedMesh(model);

    if (entry && entry.meshyAnims && clips.length && setupMultiClipAnimations(wrapper, model, gltf, entry)) {
      return;
    }

    if (entry && entry.forceProceduralAnim && skinned) {
      if (setupProceduralAvatarAnimations(wrapper, model, entry)) return;
    }

    if (!clips.length) {
      if (skinned && setupProceduralAvatarAnimations(wrapper, model, entry)) return;
      wrapper.userData.glbStatic = true;
      wrapper.userData.glbMeshLocomotion = true;
      if (skinned) {
        console.warn(
          '[LMGlb] ' +
            (entry.localUrl || '') +
            ' — 스켈레톤은 있으나 인식 가능한 다리 본이 없습니다. (몸 흔들림만 적용)'
        );
      } else {
        console.info('[LMGlb] 정적 메쉬 — 프로시저럴 흔들림·앉기 연출:', entry.localUrl || '');
      }
      return;
    }

    console.info(
      '[LMGlb] 애니메이션:',
      clips.map((c) => c.name).join(', ')
    );

    if (setupMultiClipAnimations(wrapper, model, gltf, entry)) return;

    if (entry && entry.forceProceduralAnim && skinned && setupProceduralAvatarAnimations(wrapper, model, entry)) {
      return;
    }

    const isFbx = entry && entry.format === 'fbx';
    let walkClip = findAnimClip(
      clips,
      entry && entry.animWalk,
      /walk|walking|jog|run|move|man_walk|animation/i
    );
    if (!walkClip) {
      walkClip = findAnimClip(clips, entry && entry.animWalk, /mixamo/i);
    }
    if (!walkClip && entry && entry.animWalkSingle && clips.length >= 1) {
      const named = clips.find((c) => /^animation$/i.test(c.name));
      walkClip = named || clips[0];
    }

    let idleClip = findAnimClip(
      clips,
      entry && entry.animIdle,
      /idle|stand|rest|breath|take/i
    );
    if (idleClip && walkClip && idleClip === walkClip) idleClip = null;
    if (!idleClip && !walkClip && clips.length) idleClip = clips[0];

    if (isFbx && skinned && !walkClip) {
      wrapper.userData.glbStatic = true;
      wrapper.userData.glbFbxSway = true;
      wrapper.userData.legs = null;
      wrapper.userData.arms = null;
      cacheFbxWalkBones(wrapper, model);
      console.info(
        '[LMGlb] FBX — Walk 클립 없음. 이동 시 팔·다리 흔들림 걷기 연출 (Mixamo Walk 넣으면 본 애니)'
      );
      return;
    }

    const mixer = new THREE.AnimationMixer(model);

    if (walkClip && !idleClip) {
      walkClip = sanitizeAnimClip(walkClip, entry);
      const walkAction = mixer.clipAction(walkClip);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.clampWhenFinished = true;
      wrapper.userData.glbIdleHoldTime =
        entry && entry.idleHoldTime != null ? entry.idleHoldTime : 0;
      wrapper.userData.glbMixer = mixer;
      wrapper.userData.glbWalkOnly = true;
      wrapper.userData._walkPlaying = false;
      wrapper.userData.glbIdleAction = null;
      wrapper.userData.glbWalkAction = walkAction;
      wrapper.userData.glbUsesAnim = true;
      wrapper.userData.legs = null;
      wrapper.userData.arms = null;
      if (!usesBindIdlePose(entry)) cacheBoneRestPose(model);
      enterStandPose(wrapper, model, mixer, walkAction, entry);
      console.info(
        '[LMGlb] 걷기 전용 — 정지:',
        usesBindIdlePose(entry) ? 'GLB 바인드 포즈' : '팔 내림 서기',
        walkClip.name
      );
      return;
    }

    if (!idleClip) return;

    const idleAction = mixer.clipAction(idleClip);
    idleAction.setLoop(THREE.LoopRepeat, Infinity);
    idleAction.reset();
    idleAction.play();

    let walkAction = null;
    if (walkClip && walkClip !== idleClip) {
      walkClip = sanitizeAnimClip(walkClip, entry);
      walkAction = mixer.clipAction(walkClip);
      walkAction.setLoop(THREE.LoopRepeat, Infinity);
      walkAction.setEffectiveTimeScale(1);
    }
    if (idleClip) idleClip = sanitizeAnimClip(idleClip, entry);

    mixer.update(1 / 60);

    wrapper.userData.glbMixer = mixer;
    wrapper.userData.glbWalkOnly = false;
    wrapper.userData._walkPlaying = false;
    wrapper.userData.glbIdleAction = idleAction;
    wrapper.userData.glbWalkAction = walkAction;
    wrapper.userData.glbUsesAnim = true;
    wrapper.userData.legs = null;
    wrapper.userData.arms = null;
  }

  function cacheKey(id) {
    const entry = entryById(id);
    if (!entry) return id;
    return id + '|' + (entry.localUrl || entry.url || '');
  }

  function isFbxEntry(entry) {
    return !!(entry && (entry.format === 'fbx' || (entry.localUrl && /\.fbx$/i.test(entry.localUrl))));
  }

  /** 단일 URL GLB/FBX 로드 (리깅 대체용) */
  function loadGlbFromUrl(entry, url) {
    return new Promise((resolve, reject) => {
      const onReady = (scene, animations) => {
        resolve({
          scene,
          animations: animations || [],
          entry,
          loadedUrl: url
        });
      };

      if (isFbxUrl(url) || (entry && entry.format === 'fbx')) {
        if (typeof fflate === 'undefined') return reject(new Error('fflate.min.js required for FBX'));
        const fl = getFbxLoader();
        if (!fl) return reject(new Error('no fbx loader'));
        const texDir = resolveFbxResourcePath(url, entry);
        fl.setResourcePath(texDir);
        fl.load(
          url,
          (group) => {
            normalizeFbxRoot(group, entry);
            repairModelTextures(group, url, entry)
              .then(() => onReady(group, group.animations || []))
              .catch(() => onReady(group, group.animations || []));
          },
          undefined,
          reject
        );
        return;
      }

      const gl = getGltfLoader();
      if (!gl) return reject(new Error('no gltf loader'));
      const loadUrl = String(url).replace(/\\/g, '/');
      gl.load(
        loadUrl,
        (gltf) => {
          const scene = gltf.scene;
          ensureSkinnedMaterials(scene);
          repairModelTextures(scene, loadUrl, entry)
            .then(() => onReady(scene, gltf.animations))
            .catch(() => onReady(scene, gltf.animations));
        },
        undefined,
        (err) => {
          console.warn('[LMGlb] GLB 로드 실패:', loadUrl, err && err.message ? err.message : err);
          reject(err);
        }
      );
    });
  }

  /** 정적 T-포즈 GLB → riggedFallbackUrls 중 스킨 있는 모델 */
  function loadRiggedAvatarFallback(entry, staticScene) {
    const urls = entry && entry.riggedFallbackUrls;
    if (!urls || !urls.length || hasSkinnedMesh(staticScene)) return Promise.resolve(null);
    return loadFirstAvailable(urls, (url) => loadGlbFromUrl(entry, url), 0)
      .then((alt) => {
        if (!alt || !hasSkinnedMesh(alt.scene)) return null;
        return alt;
      })
      .catch((e) => {
        console.warn('[LMGlb] 리깅 대체 GLB 없음 — 원본 유지:', (entry && entry.localUrl) || '', e);
        return null;
      });
  }

  function loadEntry(id) {
    if (!id || id === 'builtin') return Promise.reject(new Error('builtin'));
    const ck = cacheKey(id);
    const entry = entryById(id);
    if (!entry) return Promise.reject(new Error('no entry'));
    const fbxEntry = isFbxEntry(entry);
    const localRigged = !!(entry.rigged && entry.localUrl);

    if (cache.has(ck) && !fbxEntry) {
      const c = cache.get(ck);
      return Promise.resolve({
        scene: c.scene.clone(true),
        animations: c.animations,
        entry
      });
    }

    const loadFromUrl = (url) =>
      new Promise((resolve, reject) => {
        const onReady = (scene, animations) => {
          const anims = animations || [];
          const skipCache =
            !!(entry.riggedFallbackUrls && entry.riggedFallbackUrls.length) ||
            !hasSkinnedMesh(scene);
          if (!fbxEntry && !skipCache) cache.set(ck, { scene, animations: anims });
          resolve({
            scene: scene.clone(true),
            animations: anims,
            entry
          });
        };

        if (isFbxUrl(url) || (entry && entry.format === 'fbx')) {
          if (typeof fflate === 'undefined') {
            return reject(new Error('fflate.min.js required for FBX'));
          }
          const fl = getFbxLoader();
          if (!fl) return reject(new Error('no fbx loader'));
          const texDir = resolveFbxResourcePath(url, entry);
          fl.setResourcePath(texDir);
          fl.load(
            url,
            (group) => {
              normalizeFbxRoot(group, entry);
              repairModelTextures(group, url, entry)
                .then(() => onReady(group, group.animations || []))
                .catch(() => onReady(group, group.animations || []));
            },
            undefined,
            reject
          );
          return;
        }

        const gl = getGltfLoader();
        if (!gl) return reject(new Error('no gltf loader'));
        const loadUrl = String(url).replace(/\\/g, '/');
        gl.load(
          loadUrl,
          (gltf) => {
            const scene = gltf.scene;
            ensureSkinnedMaterials(scene);
            repairModelTextures(scene, loadUrl, entry)
              .then(() => onReady(scene, gltf.animations))
              .catch(() => onReady(scene, gltf.animations));
          },
          undefined,
          (err) => {
            console.warn('[LMGlb] GLB 로드 실패:', loadUrl, err && err.message ? err.message : err);
            reject(err);
          }
        );
      });

    const remote = entry.url;
    if (remote) return loadFromUrl(remote);

    return loadFirstAvailable(resolveLocalUrls(entry), loadFromUrl, 0);
  }

  function attachGlbToWrapper(wrapper, id, opts) {
    opts = opts || {};
    return loadEntry(id)
      .then((gltf) => {
        const entry = gltf.entry || entryById(id);
        return loadRiggedAvatarFallback(entry, gltf.scene).then((alt) => {
          if (alt) {
            console.info(
              '[LMGlb] 정적 T-포즈 → 리깅 모델로 대체:',
              entry.localUrl || id,
              '→',
              alt.loadedUrl
            );
            disposeTree(gltf.scene);
            gltf.scene = alt.scene;
            gltf.animations = alt.animations;
            wrapper.userData.lmRiggedFallbackUrl = alt.loadedUrl;
          }
          return gltf;
        });
      })
      .then((gltf) => {
        let entry = gltf.entry || entryById(id);
        const finish = () => {
          const ph = wrapper.getObjectByName('builtin_placeholder');
          if (ph) {
            wrapper.remove(ph);
            disposeTree(ph);
          }
          const prev = wrapper.getObjectByName('glb_model');
          if (prev) {
            wrapper.remove(prev);
            disposeTree(prev);
          }
          const model = gltf.scene;
          model.name = 'glb_model';
          if (entry && (entry.animClips || entry.meshyAnims || entry.forceProceduralAnim)) {
            wrapper.userData.glbModelYaw = resolveModelYaw(entry, wrapper);
            resetTripoModelOrientation(model, wrapper.userData.glbModelYaw);
          }
          if (
            !entry.meshyAnims &&
            (usesBindIdlePose(entry) || (entry && entry.forceProceduralAnim))
          ) {
            captureSkeletonBindPose(model, true);
          }
          wrapper.userData.lmTargetHeight = resolveAvatarTargetHeight(entry, opts.heightCm);
          fitModel(model, entry, opts.heightCm);
          if (entry && (entry.animClips || entry.meshyAnims || entry.forceProceduralAnim)) {
            resetTripoModelOrientation(model, wrapper.userData.glbModelYaw);
          }
          wrapper.add(model);
          model.visible = true;
          model.traverse((o) => {
            o.visible = true;
          });
          pruneDuplicateSkinnedMeshes(model);
          if (opts.kind === 'avatar' || (entry.category && entry.category.includes('avatar'))) {
            polishAvatarGlb(wrapper, model, entry, opts);
          }
          if (!usesBindIdlePose(entry)) cacheBoneRestPose(model);
          setupAnimations(wrapper, model, gltf, entry);
          if (entry && entry.forceProceduralAnim && hasSkinnedMesh(model)) {
            enterBindIdlePose(wrapper, model, entry);
          }
          wrapper.userData._lmDefeated = false;
          wrapper.userData._animOnceUntil = 0;
          wrapper.userData._lmHeightSynced = false;
          stampCameraHints(wrapper, model, entry, opts.heightCm);
          wrapper.userData.glbId = id;
          wrapper.userData.glbLoaded = true;
          console.info('[LMGlb] 아바타 표시:', id, entry && (entry.localUrl || entry.url));
          wrapper.userData.glbModelScale = model.scale.x;
          if (entry && entry.meshyAnims) {
            rebindMeshySkins(model);
            playMeshyIdlePose(wrapper, model, entry);
            refineMeshyAvatarScale(model, entry, wrapper.userData.lmTargetHeight);
            storeMeshyFitMetrics(wrapper, model, entry);
          }
          wrapper.userData.glbBaseY = model.position.y;
          lockModelTransform(wrapper, model);
          if (typeof opts.onAttached === 'function') {
            try {
              opts.onAttached(wrapper);
            } catch (e) {
              console.warn('[LMGlb] onAttached:', e);
            }
          }
          return wrapper;
        };

        const runAttach = () => {
          pruneGlbOnlyChildren(wrapper);
          return finish();
        };

        if (entry && entry.meshyAnims) {
          const baseAnims = gltf.animations || [];
          const applyBuilt = (built) => {
            gltf.animations = built.animations;
            wrapper.userData.lmAnimClips = built.animClips;
            entry = resolveAnimEntry(entry, wrapper);
            gltf.entry = entry;
            return runAttach();
          };
          const fullCached = meshyPackCache.get(id);
          if (fullCached) {
            applyBuilt(fullCached);
            loadMeshyAnimPackFull(entry, baseAnims, id)
              .then((full) => applyMeshyAnimPackUpgrade(wrapper, entry, full))
              .catch((e) => console.warn('[LMGlb] Meshy 전체 모션 팩(백그라운드):', e));
            return;
          }
          const bootCached = meshyBootstrapCache.get(id);
          if (bootCached) {
            applyBuilt(bootCached);
            loadMeshyAnimPackFull(entry, baseAnims, id)
              .then((full) => applyMeshyAnimPackUpgrade(wrapper, entry, full))
              .catch((e) => console.warn('[LMGlb] Meshy 전체 모션 팩(백그라운드):', e));
            return;
          }
          return buildMeshyAnimPackBootstrap(entry, baseAnims)
            .then((built) => {
              meshyBootstrapCache.set(id, built);
              applyBuilt(built);
              loadMeshyAnimPackFull(entry, baseAnims, id)
                .then((full) => applyMeshyAnimPackUpgrade(wrapper, entry, full))
                .catch((e) => console.warn('[LMGlb] Meshy 전체 모션 팩(백그라운드):', e));
            })
            .catch((e) => {
              console.warn('[LMGlb] Meshy 부트스트랩 실패 — 기본 클립만:', e);
              return runAttach();
            });
        }
        return runAttach();
      });
  }

  function findSkinnedRootForAttach(model) {
    let skinned = null;
    model.traverse((o) => {
      if (!skinned && o.isSkinnedMesh && o.skeleton) skinned = o;
    });
    return skinned || model;
  }

  function collectBones(model) {
    const seen = new Set();
    const list = [];
    const add = (b) => {
      if (!b || seen.has(b)) return;
      seen.add(b);
      list.push(b);
    };
    model.traverse((o) => {
      if (o.isBone) add(o);
    });
    const skinned = findSkinnedRootForAttach(model);
    if (skinned && skinned.skeleton && skinned.skeleton.bones) {
      skinned.skeleton.bones.forEach(add);
    }
    return list;
  }

  function scoreHandBone(nl, side) {
    const isRight = side === 'right';
    const sideHit =
      (isRight && (/right|r_|_r|\.r\b|hand\.r/.test(nl) || /^r\b/.test(nl))) ||
      (!isRight && (/left|l_|_l|\.l\b|hand\.l/.test(nl) || /^l\b/.test(nl)));
    const wrongSide =
      (isRight && /\bleft\b|l_hand|hand\.l|_l\b/.test(nl)) ||
      (!isRight && /\bright\b|r_hand|hand\.r|_r\b/.test(nl));
    if (wrongSide) return 0;
    let score = sideHit ? 2 : 0;
    if (/hand/.test(nl)) score += 8;
    if (/wrist/.test(nl)) score += 6;
    if (/finger|thumb|index|middle|ring|pinky|pinkie/.test(nl)) score -= 4;
    if (/forearm|lowerarm/.test(nl)) score += 3;
    if (/upperarm|shoulder/.test(nl) && !/hand/.test(nl)) score += 1;
    if (!sideHit && /hand/.test(nl)) score += 4;
    return score;
  }

  const LM_HAND_ATTACH_VER = 4;
  const ORBIT_WEAPON_COUNT = 2;
  const ORBIT_WEAPON_RADIUS = 0.56;
  const ORBIT_WEAPON_SPEED = 2.35;

  function resolveHandAttachConfig(wrapper, entry) {
    const base = Object.assign({}, (entry && entry.handAttach) || {});
    if (wrapper && wrapper.userData && wrapper.userData.owUsesOwAvatar && base.meshyOw) {
      Object.assign(base, base.meshyOw);
    }
    return base;
  }

  /** Meshy/Mixamo — 스켈레톤에서 손 본 이름으로 직접 조회 */
  function resolveHandBone(model, side) {
    side = side || 'right';
    const skinned = findSkinnedRootForAttach(model);
    if (skinned && skinned.skeleton && skinned.skeleton.getBoneByName) {
      const tryNames =
        side === 'right'
          ? [
              'RightHand',
              'mixamorigRightHand',
              'MixamorigRightHand',
              'right_hand',
              'hand.R',
              'Hand_R'
            ]
          : [
              'LeftHand',
              'mixamorigLeftHand',
              'MixamorigLeftHand',
              'left_hand',
              'hand.L',
              'Hand_L'
            ];
      for (let i = 0; i < tryNames.length; i++) {
        const b = skinned.skeleton.getBoneByName(tryNames[i]);
        if (b) return b;
      }
    }
    return findHandBone(model, side);
  }

  function findHandBone(model, side) {
    side = side || 'right';
    const bones = collectBones(model);
    let best = null;
    let bestScore = 0;
    bones.forEach((b) => {
      const nl = b.name.toLowerCase();
      const pats =
        side === 'right'
          ? [
              /mixamorigrighthand$/i,
              /mixamorig:right.*hand$/i,
              /^righthand$/i,
              /^right_hand$/i,
              /^r_hand$/i,
              /^hand\.r$/i,
              /^hand_r$/i,
              /right.*hand/i,
              /righthand/i
            ]
          : [
              /mixamoriglefthand$/i,
              /mixamorig:left.*hand$/i,
              /^lefthand$/i,
              /^left_hand$/i,
              /^l_hand$/i,
              /^hand\.l$/i,
              /left.*hand/i,
              /lefthand/i
            ];
      if (pats.some((re) => re.test(nl))) {
        best = b;
        bestScore = 99;
        return;
      }
      const sc = scoreHandBone(nl, side);
      if (sc > bestScore) {
        bestScore = sc;
        best = b;
      }
    });
    if (best && bestScore >= 99) return best;
    if (best && bestScore >= 8 && /hand/.test(best.name.toLowerCase())) return best;

    const handRole = side === 'right' ? 'R_hand' : 'L_hand';
    for (let i = 0; i < bones.length; i++) {
      const nl = bones[i].name.toLowerCase();
      if (boneMatchesRole(nl, handRole)) return bones[i];
    }
    return null;
  }

  /** 손 본 없을 때 — 아바타 모델 좌표계 홀더 */
  function ensureHandWeaponHolder(wrapper, model, side) {
    const holderName = side === 'right' ? 'lm_hand_weapon_holder_r' : 'lm_hand_weapon_holder_l';
    let holder = model.getObjectByName(holderName);
    if (holder) return holder;
    holder = new THREE.Group();
    holder.name = holderName;
    holder.position.set(0, 0, 0);
    holder.rotation.set(0, 0, 0);
    holder.scale.set(1, 1, 1);
    model.add(holder);
    return holder;
  }

  /** 손잡이(넓은 단면) 끝 자동 판별 — min/max 중 가드가 넓은 쪽 */
  function inferWeaponHandleEnd(prop) {
    prop.updateMatrixWorld(true);
    const box = new THREE.Box3();
    prop.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) box.expandByObject(o, true);
    });
    if (box.isEmpty()) return 'min';
    const size = new THREE.Vector3();
    box.getSize(size);
    const h = Math.max(size.y, 0.02);
    const band = h * 0.18;
    const lowBox = new THREE.Box3();
    const highBox = new THREE.Box3();
    prop.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const b = new THREE.Box3().setFromObject(o, true);
      const midY = (b.min.y + b.max.y) * 0.5;
      if (midY <= box.min.y + band) lowBox.union(b);
      if (midY >= box.max.y - band) highBox.union(b);
    });
    const spread = (b) => {
      if (b.isEmpty()) return 0;
      return (b.max.x - b.min.x) * (b.max.z - b.min.z);
    };
    const lowW = spread(lowBox);
    const highW = spread(highBox);
    return lowW >= highW ? 'min' : 'max';
  }

  /** 검·무기 GLB 긴 축을 +Y(칼날 위)로 맞춤 */
  function orientWeaponLongAxisUp(prop) {
    prop.updateMatrixWorld(true);
    const box = new THREE.Box3();
    prop.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) box.expandByObject(o);
    });
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    let axis = 'y';
    if (size.x >= size.y && size.x >= size.z) axis = 'x';
    else if (size.z >= size.y && size.z >= size.x) axis = 'z';
    if (axis === 'x') prop.rotation.z = Math.PI / 2;
    else if (axis === 'z') prop.rotation.x = -Math.PI / 2;
    prop.updateMatrixWorld(true);
  }

  /** 무기 손잡이(긴 축 끝)를 피벗 원점에 맞춤 — center 정렬 시 손이 칼날 중간에 걸침 */
  function alignHandPropGrip(prop, entry, gripEndOverride) {
    const ha = (entry && entry.handAttach) || {};
    const isWeapon =
      entry && entry.category && entry.category.indexOf('weapon') >= 0;
    prop.position.set(0, 0, 0);
    prop.rotation.set(0, 0, 0);
    prop.updateMatrixWorld(true);
    const box = new THREE.Box3();
    prop.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) box.expandByObject(o);
    });
    if (box.isEmpty()) return;

    const grip = new THREE.Vector3();
    if (ha.gripOffset && ha.gripOffset.length >= 3) {
      grip.set(ha.gripOffset[0], ha.gripOffset[1], ha.gripOffset[2]);
    } else {
      const mode = ha.gripMode || (isWeapon ? 'handle' : 'center');
      if (mode === 'center') {
        box.getCenter(grip);
      } else {
        const size = new THREE.Vector3();
        box.getSize(size);
        const cx = (box.min.x + box.max.x) * 0.5;
        const cy = (box.min.y + box.max.y) * 0.5;
        const cz = (box.min.z + box.max.z) * 0.5;
        const inset = ha.gripInset != null ? ha.gripInset : 0.1;
        let axis = ha.gripAxis;
        if (!axis) {
          if (size.y >= size.x && size.y >= size.z) axis = 'y';
          else if (size.z >= size.x) axis = 'z';
          else axis = 'x';
        }
        let end = gripEndOverride || ha.gripEnd;
        if (isWeapon && (!end || end === 'auto')) end = inferWeaponHandleEnd(prop);
        if (!end) end = isWeapon ? 'min' : 'min';
        if (axis === 'y') {
          grip.set(cx, end === 'max' ? box.max.y : box.min.y, cz);
          if (end === 'max') grip.y -= size.y * inset;
          else grip.y += size.y * inset;
        } else if (axis === 'z') {
          grip.set(cx, cy, end === 'max' ? box.max.z : box.min.z);
          grip.z += (end === 'max' ? -1 : 1) * size.z * inset;
        } else {
          grip.set(end === 'max' ? box.max.x : box.min.x, cy, cz);
          grip.x += (end === 'max' ? -1 : 1) * size.x * inset;
        }
      }
    }
    prop.position.sub(grip);
  }

  function prepareHandProp(prop, entry) {
    const ha = (entry && entry.handAttach) || {};
    const isWeapon =
      entry && entry.category && entry.category.indexOf('weapon') >= 0;
    const targetLen = ha.targetLen || (entry && entry.targetHeight) || 0.5;
    prop.position.set(0, 0, 0);
    prop.rotation.set(0, 0, 0);
    prop.scale.set(1, 1, 1);
    prop.updateMatrixWorld(true);
    const box = new THREE.Box3();
    prop.traverse((o) => {
      if (o.isMesh || o.isSkinnedMesh) box.expandByObject(o);
    });
    if (box.isEmpty()) return;
    const size = new THREE.Vector3();
    box.getSize(size);
    let len = Math.max(size.x, size.y, size.z, 0.001);
    if (len > 8) len *= 0.01;
    else if (len > 3) len *= 0.1;
    const s = Math.max(0.02, targetLen / len);
    prop.scale.setScalar(s);
    prop.updateMatrixWorld(true);
    if (isWeapon && ha.bladeUp !== false) orientWeaponLongAxisUp(prop);
    const gripEnd =
      isWeapon && (!ha.gripEnd || ha.gripEnd === 'auto')
        ? inferWeaponHandleEnd(prop)
        : ha.gripEnd || 'min';
    alignHandPropGrip(prop, entry, gripEnd);
    /* 손잡이가 max 끝이면 칼날을 +Y로 맞추기 위해 뒤집기 */
    if (isWeapon && ha.bladeUp !== false && gripEnd === 'max') {
      prop.rotation.x += Math.PI;
      prop.updateMatrixWorld(true);
    }
    prop.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      o.visible = true;
      o.renderOrder = 12;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        m.side = THREE.DoubleSide;
        m.visible = true;
        m.depthWrite = true;
        if (m.transparent && m.opacity < 0.05) {
          m.transparent = false;
          m.opacity = 1;
        }
        m.needsUpdate = true;
      });
    });
  }

  function detachHandWeapon(wrapper) {
    if (!wrapper) return Promise.resolve();
    const orbit = wrapper.userData.lmOrbitWeapon;
    const n = wrapper.userData.lmHandWeaponNode;
    const root = orbit || n;
    if (root && root.parent) root.parent.remove(root);
    if (root) disposeTree(root);
    wrapper.userData.lmHandWeaponNode = null;
    wrapper.userData.lmHandWeaponId = null;
    wrapper.userData.lmHandWeaponBone = null;
    wrapper.userData.lmHandWeaponSide = null;
    wrapper.userData.lmHandWeaponOnBone = false;
    wrapper.userData.lmHandWeaponModel = null;
    wrapper.userData.lmOrbitWeapon = null;
    wrapper.userData.lmOrbitPhase = null;
    wrapper.userData._lmHandAttachVer = null;
    wrapper.userData._lmWeaponAttaching = false;
    return Promise.resolve();
  }

  function buildOrbitSwordMesh(gltf, entry) {
    const prop = gltf.scene.clone(true);
    prop.name = 'lm_orbit_weapon_mesh';
    brightenHandWeaponMaterials(prop);
    const ha = Object.assign({}, (entry && entry.handAttach) || {});
    const orbitEntry = Object.assign({}, entry, {
      handAttach: Object.assign({}, ha, {
        targetLen: (ha.targetLen || entry.targetHeight || 0.48) * 0.82
      })
    });
    prepareHandProp(prop, orbitEntry);
    prop.rotation.set(Math.PI * 0.5, 0, Math.PI * 0.5);
    return prop;
  }

  function attachOrbitWeapon(wrapper, propId, gltf, entry) {
    const orbit = new THREE.Group();
    orbit.name = 'lm_orbit_weapon';
    orbit.frustumCulled = false;
    const bodyH =
      wrapper.userData.lmBodyHeight || wrapper.userData.lmTargetHeight || 1.72;
    orbit.position.y = bodyH * 0.5;
    const radius = ORBIT_WEAPON_RADIUS;
    const count = ORBIT_WEAPON_COUNT;
    for (let i = 0; i < count; i++) {
      const slot = new THREE.Group();
      const ang = (i / count) * Math.PI * 2;
      slot.position.set(Math.cos(ang) * radius, 0, Math.sin(ang) * radius);
      slot.rotation.y = -ang + Math.PI * 0.5;
      slot.add(buildOrbitSwordMesh(gltf, entry));
      orbit.add(slot);
    }
    wrapper.add(orbit);
    wrapper.userData.lmOrbitWeapon = orbit;
    wrapper.userData.lmOrbitPhase = 0;
    wrapper.userData.lmOrbitSpeed = ORBIT_WEAPON_SPEED;
    wrapper.userData.lmHandWeaponNode = orbit;
    wrapper.userData.lmHandWeaponId = propId;
    wrapper.userData.lmHandWeaponOnBone = false;
    wrapper.userData.lmHandWeaponBone = null;
    wrapper.userData.lmHandWeaponModel = null;
    wrapper.userData._lmHandAttachVer = LM_HAND_ATTACH_VER;
    console.info('[LMGlb] 무기 궤도:', entry.localUrl || propId);
  }

  /** 장착 검 — 아바타 주위 회전 */
  function syncOrbitWeapon(wrapper, dt) {
    if (!wrapper) return;
    const orbit = wrapper.userData.lmOrbitWeapon;
    if (!orbit) return;
    const step = dt != null && dt > 0 ? dt : 0.016;
    const speed = wrapper.userData.lmOrbitSpeed || ORBIT_WEAPON_SPEED;
    wrapper.userData.lmOrbitPhase =
      (wrapper.userData.lmOrbitPhase || 0) + speed * step;
    orbit.rotation.y = wrapper.userData.lmOrbitPhase;
    const bodyH =
      wrapper.userData.lmBodyHeight || wrapper.userData.lmTargetHeight || 1.72;
    orbit.position.y =
      bodyH * 0.5 + Math.sin(wrapper.userData.lmOrbitPhase * 2.2) * 0.035;
  }

  function brightenHandWeaponMaterials(root) {
    if (!root) return;
    root.traverse((o) => {
      if (!o.isMesh && !o.isSkinnedMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => {
        if (!m) return;
        m.vertexColors = false;
        applyTextureColorSpace(m.map);
        if (m.metalness != null) m.metalness = Math.min(m.metalness, 0.25);
        if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.4);
        if (!isTextureReady(m.map) && m.color) m.color.setRGB(1, 1, 1);
        m.side = THREE.DoubleSide;
        m.depthTest = true;
        m.visible = true;
        m.needsUpdate = true;
      });
    });
  }

  function attachHandWeapon(wrapper, propId) {
    if (!wrapper || !propId) return detachHandWeapon(wrapper);
    const entry = entryById(propId);
    if (!entry) return Promise.resolve();
    const existing = wrapper.userData.lmOrbitWeapon || wrapper.userData.lmHandWeaponNode;
    if (
      wrapper.userData.lmHandWeaponId === propId &&
      wrapper.userData._lmHandAttachVer === LM_HAND_ATTACH_VER &&
      existing &&
      existing.parent
    ) {
      return Promise.resolve();
    }
    if (wrapper.userData._lmWeaponAttaching) return Promise.resolve();
    wrapper.userData._lmWeaponAttaching = true;
    return detachHandWeapon(wrapper)
      .then(() =>
        loadEntry(propId).then((gltf) => {
          attachOrbitWeapon(wrapper, propId, gltf, entry);
        })
      )
      .finally(() => {
        wrapper.userData._lmWeaponAttaching = false;
      });
  }

  function flushSkinnedBoneWorldMatrices(model) {
    if (!model) return;
    model.updateMatrixWorld(true);
    model.traverse((o) => {
      if (!o.isSkinnedMesh || !o.skeleton) return;
      o.skeleton.update();
      o.skeleton.bones.forEach((b) => {
        if (b) b.updateMatrixWorld(true);
      });
    });
  }

  /** 손 본 월드 좌표 → 모델 좌표계 홀더 (매 프레임 손 추적) */
  function syncHandWeaponFollow(wrapper) {
    if (!wrapper) return;
    const prop = wrapper.userData.lmHandWeaponNode;
    if (!prop) return;
    const holder = prop.parent;
    if (!holder || holder.name.indexOf('lm_hand_weapon_holder') !== 0) return;
    const model =
      wrapper.userData.lmHandWeaponModel ||
      wrapper.getObjectByName('ow_avatar_model') ||
      wrapper.getObjectByName('glb_model');
    if (!model) return;
    let bone = wrapper.userData.lmHandWeaponBone;
    if (!bone) {
      const side = wrapper.userData.lmHandWeaponSide || 'right';
      bone = resolveHandBone(model, side);
      wrapper.userData.lmHandWeaponBone = bone || null;
    }
    if (!bone) return;
    flushSkinnedBoneWorldMatrices(model);
    model.updateMatrixWorld(true);
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    bone.getWorldPosition(wp);
    bone.getWorldQuaternion(wq);
    model.worldToLocal(wp);
    holder.position.copy(wp);
    const inv = new THREE.Quaternion();
    model.getWorldQuaternion(inv).invert();
    holder.quaternion.copy(inv).multiply(wq);
    holder.scale.set(1, 1, 1);
  }

  function wrapCharacter(syncBuilder, opts) {
    opts = opts || {};
    const wrapper = new THREE.Group();
    wrapper.name = 'lm_character_wrap';
    wrapper.userData.walkPhase = 0;

    let glbId = opts.glbId;
    if (!glbId && opts.kind === 'avatar') {
      glbId = resolveAvatarGlbId(opts.avatar, opts.gender);
      opts.kind = 'avatar';
    }
    if (!glbId && opts.kind === 'pet') glbId = (opts.pet && opts.pet.glbPet) || getPref('pet');

    if (!glbId || glbId === 'builtin') {
      if (typeof syncBuilder === 'function') {
        const builtin = syncBuilder();
        builtin.name = 'builtin_mesh';
        wrapper.add(builtin);
        wrapper.userData.legs = builtin.userData.legs;
        wrapper.userData.arms = builtin.userData.arms;
        if (opts.targetHeight) fitBuiltinToHeight(wrapper, opts.targetHeight);
      }
      return wrapper;
    }

    attachGlbToWrapper(wrapper, glbId, opts).catch((err) => {
      if (wrapper.getObjectByName('glb_model')) return;
      const ent = entryById(glbId);
      const urls = ent ? resolveLocalUrls(ent).join(' · ') : '';
      console.warn(
        '[LMGlb] GLB 로드 실패:',
        glbId,
        (err && err.message) || err,
        urls ? `(시도 경로: ${urls})` : ''
      );
    });
    return wrapper;
  }

  function cacheFbxWalkBones(wrapper, model) {
    const arms = [];
    const legs = [];
    model.traverse((o) => {
      if (!o.isBone) return;
      const n = o.name.toLowerCase();
      if (/finger|thumb|toe|index_|middle_|ring_|pinky_|pinkie/.test(n)) return;
      if (/upperarm|forearm|lowerarm|hand|clavicle|shoulder|arm_|_arm|upper_arm/.test(n)) {
        arms.push(o);
      }
      if (/thigh|calf|shin|foot|upleg|loleg|knee|pelvis|hip|leg_|_leg|upper_leg|lower_leg/.test(n)) {
        legs.push(o);
      }
    });
    wrapper.userData.fbxBones = { arms, legs };
    if (arms.length + legs.length > 0) {
      console.info('[LMGlb] FBX 본 걷기:', '팔', arms.length, '다리', legs.length);
    }
  }

  function updateFbxBoneWalk(root, moving, phase, walkOpts) {
    const bones = root.userData.fbxBones;
    if (!bones) return;
    walkOpts = walkOpts || {};
    const legAmp = walkOpts.legAmp != null ? walkOpts.legAmp : 0.42;
    const armAmp = walkOpts.armAmp != null ? walkOpts.armAmp : 0.32;
    const swing = (list, amp) => {
      list.forEach((b, i) => {
        if (!b.userData._lmRestQuat) {
          b.userData._lmRestQuat = b.quaternion.clone();
        }
        b.quaternion.copy(b.userData._lmRestQuat);
        if (!moving) return;
        const nl = b.name.toLowerCase();
        const isL = /_l\b|left|\.l$|_l_|^l_/.test(nl) || nl.startsWith('l_');
        const isR = /_r\b|right|\.r$|_r_|^r_/.test(nl) || nl.startsWith('r_');
        const off = isL ? 0 : isR ? Math.PI : i * Math.PI;
        b.rotateX(Math.sin(phase + off) * amp);
      });
    };
    swing(bones.legs, legAmp);
    swing(bones.arms, armAmp);
    const model = root.getObjectByName('glb_model');
    if (model) {
      model.traverse((o) => {
        if (o.isSkinnedMesh && o.skeleton) o.skeleton.update();
      });
    }
  }

  /** 정적 메쉬 — 앉기(탈것·돗자리) */
  function updateMeshSitPose(root, state) {
    const model = root.getObjectByName('glb_model');
    if (!model || !root.userData.glbStatic) return false;
    state = state || {};
    if (!state.sitting && !state.inCar && !state.riding) return false;
    const baseY = root.userData.glbBaseY != null ? root.userData.glbBaseY : model.position.y;
    if (root.userData.glbBaseY == null) root.userData.glbBaseY = baseY;
    model.rotation.x = 0.38;
    model.rotation.z = 0;
    model.position.y = baseY - 0.32;
    return true;
  }

  /** 정적/FBX T-포즈 — 상체·보폭 흔들림으로 걷는 느낌 */
  function updateStaticLocomotion(root, moving, dt, state) {
    const model = root.getObjectByName('glb_model');
    if (!model || !root.userData.glbStatic) return;
    state = state || {};
    if (updateMeshSitPose(root, state)) return;
    const phase = root.userData.walkPhase || 0;
    const d = dt || 0.016;
    const baseY = root.userData.glbBaseY != null ? root.userData.glbBaseY : model.position.y;
    if (root.userData.glbBaseY == null) root.userData.glbBaseY = baseY;
    const fbx = !!root.userData.glbFbxSway;
    if (moving) {
      const s = Math.sin(phase);
      const s2 = Math.sin(phase * 2);
      const bob = fbx ? 0.055 : 0.035;
      const tilt = fbx ? 0.11 : 0.07;
      const sway = fbx ? 0.06 : 0.035;
      model.rotation.x = s * tilt;
      model.rotation.z = s2 * sway;
      model.position.y = baseY + Math.abs(s2) * bob;
      if (fbx) {
        root.rotation.z = Math.sin(phase * 2) * 0.025;
        updateFbxBoneWalk(root, true, phase);
      }
    } else {
      if (fbx) updateFbxBoneWalk(root, false, phase);
      model.rotation.x *= 0.88;
      model.rotation.z *= 0.88;
      if (root.userData.glbFbxSway) root.rotation.z *= 0.88;
      root.userData.glbIdlePhase = (root.userData.glbIdlePhase || 0) + d * 1.1;
      model.position.y = baseY + Math.sin(root.userData.glbIdlePhase) * 0.006;
    }
  }

  function updateWalkAnim(root, moving, dt, state) {
    if (!root) return;
    const d = dt || 0.016;
    updateStaticLocomotion(root, moving, d, state);
    if (!root.userData.glbMixer) return;
    const mixer = root.userData.glbMixer;
    const model = root.getObjectByName('glb_model');

    if (root.userData.glbWalkOnly) {
      const walk = root.userData.glbWalkAction;
      if (!walk) return;
      if (moving) {
        if (!root.userData._walkPlaying) {
          walk.paused = false;
          walk.reset().fadeIn(0.12).play();
          root.userData._walkPlaying = true;
        }
        mixer.update(d);
        normalizeBoneScales(model, true);
        resetAnimRootBones(model);
        const entWalk = entryById(root.userData.glbId);
        saveAvatarWalkScale(root, model);
        maintainAvatarDisplayHeight(root, model, entWalk);
      } else {
        if (root.userData._walkPlaying) {
          walk.fadeOut(0.08);
          root.userData._walkPlaying = false;
        }
        const ent = entryById(root.userData.glbId);
        enterStandPose(root, model, mixer, walk, ent);
      }
      return;
    }

    const idle = root.userData.glbIdleAction;
    const walk = root.userData.glbWalkAction;
    if (walk) {
      if (moving && !root.userData._walkPlaying) {
        if (idle) idle.fadeOut(0.2);
        walk.reset().fadeIn(0.2).play();
        root.userData._walkPlaying = true;
      } else if (!moving && root.userData._walkPlaying) {
        walk.fadeOut(0.2);
        if (idle) idle.reset().fadeIn(0.2).play();
        else enterStandPose(root, model, mixer, walk, entryById(root.userData.glbId));
        root.userData._walkPlaying = false;
      }
      if (!moving) return;
      normalizeBoneScales(model, true);
      resetAnimRootBones(model);
      lockModelTransform(root, model);
    } else if (moving && idle) {
      idle.timeScale = 1.35;
    } else if (idle) {
      idle.timeScale = 1;
    }
    mixer.update(d);
    if (model) {
      normalizeBoneScales(model, true);
      lockModelTransform(root, model);
    }
  }

  function updateLocomotion(root, moving, dt, state) {
    state = state || {};
    if (root && root.userData.glbMultiClip) {
      updateMultiClipLocomotion(root, moving, dt, state);
      return;
    }
    updateWalkAnim(root, moving, dt, state);
  }

  function loadNpcIntoGroup(g, npc) {
    const id = getNpcPref(npc.id);
    if (!id || id === 'builtin') return;
    const keep = new Set();
    if (g.userData.ring) keep.add(g.userData.ring);
    if (g.userData.beam) keep.add(g.userData.beam);
    if (g.userData.sprite) keep.add(g.userData.sprite);
    if (g.userData.head) keep.add(g.userData.head);
    const remove = [];
    g.children.forEach((ch) => {
      if (!keep.has(ch)) remove.push(ch);
    });
    remove.forEach((ch) => {
      g.remove(ch);
      disposeTree(ch);
    });
    if (g.userData.sprite) g.userData.sprite.visible = true;

    attachGlbToWrapper(g, id, { heightCm: 170 })
      .then(() => {
        if (g.userData.head) g.userData.head.visible = false;
      })
      .catch(() => {});
  }

  /* ── UI: 3D 모델 선택 모달 ── */
  let __glbPreview = null;

  function pickerTab() {
    return (window.S && S.ow && S.ow.glbPickerTab) || 'pet';
  }

  function pickerDraft() {
    return (window.S && S.ow && S.ow.glbPickerDraft) || getPref(pickerTab());
  }

  function openPicker(cat) {
    if (!window.S || !S.ow) return;
    S.ow.showGlbPicker = true;
    S.ow.glbPickerTab = cat || 'pet';
    const t = S.ow.glbPickerTab;
    let cur = getPref(t);
    if (t === 'avatar') {
      const av = typeof getMyAvatar === 'function' ? getMyAvatar() : {};
      cur = (av && av.glbModel) || resolveAvatarGlbId(av);
    }
    if (t === 'pet' && S.myPet && S.myPet.glbPet) cur = S.myPet.glbPet;
    S.ow.glbPickerDraft = cur || 'builtin';
  }

  function disposePickerPreview() {
    if (__glbPreview) {
      try { __glbPreview.dispose(); } catch (e) { /* */ }
      __glbPreview = null;
    }
  }

  function closePicker() {
    if (!window.S || !S.ow) return;
    S.ow.showGlbPicker = false;
    S.ow.glbPickerDraft = null;
    disposePickerPreview();
  }

  function setPickerDraft(id) {
    if (!window.S || !S.ow) return;
    S.ow.glbPickerDraft = id;
  }

  function applyPicker() {
    const tab = pickerTab();
    const id = pickerDraft() || 'builtin';
    setPref(tab, id);
    if (tab === 'avatar') {
      const glbModel = id === 'builtin' ? '' : id;
      if (S.myPet) {
        S.myPet.avatar = S.myPet.avatar || {};
        S.myPet.avatar.glbModel = glbModel;
      }
      if (typeof saveAvatar === 'function') {
        saveAvatar({ glbModel });
      }
    }
    if (tab === 'pet' && S.myPet) S.myPet.glbPet = id === 'builtin' ? '' : id;
    refreshOWFromPrefs();
    if (tab === 'pet' && typeof petCol !== 'undefined' && S.myEntry && S.myEntry.nick) {
      petCol.doc(S.myEntry.nick).update({ glbPet: id === 'builtin' ? '' : id }).catch(() => {});
    }
    closePicker();
    if (typeof render === 'function') render();
  }

  function clearEntryCache(id) {
    if (id) cache.delete(cacheKey(id));
  }

  function refreshOWHuman() {
    const rd = window.__owRenderer;
    if (!rd || !rd.human) return;
    if (window.LMOwAvatar && typeof LMOwAvatar.clearCache === 'function') {
      LMOwAvatar.clearCache();
    }
    if (typeof resolveAvatarGlbId === 'function') {
      clearEntryCache(
        resolveAvatarGlbId(
          typeof getMyAvatar === 'function' ? getMyAvatar() : {},
          window.S && window.S.myEntry && window.S.myEntry.gender
        )
      );
    }
    const pos = rd.human.position.clone();
    const rot = rd.human.rotation.y;
    rd.scene.remove(rd.human);
    disposeTree(rd.human);
    const av = getMyAvatar();
    rd.human = rd._buildHuman(av, getMyHeightCm());
    rd.human.position.copy(pos);
    rd.human.rotation.y = rot;
    rd.scene.add(rd.human);
    rd.pet = rd.human;
    if (typeof owRefreshHandWeapon === 'function') {
      try {
        owRefreshHandWeapon();
      } catch (e) { /* */ }
    }
  }

  function refreshOWFromPrefs() {
    refreshOWHuman();
    if (typeof owRefreshCompanion3D === 'function') owRefreshCompanion3D();
    const rd = window.__owRenderer;
    if (rd && rd._mmoNpcMarkers && typeof OW_MMO_NPCS !== 'undefined') {
      OW_MMO_NPCS.forEach((npc) => {
        const g = rd._mmoNpcMarkers[npc.id];
        if (g) loadNpcIntoGroup(g, npc);
      });
    }
  }

  function initPickerPreview() {
    const canvas = document.querySelector('.glb-picker-preview canvas');
    if (!canvas) return;
    if (__glbPreview) {
      try { __glbPreview.dispose(); } catch (e) { /* */ }
      __glbPreview = null;
    }
    const wrap = canvas.parentElement;
    const W = wrap.clientWidth || 320;
    const H = wrap.clientHeight || 280;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1028);
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 50);
    camera.position.set(0, 1.1, 3.2);
    camera.lookAt(0, 0.9, 0);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H, false);
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const key = new THREE.DirectionalLight(0xfff0d0, 1.1);
    key.position.set(2, 4, 3);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xff8ec8, 0.35);
    fill.position.set(-2, 1, 2);
    scene.add(fill);
    const stage = new THREE.Mesh(
      new THREE.CylinderGeometry(0.85, 1, 0.06, 32),
      new THREE.MeshStandardMaterial({ color: 0x3d2550, roughness: 0.4, metalness: 0.2 })
    );
    stage.position.y = -0.02;
    scene.add(stage);
    const group = new THREE.Group();
    scene.add(group);

    let killed = false;
    let raf = null;
    let autoRot = true;
    let lastX = 0;
    let isDrag = false;

    function showPlaceholder(msg) {
      while (group.children.length) group.remove(group.children[0]);
      const geo = new THREE.BoxGeometry(0.5, 0.8, 0.35);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.5 }));
      mesh.position.y = 0.45;
      group.add(mesh);
      console.info('[LMGlb preview]', msg);
    }

    function loadDraft() {
      const id = pickerDraft();
      const ent = entryById(id);
      while (group.children.length) group.remove(group.children[0]);
      if (!id || id === 'builtin') {
        showPlaceholder('기본 메쉬 (블록/이모지)');
        return;
      }
      if (ent && ent.needsFile) {
        showPlaceholder('파일 필요: ' + (ent.localUrl || ''));
        return;
      }
      const finishPreview = (gltf, ent) => {
        if (killed) return;
        const model = gltf.scene;
        fitModel(model, ent || {}, 170);
        group.add(model);
        if (ent && (ent.category || []).includes('avatar')) {
          polishAvatarGlb(group, model, ent, {});
        }
        setupAnimations(group, model, gltf, ent || {});
      };
      loadEntry(id)
        .then((gltf) => {
          const ent = gltf.entry || entryById(id);
          if (ent && ent.meshyAnims) {
            return buildMeshyAnimPack(ent, gltf.animations).then((built) => {
              gltf.animations = built.animations;
              group.userData.lmAnimClips = built.animClips;
              finishPreview(gltf, resolveAnimEntry(ent, group));
            });
          }
          finishPreview(gltf, ent);
        })
        .catch((e) => {
          showPlaceholder('로드 실패 — URL/CORS 확인');
          console.warn(e);
        });
    }

    loadDraft();

    canvas.onmousedown = (e) => { isDrag = true; autoRot = false; lastX = e.clientX; };
    window.addEventListener('mousemove', (e) => {
      if (!isDrag) return;
      group.rotation.y += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    });
    window.addEventListener('mouseup', () => { isDrag = false; });

    const loop = () => {
      if (killed) return;
      if (autoRot) group.rotation.y += 0.01;
      const mode = group.userData.glbAnimMode;
      if (group.userData.glbMixer && mode && mode !== 'idle') {
        group.userData.glbMixer.update(0.016);
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    __glbPreview = {
      reload: loadDraft,
      dispose() {
        killed = true;
        if (raf) cancelAnimationFrame(raf);
        try {
          renderer.dispose();
          if (renderer.forceContextLoss) renderer.forceContextLoss();
        } catch (e) { /* */ }
        disposeTree(group);
      }
    };
  }

  window.rGlbPickerModal = function rGlbPickerModal() {
    if (!window.S || !S.ow || !S.ow.showGlbPicker) return '';
    const tab = pickerTab();
    const draft = pickerDraft();
    const tabs = [
      { id: 'pet', label: '🐾 펫', desc: '컨셉: 강아지·고양이·여우·판다…' },
      { id: 'avatar', label: '👤 아바타', desc: '컨셉: 소년·소녀·헤어·의상' },
      { id: 'npc', label: '🧍 NPC', desc: '컨셉: 상인·경비·마을 NPC' }
    ];
    const tabHtml = tabs.map((t) =>
      `<button type="button" class="glb-tab ${tab === t.id ? 'active' : ''}" data-a="glb_tab" data-cat="${t.id}">${t.label}</button>`
    ).join('');
    const items = catalog().filter((e) => e.category && e.category.includes(tab));
    const cards = items.map((e) => {
      const active = draft === e.id;
      const styleLabel = (window.LM_GLB_STYLE_TAGS && LM_GLB_STYLE_TAGS[e.style]) || e.style;
      return `<button type="button" class="glb-card ${active ? 'active' : ''}" data-a="glb_pick" data-id="${e.id}">
        <div class="glb-card-title">${e.name}</div>
        <div class="glb-card-concept">${e.concept || ''}</div>
        <div class="glb-card-meta"><span class="tag">${styleLabel}</span> · ${e.license || ''}</div>
      </button>`;
    }).join('');
    const cur = entryById(draft);
    return `
    <div class="modal-overlay glb-picker-overlay" style="z-index:10510" data-a="glb_close">
      <div class="glb-picker-modal" onclick="event.stopPropagation()">
        <div class="glb-picker-head">
          <h3>🎨 3D GLB 모델 선택</h3>
          <p class="glb-picker-sub">컨셉 아트처럼 <b>캐주얼·치비</b> 무료 모델을 골라 적용합니다. 직접 만든 GLB는 <code>assets/models/</code> 폴더에 넣으세요.</p>
        </div>
        <div class="glb-picker-tabs">${tabHtml}</div>
        <p class="glb-tab-hint">${tabs.find((t) => t.id === tab)?.desc || ''}</p>
        <div class="glb-picker-body">
          <div class="glb-picker-preview"><canvas></canvas></div>
          <div class="glb-picker-list">${cards}</div>
        </div>
        <div class="glb-picker-foot">
          <span class="glb-pick-label">선택: <b>${cur ? cur.name : '기본'}</b></span>
          <button type="button" class="btn" data-a="glb_close">취소</button>
          <button type="button" class="btn btn-primary" data-a="glb_apply">✅ 적용</button>
        </div>
      </div>
    </div>`;
  };

  window.__lmGlbReady = true;
  console.info('[LMGlb] 3D GLB 준비됨 — 오픈월드 상단 🎨 3D 버튼');

  window.LMGlb = {
    catalog,
    entryById,
    resolveAvatarGlbId,
    beautifyGlbMaterials,
    preserveOriginalGlbColors,
    applyRealisticSkinByHeight,
    addCuteFaceOverlay,
    polishAvatarGlb,
    polishOwGlbModel,
    getPref,
    setPref,
    getNpcPref,
    setNpcPref,
    loadEntry,
    preloadOpenWorldAvatars,
    wrapCharacter,
    attachGlbToWrapper,
    handAttachVersion: LM_HAND_ATTACH_VER,
    attachHandWeapon,
    detachHandWeapon,
    syncOrbitWeapon,
    syncHandWeaponFollow,
    loadNpcIntoGroup,
    disposeTree,
    updateWalkAnim,
    updateLocomotion,
    playAvatarAnim,
    triggerAvatarCombatAnim,
    isAvatarCombatAnimPlaying,
    restoreMeshyStandBaseY,
    primeSitMatPose,
    triggerAvatarGreet,
    triggerAvatarDance,
    triggerAvatarEmote,
    setAvatarCombatDefeat,
    openPicker,
    closePicker,
    disposePickerPreview,
    setPickerDraft,
    applyPicker,
    initPickerPreview,
    refreshOWHuman,
    refreshOWFromPrefs
  };

})();
