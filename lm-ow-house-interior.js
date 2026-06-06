/**
 * 오픈월드 분양 집 — 3D 인테리어 (하우스탭과 별도)
 */
(function (global) {
  'use strict';

  const ROOM_W = 13;
  const ROOM_D = 11;
  const WALL_H = 3.4;
  const MAX_PLACEMENTS = 48;

  const CATALOG = [
    { id: 'wood_sofa', name: '나무 소파', emoji: '🛋️', cost: 15000, glb: '오픈월드/house/나무소파.glb', h: 0.95, cat: 'seat' },
    { id: 'pink_sofa', name: '핑크 소파', emoji: '💗', cost: 18000, glb: '오픈월드/house/핑크소파.glb', h: 0.95, cat: 'seat' },
    { id: 'gold_sofa', name: '황금 소파', emoji: '✨', cost: 32000, glb: '오픈월드/house/황금소파.glb', h: 1.0, cat: 'seat' },
    { id: 'chair_1', name: '의자', emoji: '🪑', cost: 9500, glb: '오픈월드/house/의자1.glb', h: 0.88, cat: 'seat' },
    { id: 'wood_bed', name: '나무 침대', emoji: '🛏️', cost: 20000, glb: '오픈월드/house/나무침대.glb', h: 0.75, cat: 'bed' },
    { id: 'pink_bed', name: '핑크 침대', emoji: '🌸', cost: 28000, glb: '오픈월드/house/핑크침대.glb', h: 0.78, cat: 'bed' },
    { id: 'magic_desk', name: '마법 책상', emoji: '📚', cost: 12000, glb: '오픈월드/house/마법책상.glb', h: 0.82, cat: 'table' },
    { id: 'deluxe_magic_desk', name: '고급 마법 책상', emoji: '🔮', cost: 25000, glb: '오픈월드/house/고급마법책상.glb', h: 0.9, cat: 'table' },
    { id: 'dressing_table', name: '화장대', emoji: '💄', cost: 16500, glb: '오픈월드/house/화장대.glb', h: 0.85, cat: 'table' },
    { id: 'magic_library', name: '마법 도서관', emoji: '📖', cost: 40000, glb: '오픈월드/house/마법도서관.glb', h: 1.35, cat: 'deco' },
    { id: 'lucky_pot', name: '행운의 화분', emoji: '🪴', cost: 8000, glb: '오픈월드/house/행운의화분.glb', h: 0.55, cat: 'plant' },
    { id: 'rose_pot', name: '장미 화분', emoji: '🌹', cost: 9000, glb: '오픈월드/house/장미화분.glb', h: 0.58, cat: 'plant' },
    { id: 'cherry_tree', name: '벚꽃 나무', emoji: '🌸', cost: 22000, glb: '오픈월드/house/벚꽃나무.glb', h: 1.6, cat: 'plant' },
    { id: 'bedroom_lamp', name: '침실 조명', emoji: '💡', cost: 6000, glb: '오픈월드/house/침실조명.glb', h: 0.72, cat: 'light' },
    { id: 'bedroom_lamp2', name: '침실 조명 2', emoji: '🔆', cost: 6500, glb: '오픈월드/house/침실조명2.glb', h: 0.75, cat: 'light' },
    { id: 'star_lamp', name: '별빛 조명', emoji: '⭐', cost: 7500, glb: '오픈월드/house/별빛조명.glb', h: 0.8, cat: 'light' },
    { id: 'ceiling_lamp', name: '천장 조명', emoji: '🏮', cost: 8500, glb: '오픈월드/house/천장조명.glb', h: 0.45, cat: 'light' },
    { id: 'dragon_statue', name: '드래곤 조각상', emoji: '🐉', cost: 45000, glb: '오픈월드/house/드래곤조각상.glb', h: 1.2, cat: 'deco' },
    { id: 'dragon_fireplace', name: '드래곤 벽난로', emoji: '🔥', cost: 38000, glb: '오픈월드/house/드래곤벽난로.glb', h: 1.1, cat: 'deco' },
    { id: 'large_fountain', name: '대형 분수', emoji: '⛲', cost: 35000, glb: '오픈월드/house/대형분수.glb', h: 1.15, cat: 'deco' },
    { id: 'aquarium', name: '수족관', emoji: '🐠', cost: 30000, glb: '오픈월드/house/수족관.glb', h: 0.95, cat: 'deco' },
    { id: 'piano', name: '피아노', emoji: '🎹', cost: 32000, glb: '오픈월드/house/피아노.glb', h: 1.05, cat: 'deco' },
  ];

  const catalogMap = {};
  CATALOG.forEach((c) => { catalogMap[c.id] = c; });

  let instance = null;

  function getItem(id) { return catalogMap[id] || null; }

  function snap(v) { return Math.round(v * 2) / 2; }

  function clampRoom(x, z) {
    const margin = 0.8;
    const hw = ROOM_W / 2 - margin;
    const hd = ROOM_D / 2 - margin;
    return {
      x: Math.max(-hw, Math.min(hw, x)),
      z: Math.max(-hd, Math.min(hd, z)),
    };
  }

  class OWHouseInteriorRenderer {
    constructor(canvas) {
      const THREE = global.THREE;
      this.THREE = THREE;
      this.canvas = canvas;
      this.active = false;
      this.canEdit = false;
      this.owner = null;
      this.plotId = null;
      this.decor = { inventory: {}, placements: [] };
      this.editMode = false;
      this.selectedItem = null;
      this.selectedPlacement = null;
      this._raf = null;
      this._furnitureMeshes = new Map();
      this._raycaster = new THREE.Raycaster();
      this._pointer = new THREE.Vector2();
      this._floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      this._intersectPt = new THREE.Vector3();
      this.humanTarget = null;
      this.humanRotY = 0;
      this.cameraYaw = Math.PI;
      this.cameraPitch = 0.35;
      this._boundPointer = this._onPointer.bind(this);
      this._boundResize = this._onResize.bind(this);
    }

    _size() {
      const w = this.canvas.clientWidth || window.innerWidth;
      const h = this.canvas.clientHeight || window.innerHeight;
      return { w, h };
    }

    async enter(opts) {
      opts = opts || {};
      const THREE = this.THREE;
      if (!THREE || !this.canvas) throw new Error('Three/canvas missing');

      if (this.active) await this.exit();

      this.owner = opts.owner;
      this.plotId = opts.plotId;
      this.canEdit = !!opts.canEdit;
      this.editMode = false;
      this.selectedItem = null;
      this.selectedPlacement = null;
      this.decor = opts.decor || { inventory: {}, placements: [] };
      this.decor.inventory = this.decor.inventory || {};
      this.decor.placements = Array.isArray(this.decor.placements) ? this.decor.placements : [];

      if (global.S && global.S.ow) {
        global.S.ow.houseInterior = {
          active: true,
          plotId: this.plotId,
          owner: this.owner,
          canEdit: this.canEdit,
          editMode: false,
          selectedItem: null,
          selectedPlacement: null,
        };
      }

      if (global.__owRaf) {
        cancelAnimationFrame(global.__owRaf);
        global.__owRaf = null;
      }
      if (global.S && global.S.ow) global.S.ow.active = false;

      const owRd = global.__owRenderer;
      this._savedOw = owRd ? {
        scene: owRd.scene,
        camera: owRd.camera,
        renderer: owRd.renderer,
      } : null;
      this.renderer = owRd && owRd.renderer ? owRd.renderer : null;
      if (!this.renderer) {
        const { w, h } = this._size();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(dpr);
        this.renderer.setSize(w, h, false);
        this._ownedRenderer = true;
      }
      this.renderer.shadowMap.enabled = true;
      if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;

      const { w, h } = this._size();
      this.renderer.setSize(w, h, false);

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xf5e6ff);
      this.scene.fog = new THREE.Fog(0xf5e6ff, 14, 28);

      this.camera = new THREE.PerspectiveCamera(52, w / h, 0.08, 60);

      this._buildRoom(opts.plotTint || 0xffb3d9);
      await this._spawnAvatar();

      this.active = true;
      this._startFurnitureQueue();
      this.canvas.addEventListener('pointerdown', this._boundPointer);
      window.addEventListener('resize', this._boundResize);
      document.body.classList.add('ow-house-interior-mode');

      this._lastT = performance.now();
      const loop = () => {
        if (!this.active) return;
        const frameStart = performance.now();
        const dt = Math.min(0.05, (frameStart - this._lastT) / 1000);
        this._lastT = frameStart;
        this._update(dt);
        if (this.renderer && this.scene && this.camera) {
          this.renderer.render(this.scene, this.camera);
        }
        this._raf = requestAnimationFrame(loop);
      };
      loop();

      if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();
    }

    _buildRoom(tint) {
      const THREE = this.THREE;
      const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8f0e8, roughness: 0.85, metalness: 0.05 });
      const wallMat = new THREE.MeshStandardMaterial({ color: 0xfff5fb, roughness: 0.9 });
      const accent = new THREE.Color(tint || 0xffb3d9);
      wallMat.color.lerp(accent, 0.12);

      const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 0.12, ROOM_D), floorMat);
      floor.position.y = -0.06;
      floor.receiveShadow = true;
      floor.name = 'hi_floor';
      this.scene.add(floor);

      const rug = new THREE.Mesh(
        new THREE.CircleGeometry(2.8, 48),
        new THREE.MeshStandardMaterial({ color: tint || 0xffb3d9, roughness: 0.75, transparent: true, opacity: 0.35 })
      );
      rug.rotation.x = -Math.PI / 2;
      rug.position.set(0, 0.02, 0);
      this.scene.add(rug);

      const wallT = 0.18;
      const mkWall = (gw, gh, gd, x, y, z) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), wallMat);
        m.position.set(x, y, z);
        m.castShadow = true;
        m.receiveShadow = true;
        this.scene.add(m);
      };
      mkWall(ROOM_W, WALL_H, wallT, 0, WALL_H / 2, -ROOM_D / 2);
      mkWall(ROOM_W, WALL_H, wallT, 0, WALL_H / 2, ROOM_D / 2);
      mkWall(wallT, WALL_H, ROOM_D, -ROOM_W / 2, WALL_H / 2, 0);
      mkWall(wallT, WALL_H, ROOM_D, ROOM_W / 2, WALL_H / 2, 0);

      const doorMat = new THREE.MeshStandardMaterial({ color: 0x42a5f5, emissive: 0x1565c0, emissiveIntensity: 0.25 });
      const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.4, 0.12), doorMat);
      door.position.set(0, 1.2, ROOM_D / 2 - 0.08);
      door.name = 'hi_exit_door';
      this.scene.add(door);

      const amb = new THREE.AmbientLight(0xfff5f8, 0.55);
      const sun = new THREE.DirectionalLight(0xffffff, 0.85);
      sun.position.set(4, 9, 6);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      const fill = new THREE.PointLight(tint || 0xffb3d9, 0.45, 18);
      fill.position.set(0, 2.8, 0);
      this.scene.add(amb, sun, fill);
    }

    async _spawnAvatar() {
      const THREE = this.THREE;
      const g = new THREE.Group();
      g.name = 'hi_avatar';
      g.position.set(0, 0, 2.5);
      this.human = g;
      this.scene.add(g);

      const buildHuman = global.getMyAvatar && global.getMyHeightCm
        ? null
        : null;

      if (global.__owRenderer?.human) {
        try {
          const src = global.__owRenderer.human;
          src.updateMatrixWorld(true);
          const clone = src.clone(true);
          clone.position.set(0, 0, 0);
          clone.rotation.set(0, 0, 0);
          clone.name = 'hi_avatar_mesh';
          g.add(clone);
          g.userData.mesh = clone;
          return;
        } catch (e) { /* fallback */ }
      }

      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.28, 0.9, 6, 12),
        new THREE.MeshStandardMaterial({ color: 0xffc1e3, roughness: 0.55 })
      );
      body.position.y = 0.75;
      g.add(body);
    }

    async _attachFurnitureMesh(group, itemId) {
      const item = getItem(itemId);
      if (!item || !global.LMOwGlb || !global.LMOwGlb.loadGlb) return;
      const gltf = await global.LMOwGlb.loadGlb(item.glb);
      const model = gltf.scene.clone(true);
      model.traverse((o) => {
        if ((o.isMesh || o.isSkinnedMesh) && o.geometry) o.geometry = o.geometry.clone();
      });
      model.name = 'hi_furn_mesh';
      const THREE = this.THREE;
      model.position.set(0, 0, 0);
      model.rotation.set(0, 0, 0);
      model.scale.set(1, 1, 1);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const h = box.max.y - box.min.y;
      const sy = h >= 0.05 ? THREE.MathUtils.clamp(item.h / h, 0.02, 6) : 1;
      model.scale.setScalar(sy);
      model.updateMatrixWorld(true);
      box.setFromObject(model);
      model.position.y = -box.min.y;
      if (global.LMGlb && typeof global.LMGlb.polishOwGlbModel === 'function') {
        global.LMGlb.polishOwGlbModel(model);
      }
      group.add(model);
      group.userData.itemId = itemId;
    }

    _startFurnitureQueue() {
      this._furnLoadQueue = (this.decor.placements || []).slice();
      this._furnLoading = false;
      const step = () => {
        if (!this.active || !this._furnLoadQueue.length) return;
        if (this._furnLoading) {
          requestAnimationFrame(step);
          return;
        }
        const p = this._furnLoadQueue.shift();
        this._furnLoading = true;
        this._addPlacementMesh(p).finally(() => {
          this._furnLoading = false;
          if (this.active && this._furnLoadQueue.length) requestAnimationFrame(step);
        });
      };
      if (this._furnLoadQueue.length) requestAnimationFrame(step);
    }

    async _addPlacementMesh(p) {
      const THREE = this.THREE;
      const g = new THREE.Group();
      g.name = 'hi_furn_' + p.id;
      g.position.set(p.x || 0, 0, p.z || 0);
      g.rotation.y = p.rotY || 0;
      g.userData.placementId = p.id;
      g.userData.itemId = p.itemId;
      await this._attachFurnitureMesh(g, p.itemId);
      if (this.editMode && this.selectedPlacement === p.id) {
        this._highlightGroup(g);
      }
      this.scene.add(g);
      this._furnitureMeshes.set(p.id, g);
    }

    _highlightGroup(g) {
      const THREE = this.THREE;
      const old = g.getObjectByName('hi_sel_ring');
      if (old) g.remove(old);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.72, 32),
        new THREE.MeshBasicMaterial({ color: 0x42a5f5, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
      );
      ring.name = 'hi_sel_ring';
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.04;
      g.add(ring);
    }

    _clearHighlights() {
      this._furnitureMeshes.forEach((g) => {
        const ring = g.getObjectByName('hi_sel_ring');
        if (ring) g.remove(ring);
      });
    }

    _update(dt) {
      if (!this.human) return;
      const WALK = 2.8;
      let moving = false;
      if (this.humanTarget) {
        const dx = this.humanTarget.x - this.human.position.x;
        const dz = this.humanTarget.z - this.human.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.15) {
          moving = true;
          const sp = WALK * dt;
          this.human.position.x += (dx / dist) * sp;
          this.human.position.z += (dz / dist) * sp;
          this.humanRotY = Math.atan2(dx, dz);
        } else {
          this.humanTarget = null;
        }
      }
      this.human.rotation.y = this.humanRotY;

      const camDist = 4.2;
      const cx = this.human.position.x - Math.sin(this.cameraYaw) * camDist;
      const cz = this.human.position.z - Math.cos(this.cameraYaw) * camDist;
      const cy = 2.1 + this.cameraPitch * 2;
      this.camera.position.lerp(new this.THREE.Vector3(cx, cy, cz), moving ? 0.12 : 0.08);
      this.camera.lookAt(this.human.position.x, 1.1, this.human.position.z);

      if (global.LMOwGlb && typeof global.LMOwGlb.tickMixers === 'function') {
        global.LMOwGlb.tickMixers(this.human);
      }
    }

    _pickFloor(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this._raycaster.intersectObjects(this.scene.children, true);
      for (const h of hits) {
        let o = h.object;
        while (o) {
          if (o.name === 'hi_floor' || o.name === 'hi_exit_door') {
            this._raycaster.ray.intersectPlane(this._floorPlane, this._intersectPt);
            return { x: snap(this._intersectPt.x), z: snap(this._intersectPt.z), exit: o.name === 'hi_exit_door' };
          }
          o = o.parent;
        }
      }
      return null;
    }

    _pickFurniture(clientX, clientY) {
      const rect = this.canvas.getBoundingClientRect();
      this._pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const meshes = [];
      this._furnitureMeshes.forEach((g) => { meshes.push(g); });
      const hits = this._raycaster.intersectObjects(meshes, true);
      if (!hits.length) return null;
      let o = hits[0].object;
      while (o && !o.userData.placementId) o = o.parent;
      return o && o.userData.placementId ? o : null;
    }

    _onPointer(ev) {
      if (!this.active) return;
      if (ev.target.closest && ev.target.closest('#ow-ui-root')) return;

      if (this.editMode && this.canEdit) {
        const furn = this._pickFurniture(ev.clientX, ev.clientY);
        if (furn) {
          this.selectedPlacement = furn.userData.placementId;
          this.selectedItem = null;
          if (global.S && global.S.ow && global.S.ow.houseInterior) {
            global.S.ow.houseInterior.selectedPlacement = this.selectedPlacement;
            global.S.ow.houseInterior.selectedItem = null;
          }
          this._clearHighlights();
          this._highlightGroup(furn);
          if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();
          return;
        }
        if (this.selectedItem) {
          const pt = this._pickFloor(ev.clientX, ev.clientY);
          if (!pt || pt.exit) return;
          const inv = this.decor.inventory[this.selectedItem] || 0;
          if (inv < 1) return;
          if ((this.decor.placements || []).length >= MAX_PLACEMENTS) {
            alert('배치 한도(' + MAX_PLACEMENTS + '개)에 도달했어요.');
            return;
          }
          const c = clampRoom(pt.x, pt.z);
          const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 999);
          const placement = { id, itemId: this.selectedItem, x: c.x, z: c.z, rotY: 0 };
          this.decor.placements.push(placement);
          this.decor.inventory[this.selectedItem] = inv - 1;
          this._addPlacementMesh(placement);
          this._saveDecor();
          if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();
          return;
        }
      }

      const pt = this._pickFloor(ev.clientX, ev.clientY);
      if (!pt) return;
      if (pt.exit) {
        this.exit();
        return;
      }
      const c = clampRoom(pt.x, pt.z);
      this.humanTarget = new this.THREE.Vector3(c.x, 0, c.z);
    }

    setEditMode(on) {
      if (!this.canEdit) return;
      this.editMode = !!on;
      this.selectedItem = null;
      this.selectedPlacement = null;
      this._clearHighlights();
      if (global.S && global.S.ow && global.S.ow.houseInterior) {
        global.S.ow.houseInterior.editMode = this.editMode;
        global.S.ow.houseInterior.selectedItem = null;
        global.S.ow.houseInterior.selectedPlacement = null;
      }
      if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();
    }

    selectPlaceItem(itemId) {
      if (!this.canEdit || !this.editMode) return;
      const inv = this.decor.inventory[itemId] || 0;
      if (inv < 1) return;
      this.selectedItem = itemId;
      this.selectedPlacement = null;
      this._clearHighlights();
      if (global.S && global.S.ow && global.S.ow.houseInterior) {
        global.S.ow.houseInterior.selectedItem = itemId;
        global.S.ow.houseInterior.selectedPlacement = null;
      }
      if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();
    }

    rotateSelected(deg) {
      if (!this.selectedPlacement) return;
      const g = this._furnitureMeshes.get(this.selectedPlacement);
      const p = (this.decor.placements || []).find((x) => x.id === this.selectedPlacement);
      if (!g || !p) return;
      p.rotY = (p.rotY || 0) + (deg * Math.PI) / 180;
      g.rotation.y = p.rotY;
      this._saveDecor();
    }

    removeSelected() {
      if (!this.canEdit || !this.selectedPlacement) return;
      const p = (this.decor.placements || []).find((x) => x.id === this.selectedPlacement);
      if (!p) return;
      const g = this._furnitureMeshes.get(this.selectedPlacement);
      if (g) {
        this.scene.remove(g);
        this._furnitureMeshes.delete(this.selectedPlacement);
      }
      this.decor.placements = this.decor.placements.filter((x) => x.id !== this.selectedPlacement);
      this.decor.inventory[p.itemId] = (this.decor.inventory[p.itemId] || 0) + 1;
      this.selectedPlacement = null;
      if (global.S && global.S.ow && global.S.ow.houseInterior) {
        global.S.ow.houseInterior.selectedPlacement = null;
      }
      this._saveDecor();
      if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();
    }

    addInventory(itemId, qty) {
      qty = qty || 1;
      this.decor.inventory[itemId] = (this.decor.inventory[itemId] || 0) + qty;
      this._saveDecor();
    }

    _saveDecor() {
      if (typeof global.owSaveHouseDecor === 'function') {
        global.owSaveHouseDecor(this.owner, this.plotId, this.decor);
      }
      if (global.S) global.S.owOwHouseDecor = { owner: this.owner, plotId: this.plotId, ...this.decor };
    }

    async exit() {
      if (!this.active) return;
      this.active = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this._raf = null;
      this.canvas.removeEventListener('pointerdown', this._boundPointer);
      window.removeEventListener('resize', this._boundResize);
      document.body.classList.remove('ow-house-interior-mode');

      if (this.scene) {
        this.scene.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
          mats.forEach((m) => m && m.dispose && m.dispose());
        });
        this.scene = null;
      }
      this._furnitureMeshes.clear();
      this.human = null;

      const owRd = global.__owRenderer;
      if (owRd && this._savedOw) {
        owRd.scene = this._savedOw.scene;
        owRd.camera = this._savedOw.camera;
      }
      if (this._ownedRenderer && this.renderer) {
        try { this.renderer.dispose(); } catch (e) {}
      }
      this.renderer = null;
      this._savedOw = null;
      this._ownedRenderer = false;

      if (global.S && global.S.ow) {
        global.S.ow.houseInterior = null;
        global.S.ow.active = true;
      }

      if (typeof global.renderOpenWorldUIPass === 'function') global.renderOpenWorldUIPass();

      if (global.__owRenderer && global.S && global.S.ow && global.S.ow.active) {
        if (typeof global.owResumeOpenWorldLoop === 'function') global.owResumeOpenWorldLoop();
      }
      if (typeof global.owMmoToast === 'function') global.owMmoToast('🌀 오픈월드로 돌아왔어요');
    }

    _onResize() {
      if (!this.renderer || !this.camera) return;
      const { w, h } = this._size();
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }

    isActive() { return this.active; }
    getDecor() { return this.decor; }
  }

  function getInstance() {
    if (!instance) {
      const canvas = document.getElementById('ow-canvas');
      if (!canvas) return null;
      instance = new OWHouseInteriorRenderer(canvas);
    }
    return instance;
  }

  global.OWHouseInterior = {
    CATALOG,
    getItem,
    getInstance,
    isActive() { return instance && instance.active; },
    async enter(opts) {
      const inst = getInstance();
      if (!inst) throw new Error('ow-canvas missing');
      await inst.enter(opts);
      return inst;
    },
    async exit() {
      if (instance) await instance.exit();
    },
    setEditMode(on) { if (instance) instance.setEditMode(on); },
    selectPlaceItem(id) { if (instance) instance.selectPlaceItem(id); },
    rotateSelected(deg) { if (instance) instance.rotateSelected(deg); },
    removeSelected() { if (instance) instance.removeSelected(); },
  };
})(typeof window !== 'undefined' ? window : global);
