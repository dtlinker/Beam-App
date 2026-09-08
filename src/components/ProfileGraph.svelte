<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    values: Float64Array | null;
  }

  let { values }: Props = $props();

  let canvas: HTMLCanvasElement;
  let container: HTMLDivElement;
  let resizeObserver: ResizeObserver | undefined;

  function draw() {
    if (!canvas || !values || values.length === 0) return;

    // These are the dimensions at which the graph is actually displayed.
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.round(rect.width));
    const cssHeight = Math.max(1, Math.round(rect.height));

    // On standard displays this is generally 1; on Retina displays it is often 2.
    const dpr = window.devicePixelRatio || 1;

    // The canvas bitmap is physical pixels; its CSS size remains unchanged.
    const bitmapWidth = Math.round(cssWidth * dpr);
    const bitmapHeight = Math.round(cssHeight * dpr);

    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Reset the transform, then draw using CSS-pixel coordinates.
    // This avoids repeated scaling when Svelte redraws the graph.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const accent =
      getComputedStyle(canvas).getPropertyValue('--accent').trim() ||
      '#4ea1ff';

    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();

    for (let i = 0; i < values.length; i++) {
      const x =
        values.length === 1
          ? cssWidth / 2
          : (i / (values.length - 1)) * cssWidth;

      // Protect the rendering operation from non-finite simulation values.
      const normalized = Number.isFinite(values[i]) ? values[i] : 0;
      const y = cssHeight - Math.max(0, Math.min(1, normalized)) * cssHeight;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
  }

  onMount(() => {
    // Redraw if the responsive panel width changes, including window resize.
    resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(container);

    draw();

    return () => resizeObserver?.disconnect();
  });

  // Redraw whenever a new simulation supplies a new values array.
  $effect(() => {
    values;
    draw();
  });
</script>

<div bind:this={container} class="profile-graph">
  <h2>Beam amplitude profile</h2>

  <canvas
    bind:this={canvas}
    class="profile-canvas"
    aria-label="Beam amplitude profile"
  ></canvas>
</div>

<style>
  .profile-graph {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow);
    padding: 12px 14px;
    box-sizing: border-box;
  }

  .profile-graph h2 {
    margin: 0 0 8px;
    color: var(--text-h);
    font-size: 17px;
    font-weight: 600;
  }

  .profile-canvas {
    display: block;
    width: 100%;
    height: 150px;
  }
</style>
