import { beamProfile, type EmitterSpec } from './beamProfile';
import { colonRange } from './mathUtils';

const SPEED_OF_SOUND_CM_S = 154000; // 1540 m/s expressed in cm/s

export interface BeamSimulationResult {
  /** Row-major matrix data: rows.length x rows[0].length */
  rows: Float64Array[];
  width: number;
  height: number;
}

/** Called after each row of the field is computed, so callers can report progress. */
export type ProgressCallback = (row: number, total: number) => void;

/**
 * Computes transducer element positions and their steering/focus delay
 * adjustments. Depends only on transducer width, angle, focus and emitter
 * layout, so it's computed once per simulation rather than per profile row.
 *
 * @param w width of the transducer (wavelengths)
 * @param angl angle of the beam (radians)
 * @param focus focus distance (0 disables focusing)
 * @param emitters number of elements, or [elements, gapPercent] for spaced transducers
 */
function computeTransducerGeometry(
  w: number,
  angl: number,
  focus: number,
  emitters: EmitterSpec
): { tpoints: number[]; sf: number[] } {
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

  // Steering adjustment
  const sf = tpoints.map((t) => t * Math.sin(angl));
  if (focus !== 0) {
    for (let i = 0; i < sf.length; i++) {
      sf[i] += Math.sqrt(tpoints[i] * tpoints[i] + focus * focus) - focus;
    }
  }

  return { tpoints, sf };
}

/**
 * Port of beamsimulation.m — computes the beam power over the whole field
 * using beamProfile. Returns a matrix (rows = depth samples, cols = width samples).
 *
 * @param freq transducer frequency in MHz
 * @param depth depth of the simulation in cm
 * @param wide width of the simulation in cm
 * @param trans width of the transducer in cm
 * @param angl beam angle in degrees
 * @param focus focus distance in cm (0 disables focusing)
 * @param emitters number of elements, or [elements, gapPercent]
 * @param onProgress optional callback invoked after each computed row
 */
export function beamSimulation(
  freq: number,
  depth: number,
  wide: number,
  trans: number,
  angl = 0,
  focus = 0,
  emitters: EmitterSpec = 50,
  onProgress?: ProgressCallback
): BeamSimulationResult {
  const anglRad = (2 * Math.PI * angl) / 360;

  // Sample counts, assuming a 0.01 cm (0.1 mm) grid — matches beamsimulation.m
  const m = Math.floor(wide / 0.01);
  const n = Math.floor(depth / 0.01);

  // Recalculate dimensions in wavelengths (speed of sound 1540 m/s)
  const freqHz = freq * 1e6;
  const wideW = (wide * freqHz) / SPEED_OF_SOUND_CM_S;
  const depthW = (depth * freqHz) / SPEED_OF_SOUND_CM_S;
  const transW = (trans * freqHz) / SPEED_OF_SOUND_CM_S;
  const focusW = focus !== 0 ? (focus * freqHz) / SPEED_OF_SOUND_CM_S : 0;

  const step = depthW / n;
  const iVals = colonRange(depthW - step, -step, step);
  const total = 1 + iVals.length;

  const { tpoints, sf } = computeTransducerGeometry(transW, anglRad, focusW, emitters);

  const rows: Float64Array[] = [];
  rows.push(beamProfile(depthW, wideW, m, tpoints, sf));
  onProgress?.(1, total);

  for (let idx = 0; idx < iVals.length; idx++) {
    rows.push(beamProfile(iVals[idx], wideW, m, tpoints, sf));
    onProgress?.(idx + 2, total);
  }

  return { rows, width: m, height: rows.length };
}
