# Beam Simulation Web App

This is a browser-based port of the original MATLAB `beamApp.m` ultrasound beam
simulator. It computes the transmit amplitude field of a linear phased array
transducer (frequency, depth/width of field, transducer size, steering
angle, focus, and element count) and renders it as a grayscale image,
matching the original app's `imshow`-based display.

The original Matlab and this port were developed by David T. Linker (dtlinker@uw.edu)

## What it does

- Ports `beamprofile.m` and `beamsimulation.m` line-for-line into
  TypeScript ([src/lib/beamProfile.ts](src/lib/beamProfile.ts),
  [src/lib/beamSimulation.ts](src/lib/beamSimulation.ts)), including the
  spaced-transducer (`[count, gapPercent]`) emitter option and MATLAB's
  colon-range (`start:step:stop`) semantics.
- Runs the simulation in a Web Worker
  ([src/lib/simulation.worker.ts](src/lib/simulation.worker.ts)) so the UI
  stays responsive, and streams back progress/status updates while it runs.
- Renders the normalized amplitude matrix to a `<canvas>` as a grayscale
  image ([src/components/BeamCanvas.svelte](src/components/BeamCanvas.svelte)),
  equivalent to MATLAB's `imshow(I)` with `I` scaled so `max(I(:)) == 1`.

## Tools used

- [Svelte 5](https://svelte.dev/) (runes: `$state`, `$props`, `$effect`) for the UI
- [TypeScript](https://www.typescriptlang.org/) for the simulation math and components
- [Vite](https://vite.dev/) as the dev server and bundler (via
  `@sveltejs/vite-plugin-svelte`)
- Native Web Worker + `<canvas>` APIs — no numeric/plotting libraries are
  needed; the simulation math is simple enough for plain typed-array loops
- [oxlint](https://oxc.rs/) for linting

No server/backend is required — it's a fully static, client-side app.

## Project structure

```
src/
  App.svelte                 # form inputs, run button, status text
  components/
    BeamCanvas.svelte        # canvas renderer (imshow equivalent)
  lib/
    beamProfile.ts           # port of beamprofile.m
    beamSimulation.ts        # port of beamsimulation.m
    simulation.worker.ts     # Web Worker wrapper with progress/status messages
    mathUtils.ts             # MATLAB colon-range helper
```

## How to build and run

Requires Node.js (with npm).

```sh
npm install       # install dependencies
npm run dev       # start the dev server with hot reload
npm run build     # type-check (tsc -b) and produce a production build in dist/
npm run preview   # preview the production build locally
npm run lint      # run oxlint
```

