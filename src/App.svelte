<script lang="ts">
  import { onDestroy } from 'svelte';
  import './App.css';
  import BeamCanvas from './components/BeamCanvas.svelte';
  import ProfileGraph from './components/ProfileGraph.svelte';
  import NumberStepper from './components/NumberStepper.svelte';
  import type { SimulationParams, WorkerMessage } from './lib/simulation.worker';

  interface FormState {
    freq: number;
    depth: number;
    wide: number;
    trans: number;
    angl: number;
    focus: number;
    emitters: number;
    gapPercent: number;
  }

  const gapPercentOptions = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];

  let form = $state<FormState>({
    freq: 5,
    depth: 10,
    wide: 3,
    trans: 1,
    angl: 0,
    focus: 5,
    emitters: 50,
    gapPercent: 0,
  });

  let status = $state('');
  let running = $state(false);
  let image = $state<{ data: Float64Array; width: number; height: number; depthCm: number } | null>(null);

  let showBeamProfile = $state(false);
  let profileDistance = $state(form.depth / 2);

  // Row index (in the image's data grid) that corresponds to profileDistance, or null if unavailable.
  let profileRow = $derived.by(() => {
    if (!showBeamProfile || !image) return null;
    const fraction = 1 - profileDistance / image.depthCm;
    const row = Math.round(fraction * image.height);
    return Math.max(0, Math.min(image.height - 1, row));
  });

  let profileValues = $derived.by(() => {
    if (profileRow === null || !image) return null;
    return image.data.slice(profileRow * image.width, (profileRow + 1) * image.width);
  });

  function toggleBeamProfile() {
    showBeamProfile = !showBeamProfile;
    if (showBeamProfile) profileDistance = form.depth / 2;
  }

  // A focus of 0 is the application's sentinel for "no finite focus."

    // A focus of 0 is the application's sentinel for "no finite focus."
  // Present that state explicitly to users as infinity.
  let focusDisplay = $derived(form.focus === 0 ? '∞' : form.focus.toFixed(1));

  function parseFocusInput(raw: string) {
    const text = raw.trim().toLowerCase();

    if (text === '∞' || text === 'inf' || text === 'infinity') {
      form.focus = 0;
      return;
    }

    const n = Number(text);

    // Keep the current value if the entry is not a valid number.
    if (!Number.isFinite(n)) return;

    // Preserve the existing internal convention: 0 means infinity/no finite focus.
    if (n === 0) {
      form.focus = 0;
      return;
    }

    // Finite focus distances are restricted to 0.2–15.0 cm.
    form.focus = Math.round(Math.min(15, Math.max(0.2, n)) * 10) / 10;
  }

  function stepFocus(dir: 1 | -1) {
    // ∞ decreases into the finite range at 15.0.
    if (form.focus === 0) {
      if (dir === -1) form.focus = 15;
      return;
    }

    const next = Math.round((form.focus + dir * 0.1) * 10) / 10;

    // 15.0 increasing enters the ∞ / no-finite-focus state.
    if (next > 15) {
      form.focus = 0;
      return;
    }

    // Do not wrap below the smallest finite focus distance.
    form.focus = Math.max(0.2, next);
  }

  let focusRepeatDelay: ReturnType<typeof setTimeout> | undefined;
  let focusRepeatInterval: ReturnType<typeof setInterval> | undefined;

  const FOCUS_REPEAT_DELAY_MS = 400;
  const FOCUS_REPEAT_INTERVAL_MS = 80;

  function stopFocusRepeat() {
    if (focusRepeatDelay !== undefined) {
      clearTimeout(focusRepeatDelay);
      focusRepeatDelay = undefined;
    }

    if (focusRepeatInterval !== undefined) {
      clearInterval(focusRepeatInterval);
      focusRepeatInterval = undefined;
    }
  }

  function canStepFocus(dir: 1 | -1) {
    if (form.focus === 0) return dir === -1;

    return dir === 1
      ? form.focus < 15
      : form.focus > 0.2;
  }

  function startFocusRepeat(dir: 1 | -1) {
    stopFocusRepeat();

    // Make an ordinary short press change the value once.
    stepFocus(dir);

    // Do not start the repeat timer if the first step reached an endpoint.
    if (!canStepFocus(dir)) return;

    focusRepeatDelay = setTimeout(() => {
      focusRepeatDelay = undefined;

      focusRepeatInterval = setInterval(() => {
        stepFocus(dir);

        if (!canStepFocus(dir)) {
          stopFocusRepeat();
        }
      }, FOCUS_REPEAT_INTERVAL_MS);
    }, FOCUS_REPEAT_DELAY_MS);
  }

  // Register this once, while App.svelte is initialized—not inside a button handler.
  onDestroy(stopFocusRepeat);

  // Keep the distance within [0, depth] as the depth field changes.
  $effect(() => {
    if (profileDistance > form.depth) profileDistance = form.depth;
  });

  const worker = new Worker(new URL('./lib/simulation.worker.ts', import.meta.url), { type: 'module' });

  // Without this, a worker script that fails to load leaves running=true forever with no feedback.
  worker.onerror = (e) => {
    running = false;
    status = `Error loading simulation worker: ${e.message || 'unknown error'}.`;
  };

  worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    const msg = e.data;

    if (msg.type === 'progress') {
      status = `Running simulation... row ${msg.row}/${msg.total} (${((msg.row / msg.total) * 100).toFixed(0)}%)`;
      return;
    }

    if (msg.type === 'status') {
      status = msg.message;
      return;
    }

    if (msg.type === 'error') {
      running = false;
      status = `Error running beamsimulation: ${msg.error}`;
      return;
    }

    const { data, width, height } = msg;

    // Defer the remaining work one tick at a time so each status update actually paints
    // before the next (synchronous, CPU-bound) step runs.
    status = 'Result received. Normalizing intensity data...';
    setTimeout(() => {
      let max = 0;
      for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
      if (max === 0) {
        running = false;
        status = 'Simulation result is all zeros; cannot normalize.';
        return;
      }
      const normalized = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) normalized[i] = data[i] / max;

      status = 'Rendering image...';
      setTimeout(() => {
        image = { data: normalized, width, height, depthCm: runDepth };
        running = false;
        status = 'Simulation complete.';
      }, 0);
    }, 0);
  };

  let runDepth = $state(0);

  function runSimulation() {
    const { freq, depth, wide, trans, angl, focus, emitters, gapPercent } = form;

    const valid =
      [freq, depth, wide, trans, angl, focus, emitters, gapPercent].every((v) => !Number.isNaN(v)) &&
      freq > 0 &&
      depth > 0 &&
      wide > 0 &&
      trans > 0 &&
      emitters >= 1;

    if (!valid) {
      status = 'Error: Ensure numeric inputs are valid (positive size values, emitters >= 1).';
      return;
    }

    running = true;
    status = 'Running simulation...';
    runDepth = depth;

    const params: SimulationParams = {
      freq,
      depth,
      wide,
      trans,
      angl,
      focus,
      emitters: gapPercent === 0 ? Math.round(emitters) : [Math.round(emitters), gapPercent],
    };
    worker.postMessage(params);
  }
