import { useEffect, useRef, useState } from 'react';
import { BeamCanvas } from './components/BeamCanvas';
import type { SimulationParams, WorkerMessage } from './lib/simulation.worker';
import './App.css';

interface FormState {
  freq: number;
  depth: number;
  wide: number;
  trans: number;
  angl: number;
  focus: number;
  emitters: number;
}

const initialForm: FormState = {
  freq: 5,
  depth: 10,
  wide: 6,
  trans: 3,
  angl: 0,
  focus: 0,
  emitters: 50,
};

function App() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [image, setImage] = useState<{ data: Float64Array; width: number; height: number } | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Lazily create a single worker that survives React StrictMode's mount/cleanup/remount cycle in
  // dev mode. (A useEffect that both creates and terminates the worker would kill it after the
  // first simulated unmount, leaving it silently unresponsive to later postMessage calls.)
  if (!workerRef.current) {
    workerRef.current = new Worker(new URL('./lib/simulation.worker.ts', import.meta.url), { type: 'module' });
  }
  const worker = workerRef.current;

  useEffect(() => {
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;

      if (msg.type === 'progress') {
        // Also visible in the browser DevTools console (a worker can't write to the OS terminal).
        console.log(`[beamSimulation] row ${msg.row}/${msg.total}`);
        setStatus(`Running simulation... row ${msg.row}/${msg.total} (${((msg.row / msg.total) * 100).toFixed(0)}%)`);
        return;
      }

      if (msg.type === 'error') {
        setRunning(false);
        setStatus(`Error running beamsimulation: ${msg.error}`);
        return;
      }

      setRunning(false);
      const { data, width, height } = msg;

      // Normalize so max is 1.0, matching beamApp.m
      let max = 0;
      for (let i = 0; i < data.length; i++) if (data[i] > max) max = data[i];
      if (max === 0) {
        setStatus('Simulation result is all zeros; cannot normalize.');
        return;
      }
      const normalized = new Float64Array(data.length);
      for (let i = 0; i < data.length; i++) normalized[i] = data[i] / max;

      setImage({ data: normalized, width, height });
      setStatus('Simulation complete.');
    };
  }, [worker]);

  const updateField = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.valueAsNumber }));
  };

  const runSimulation = () => {
    const { freq, depth, wide, trans, angl, focus, emitters } = form;

    const valid =
      [freq, depth, wide, trans, angl, focus, emitters].every((v) => !Number.isNaN(v)) &&
      freq > 0 &&
      depth > 0 &&
      wide > 0 &&
      trans > 0 &&
      emitters >= 1;

    if (!valid) {
      setStatus('Error: Ensure numeric inputs are valid (positive size values, emitters >= 1).');
      return;
    }

    setRunning(true);
    setStatus('Running simulation...');

    const params: SimulationParams = {
      freq,
      depth,
      wide,
      trans,
      angl,
      focus,
      emitters: Math.round(emitters),
    };
    workerRef.current?.postMessage(params);
  };

  return (
    <div className="beam-app">
      <aside className="beam-form">
        <h1>Beam Simulation</h1>

        <label>
          Frequency (MHz)
          <input type="number" value={form.freq} onChange={updateField('freq')} />
        </label>
        <label>
          Depth (cm)
          <input type="number" value={form.depth} onChange={updateField('depth')} />
        </label>
        <label>
          Width (cm)
          <input type="number" value={form.wide} onChange={updateField('wide')} />
        </label>
        <label>
          Transducer (cm)
          <input type="number" value={form.trans} onChange={updateField('trans')} />
        </label>
        <label>
          Angle (deg)
          <input type="number" value={form.angl} onChange={updateField('angl')} />
        </label>
        <label>
          Focus (cm)
          <input type="number" value={form.focus} onChange={updateField('focus')} />
        </label>
        <label>
          Emitters (count)
          <input type="number" min={1} step={1} value={form.emitters} onChange={updateField('emitters')} />
        </label>

        <button type="button" onClick={runSimulation} disabled={running}>
          {running ? 'Running…' : 'Run Simulation'}
        </button>

        <p className="status">{status}</p>
      </aside>

      <main className="beam-display">
        {image ? (
          <BeamCanvas data={image.data} width={image.width} height={image.height} />
        ) : (
          <p className="placeholder">Run a simulation to see the beam profile.</p>
        )}
      </main>
    </div>
  );
}

export default App;
