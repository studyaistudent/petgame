/**
 * 무료(CC0 등) GLB 카탈로그 — 컨셉 아트(펫·아바타·NPC) 스타일에 가까운 모델 위주
 * 직접 만든 2D→3D는 assets/models/ 에 넣고 localUrl 사용
 */
window.LM_GLB_CATALOG = [
  {
    id: 'builtin',
    name: '기본 (게임 내 블록/이모지)',
    category: ['avatar', 'pet', 'npc'],
    style: 'builtin',
    concept: '컨셉 2D와 동일한 현재 방식',
    license: '내장',
    url: null,
    targetHeight: 1.75,
    scale: 1,
    yOffset: 0
  },
  /* ── 펫 (컨셉: 강아지·고양이·토끼·판다·펭귄·공룡·여우·고슴도치·돼지·병아리) ── */
  {
    id: 'pet_fox',
    name: '여우',
    category: ['pet'],
    style: 'cute',
    concept: '🦊 컨셉 펫 · Quaternius',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Animated_Animals_Pack@master/GLB/Fox.glb',
    targetHeight: 0.42,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'pet_dog',
    name: '강아지',
    category: ['pet'],
    style: 'cute',
    concept: '🐶 컨셉 펫',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Animated_Animals_Pack@master/GLB/Dog.glb',
    targetHeight: 0.4,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'pet_cat',
    name: '고양이',
    category: ['pet'],
    style: 'cute',
    concept: '🐱 컨셉 펫',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Animated_Animals_Pack@master/GLB/Cat.glb',
    targetHeight: 0.38,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'pet_panda',
    name: '판다',
    category: ['pet'],
    style: 'cute',
    concept: '🐼 컨셉 펫',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Animated_Animals_Pack@master/GLB/Panda.glb',
    targetHeight: 0.45,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'pet_penguin',
    name: '펭귄',
    category: ['pet'],
    style: 'cute',
    concept: '🐧 컨셉 펫',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Animated_Animals_Pack@master/GLB/Penguin.glb',
    targetHeight: 0.4,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'pet_duck',
    name: '오리',
    category: ['pet'],
    style: 'cute',
    concept: '🐤 병아리/새 느낌',
    license: 'CC BY 4.0 — Khronos Sample',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
    targetHeight: 0.35,
    scale: 0.9
  },
  {
    id: 'pet_parrot',
    name: '앵무새',
    category: ['pet'],
    style: 'cute',
    concept: '🦜 색감 있는 펫',
    license: 'three.js examples',
    url: 'https://threejs.org/examples/models/gltf/Parrot.glb',
    targetHeight: 0.35
  },
  {
    id: 'pet_flamingo',
    name: '플라밍고',
    category: ['pet'],
    style: 'cute',
    concept: '🦩 분홍 톤 펫',
    license: 'three.js examples',
    url: 'https://threejs.org/examples/models/gltf/Flamingo.glb',
    targetHeight: 0.5
  },
  /* 로컬 — 컨셉에 맞게 직접 넣은 GLB (파일만 추가하면 목록에 표시) */
  {
    id: 'pet_local_custom',
    name: '내 펫 GLB (직접 추가)',
    category: ['pet'],
    style: 'custom',
    concept: 'assets/models/pet/custom.glb',
    license: '직접 제작/다운로드',
    localUrl: 'assets/models/pet/custom.glb',
    targetHeight: 0.45,
    needsFile: true
  },
  /* ── 아바타 (오픈월드 — lm-ow-avatar.js · standard GLB) ── */
  {
    id: 'avatar_man',
    name: '남자 아바타 (Meshy)',
    category: ['avatar'],
    style: 'custom',
    concept: '👦 boystandard.glb · 대기',
    license: 'Meshy AI',
    format: 'glb',
    localUrl: 'Meshy_AI_Blue_Hoodie_Stance_biped/boystandard.glb',
    targetHeight: 1.72,
    preserveGlbColors: true
  },
  {
    id: 'avatar_girl',
    name: '여자 아바타 (Meshy)',
    category: ['avatar'],
    style: 'custom',
    avatarPinkTone: true,
    concept: '👧 girlstandard.glb · 대기',
    license: 'Meshy AI',
    format: 'glb',
    localUrl: 'Meshy_AI_Pastel_Bunny_Dream_biped/girlstandard.glb',
    targetHeight: 1.72,
    preserveGlbColors: true
  },
  /* ── 아바타 (무료 샘플) ── */
  {
    id: 'avatar_student_f',
    name: '소녀 (학생)',
    category: ['avatar'],
    style: 'anime',
    concept: '👧 컨셉 소녀 아바타',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Modular_Anime_Characters@main/Characters/Student%20Female.glb',
    targetHeight: 1.72,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'avatar_student_m',
    name: '소년 (학생)',
    category: ['avatar'],
    style: 'anime',
    concept: '👦 컨셉 소년 아바타',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Modular_Anime_Characters@main/Characters/Student%20Male.glb',
    targetHeight: 1.72,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'avatar_adventurer_f',
    name: '모험가 (여)',
    category: ['avatar'],
    style: 'anime',
    concept: '👗 의상 커스텀 느낌',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Modular_Anime_Characters@main/Characters/Female%20Adventurer.glb',
    targetHeight: 1.72,
    animWalk: 'Walk',
    animIdle: 'Idle'
  },
  {
    id: 'avatar_rigged',
    name: '심플 휴머노이드',
    category: ['avatar', 'npc'],
    style: 'stylized',
    concept: '기본 인간 실루엣',
    license: 'CC BY 4.0 — Khronos',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/RiggedSimple/glTF-Binary/RiggedSimple.glb',
    targetHeight: 1.65,
    animWalk: 'walk',
    animIdle: 'idle'
  },
  /* ── 오픈월드 손 무기 (상점 구매 · 손 본 부착) ── */
  {
    id: 'prop_sword_blue_m',
    name: '블루 검 (남)',
    category: ['prop', 'weapon'],
    style: 'custom',
    concept: '남자 블루검.glb · 오픈월드 상점',
    license: '직접 제작',
    localUrl: '남자 블루검.glb',
    altLocalUrls: ['./남자 블루검.glb'],
    targetHeight: 0.55,
    preserveGlbColors: true,
    beautify: false,
    handAttach: {
      side: 'right',
      gripMode: 'handle',
      gripEnd: 'auto',
      gripInset: 0.06,
      bladeUp: true,
      position: [0, 0.02, 0.05],
      rotation: [-1.5708, 0.2, 0],
      targetLen: 0.48,
      meshyOw: {
        position: [0.01, 0.16, -0.01],
        rotation: [0.55, 1.5708, 1.1],
        gripInset: 0.03
      }
    },
    owShop: { key: 'blue', gender: '남성', cost: 42000, emoji: '⚔️', atkBonus: 30 }
  },
  {
    id: 'prop_sword_pink_f',
    name: '핑크 검 (여)',
    category: ['prop', 'weapon'],
    style: 'custom',
    concept: '여자 핑크검.glb · 오픈월드 상점',
    license: '직접 제작',
    localUrl: '여자 핑크검.glb',
    altLocalUrls: ['./여자 핑크검.glb'],
    targetHeight: 0.55,
    preserveGlbColors: true,
    beautify: false,
    handAttach: {
      side: 'right',
      gripMode: 'handle',
      gripEnd: 'auto',
      gripInset: 0.06,
      bladeUp: true,
      position: [0, 0.02, 0.05],
      rotation: [-1.5708, 0.2, 0],
      targetLen: 0.48,
      meshyOw: {
        position: [0.01, 0.16, -0.01],
        rotation: [0.55, 1.5708, 1.1],
        gripInset: 0.03
      }
    },
    owShop: { key: 'pink', gender: '여성', cost: 42000, emoji: '🗡️', atkBonus: 30 }
  },
  /* ── NPC (컨셉: 상인·약초·경비·방랑자) ── */
  {
    id: 'npc_merchant',
    name: '상인 NPC',
    category: ['npc'],
    style: 'stylized',
    concept: '🏪 낚시 상점·마을 NPC',
    license: 'CC0 — Quaternius',
    url: 'https://cdn.jsdelivr.net/gh/Quaternius/Ultimate_Modular_Anime_Characters@main/Characters/Female%20Adventurer.glb',
    targetHeight: 1.7,
    animIdle: 'Idle'
  },
  {
    id: 'npc_guard',
    name: '경비 NPC',
    category: ['npc'],
    style: 'stylized',
    concept: '🛡️ 경비 역할',
    license: 'CC BY 4.0 — Khronos',
    url: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/CesiumMan/glTF-Binary/CesiumMan.glb',
    targetHeight: 1.75,
    scale: 0.95
  },
  {
    id: 'npc_local',
    name: '내 NPC GLB',
    category: ['npc'],
    style: 'custom',
    concept: 'assets/models/npc/merchant.glb',
    license: '직접 제작',
    localUrl: 'assets/models/npc/merchant.glb',
    targetHeight: 1.7,
    needsFile: true
  }
];

window.LM_GLB_STYLE_TAGS = {
  cute: '귀여운·치비',
  anime: '애니·아이돌',
  stylized: '양식화',
  custom: '직접 추가',
  builtin: '기본'
};