</script>

<div class="beam-app">
  <aside class="beam-form">
    <div class="beam-form-header">
      <h1>Beam Simulation</h1>
      <a class="instructions-link" href="./instructions.html">Instructions</a>
    </div>

    <fieldset class="form-group">
      <legend>Simulation</legend>
      <label>
        Depth (cm)
        <NumberStepper bind:value={form.depth} min={1} max={25} step={1} decimals={0} ariaLabel="Depth (cm)" />
      </label>
      <label>
        Width (cm)
        <NumberStepper bind:value={form.wide} min={2} max={16} step={0.5} decimals={1} ariaLabel="Simulation width (cm)" />
      </label>
    </fieldset>

    <fieldset class="form-group">
      <legend>Transducer</legend>
      <label>
        Frequency (MHz)
        <NumberStepper bind:value={form.freq} min={1} max={10} step={0.5} decimals={1} ariaLabel="Frequency (MHz)" />
      </label>
      <label>
        Width (cm)
        <NumberStepper bind:value={form.trans} min={0.2} max={5} step={0.1} decimals={1} ariaLabel="Transducer width (cm)" />
      </label>

      <label>
        Angle (deg)
        <NumberStepper bind:value={form.angl} min={-45} max={45} step={1} decimals={0} ariaLabel="Angle (deg)" />
      </label>
      <label>
        Emitters (count)
        <NumberStepper bind:value={form.emitters} min={32} max={256} step={1} decimals={0} ariaLabel="Emitters (count)" />
      </label>
      <label class="stepper-field">
  Focus (cm)
  <div class="stepper">
    <input
      type="text"
      inputmode="decimal"
      class="stepper-input"
      aria-label="Focus (cm); infinity means no finite focus"
      value={focusDisplay}
      onchange={(e) => parseFocusInput(e.currentTarget.value)}
      onkeydown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
    />

    <div class="stepper-buttons">
     <button
  type="button"
  class="stepper-btn"
  aria-label="Increase focus"
  onpointerdown={(event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startFocusRepeat(1);
  }}
  onpointerup={stopFocusRepeat}
  onpointercancel={stopFocusRepeat}
  onlostpointercapture={stopFocusRepeat}
>
  ▲
</button>

<button
  type="button"
  class="stepper-btn"
  aria-label="Decrease focus"
  onpointerdown={(event) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    startFocusRepeat(-1);
  }}
  onpointerup={stopFocusRepeat}
  onpointercancel={stopFocusRepeat}
  onlostpointercapture={stopFocusRepeat}
>
  ▼
</button>

    </div>
  </div>
</label>


      <label>
        Element Gap
        <select bind:value={form.gapPercent}>
          {#each gapPercentOptions as option}
            <option value={option}>{option === 0 ? 'None' : `${(option * 100).toFixed(0)}%`}</option>
          {/each}
        </select>
      </label>
    </fieldset>

    <fieldset class="form-group">
      <legend>Display profile</legend>
      <label class="checkbox-label">
        <input type="checkbox" checked={showBeamProfile} onchange={toggleBeamProfile} />
        Beam profile
      </label>
      {#if showBeamProfile}
        <label>
          Distance (cm)
          <input type="number" min="0.1" max={form.depth} step="0.1" bind:value={profileDistance} />
        </label>
      {/if}
    </fieldset>

    <button type="button" onclick={runSimulation} disabled={running}>
      {running ? 'Running…' : 'Run Simulation'}
    </button>

    <p class="status">{status}</p>
  </aside>

  <main class="beam-display">
    {#if image}
      <div class="beam-display-stack">
        <div class="beam-canvas-area">
          <div class="beam-canvas-wrap" style="aspect-ratio: {image.width} / {image.height};">
            <BeamCanvas data={image.data} width={image.width} height={image.height} highlightRow={profileRow} />
          </div>
        </div>
        {#if showBeamProfile && profileValues}
          <ProfileGraph values={profileValues} />
        {/if}
      </div>
    {:else}
      <p class="placeholder">Run a simulation to see the beam profile.</p>
    {/if}
  </main>
</div>
