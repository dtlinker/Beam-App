<script lang="ts">
  import './App.css';
  import BeamCanvas from './components/BeamCanvas.svelte';
  import ProfileGraph from './components/ProfileGraph.svelte';
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
    wide: 6,
    trans: 3,
    angl: 0,
    focus: 0,
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

  // Focus allows 0 (disables focusing) or 0.2-15; 0.1 is not a valid step, so snap it to
  // whichever end the value is moving away from (0 when incrementing, 0.2 when decrementing).
  let lastFocus = form.focus;
  function snapFocus() {
    if (Math.abs(form.focus - 0.1) < 1e-9) {
      form.focus = form.focus > lastFocus ? 0.2 : 0;
    }
    lastFocus = form.focus;
  }

  // Keep the distance within [0, depth] as the depth field changes.
  $effect(() => {
    if (profileDistance > form.depth) profileDistance = form.depth;
  });

  const worker = new Worker(new URL('./lib/simulation.worker.ts', import.meta.url), { type: 'module' });

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
      <a class="instructions-link" href="/instructions.html">Instructions</a>
    </div>

    <fieldset class="form-group">
      <legend>Simulation</legend>
      <label>
        Depth (cm)
        <input type="number" min="1" max="25" step="1" bind:value={form.depth} />
      </label>
      <label>
        Width (cm)
        <input type="number" min="2" max="16" step="0.5" bind:value={form.wide} />
      </label>
    </fieldset>

    <fieldset class="form-group">
      <legend>Transducer</legend>
      <label>
        Frequency (MHz)
        <input type="number" min="1" max="10" step="0.5" bind:value={form.freq} />
      </label>
      <label>
        Width (cm)
        <input type="number" min="0.2" max="5" step="0.1" bind:value={form.trans} />
      </label>
      <label>
        Focus (cm)
        <input type="number" min="0" max="15" step="0.1" bind:value={form.focus} oninput={snapFocus} />
      </label>
      <label>
        Angle (deg)
        <input type="number" min="-45" max="45" step="1" bind:value={form.angl} />
      </label>
      <label>
        Emitters (count)
        <input type="number" min="32" max="256" step="1" bind:value={form.emitters} />
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
        <div class="beam-canvas-wrap">
          <BeamCanvas data={image.data} width={image.width} height={image.height} highlightRow={profileRow} />
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
