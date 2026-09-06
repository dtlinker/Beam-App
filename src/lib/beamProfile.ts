import { colonRange } from './mathUtils';

/** Emitter configuration: either a plain element count, or [count, gapPercent] for spaced transducers. */
export type EmitterSpec = number | [number, number];

/**
 * Port of beamprofile.m — computes beam power across the beam axis at a
 * particular distance. All distances are in wavelengths.
 *
 * @param l distance from the transducer to the profile
 * @param s width of the profile
 * @param n number of points to calculate
 * @param tpoints transducer element positions (see computeTransducerGeometry in beamSimulation.ts)
 * @param sf per-element steering/focus delay adjustments, matching tpoints
 */
export function beamProfile(
  l: number,
  s: number,
  n: number,
  tpoints: number[],
  sf: number[]
): Float64Array {
  const points = colonRange(-s / 2, s / n, s / 2);

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
