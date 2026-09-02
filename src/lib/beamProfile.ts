import { colonRange } from './mathUtils';

/** Emitter configuration: either a plain element count, or [count, gapPercent] for spaced transducers. */
export type EmitterSpec = number | [number, number];

/**
 * Port of beamprofile.m — computes beam power across the beam axis at a
 * particular distance. All distances are in wavelengths.
 *
 * @param l distance from the transducer to the profile
 * @param w width of the transducer
 * @param s width of the profile
 * @param n number of points to calculate
 * @param angl angle of the beam (radians)
 * @param focus focus distance (0 disables focusing)
 * @param emitters number of elements, or [elements, gapPercent] for spaced transducers
 */
export function beamProfile(
  l: number,
  w: number,
  s: number,
  n: number,
  angl: number,
  focus: number,
  emitters: EmitterSpec = 50
): Float64Array {
  let tpoints: number[];

  if (Array.isArray(emitters)) {
    const [count, gapPercent] = emitters;
    // one_element = 0:0.1:0.9 < emitters(2)
    const oneElement: boolean[] = colonRange(0, 0.1, 0.9).map((v) => v < gapPercent);
    // tselect = repmat(one_element, 1, emitters(1))
    const tselect: boolean[] = [];
    for (let r = 0; r < count; r++) tselect.push(...oneElement);
    const full = colonRange(-w / 2, w / (count * 10), w / 2);
    tpoints = [];
    for (let i = 0; i < tselect.length && i < full.length; i++) {
      if (tselect[i]) tpoints.push(full[i]);
    }
  } else {
    tpoints = colonRange(-w / 2, w / emitters, w / 2);
  }

  const points = colonRange(-s / 2, s / n, s / 2);

  // Steering adjustment
  const sf = tpoints.map((t) => t * Math.sin(angl));
  if (focus !== 0) {
    for (let i = 0; i < sf.length; i++) {
      sf[i] += Math.sqrt(tpoints[i] * tpoints[i] + focus * focus) - focus;
    }
  }

  const profile = new Float64Array(n);
  for (let xs = 0; xs < n; xs++) {
    const p = points[xs];
    let sumx = 0;
    let sumy = 0;
    for (let j = 0; j < tpoints.length; j++) {
      const disp = 2 * Math.PI * (Math.sqrt((p - tpoints[j]) ** 2 + l * l) - l - sf[j]);
      sumx += Math.sin(disp);
      sumy += Math.cos(disp);
    }
    profile[xs] = Math.sqrt(sumx * sumx + sumy * sumy);
  }

  return profile;
}
