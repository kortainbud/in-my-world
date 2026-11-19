/**
 * Original blocky avatars, built from an Appearance in either visual style.
 */
import * as THREE from "three";
import type { Appearance, Expression, FacePreset, VisualStyle } from "@/lib/engine/types";
import { makeKit, roundedBox, shade } from "./kit";

export interface Avatar {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  cape?: THREE.Object3D;
  hand: THREE.Object3D;
  /** Height of the top of the head in body units (before root scale). */
  topY: number;
  setExpression(e: Expression): void;
  /** Whether the character casts a shadow (stories about losing your shadow). */
  setShadow(cast: boolean): void;
  /** 0–1. Below 1 the character fades (disappearing, ghosts). */
  setOpacity(a: number): void;
  dispose(): void;
}

const faceCache = new Map<string, THREE.CanvasTexture>();

function faceTexture(style: VisualStyle, preset: FacePreset, expr: Expression, ap: Appearance) {
  const key = `${style}|${preset}|${expr}|${ap.skin}|${ap.hair}|${ap.hairColor}`;
  const hit = faceCache.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  const voxel = style === "minecraft";
  const S = voxel ? 8 : 128;
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  if (voxel) {
    g.fillStyle = ap.skin;
    g.fillRect(0, 0, 8, 8);
    if (ap.hair !== "none") {
      g.fillStyle = ap.hairColor;
      g.fillRect(0, 0, 8, ap.hair === "long" || ap.hair === "curly" ? 2 : 1);
      if (ap.hair === "long") {
        g.fillRect(0, 2, 1, 4);
        g.fillRect(7, 2, 1, 4);
      }
    }
    const dark = "#1b1410";
    // brows
    if (expr === "angry") {
      g.fillStyle = dark;
      g.fillRect(1, 3, 1, 1);
      g.fillRect(6, 3, 1, 1);
    }
    if (expr === "sleepy") {
      g.fillStyle = dark;
      g.fillRect(1, 4, 2, 1);
      g.fillRect(5, 4, 2, 1);
    } else {
      g.fillStyle = "#ffffff";
      g.fillRect(1, 4, 2, 1);
      g.fillRect(5, 4, 2, 1);
      g.fillStyle = expr === "shocked" ? "#000" : "#3a2a6a";
      g.fillRect(2, 4, 1, 1);
      g.fillRect(5, 4, 1, 1);
      if (expr === "shocked") {
        g.fillStyle = "#ffffff";
        g.fillRect(1, 3, 2, 1);
        g.fillRect(5, 3, 2, 1);
      }
    }
    g.fillStyle = shade(ap.skin, -0.28);
    if (expr === "shocked") g.fillRect(3, 6, 2, 2);
    else if (expr === "sad") {
      g.fillRect(3, 6, 2, 1);
      g.fillRect(2, 7, 1, 1);
      g.fillRect(5, 7, 1, 1);
    } else if (expr === "happy" || expr === "smug") {
      g.fillRect(2, 6, 1, 1);
      g.fillRect(3, 7, 2, 1);
      g.fillRect(expr === "smug" ? 5 : 5, 6, 1, 1);
    } else g.fillRect(3, 6, 2, 1);
  } else {
    g.clearRect(0, 0, S, S);
    const ink = "#161210";
    g.fillStyle = ink;
    g.strokeStyle = ink;
    g.lineCap = "round";
    const eye = (x: number, y: number, rx: number, ry: number) => {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      g.fill();
    };
    const big = expr === "shocked";
    if (expr === "sleepy") {
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(32, 54);
      g.lineTo(50, 54);
      g.moveTo(78, 54);
      g.lineTo(96, 54);
      g.stroke();
    } else {
      eye(42, 52, big ? 9 : 7, big ? 13 : 10);
      eye(86, 52, big ? 9 : 7, big ? 13 : 10);
      g.fillStyle = "#ffffff";
      eye(44, 48, 2.5, 3);
      eye(88, 48, 2.5, 3);
      g.fillStyle = ink;
    }
    g.lineWidth = 5;
    // brows
    g.beginPath();
    if (expr === "angry") {
      g.moveTo(30, 34);
      g.lineTo(52, 40);
      g.moveTo(98, 34);
      g.lineTo(76, 40);
    } else if (expr === "sad") {
      g.moveTo(32, 40);
      g.lineTo(52, 34);
      g.moveTo(96, 40);
      g.lineTo(76, 34);
    } else if (expr === "shocked") {
      g.moveTo(32, 30);
      g.lineTo(52, 28);
      g.moveTo(96, 30);
      g.lineTo(76, 28);
    } else if (expr === "smug") {
      g.moveTo(32, 36);
      g.lineTo(52, 36);
      g.moveTo(76, 30);
      g.lineTo(96, 34);
    }
    g.stroke();
    // mouth
    g.lineWidth = 6;
    g.beginPath();
    const m = expr === "happy" || expr === "neutral" ? (expr === "happy" ? preset : "calm") : expr;
    switch (m) {
      case "grin":
      case "cheeky":
        g.moveTo(40, 80);
        g.quadraticCurveTo(64, 112, 88, 80);
        g.closePath();
        g.fill();
        if (m === "cheeky") {
          g.fillStyle = "#e86a7a";
          eye(72, 94, 7, 5);
        }
        break;
      case "smile":
        g.moveTo(44, 82);
        g.quadraticCurveTo(64, 100, 84, 82);
        g.stroke();
        break;
      case "determined":
        g.moveTo(48, 88);
        g.lineTo(80, 86);
        g.stroke();
        break;
      case "sad":
        g.moveTo(46, 94);
        g.quadraticCurveTo(64, 78, 82, 94);
        g.stroke();
        break;
      case "shocked":
        eye(64, 92, 10, 13);
        break;
      case "angry":
        g.moveTo(46, 92);
        g.lineTo(82, 92);
        g.stroke();
        break;
      case "smug":
        g.moveTo(48, 88);
        g.quadraticCurveTo(70, 96, 86, 80);
        g.stroke();
        break;
      case "sleepy":
        eye(64, 90, 5, 4);
        break;
      default:
        g.moveTo(50, 88);
        g.quadraticCurveTo(64, 94, 78, 88);
        g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  if (voxel) {
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
  } else t.anisotropy = 4;
  faceCache.set(key, t);
  return t;
}

export function buildAvatar(ap: Appearance, style: VisualStyle): Avatar {
  const kit = makeKit(style);
  const voxel = style === "minecraft";
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const plastic = (color: string) => kit.mat(color, "plain");
  const cloth = (color: string) => kit.mat(color, voxel ? "fabric" : "plain");
  const mesh = (geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[]) => {
    const x = new THREE.Mesh(geo, m);
    x.castShadow = true;
    x.receiveShadow = true;
    return x;
  };
  const geoBox = (w: number, h: number, d: number, r = 0.12) => (voxel ? new THREE.BoxGeometry(w, h, d) : roundedBox(w, h, d, r));

  // Dimensions
  const torsoW = voxel ? 1.6 : 2.0;
  const torsoD = voxel ? 0.8 : 1.0;
  const limbW = voxel ? 0.8 : 0.95;
  const legH = 2.0;
  const torsoH = 2.0;
  const headS = voxel ? 1.5 : 1.25;

  // Legs
  const mkLeg = (x: number) => {
    const g = new THREE.Group();
    g.position.set(x, legH, 0);
    const leg = mesh(geoBox(limbW, legH - 0.3, limbW * 0.98, 0.1), cloth(ap.bottoms));
    leg.position.y = -(legH - 0.3) / 2;
    const shoe = mesh(geoBox(limbW, 0.32, limbW * 1.02, 0.08), plastic(ap.shoes));
    shoe.position.y = -legH + 0.16;
    g.add(leg, shoe);
    body.add(g);
    return g;
  };
  const legL = mkLeg(-limbW / 2 - 0.02);
  const legR = mkLeg(limbW / 2 + 0.02);

  // Torso
  const torso = mesh(geoBox(torsoW, torsoH, torsoD, 0.14), cloth(ap.top));
  torso.position.y = legH + torsoH / 2;
  body.add(torso);
  const stripe = mesh(new THREE.BoxGeometry(torsoW * 0.98, 0.26, 0.04), kit.mat(ap.topAccent, voxel ? "fabric" : "plain"));
  stripe.position.set(0, legH + torsoH * 0.62, torsoD / 2 + 0.01);
  body.add(stripe);
  const badge = mesh(new THREE.BoxGeometry(0.34, 0.34, 0.04), kit.mat(ap.topAccent, "plain"));
  badge.position.set(-torsoW * 0.22, legH + torsoH * 0.32, torsoD / 2 + 0.01);
  body.add(badge);

  // Arms
  const shoulderY = legH + torsoH - 0.12;
  const mkArm = (side: -1 | 1) => {
    const g = new THREE.Group();
    g.position.set(side * (torsoW / 2 + limbW / 2 + 0.02), shoulderY, 0);
    const sleeve = mesh(geoBox(limbW, 0.8, limbW, 0.1), cloth(ap.top));
    sleeve.position.y = -0.4 + 0.12;
    const arm = mesh(geoBox(limbW * 0.96, 1.25, limbW * 0.96, 0.1), plastic(ap.skin));
    arm.position.y = -1.15;
    g.add(sleeve, arm);
    body.add(g);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  const hand = new THREE.Object3D();
  hand.position.set(0, -1.85, limbW * 0.6);
  armR.add(hand);

  // Head
  const head = new THREE.Group();
  head.position.set(0, legH + torsoH, 0);
  body.add(head);
  const headY = headS / 2 + 0.06;
  let faceMat: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial;
  if (voxel) {
    const skin = kit.mat(ap.skin, "plain");
    const hairM = ap.hair === "none" ? skin : kit.mat(ap.hairColor, "noise");
    faceMat = new THREE.MeshLambertMaterial({ map: faceTexture(style, ap.face, "happy", ap) });
    // +x, -x, +y, -y, +z(front), -z(back)
    const h = mesh(new THREE.BoxGeometry(headS, headS, headS), [skin, skin, hairM, skin, faceMat, hairM]);
    h.position.y = headY;
    head.add(h);
  } else {
    const h = mesh(roundedBox(headS * 1.08, headS, headS, 0.3), plastic(ap.skin));
    h.position.y = headY;
    head.add(h);
    faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(style, ap.face, "happy", ap), transparent: true, depthWrite: false });
    const face = new THREE.Mesh(new THREE.PlaneGeometry(headS * 0.92, headS * 0.92), faceMat);
    face.position.set(0, headY, headS / 2 + 0.012);
    head.add(face);
  }

  // Hair
  const hairMat = kit.mat(ap.hairColor, voxel ? "noise" : "plain");
  const top = headY + headS / 2;
  const addHair = (geo: THREE.BufferGeometry, x: number, y: number, z: number) => {
    const m = mesh(geo, hairMat);
    m.position.set(x, y, z);
    head.add(m);
    return m;
  };
  const capW = headS * (voxel ? 1.06 : 1.14);
  if (ap.hair !== "none" && !voxel) addHair(geoBox(capW, 0.32, headS * 1.06, 0.12), 0, top - 0.06, -0.02);
  if (ap.hair === "spiky") {
    for (let i = 0; i < 5; i++) {
      const geo = voxel ? new THREE.BoxGeometry(0.3, 0.4, 0.3) : new THREE.ConeGeometry(0.2, 0.55, 6);
      const s = addHair(geo, -0.5 + i * 0.25, top + 0.22, (i % 2 ? -0.15 : 0.12));
      s.rotation.z = (i - 2) * 0.18;
    }
  } else if (ap.hair === "long") {
    addHair(geoBox(capW, headS * 1.2, 0.3, 0.1), 0, headY - 0.25, -headS / 2 - 0.1);
  } else if (ap.hair === "bun") {
    addHair(voxel ? new THREE.BoxGeometry(0.6, 0.5, 0.6) : new THREE.SphereGeometry(0.34, 16, 12), 0, top + 0.28, -0.2);
  } else if (ap.hair === "curly") {
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      addHair(voxel ? new THREE.BoxGeometry(0.4, 0.4, 0.4) : new THREE.SphereGeometry(0.3, 12, 10), Math.cos(a) * 0.55, top + 0.05, Math.sin(a) * 0.5 - 0.05);
    }
  } else if (ap.hair === "mohawk") {
    addHair(new THREE.BoxGeometry(0.28, 0.6, headS * 1.05), 0, top + 0.22, 0);
  } else if (ap.hair === "short" && voxel) {
    addHair(new THREE.BoxGeometry(capW, 0.18, headS * 1.06), 0, top + 0.06, 0);
  }

  // Hats
  const hatMat = kit.mat(ap.hatColor, voxel ? "noise" : "plain");
  const addHat = (geo: THREE.BufferGeometry, x: number, y: number, z: number, m: THREE.Material = hatMat) => {
    const h = mesh(geo, m);
    h.position.set(x, y, z);
    head.add(h);
    return h;
  };
  switch (ap.hat) {
    case "cap":
      addHat(geoBox(capW * 1.02, 0.42, headS * 1.08, 0.14), 0, top + 0.08, 0);
      addHat(new THREE.BoxGeometry(capW * 0.9, 0.08, 0.6), 0, top - 0.08, headS / 2 + 0.25);
      break;
    case "beanie":
      addHat(geoBox(capW * 1.04, 0.62, headS * 1.1, 0.18), 0, top + 0.1, 0);
      addHat(new THREE.BoxGeometry(capW * 1.08, 0.18, headS * 1.14), 0, top - 0.14, 0, kit.mat(shade(ap.hatColor, -0.12), "plain"));
      break;
    case "crown": {
      const gold = kit.mat(ap.hatColor, "plain", { emissive: ap.hatColor, emissiveIntensity: 0.15 });
      addHat(new THREE.BoxGeometry(capW * 0.95, 0.24, headS * 0.95), 0, top + 0.12, 0, gold);
      for (let i = 0; i < 4; i++) addHat(new THREE.BoxGeometry(0.2, 0.3, 0.2), -0.45 + i * 0.3, top + 0.36, headS * 0.46, gold);
      break;
    }
    case "headphones": {
      addHat(new THREE.BoxGeometry(capW * 1.12, 0.14, 0.24), 0, top + 0.1, 0);
      const cup = (s: number) => addHat(geoBox(0.26, 0.6, 0.6, 0.1), s * (headS * 0.58 + 0.12), headY, 0);
      cup(-1);
      cup(1);
      break;
    }
    case "tophat":
      addHat(voxel ? new THREE.BoxGeometry(1.1, 1, 1.1) : new THREE.CylinderGeometry(0.55, 0.55, 1, 20), 0, top + 0.5, 0);
      addHat(voxel ? new THREE.BoxGeometry(1.6, 0.1, 1.6) : new THREE.CylinderGeometry(0.85, 0.85, 0.08, 24), 0, top + 0.02, 0);
      break;
    case "helmet":
      addHat(voxel ? new THREE.BoxGeometry(capW * 1.08, 0.6, headS * 1.12) : new THREE.SphereGeometry(headS * 0.66, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0, voxel ? top + 0.05 : top - 0.25, 0);
      addHat(new THREE.BoxGeometry(capW * 1.2, 0.08, headS * 1.3), 0, top - 0.24, 0.05);
      break;
  }

  // Accessories
  const accMat = kit.mat(ap.accessoryColor, voxel ? "noise" : "plain");
  let cape: THREE.Object3D | undefined;
  const front = headS / 2 + 0.03;
  switch (ap.accessory) {
    case "glasses": {
      const f = (x: number) => {
        const m = mesh(new THREE.TorusGeometry(0.2, 0.04, 6, 16), accMat);
        m.position.set(x, headY + 0.05, front);
        head.add(m);
      };
      f(-0.27);
      f(0.27);
      const bridge = mesh(new THREE.BoxGeometry(0.16, 0.04, 0.04), accMat);
      bridge.position.set(0, headY + 0.07, front);
      head.add(bridge);
      break;
    }
    case "shades": {
      const s = mesh(new THREE.BoxGeometry(headS * 0.95, 0.26, 0.08), kit.mat("#0b0b0b", "plain"));
      s.position.set(0, headY + 0.06, front);
      head.add(s);
      break;
    }
    case "backpack": {
      const b = mesh(geoBox(torsoW * 0.8, torsoH * 0.8, 0.5, 0.12), accMat);
      b.position.set(0, legH + torsoH * 0.5, -torsoD / 2 - 0.25);
      body.add(b);
      break;
    }
    case "cape": {
      const pivot = new THREE.Group();
      pivot.position.set(0, legH + torsoH - 0.05, -torsoD / 2 - 0.06);
      const c = mesh(new THREE.BoxGeometry(torsoW * 1.05, torsoH + 1.2, 0.06), accMat);
      c.position.y = -(torsoH + 1.2) / 2;
      pivot.add(c);
      body.add(pivot);
      cape = pivot;
      break;
    }
    case "scarf": {
      const s = mesh(geoBox(torsoW * 0.9, 0.34, torsoD * 1.15, 0.12), accMat);
      s.position.set(0, legH + torsoH - 0.08, 0);
      body.add(s);
      const tail = mesh(new THREE.BoxGeometry(0.3, 0.8, 0.1), accMat);
      tail.position.set(0.4, legH + torsoH - 0.55, torsoD / 2 + 0.08);
      body.add(tail);
      break;
    }
    case "chain": {
      const c = mesh(new THREE.TorusGeometry(0.55, 0.06, 6, 24, Math.PI), kit.mat(ap.accessoryColor, "plain", { emissive: ap.accessoryColor, emissiveIntensity: 0.2 }));
      c.rotation.z = Math.PI;
      c.position.set(0, legH + torsoH - 0.12, torsoD / 2 + 0.04);
      body.add(c);
      break;
    }
  }

  body.scale.setScalar(ap.height);
  const topY = (legH + torsoH + headS + 0.2) * ap.height;

  let currentExpr: Expression = "happy";
  let ownMaterials = false;
  return {
    root, body, head, armL, armR, legL, legR, cape, hand, topY,
    setExpression(e) {
      if (e === currentExpr) return;
      currentExpr = e;
      faceMat.map = faceTexture(style, ap.face, e, ap);
      faceMat.needsUpdate = true;
    },
    setShadow(cast) {
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = cast;
      });
    },
    setOpacity(a) {
      if (a >= 0.999 && !ownMaterials) return;
      if (!ownMaterials) {
        // Materials are shared across avatars; clone before changing them.
        ownMaterials = true;
        root.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
        });
      }
      root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
          mat.transparent = a < 0.999 || mat === faceMat;
          mat.opacity = a;
          mat.depthWrite = a >= 0.999;
        }
      });
    },
    dispose() {
      root.traverse((o) => {
        if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
      });
    },
  };
}
