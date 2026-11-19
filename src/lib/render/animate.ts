import type * as THREE from "three";
import type { Action } from "@/lib/engine/types";
import type { Avatar } from "./avatar";

const ease = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x * x * (3 - 2 * x));

function walkCycle(av: Avatar, t: number, speed: number, amp = 0.7) {
  const s = Math.sin(t * speed);
  av.legL.rotation.x = s * amp;
  av.legR.rotation.x = -s * amp;
  av.armL.rotation.x = -s * amp * 0.8;
  av.armR.rotation.x = s * amp * 0.8;
  return Math.abs(Math.cos(t * speed)) * 0.12;
}

function reset(av: Avatar) {
  for (const p of [av.armL, av.armR, av.legL, av.legR, av.head]) p.rotation.set(0, 0, 0);
  av.body.rotation.set(0, 0, 0);
  av.body.position.set(0, 0, 0);
  if (av.cape) av.cape.rotation.set(0.08, 0, 0);
}

export interface PoseInput {
  action: Action;
  /** Seconds since scene start. */
  lt: number;
  dur: number;
  /** Absolute time, for continuous idle motion. */
  t: number;
  base: THREE.Vector3;
  phase: number;
  talking: boolean;
  /** Character is facing toward this x (dialogue). */
  faceX?: number;
}

/**
 * Poses the avatar and returns its world placement. Rotation y = 0 faces the
 * camera (+z).
 */
