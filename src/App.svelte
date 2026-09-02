<script lang="ts">
  import './App.css';
  import BeamCanvas from './components/BeamCanvas.svelte';
  import type { SimulationParams, WorkerMessage } from './lib/simulation.worker';

  interface FormState {
    freq: number;
    depth: number;
    wide: number;
    trans: number;
    angl: number;
    focus: number;
    emitters: number;
  }

  let form = $state<FormState>({
    freq: 5,
    depth: 10,
    wide: 6,
    trans: 3,
    angl: 0,
    focus: 0,
    emitters: 50,
  });

  let status = $state('');
  let running = $state(false);
  let image = $state<{ data: Float64Array; width: number; height: number } | null>(null);

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
        image = { data: normalized, width, height };
        running = false;
        status = 'Simulation complete.';
      }, 0);
    }, 0);
  };

  function runSimulation() {
    const { freq, depth, wide, trans, angl, focus, emitters } = form;

    const valid =
      [freq, depth, wide, trans, angl, focus, emitters].every((v) => !Number.isNaN(v)) &&
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

    const params: SimulationParams = {
      freq,
      depth,
      wide,
      trans,
      angl,
      focus,
      emitters: Math.round(emitters),
    };
    worker.postMessage(params);
  }
</script>

<div class="beam-app">
  <aside class="beam-form">
    <h1>Beam Simulation</h1>

    <label>
      Frequency (MHz)
      <input type="number" bind:value={form.freq} />
    </label>
    <label>
      Depth (cm)
      <input type="number" bind:value={form.depth} />
    </label>
    <label>
      Width (cm)
      <input type="number" bind:value={form.wide} />
    </label>
    <label>
      Transducer (cm)
      <input type="number" bind:value={form.trans} />
    </label>
    <label>
      Angle (deg)
      <input type="number" bind:value={form.angl} />
    </label>
    <label>
      Focus (cm)
      <input type="number" bind:value={form.focus} />
    </label>
    <label>
      Emitters (count)
      <input type="number" min="1" step="1" bind:value={form.emitters} />
    </label>

    <button type="button" onclick={runSimulation} disabled={running}>
      {running ? 'Running…' : 'Run Simulation'}
    </button>

    <p class="status">{status}</p>
  </aside>

  <main class="beam-display">
    {#if image}
      <BeamCanvas data={image.data} width={image.width} height={image.height} />
    {:else}
      <p class="placeholder">Run a simulation to see the beam profile.</p>
    {/if}
  </main>
</div>
