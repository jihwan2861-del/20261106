/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import {
  AnimalType,
  ARENA_BRIDGES,
  ARENA_JUMP_PADS,
  ARENA_OBSTACLES,
  ARENA_PLATFORMS,
  ARENA_SPEED_ZONES,
  DEFAULT_PHYSICS_CONFIG,
} from './config';

// Shared 3-step toon gradient map for bright pastel cel-shading
let sharedToonGradient: THREE.DataTexture | null = null;
function getToonGradient(): THREE.DataTexture {
  if (!sharedToonGradient) {
    const colors = new Uint8Array([145, 210, 255]);
    const tex = new THREE.DataTexture(colors, 3, 1, THREE.RedFormat);
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;
    sharedToonGradient = tex;
  }
  return sharedToonGradient;
}

let sharedShadowTexture: THREE.CanvasTexture | null = null;
export function getRadialShadowTexture(): THREE.CanvasTexture {
  if (!sharedShadowTexture) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
    grad.addColorStop(0, 'rgba(28, 36, 48, 0.55)');
    grad.addColorStop(0.65, 'rgba(28, 36, 48, 0.24)');
    grad.addColorStop(1, 'rgba(28, 36, 48, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    sharedShadowTexture = tex;
  }
  return sharedShadowTexture;
}

/**
 * Generates a high-resolution procedural face + body marking texture for each spherical animal
 * so that both the back/top view and front/side views have crisp cartoon markings, blushes, and eyes.
 */
