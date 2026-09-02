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

  const rows: Float64Array[] = [];
  rows.push(beamProfile(depthW, transW, wideW, m, anglRad, focusW, emitters));
  onProgress?.(1, total);

  for (let idx = 0; idx < iVals.length; idx++) {
    rows.push(beamProfile(iVals[idx], transW, wideW, m, anglRad, focusW, emitters));
    onProgress?.(idx + 2, total);
  }

  return { rows, width: m, height: rows.length };
}
