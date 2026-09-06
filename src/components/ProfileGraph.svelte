<script lang="ts">
  interface Props {
    values: Float64Array | null;
  }

  let { values }: Props = $props();
  let canvas: HTMLCanvasElement;

  // Renders the intensity values along a single row as a line graph, scaled 0..1.
  $effect(() => {
    if (!canvas || !values || values.length === 0) return;

    const width = values.length;
    const height = 150;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#4ea1ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < width; x++) {
      const y = height - values[x] * height;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });
</script>

<div class="profile-graph">
  <h2>Beam amplitude profile</h2>
  <canvas bind:this={canvas} style="width: 100%; height: 150px; display: block;"></canvas>
</div>

<style>
  .profile-graph h2 {
    font-size: 13px;
    font-weight: 600;
    margin: 0 0 4px;
  }
</style>