function createAnimalSkinTexture(animal: AnimalType, expression: 'normal' | 'impact' = 'normal'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (animal === 'puppy') {
    // Shiba puppy: warm tan upper body, soft cream belly & lower face
    ctx.fillStyle = '#F5AD56';
    ctx.fillRect(0, 0, 512, 512);

    // Cream belly / lower half + cheek mask
    ctx.fillStyle = '#FFF6E6';
    ctx.fillRect(0, 275, 512, 237);

    // Front face mask (around u = 0.5, v = 0.5)
    ctx.beginPath();
    ctx.ellipse(256, 265, 118, 95, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cute cream eyebrow dots
    ctx.fillStyle = '#FFF6E6';
    ctx.beginPath();
    ctx.ellipse(215, 175, 16, 11, -0.2, 0, Math.PI * 2);
    ctx.ellipse(297, 175, 16, 11, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Rosy cheeks
    ctx.fillStyle = '#FF9482';
    ctx.beginPath();
    ctx.ellipse(178, 250, 20, 12, 0, 0, Math.PI * 2);
    ctx.ellipse(334, 250, 20, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (animal === 'cat') {
    // Grey tabby cat: warm cool-grey upper coat, soft white lower belly
    ctx.fillStyle = '#8B8999';
    ctx.fillRect(0, 0, 512, 512);

    ctx.fillStyle = '#F7F6FA';
    ctx.fillRect(0, 285, 512, 227);
    ctx.beginPath();
    ctx.ellipse(256, 278, 115, 88, 0, 0, Math.PI * 2);
    ctx.fill();

    // Darker tabby stripes on forehead & back
    ctx.fillStyle = '#5D5B6B';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.roundRect(256 + i * 28 - 7, 110, 14, 48, 7);
      ctx.fill();
      // Back stripes (around u = 0 or 1)
      ctx.beginPath();
      ctx.roundRect(30 + (i + 1) * 20, 150, 12, 55, 6);
      ctx.fill();
    }

    // Whiskers on cheeks
    ctx.strokeStyle = '#3B3646';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    [-1, 1].forEach((dir) => {
      const bx = 256 + dir * 82;
      [-8, 8].forEach((dy) => {
        ctx.beginPath();
        ctx.moveTo(bx, 244 + dy);
        ctx.lineTo(bx + dir * 32, 240 + dy * 1.4);
        ctx.stroke();
      });
    });

    // Pink blush
    ctx.fillStyle = '#FFA8BA';
    ctx.beginPath();
    ctx.ellipse(186, 252, 16, 10, 0, 0, Math.PI * 2);
    ctx.ellipse(326, 252, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Pastel pink pig
    ctx.fillStyle = '#F9A8C9';
    ctx.fillRect(0, 0, 512, 512);

    // Soft lighter pink belly
    ctx.fillStyle = '#FFD9EA';
    ctx.fillRect(0, 310, 512, 202);

    // Rosy cheeks
    ctx.fillStyle = '#F46C9B';
    ctx.beginPath();
    ctx.ellipse(176, 252, 20, 13, 0, 0, Math.PI * 2);
    ctx.ellipse(336, 252, 20, 13, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Facial eyes & mouth (drawn around center u=0.5, v=0.45)
  ctx.strokeStyle = '#2B1E1A';
  ctx.fillStyle = '#2B1E1A';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (expression === 'impact') {
    // "> <" tight impact eyes!
    ctx.beginPath();
    ctx.moveTo(192, 204);
    ctx.lineTo(216, 218);
    ctx.lineTo(192, 232);
    ctx.moveTo(320, 204);
    ctx.lineTo(296, 218);
    ctx.lineTo(320, 232);
    ctx.stroke();
  } else {
    // Happy curved arcade eyes + shiny pupils
    ctx.beginPath();
    ctx.arc(206, 218, 13, 0, Math.PI * 2);
    ctx.arc(306, 218, 13, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(202, 213, 5, 0, Math.PI * 2);
    ctx.arc(302, 213, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Cute cat/dog mouth and tongue
  if (animal !== 'pig') {
    ctx.fillStyle = '#FF6F7D';
    ctx.beginPath();
    ctx.arc(256, 252, 16, 0, Math.PI);
    ctx.fill();

    ctx.strokeStyle = '#2B1E1A';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(244, 244, 12, 0.15, Math.PI - 0.15);
    ctx.arc(268, 244, 12, 0.15, Math.PI - 0.15);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface CharacterModelHandle {
  root: THREE.Group;
  bodyVisual: THREE.Group;
  tailMesh: THREE.Object3D;
  shadowDisc: THREE.Mesh;
  aimRing: THREE.Mesh;
  invincibleHalo: THREE.Mesh;
  setExpression: (expr: 'normal' | 'impact') => void;
}

/**
 * Builds a composite 8–12 part 3D spherical animal character (`THREE.Group`)
 * matching the reference illustrations:
 * - Puppy: Cream/tan spherical body, pointy outer+inner ears, snout, red collar, gold bone tag, stubby paws, puffy white tail
 * - Cat: Grey striped spherical body, triangle outer+pink inner ears, button nose, paws, curved tail
 * - Pig: Pink spherical body, 3D protruding oval snout with two nostrils, floppy ears, paws, curly tail
 */
export function createAnimalCharacterModel(
  animal: AnimalType,
  isPlayer: boolean
): CharacterModelHandle {
  const root = new THREE.Group();
  const bodyVisual = new THREE.Group();
  // Pivot at bottom-center: sphere of baseRadius 1.0 sits with center at y = 0.92
  bodyVisual.position.set(0, 0.92, 0);
  root.add(bodyVisual);

  const gradientMap = getToonGradient();
  const normalTex = createAnimalSkinTexture(animal, 'normal');
  const impactTex = createAnimalSkinTexture(animal, 'impact');

  const bodyMat = new THREE.MeshToonMaterial({
    map: normalTex,
    gradientMap,
  });

  // 1. Primary Silhouette: Slightly plump spherical body
  const sphereGeo = new THREE.SphereGeometry(0.95, 28, 24);
  // Rotate sphere so UV center (u=0.5, face) faces +Z (same side as 3D nose, collar bone tag, and pig snout)
  sphereGeo.rotateY(-Math.PI / 2);
  const bodyMesh = new THREE.Mesh(sphereGeo, bodyMat);
  bodyMesh.scale.set(1.04, 0.96, 1.02);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  bodyVisual.add(bodyMesh);

  // Subtle cartoon outline shell (inverted hull) for crisp cel-shaded silhouette readability
  const outlineMat = new THREE.MeshBasicMaterial({
    color: 0x2c1d19,
    side: THREE.BackSide,
  });
  const outlineMesh = new THREE.Mesh(sphereGeo, outlineMat);
  outlineMesh.scale.set(1.085, 1.005, 1.065);
  bodyVisual.add(outlineMesh);

  // 2. Secondary Read: Ears, Collar, Snout
  const earOuterColor =
    animal === 'puppy' ? 0xf5ad56 : animal === 'cat' ? 0x7c7a8a : 0xf794be;
  const earInnerColor =
    animal === 'puppy' ? 0xffd7ba : animal === 'cat' ? 0xffb3c4 : 0xf26b9a;

  const earOuterMat = new THREE.MeshToonMaterial({ color: earOuterColor, gradientMap });
  const earInnerMat = new THREE.MeshToonMaterial({ color: earInnerColor, gradientMap });

  [-1, 1].forEach((side) => {
    const earGroup = new THREE.Group();
    if (animal === 'pig') {
      // Floppy rounded pig ears
      const earGeo = new THREE.ConeGeometry(0.26, 0.42, 16);
      const earMesh = new THREE.Mesh(earGeo, earOuterMat);
      earMesh.scale.set(1.1, 0.85, 0.55);
      earMesh.castShadow = true;
      earGroup.add(earMesh);
      earGroup.position.set(side * 0.62, 0.72, 0.1);
      earGroup.rotation.z = -side * 0.68;
      earGroup.rotation.x = -0.25;
    } else {
      // Pointy triangle ears for Puppy and Cat
      const earGeo = new THREE.ConeGeometry(0.3, 0.52, 16);
      const earMesh = new THREE.Mesh(earGeo, earOuterMat);
      earMesh.scale.set(1.0, 1.0, 0.58);
      earMesh.castShadow = true;
      earGroup.add(earMesh);

      const innerGeo = new THREE.ConeGeometry(0.18, 0.36, 12);
      const innerMesh = new THREE.Mesh(innerGeo, earInnerMat);
      innerMesh.scale.set(1.0, 1.0, 0.35);
      innerMesh.position.set(0, -0.02, 0.09);
      earGroup.add(innerMesh);

      earGroup.position.set(side * 0.52, 0.78, 0.05);
      earGroup.rotation.z = -side * 0.36;
    }
    bodyVisual.add(earGroup);
  });

  // 3. Animal-Specific Accent Details (Collar + Bone Tag, Pig Snout, Paws, Tail)
  let tailMesh: THREE.Object3D;

  if (animal === 'puppy') {
    // Red Collar around lower neck/body
    const collarGeo = new THREE.TorusGeometry(0.88, 0.085, 12, 32);
    collarGeo.rotateX(Math.PI / 2);
    const collarMat = new THREE.MeshStandardMaterial({
      color: 0xe03e49,
      roughness: 0.4,
      metalness: 0.1,
    });
    const collar = new THREE.Mesh(collarGeo, collarMat);
    collar.position.set(0, -0.25, 0);
    bodyVisual.add(collar);

    // Golden Bone Tag on front of collar (+Z)
    const boneGroup = new THREE.Group();
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xffcf40,
      roughness: 0.25,
      metalness: 0.65,
    });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.08), goldMat);
    boneGroup.add(bar);
    [-0.12, 0.12].forEach((bx) => {
      [-0.05, 0.05].forEach((by) => {
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 10), goldMat);
        knob.position.set(bx, by, 0);
        boneGroup.add(knob);
      });
    });
    boneGroup.position.set(0, -0.26, 0.94);
    bodyVisual.add(boneGroup);

    // 3D dark brown button nose on face (+Z)
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 12),
      new THREE.MeshStandardMaterial({ color: 0x3b2314, roughness: 0.3 })
    );
    nose.scale.set(1.3, 0.9, 0.9);
    nose.position.set(0, 0.05, 0.96);
    bodyVisual.add(nose);

    // Fluffy cream round tail on the back (-Z)
    const tailGroup = new THREE.Group();
    const tailMat = new THREE.MeshToonMaterial({ color: 0xfff6e6, gradientMap });
    const mainPuff = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 16), tailMat);
    const tipPuff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), tailMat);
    tipPuff.position.set(0, 0.15, -0.1);
    tailGroup.add(mainPuff, tipPuff);
    tailGroup.position.set(0, -0.15, -0.92);
    bodyVisual.add(tailGroup);
    tailMesh = tailGroup;
  } else if (animal === 'cat') {
    // Cute pink button nose on face (+Z)
    const nose = new THREE.Mesh(
      new THREE.SphereGeometry(0.085, 12, 12),
      new THREE.MeshToonMaterial({ color: 0xff8da1, gradientMap })
    );
    nose.scale.set(1.2, 0.85, 0.85);
    nose.position.set(0, 0.02, 0.96);
    bodyVisual.add(nose);

    // Striped curved cat tail on back (-Z)
    const tailGroup = new THREE.Group();
    const tailGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.68, 12);
    const tailBody = new THREE.Mesh(
      tailGeo,
      new THREE.MeshToonMaterial({ color: 0x6f6d7d, gradientMap })
    );
    tailBody.position.set(0, 0.22, -0.12);
    tailBody.rotation.x = -0.55;
    const tailTip = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 12),
      new THREE.MeshToonMaterial({ color: 0x4b4957, gradientMap })
    );
    tailTip.position.set(0, 0.5, -0.28);
    tailGroup.add(tailBody, tailTip);
    tailGroup.position.set(0, -0.1, -0.85);
    bodyVisual.add(tailGroup);
    tailMesh = tailGroup;
  } else {
    // Protruding 3D Pig Snout with two dark nostrils on face (+Z)
    const snoutGroup = new THREE.Group();
    const snoutCylinder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.26, 0.18, 20),
      new THREE.MeshToonMaterial({ color: 0xf46c9b, gradientMap })
    );
    snoutCylinder.rotation.x = Math.PI / 2;
    snoutCylinder.scale.set(1.3, 1.0, 0.95);
    snoutGroup.add(snoutCylinder);

    const nostrilMat = new THREE.MeshBasicMaterial({ color: 0x4a152b });
    [-0.09, 0.09].forEach((nx) => {
      const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10), nostrilMat);
      nostril.scale.set(0.85, 1.25, 0.5);
      nostril.position.set(nx, 0, 0.09);
      snoutGroup.add(nostril);
    });
    snoutGroup.position.set(0, 0.02, 0.94);
    bodyVisual.add(snoutGroup);

    // Cute curly pig tail on the back (-Z)
    const tailGroup = new THREE.Group();
    const curl = new THREE.Mesh(
      new THREE.TorusGeometry(0.15, 0.055, 10, 20, Math.PI * 1.65),
      new THREE.MeshToonMaterial({ color: 0xf46c9b, gradientMap })
    );
    curl.position.set(0, 0.05, -0.08);
    tailGroup.add(curl);
    tailGroup.position.set(0, -0.05, -0.92);
    bodyVisual.add(tailGroup);
    tailMesh = tailGroup;
  }

  // Stubby side paws (2 little nubs on left & right)
  const pawMat = new THREE.MeshToonMaterial({
    color: animal === 'puppy' ? 0xf5ad56 : animal === 'cat' ? 0xf7f6fa : 0xf9a8c9,
    gradientMap,
  });
  [-1, 1].forEach((side) => {
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), pawMat);
    paw.scale.set(0.7, 0.9, 1.2);
    paw.position.set(side * 0.92, -0.18, 0.15);
    bodyVisual.add(paw);
  });

  // Ground contact shadow disc (stays flat on floor below character)
  const shadowGeo = new THREE.CircleGeometry(1.15, 24);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: getRadialShadowTexture(),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.set(0, 0.02, 0);
  root.add(shadowDisc);

  // Golden selection / player ring on floor (matches the glowing yellow ring around '나' in the reference!)
  const ringGeo = new THREE.RingGeometry(1.02, 1.22, 32);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: isPlayer ? 0xffdf4d : 0xffffff,
    transparent: true,
    opacity: isPlayer ? 0.85 : 0.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const aimRing = new THREE.Mesh(ringGeo, ringMat);
  aimRing.position.set(0, 0.03, 0);
  root.add(aimRing);

  // Invincibility bubble halo (visible after respawn)
  const haloGeo = new THREE.SphereGeometry(1.18, 20, 16);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x7ef9ff,
    transparent: true,
    opacity: 0,
    wireframe: true,
    depthWrite: false,
  });
  const invincibleHalo = new THREE.Mesh(haloGeo, haloMat);
  invincibleHalo.position.set(0, 0.92, 0);
  root.add(invincibleHalo);

  return {
    root,
    bodyVisual,
    tailMesh,
    shadowDisc,
    aimRing,
    invincibleHalo,
    setExpression: (expr) => {
      bodyMat.map = expr === 'impact' ? impactTex : normalTex;
      bodyMat.needsUpdate = true;
    },
  };
}

