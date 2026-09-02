/**
 * Generates a numeric range equivalent to MATLAB's colon operator `start:step:stop`.
 * Uses a rounded element count to avoid floating point drift in the endpoint.
 */
export function colonRange(start: number, step: number, stop: number): number[] {
  if (step === 0) return [start];
  const count = Math.round((stop - start) / step);
  const result = new Array<number>(count + 1);
  for (let i = 0; i <= count; i++) {
    result[i] = start + i * step;
  }
  return result;
}
