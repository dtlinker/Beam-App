<script lang="ts">
  import { onDestroy } from 'svelte';

  interface Props {
    value: number;
    min: number;
    max: number;
    step: number;
    /** Decimal places to display and round to; defaults based on step. */
    decimals?: number;
    ariaLabel?: string;
  }

  let {
    value = $bindable(),
    min,
    max,
    step,
    decimals = step < 1 ? 1 : 0,
    ariaLabel
  }: Props = $props();

  let repeatDelay: ReturnType<typeof setTimeout> | undefined;
  let repeatInterval: ReturnType<typeof setInterval> | undefined;

  const INITIAL_REPEAT_DELAY_MS = 400;
  const REPEAT_INTERVAL_MS = 80;

  function clamp(n: number) {
    return Math.min(max, Math.max(min, n));
  }

  function round(n: number) {
    return Number(n.toFixed(decimals));
  }

  function commit(raw: string) {
    const n = Number(raw);

    if (!Number.isFinite(n)) return;

    value = round(clamp(n));
  }

  function canStep(dir: 1 | -1) {
    return dir === 1 ? value < max : value > min;
  }

  function stepValue(dir: 1 | -1) {
    const next = round(clamp(value + dir * step));

    if (next === value) return false;

    value = next;
    return true;
  }

  function stopRepeat() {
    if (repeatDelay !== undefined) {
      clearTimeout(repeatDelay);
      repeatDelay = undefined;
    }

    if (repeatInterval !== undefined) {
      clearInterval(repeatInterval);
      repeatInterval = undefined;
    }
  }

  function startRepeat(dir: 1 | -1) {
    stopRepeat();

    // A normal brief press changes the value once immediately.
    if (!stepValue(dir)) return;

    // Do not start a timer if that press reached min or max.
    if (!canStep(dir)) return;

    repeatDelay = setTimeout(() => {
      repeatDelay = undefined;

      repeatInterval = setInterval(() => {
        if (!stepValue(dir) || !canStep(dir)) {
          stopRepeat();
        }
      }, REPEAT_INTERVAL_MS);
    }, INITIAL_REPEAT_DELAY_MS);
  }

  onDestroy(stopRepeat);
</script>

<div class="stepper">
  <input
    type="text"
    inputmode="decimal"
    class="stepper-input"
    aria-label={ariaLabel}
    value={value.toFixed(decimals)}
    onchange={(e) => commit(e.currentTarget.value)}
    onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
  />

  <div class="stepper-buttons">
    <button
      type="button"
      class="stepper-btn"
      aria-label={ariaLabel ? `Increase ${ariaLabel}` : 'Increase'}
      onpointerdown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startRepeat(1);
      }}
      onpointerup={stopRepeat}
      onpointercancel={stopRepeat}
      onlostpointercapture={stopRepeat}
    >
      ▲
    </button>

    <button
      type="button"
      class="stepper-btn"
      aria-label={ariaLabel ? `Decrease ${ariaLabel}` : 'Decrease'}
      onpointerdown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        startRepeat(-1);
      }}
      onpointerup={stopRepeat}
      onpointercancel={stopRepeat}
      onlostpointercapture={stopRepeat}
    >
      ▼
    </button>
  </div>
</div>