/**
 * Builds a 5-pointed 3D Golden Star Coin item matching the reference screenshot
 * (golden coin ring + embossed 3D star inside + ground shadow).
 */
export function createStarItemModel(isMegaStar = false): THREE.Group {
  const group = new THREE.Group();
  const scale = isMegaStar ? 1.45 : 1.0;

  // Coin body (golden cylinder facing upward/tilted)
  const coinGroup = new THREE.Group();
  const goldMat = new THREE.MeshStandardMaterial({
    color: isMegaStar ? 0xffd700 : 0xffcf33,
    emissive: isMegaStar ? 0xff8800 : 0xd48800,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.55,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xffea79,
    emissive: 0xffaa00,
    emissiveIntensity: 0.25,
    roughness: 0.2,
    metalness: 0.6,
  });

  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62 * scale, 0.62 * scale, 0.18 * scale, 24), goldMat);
  disc.rotation.x = Math.PI / 2;
  disc.castShadow = true;
  coinGroup.add(disc);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62 * scale, 0.07 * scale, 10, 24), rimMat);
  coinGroup.add(rim);

  // 5-pointed star shape on both sides of the coin
  const starShape = new THREE.Shape();
  const outerR = 0.38 * scale;
  const innerR = 0.17 * scale;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const x = Math.cos(angle) * r;
    const y = -Math.sin(angle) * r;
    if (i === 0) starShape.moveTo(x, y);
    else starShape.lineTo(x, y);
  }
  starShape.closePath();

  const starGeo = new THREE.ExtrudeGeometry(starShape, {
    depth: 0.24 * scale,
    bevelEnabled: true,
    bevelThickness: 0.03 * scale,
    bevelSize: 0.02 * scale,
    bevelSegments: 2,
  });
  starGeo.center();
  const starMesh = new THREE.Mesh(starGeo, rimMat);
  coinGroup.add(starMesh);

  coinGroup.position.set(0, 0.72 * scale, 0);
  coinGroup.name = 'spinner';
  group.add(coinGroup);

  // Soft shadow disc on ground
  const shadowGeo = new THREE.CircleGeometry(0.65 * scale, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadow = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      map: getRadialShadowTexture(),
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    })
  );
  shadow.position.set(0, 0.02, 0);
  group.add(shadow);

  return group;
}

