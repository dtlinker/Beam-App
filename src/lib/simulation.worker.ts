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

export interface StatusMessage {
  type: 'status';
  message: string;
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

export type WorkerMessage = ProgressMessage | StatusMessage | ResultMessage | ErrorMessage;

self.onmessage = (e: MessageEvent<SimulationParams>) => {
  const { freq, depth, wide, trans, angl, focus, emitters } = e.data;
  const startedAt = performance.now();

  try {
    const { rows, width, height } = beamSimulation(freq, depth, wide, trans, angl, focus, emitters, (row, total) => {
      const progress: ProgressMessage = { type: 'progress', row, total };
      (self as unknown as Worker).postMessage(progress);
    });

    const computeMs = performance.now() - startedAt;
    (self as unknown as Worker).postMessage({
      type: 'status',
      message: `Compute done in ${computeMs.toFixed(0)}ms. Assembling ${width}x${height} result matrix...`,
    } satisfies StatusMessage);

    // Flatten rows into a single transferable buffer
    const data = new Float64Array(width * height);
    for (let r = 0; r < height; r++) {
      data.set(rows[r], r * width);
    }

    (self as unknown as Worker).postMessage({
      type: 'status',
      message: 'Transferring result to browser...',
    } satisfies StatusMessage);

    const result: ResultMessage = { type: 'result', data, width, height };
    (self as unknown as Worker).postMessage(result, [data.buffer]);
  } catch (err) {
    const message: ErrorMessage = { type: 'error', error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(message);
  }
};
