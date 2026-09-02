import { beamSimulation } from './beamSimulation';
import type { EmitterSpec } from './beamProfile';

export interface SimulationParams {
  freq: number;
  depth: number;
  wide: number;
  trans: number;
  angl: number;
  focus: number;
  emitters: EmitterSpec;
}

export interface ProgressMessage {
  type: 'progress';
  row: number;
  total: number;
}

export interface ResultMessage {
  type: 'result';
  data: Float64Array;
  width: number;
  height: number;
}

export interface ErrorMessage {
  type: 'error';
  error: string;
}

export type WorkerMessage = ProgressMessage | ResultMessage | ErrorMessage;

self.onmessage = (e: MessageEvent<SimulationParams>) => {
  const { freq, depth, wide, trans, angl, focus, emitters } = e.data;
  const startedAt = performance.now();

  try {
    console.log('[beamSimulation] starting', e.data);

    let lastLoggedAt = startedAt;
    const { rows, width, height } = beamSimulation(freq, depth, wide, trans, angl, focus, emitters, (row, total) => {
      const now = performance.now();
      // Log every row, but throttle console output to ~4x/sec so it doesn't flood devtools.
      if (row === total || now - lastLoggedAt > 250) {
        lastLoggedAt = now;
        console.log(`[beamSimulation] row ${row}/${total} (${((row / total) * 100).toFixed(1)}%)`);
      }
      const progress: ProgressMessage = { type: 'progress', row, total };
      (self as unknown as Worker).postMessage(progress);
    });

    console.log(`[beamSimulation] done in ${(performance.now() - startedAt).toFixed(0)}ms, ${width}x${height}`);

    // Flatten rows into a single transferable buffer
    const data = new Float64Array(width * height);
    for (let r = 0; r < height; r++) {
      data.set(rows[r], r * width);
    }

    const result: ResultMessage = { type: 'result', data, width, height };
    (self as unknown as Worker).postMessage(result, [data.buffer]);
  } catch (err) {
    console.error('[beamSimulation] failed', err);
    const message: ErrorMessage = { type: 'error', error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(message);
  }
};