/**
 * Generates procedural stone pavement, grassy lawn, and 4 cardinal crossroads for the expanded main hub.
 */
function createArenaFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Rich warm meadow green
  ctx.fillStyle = '#84B853';
  ctx.fillRect(0, 0, 1024, 1024);

  const cx = 512;
  const cy = 512;

  // Outer stone rim
  ctx.fillStyle = '#9D8893';
  ctx.beginPath();
  ctx.arc(cx, cy, 502, 0, Math.PI * 2);
  ctx.fill();

  // Inner grassy lawn
  ctx.fillStyle = '#88BE58';
  ctx.beginPath();
  ctx.arc(cx, cy, 468, 0, Math.PI * 2);
  ctx.fill();

  // Subtle darker grass patches for organic depth
  ctx.fillStyle = '#79AF4B';
  [
    [260, 280, 95],
    [760, 300, 90],
    [290, 740, 105],
    [730, 720, 95],
    [512, 320, 70],
    [512, 700, 70],
  ].forEach(([gx, gy, gr]) => {
    ctx.beginPath();
    ctx.arc(gx, gy, gr, 0, Math.PI * 2);
    ctx.fill();
  });

  // 4 Cardinal Cobblestone Crossroads leading to North, South, East, West bridges
  ctx.fillStyle = '#A8949E';
  ctx.fillRect(cx - 48, 24, 96, 976);
  ctx.fillRect(24, cy - 48, 976, 96);

  // Outer & Inner paved stone rings
  ctx.strokeStyle = '#A8949E';
  ctx.lineWidth = 74;
  ctx.beginPath();
  ctx.arc(cx, cy, 320, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 52;
  ctx.beginPath();
  ctx.arc(cx, cy, 155, 0, Math.PI * 2);
  ctx.stroke();

  // Dark stone border lines on outer ring
  ctx.strokeStyle = '#7A6871';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, 283, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 357, 0, Math.PI * 2);
  ctx.stroke();

  // Radial cobble seams on the outer stone ring
  for (let i = 0; i < 32; i++) {
    const angle = (i / 32) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * 284, cy + Math.sin(angle) * 284);
    ctx.lineTo(cx + Math.cos(angle) * 356, cy + Math.sin(angle) * 356);
    ctx.stroke();
  }

  // Scattered stone flagstones inside the lawn quadrants
  const stones = [
    { x: 360, y: 390, rx: 38, ry: 26 },
    { x: 660, y: 390, rx: 38, ry: 26 },
    { x: 360, y: 640, rx: 38, ry: 26 },
    { x: 660, y: 640, rx: 38, ry: 26 },
    { x: 512, y: 820, rx: 46, ry: 30 },
  ];
  ctx.fillStyle = '#A8949E';
  stones.forEach((s) => {
    ctx.beginPath();
    ctx.ellipse(s.x, s.y, s.rx, s.ry, 0.2, 0, Math.PI * 2);
    ctx.fill();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Creates a glowing chevron texture for the Jump Pads, Speed Dash Zones, and Stone Ramp.
 */
function createChevronTexture(bgColor: string, arrowColor: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 256, 256);

  ctx.strokeStyle = arrowColor;
  ctx.lineWidth = 26;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  [95, 175].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(64, y + 32);
    ctx.lineTo(128, y - 22);
    ctx.lineTo(192, y + 32);
    ctx.stroke();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds the expanded 5-Island Fantasy Archipelago Arena:
 * - Central Circular Ruins Hub (radius 20.0) with crossroads, stone rings, pillars, and speed dash strips
 * - North Ancient Sanctuary Platform (y = 3.4) with grand temple archway, waterfalls, and stone chevron ramp
 * - West Blossom & Bouncy Mushroom Island (y = 0.4) with pink cherry blossom trees, giant bouncy mushrooms, and wooden bridge
 * - East Arcane Crystal Terrace (y = 2.2) with glowing cyan/violet crystal spires and sloped crystal bridge
 * - South Golden Oasis Islet (y = 0.0) with golden sand, palm totems, treasure chest, and stone causeway
 * - 5 Jump Pads & 4 Speed Dash Zones
 */
export function createFantasyArena(scene: THREE.Scene): {
  jumpPadMeshes: THREE.Object3D[];
  obstacleMeshes: Map<string, THREE.Object3D>;
  waterMesh: THREE.Mesh;
} {
  const arenaGroup = new THREE.Group();
  scene.add(arenaGroup);

  const r = DEFAULT_PHYSICS_CONFIG.arenaRadius;
  const toonGrad = getToonGradient();

  // 1. Surrounding Sky-Blue Water Moat (expanded to 190x190 for the 5-island archipelago)
  const waterGeo = new THREE.PlaneGeometry(190, 190);
  waterGeo.rotateX(-Math.PI / 2);
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x38b6ff,
    roughness: 0.2,
    metalness: 0.1,
  });
  const waterMesh = new THREE.Mesh(waterGeo, waterMat);
  waterMesh.position.set(0, -2.2, 0);
  waterMesh.receiveShadow = true;
  arenaGroup.add(waterMesh);

  // Cute green lily pads floating on the water moat between islands
  const lilyMat = new THREE.MeshToonMaterial({ color: 0x6ec85f, gradientMap: toonGrad });
  const lilyPositions = [
    [-16.5, -15.5],
    [-18.8, -13.2],
    [16.2, -16.0],
    [19.0, -13.5],
    [-16.5, 15.8],
    [-14.2, 18.5],
    [16.8, 15.5],
    [14.5, 18.2],
    [-23.5, -9.5],
    [23.5, 9.5],
  ];
  lilyPositions.forEach(([lx, lz]) => {
    const lily = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.05, 0.08, 16, 1, false, 0, Math.PI * 1.85),
      lilyMat
    );
    lily.position.set(lx, -2.14, lz);
    lily.rotation.y = Math.random() * Math.PI * 2;
    arenaGroup.add(lily);
  });

  // 2. Main Circular Hub Base (tapered cliff cylinder + top stone/grass surface)
  const cliffMat = new THREE.MeshStandardMaterial({
    color: 0x8e7f8c,
    roughness: 0.85,
    metalness: 0.05,
  });
  const baseBody = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 3.4, 56), cliffMat);
  baseBody.position.set(0, -1.72, 0);
  baseBody.receiveShadow = true;
  arenaGroup.add(baseBody);

  const floorTex = createArenaFloorTexture();
  const topDiscGeo = new THREE.CircleGeometry(r, 56);
  topDiscGeo.rotateX(-Math.PI / 2);
  const topDiscMat = new THREE.MeshStandardMaterial({
    map: floorTex,
    roughness: 0.88,
    metalness: 0.04,
  });
  const topDisc = new THREE.Mesh(topDiscGeo, topDiscMat);
  topDisc.position.set(0, 0.0, 0);
  topDisc.receiveShadow = true;
  arenaGroup.add(topDisc);

  // Decorative Perimeter Stone Blocks & Bushes (leaving clear openings at N/S/E/W bridges & fall-off gaps)
  const stoneMat = new THREE.MeshStandardMaterial({
    color: 0xbdb0b9,
    roughness: 0.78,
    metalness: 0.05,
  });
  const mossMat = new THREE.MeshStandardMaterial({
    color: 0x83b458,
    roughness: 0.85,
  });
  const blossomGrassMat = new THREE.MeshStandardMaterial({
    color: 0x9AD26B,
    roughness: 0.82,
  });
  const crystalFloorMat = new THREE.MeshStandardMaterial({
    color: 0x7A729B,
    roughness: 0.65,
    metalness: 0.15,
  });
  const oasisFloorMat = new THREE.MeshStandardMaterial({
    color: 0xF2D279,
    roughness: 0.8,
  });
  const flowerPetalMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const flowerCenterMat = new THREE.MeshBasicMaterial({ color: 0xffce3b });

  for (let i = 0; i < 40; i++) {
    const angle = (i / 40) * Math.PI * 2;
    const bx = Math.cos(angle) * (r - 0.5);
    const bz = Math.sin(angle) * (r - 0.5);

    // Leave wide openings at North, South, East, West bridge entrances
    if (Math.abs(bx) < 3.4 || Math.abs(bz) < 3.4) continue;
    // Leave periodic open gaps so characters can still be knocked off the hub
    if (i % 3 === 1) continue;

    const blockH = 0.45 + (i % 3) * 0.18;
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.5, blockH, 0.88), stoneMat);
    block.position.set(bx, blockH / 2, bz);
    block.rotation.y = -angle + Math.PI / 2;
    block.castShadow = true;
    block.receiveShadow = true;
    arenaGroup.add(block);

    if (i % 2 === 0) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.58, 10, 8), mossMat);
      bush.scale.set(1.2, 0.7, 1.0);
      bush.position.set(bx * 0.96, blockH + 0.1, bz * 0.96);
      arenaGroup.add(bush);

      const flower = new THREE.Group();
      flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), flowerCenterMat));
      for (let p = 0; p < 5; p++) {
        const pa = (p / 5) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), flowerPetalMat);
        petal.position.set(Math.cos(pa) * 0.14, 0, Math.sin(pa) * 0.14);
        flower.add(petal);
      }
      flower.position.set(bx * 0.95, blockH + 0.48, bz * 0.95);
      arenaGroup.add(flower);
    }
  }

  // 3. Build the 4 Outer Themed Islands (`ARENA_PLATFORMS`)
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, roughness: 0.75 });
  const waterfallMat = new THREE.MeshBasicMaterial({
    color: 0x7ce8ff,
    transparent: true,
    opacity: 0.78,
  });

  ARENA_PLATFORMS.forEach((plat) => {
    const islandGroup = new THREE.Group();
    islandGroup.position.set(plat.x, 0, plat.z);
    arenaGroup.add(islandGroup);

    // Cliff cylinder down into water
    const cylH = plat.height + 2.4;
    const cliff = new THREE.Mesh(
      new THREE.CylinderGeometry(plat.radius, plat.radius * 0.9, cylH, 32),
      cliffMat
    );
    cliff.position.y = plat.height - cylH / 2;
    cliff.receiveShadow = true;
    islandGroup.add(cliff);

    // Top surface disc
    const topMat =
      plat.theme === 'sanctuary'
        ? mossMat
        : plat.theme === 'blossom'
        ? blossomGrassMat
        : plat.theme === 'crystal'
        ? crystalFloorMat
        : oasisFloorMat;

    const topCap = new THREE.Mesh(
      new THREE.CylinderGeometry(plat.radius, plat.radius, 0.24, 32),
      topMat
    );
    topCap.position.y = plat.height - 0.1;
    topCap.receiveShadow = true;
    islandGroup.add(topCap);

    // Inner decorative ring on each island
    const innerRing = new THREE.Mesh(
      new THREE.RingGeometry(plat.radius * 0.58, plat.radius * 0.72, 28),
      new THREE.MeshBasicMaterial({
        color:
          plat.theme === 'sanctuary'
            ? 0xffe066
            : plat.theme === 'blossom'
            ? 0xffb3c6
            : plat.theme === 'crystal'
            ? 0x72efdd
            : 0xff9f1c,
        side: THREE.DoubleSide,
      })
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = plat.height + 0.03;
    islandGroup.add(innerRing);

    if (plat.theme === 'sanctuary') {
      // North Ancient Sanctuary: Glowing pedestal, Ancient Temple Archway at north rim, Twin Waterfalls
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.85, 0.35, 16),
        new THREE.MeshStandardMaterial({ color: 0x9b7ede, roughness: 0.4 })
      );
      pedestal.position.set(0, plat.height + 0.16, 0);
      islandGroup.add(pedestal);

      // Grand Stone Temple Archway on the back edge of North Sanctuary
      [-2.6, 2.6].forEach((ax) => {
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.52, 3.6, 12), stoneMat);
        col.position.set(ax, plat.height + 1.8, -plat.radius * 0.72);
        col.castShadow = true;
        islandGroup.add(col);
      });
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.75, 1.1), stoneMat);
      lintel.position.set(0, plat.height + 3.7, -plat.radius * 0.72);
      lintel.castShadow = true;
      islandGroup.add(lintel);

      // Twin waterfalls flanking the sanctuary ramp
      [-4.2, 4.2].forEach((wx) => {
        const wf = new THREE.Mesh(new THREE.BoxGeometry(1.75, plat.height + 2.2, 0.32), waterfallMat);
        wf.position.set(wx, (plat.height - 2.2) / 2, plat.radius * 0.78);
        islandGroup.add(wf);
      });
    } else if (plat.theme === 'blossom') {
      // West Blossom Island: Cute Pink Cherry Blossom Trees on outer rim + fallen petals
      const blossomFoliageMat = new THREE.MeshToonMaterial({
        color: 0xffa6c9,
        gradientMap: toonGrad,
      });
      [
        [-plat.radius * 0.65, -plat.radius * 0.45],
        [-plat.radius * 0.65, plat.radius * 0.45],
      ].forEach(([tx, tz]) => {
        const treeGroup = new THREE.Group();
        treeGroup.position.set(tx, plat.height, tz);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.38, 2.1, 10), woodMat);
        trunk.position.y = 1.05;
        treeGroup.add(trunk);

        [
          [0, 2.4, 0, 1.25],
          [-0.7, 2.1, 0.4, 0.9],
          [0.7, 2.1, -0.4, 0.9],
        ].forEach(([cx, cy, cz, cr]) => {
          const crown = new THREE.Mesh(new THREE.SphereGeometry(cr, 14, 12), blossomFoliageMat);
          crown.position.set(cx, cy, cz);
          treeGroup.add(crown);
        });
        islandGroup.add(treeGroup);
      });
    } else if (plat.theme === 'crystal') {
      // East Crystal Terrace: Glowing Cyan/Violet Arcane Obelisk Arch on back edge
      const crystalMat = new THREE.MeshStandardMaterial({
        color: 0x48bfe3,
        emissive: 0x0077b6,
        emissiveIntensity: 0.55,
        roughness: 0.2,
        metalness: 0.4,
      });
      [-2.5, 2.5].forEach((cz) => {
        const obelisk = new THREE.Mesh(new THREE.ConeGeometry(0.65, 3.2, 6), crystalMat);
        obelisk.position.set(plat.radius * 0.72, plat.height + 1.6, cz);
        islandGroup.add(obelisk);
      });
    } else if (plat.theme === 'oasis') {
      // South Golden Oasis Islet: Palm-style totems & golden decorative rim on south edge
      const palmLeafMat = new THREE.MeshToonMaterial({ color: 0x52b788, gradientMap: toonGrad });
      [-2.8, 2.8].forEach((ox) => {
        const palm = new THREE.Group();
        palm.position.set(ox, plat.height, plat.radius * 0.68);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 2.2, 10), woodMat);
        trunk.position.y = 1.1;
        palm.add(trunk);
        for (let l = 0; l < 4; l++) {
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.65, 10, 8), palmLeafMat);
          leaf.scale.set(1.8, 0.35, 0.7);
          const la = (l / 4) * Math.PI * 2;
          leaf.position.set(Math.cos(la) * 0.7, 2.2, Math.sin(la) * 0.7);
          leaf.rotation.y = -la;
          palm.add(leaf);
        }
        islandGroup.add(palm);
      });
    }
  });

  // 4. Build All 4 Connecting Bridges & Sloped Ramps (`ARENA_BRIDGES`)
  const rampTex = createChevronTexture('#A99BA8', '#FFD93D');
  const crystalBridgeTex = createChevronTexture('#5E548E', '#72EFDD');

  ARENA_BRIDGES.forEach((bridge) => {
    const bw = bridge.maxX - bridge.minX;
    const bd = bridge.maxZ - bridge.minZ;
    const cx = (bridge.minX + bridge.maxX) * 0.5;
    const cz = (bridge.minZ + bridge.maxZ) * 0.5;
    const avgY = (bridge.startHeight + bridge.endHeight) * 0.5;
    const dy = bridge.endHeight - bridge.startHeight;

    const bridgeGroup = new THREE.Group();
    bridgeGroup.position.set(cx, avgY, cz);

    if (bridge.slopeAxis === 'z_north') {
      const horizLen = Math.hypot(bd, dy);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(bw, 0.42, horizLen + 0.6),
        new THREE.MeshStandardMaterial({ map: rampTex, roughness: 0.7 })
      );
      mesh.rotation.x = Math.atan2(dy, bd);
      bridgeGroup.add(mesh);
    } else if (bridge.slopeAxis === 'x_east') {
      const horizLen = Math.hypot(bw, dy);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(horizLen + 0.6, 0.42, bd),
        new THREE.MeshStandardMaterial({ map: crystalBridgeTex, roughness: 0.55 })
      );
      mesh.rotation.z = Math.atan2(dy, bw);
      bridgeGroup.add(mesh);
    } else if (bridge.slopeAxis === 'x_west') {
      // Wooden plank bridge with cute side posts
      const horizLen = Math.hypot(bw, dy);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(horizLen + 0.6, 0.36, bd),
        woodMat
      );
      mesh.rotation.z = -Math.atan2(dy, bw);
      bridgeGroup.add(mesh);

      [-bd * 0.46, bd * 0.46].forEach((rz) => {
        [-bw * 0.35, bw * 0.35].forEach((rx) => {
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.75, 10), woodMat);
          post.position.set(rx, 0.38, rz);
          bridgeGroup.add(post);
        });
      });
    } else {
      // South stone causeway
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.4, bd + 0.6), stoneMat);
      bridgeGroup.add(mesh);
    }

    arenaGroup.add(bridgeGroup);
  });

  // 5. Collidable Obstacles (`central_ruin`, `pillar`, `bumper_mushroom`, `crystal_spire`)
  const obstacleMeshes = new Map<string, THREE.Object3D>();
  const mushroomCapMat = new THREE.MeshToonMaterial({
    color: 0xff5d8f,
    gradientMap: toonGrad,
  });
  const mushroomStemMat = new THREE.MeshToonMaterial({
    color: 0xfff5e4,
    gradientMap: toonGrad,
  });
  const crystalSpireMat = new THREE.MeshStandardMaterial({
    color: 0x4cc9f0,
    emissive: 0x3a0ca3,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.35,
  });

  ARENA_OBSTACLES.forEach((obs) => {
    const obsGroup = new THREE.Group();
    const baseY = obs.baseY ?? 0;
    obsGroup.position.set(obs.x, baseY, obs.z);

    if (obs.kind === 'central_ruin') {
      const mainBlock = new THREE.Mesh(
        new THREE.CylinderGeometry(obs.radius * 0.95, obs.radius * 1.02, obs.height, 8),
        stoneMat
      );
      mainBlock.position.y = obs.height / 2;
      mainBlock.castShadow = true;
      mainBlock.receiveShadow = true;
      obsGroup.add(mainBlock);

      const mossCap = new THREE.Mesh(
        new THREE.CylinderGeometry(obs.radius * 0.98, obs.radius * 0.95, 0.38, 8),
        mossMat
      );
      mossCap.position.y = obs.height + 0.08;
      obsGroup.add(mossCap);

      const bigFlower = new THREE.Group();
      bigFlower.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 10), flowerCenterMat));
      for (let p = 0; p < 6; p++) {
        const pa = (p / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), flowerPetalMat);
        petal.scale.set(1.1, 0.5, 1.1);
        petal.position.set(Math.cos(pa) * 0.28, 0, Math.sin(pa) * 0.28);
        bigFlower.add(petal);
      }
      bigFlower.position.set(0.15, obs.height + 0.32, 0.1);
      obsGroup.add(bigFlower);
    } else if (obs.kind === 'bumper_mushroom') {
      // Giant Bouncy Mushroom Bumper with white polka dots!
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(obs.radius * 0.48, obs.radius * 0.58, obs.height * 0.65, 16),
        mushroomStemMat
      );
      stem.position.y = obs.height * 0.32;
      obsGroup.add(stem);

      const cap = new THREE.Mesh(
        new THREE.SphereGeometry(obs.radius * 1.06, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.62),
        mushroomCapMat
      );
      cap.position.y = obs.height * 0.55;
      cap.castShadow = true;
      obsGroup.add(cap);

      // Cute white spots on mushroom cap surface
      for (let s = 0; s < 5; s++) {
        const sa = (s / 5) * Math.PI * 2;
        const spot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), flowerPetalMat);
        spot.scale.set(1.1, 0.55, 1.1);
        spot.position.set(
          Math.cos(sa) * obs.radius * 0.58,
          obs.height * 0.55 + obs.radius * 0.92,
          Math.sin(sa) * obs.radius * 0.58
        );
        obsGroup.add(spot);
      }
      const topSpot = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), flowerPetalMat);
      topSpot.scale.set(1.15, 0.5, 1.15);
      topSpot.position.set(0, obs.height * 0.55 + obs.radius * 1.05, 0);
      obsGroup.add(topSpot);
    } else if (obs.kind === 'crystal_spire') {
      // Glowing Multi-Pronged Crystal Cluster
      const mainCrystal = new THREE.Mesh(
        new THREE.ConeGeometry(obs.radius * 0.78, obs.height, 6),
        crystalSpireMat
      );
      mainCrystal.position.y = obs.height * 0.5;
      mainCrystal.castShadow = true;
      obsGroup.add(mainCrystal);

      [-1, 1].forEach((side) => {
        const subCrystal = new THREE.Mesh(
          new THREE.ConeGeometry(obs.radius * 0.48, obs.height * 0.7, 6),
          crystalSpireMat
        );
        subCrystal.position.set(side * obs.radius * 0.45, obs.height * 0.32, 0.2 * side);
        subCrystal.rotation.z = -side * 0.32;
        obsGroup.add(subCrystal);
      });
    } else {
      // Fluted fantasy ruin stone column
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(obs.radius * 1.08, obs.radius * 1.14, 0.35, 16),
        stoneMat
      );
      base.position.y = 0.175;
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(obs.radius * 0.88, obs.radius * 0.92, obs.height - 0.35, 16),
        stoneMat
      );
      shaft.position.y = obs.height / 2 + 0.1;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      const mossTop = new THREE.Mesh(
        new THREE.CylinderGeometry(obs.radius * 0.96, obs.radius * 0.9, 0.28, 16),
        mossMat
      );
      mossTop.position.y = obs.height + 0.05;
      obsGroup.add(base, shaft, mossTop);
    }

    arenaGroup.add(obsGroup);
    obstacleMeshes.set(obs.id, obsGroup);
  });

  // 6. Glowing Floor Speed Dash Zones (`ARENA_SPEED_ZONES`)
  const speedZoneTex = createChevronTexture('#00B4D8', '#CAF0F8');
  ARENA_SPEED_ZONES.forEach((zone) => {
    const dashGroup = new THREE.Group();
    dashGroup.position.set(zone.x, zone.y + 0.03, zone.z);
    const angle = Math.atan2(zone.dirX, zone.dirZ);
    dashGroup.rotation.y = angle + Math.PI;

    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(zone.radius * 1.4, 0.08, zone.radius * 1.7),
      new THREE.MeshStandardMaterial({
        map: speedZoneTex,
        emissive: 0x0096c7,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      })
    );
    dashGroup.add(strip);
    arenaGroup.add(dashGroup);
  });

  // 7. Glowing Jump Pads (`ARENA_JUMP_PADS`)
  const jumpPadMeshes: THREE.Object3D[] = [];
  const padChevronTex = createChevronTexture('#FF8C42', '#FFF3B0');

  ARENA_JUMP_PADS.forEach((pad) => {
    const padGroup = new THREE.Group();
    const padY = pad.baseY ?? 0;
    padGroup.position.set(pad.x, padY + 0.04, pad.z);

    // Orient pad toward its target
    const angle = Math.atan2(pad.targetX - pad.x, pad.targetZ - pad.z);
    padGroup.rotation.y = angle + Math.PI;

    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(pad.radius, pad.radius * 1.12, 0.26, 20),
      new THREE.MeshStandardMaterial({
        color: 0x8d6be8,
        emissive: 0x4c2aa8,
        emissiveIntensity: 0.35,
        roughness: 0.35,
      })
    );
    ring.position.y = 0.13;
    padGroup.add(ring);

    const core = new THREE.Mesh(
      new THREE.BoxGeometry(pad.radius * 1.25, 0.36, pad.radius * 1.25),
      new THREE.MeshStandardMaterial({
        map: padChevronTex,
        emissive: 0xff7b29,
        emissiveIntensity: 0.45,
        roughness: 0.25,
      })
    );
    core.position.y = 0.24;
    padGroup.add(core);

    arenaGroup.add(padGroup);
    jumpPadMeshes.push(padGroup);
  });

  return { jumpPadMeshes, obstacleMeshes, waterMesh };
}