export function pose(av: Avatar, p: PoseInput): { x: number; y: number; z: number; ry: number; rx: number } {
  reset(av);
  const { lt, dur, t, base, phase } = p;
  const u = lt / dur;
  let x = base.x, y = base.y, ry = 0, rx = 0;
  const z = base.z;
  const breathe = Math.sin(t * 2 + phase) * 0.03;
  av.body.position.y = breathe;
  av.armL.rotation.z = -0.06 - breathe;
  av.armR.rotation.z = 0.06 + breathe;
  av.head.rotation.y = Math.sin(t * 0.7 + phase) * 0.08;

  if (p.faceX !== undefined) ry = Math.atan2(p.faceX - base.x, 6) * 0.6;

  switch (p.action) {
    case "idle":
      break;
    case "talk":
      av.armR.rotation.z = 0.35 + Math.sin(t * 5 + phase) * 0.25;
      av.armR.rotation.x = -0.6 + Math.sin(t * 4) * 0.2;
      av.head.rotation.x = Math.sin(t * 6 + phase) * 0.06;
      break;
    case "walk_in_left":
    case "walk_in_right": {
      const dir = p.action === "walk_in_left" ? -1 : 1;
      const k = ease(Math.min(1, u / 0.45));
      x = base.x + dir * 9 * (1 - k);
      if (k < 1) {
        y += walkCycle(av, t, 9);
        ry = dir < 0 ? Math.PI / 2 : -Math.PI / 2;
        ry *= 1 - ease((k - 0.75) * 4);
      }
      break;
    }
    case "walk_across": {
      x = base.x - 7 + 14 * u;
      y += walkCycle(av, t, 8);
      ry = Math.PI / 2;
      break;
    }
    case "run": {
      x = base.x + Math.sin(u * Math.PI * 2) * 2.2;
      const dirv = Math.cos(u * Math.PI * 2);
      y += walkCycle(av, t, 15, 1.1) * 1.8;
      ry = dirv > 0 ? Math.PI / 2 : -Math.PI / 2;
      av.body.rotation.x = 0.18;
      av.armL.rotation.x *= 1.3;
      av.armR.rotation.x *= 1.3;
      break;
    }
    case "wave":
      av.armR.rotation.z = 2.7 + Math.sin(t * 10) * 0.35;
      av.head.rotation.z = Math.sin(t * 3) * 0.08;
      break;
    case "jump": {
      const c = (lt * 1.4 + phase) % 1;
      const h = Math.max(0, Math.sin(c * Math.PI)) * 1.6;
      y += h;
      av.armL.rotation.z = -0.6 - h * 0.8;
      av.armR.rotation.z = 0.6 + h * 0.8;
      av.legL.rotation.x = h > 0.1 ? -0.4 : 0;
      av.legR.rotation.x = h > 0.1 ? 0.3 : 0;
      break;
    }
    case "celebrate": {
      const c = Math.abs(Math.sin(t * 6 + phase));
      y += c * 0.5;
      av.armL.rotation.z = -2.7 - c * 0.3;
      av.armR.rotation.z = 2.7 + c * 0.3;
      av.head.rotation.x = -0.15;
      break;
    }
    case "dance": {
      const b = Math.sin(t * 7 + phase);
      av.body.rotation.z = b * 0.12;
      ry += Math.sin(t * 3.5) * 0.5;
      av.armL.rotation.z = -1.4 + b * 1.1;
      av.armR.rotation.z = 1.4 + b * 1.1;
      av.legL.rotation.x = Math.max(0, b) * 0.5;
      av.legR.rotation.x = Math.max(0, -b) * 0.5;
      y += Math.abs(b) * 0.2;
      break;
    }
    case "point":
      av.armR.rotation.x = -Math.PI / 2 + Math.sin(t * 3) * 0.05;
      av.armR.rotation.y = -0.2;
      av.head.rotation.x = -0.05;
      break;
    case "shrug": {
      const s = ease(Math.abs(Math.sin(t * 1.6 + phase)));
      av.armL.rotation.z = -0.9 * s;
      av.armR.rotation.z = 0.9 * s;
      av.armL.rotation.x = -0.6 * s;
      av.armR.rotation.x = -0.6 * s;
      av.head.rotation.z = 0.15 * s;
      break;
    }
    case "sad":
      av.head.rotation.x = 0.4;
      av.body.rotation.x = 0.1;
      av.armL.rotation.z = 0.05;
      av.armR.rotation.z = -0.05;
      av.head.rotation.y = 0;
      break;
    case "shocked": {
      const k = ease(Math.min(1, lt / 0.35));
      av.armL.rotation.z = -1.3 * k;
      av.armR.rotation.z = 1.3 * k;
      av.armL.rotation.x = -1.2 * k;
      av.armR.rotation.x = -1.2 * k;
      av.body.rotation.x = -0.15 * k;
      x += Math.sin(t * 40) * 0.03 * k;
      break;
    }
    case "sit":
      y -= 0.95;
      av.legL.rotation.x = -Math.PI / 2;
      av.legR.rotation.x = -Math.PI / 2;
      av.armL.rotation.x = -0.4;
      av.armR.rotation.x = -0.4;
      break;
    case "sleep":
      rx = -Math.PI / 2;
      y += 1.0;
      av.head.rotation.y = 0;
      av.body.position.y = Math.sin(t * 1.2) * 0.04;
      break;
    case "look_up":
      av.head.rotation.x = -0.5;
      av.armR.rotation.x = -2.4;
      av.armR.rotation.z = 0.2;
      break;
    case "give": {
      const k = ease(Math.min(1, lt / 0.6));
      av.armR.rotation.x = -1.3 * k;
      av.armL.rotation.x = -1.3 * k;
      av.armL.rotation.z = 0.25;
      av.armR.rotation.z = -0.25;
      ry += 0.4;
      break;
    }
    case "grow":
    case "shrink": {
      const k = Math.sin(t * 9) * 0.05 * (1 - Math.abs(u - 0.5) * 2);
      av.armL.rotation.z = -0.5 - k * 4;
      av.armR.rotation.z = 0.5 + k * 4;
      break;
    }
  }

  if (p.talking) av.head.rotation.x += Math.sin(t * 14) * 0.04;
  if (av.cape) av.cape.rotation.x = 0.1 + Math.abs(Math.sin(t * 3 + phase)) * 0.12 + (p.action === "run" ? 0.5 : 0);

  return { x, y, z, ry, rx };
}

export { ease };