/**
 * Stage 2 (King of the Hill): Builds a glowing Golden Capture Ring on the floor
 * with a floating 3D royal golden crown above it.
 */
export function createCrownZoneModel(radius = 4.8): THREE.Group {
  const group = new THREE.Group();

  // Translucent golden floor disc
  const discGeo = new THREE.CircleGeometry(radius, 36);
  discGeo.rotateX(-Math.PI / 2);
  const discMat = new THREE.MeshBasicMaterial({
    color: 0xffe144,
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.y = 0.05;
  group.add(disc);

  // Outer glowing border ring
  const ringGeo = new THREE.RingGeometry(radius - 0.35, radius, 36);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffb800,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 0.07;
  group.add(ring);

  // Floating 3D Royal Crown in the center
  const crownGroup = new THREE.Group();
  crownGroup.name = 'crownFloat';
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xff9900,
    emissiveIntensity: 0.45,
    roughness: 0.2,
    metalness: 0.65,
  });
  const gemMat = new THREE.MeshBasicMaterial({ color: 0xff2a85 });

  const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.78, 0.48, 12), goldMat);
  crownGroup.add(crownBase);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.55, 8), goldMat);
    spike.position.set(Math.cos(angle) * 0.82, 0.42, Math.sin(angle) * 0.82);
    crownGroup.add(spike);

    const tipGem = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), gemMat);
    tipGem.position.set(Math.cos(angle) * 0.84, 0.7, Math.sin(angle) * 0.84);
    crownGroup.add(tipGem);
  }

  crownGroup.position.set(0, 2.2, 0);
  group.add(crownGroup);

  return group;
}

/**
 * Stage 3 (Jump Club Sweeper): Builds a Fall Guys-style rotating pink & yellow padded sweeper beam
 * centered at (0, 0, -0.5).
 */
export function createSweeperBeamModel(barLength = 17.5): THREE.Group {
  const group = new THREE.Group();
  group.position.set(0, 0, -0.5);

  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xff3b94,
    emissive: 0x99004d,
    emissiveIntensity: 0.25,
    roughness: 0.3,
  });
  const yellowMat = new THREE.MeshStandardMaterial({
    color: 0xffe144,
    emissive: 0xcc9900,
    emissiveIntensity: 0.2,
    roughness: 0.3,
  });
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.35,
  });

  // Central spinner cap sitting atop the center ruin
  const spinnerHub = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.2, 20), pinkMat);
  spinnerHub.position.y = 1.4;
  group.add(spinnerHub);

  const hubTop = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 12), yellowMat);
  hubTop.position.y = 2.1;
  group.add(hubTop);

  // Two opposing padded sweeper arms along the X axis (-barLength to +barLength)
  [-1, 1].forEach((dir) => {
    const armLen = barLength - 1.6;
    const armGeo = new THREE.CylinderGeometry(0.58, 0.58, armLen, 16);
    armGeo.rotateZ(Math.PI / 2);
    const armMesh = new THREE.Mesh(armGeo, dir > 0 ? pinkMat : yellowMat);
    armMesh.position.set(dir * (1.6 + armLen * 0.5), 0.72, 0);
    armMesh.castShadow = true;
    group.add(armMesh);

    // Striped bumper rings along the arm
    for (let s = 1; s <= 3; s++) {
      const ringGeo = new THREE.CylinderGeometry(0.64, 0.64, 0.85, 16);
      ringGeo.rotateZ(Math.PI / 2);
      const stripe = new THREE.Mesh(ringGeo, whiteMat);
      stripe.position.set(dir * (2.5 + s * 3.6), 0.72, 0);
      group.add(stripe);
    }

    // Rounded end cap
    const endCap = new THREE.Mesh(new THREE.SphereGeometry(0.68, 14, 14), yellowMat);
    endCap.position.set(dir * barLength, 0.72, 0);
    group.add(endCap);
  });

  return group;
}

/**
 * Stage 4 (Hot Bomb Tag): Builds a 3D cartoon ticking bomb with a glowing fuse spark
 * that floats above the current bomb holder's head.
 */
export function createHotBombModel(): THREE.Group {
  const group = new THREE.Group();

  const bombBodyMat = new THREE.MeshStandardMaterial({
    color: 0x231f20,
    emissive: 0x800000,
    emissiveIntensity: 0.35,
    roughness: 0.3,
    metalness: 0.5,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 16), bombBodyMat);
  body.name = 'bombSphere';
  group.add(body);

  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.28, 0.25, 12),
    new THREE.MeshStandardMaterial({ color: 0x6c757d, metalness: 0.6, roughness: 0.3 })
  );
  cap.position.y = 0.68;
  group.add(cap);

  const spark = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.26, 0),
    new THREE.MeshBasicMaterial({ color: 0xffbe0b })
  );
  spark.position.set(0, 0.98, 0);
  spark.name = 'fuseSpark';
  group.add(spark);

  return group;
}


