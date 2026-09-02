import { useEffect, useRef } from 'react';

interface BeamCanvasProps {
  data: Float64Array | null;
  width: number;
  height: number;
}

/**
 * Renders a normalized intensity matrix as a grayscale image, equivalent to
 * MATLAB's imshow(I) where I has been scaled so max == 1.0.
 */
export function BeamCanvas({ data, width, height }: BeamCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data || width <= 0 || height <= 0) return;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.createImageData(width, height);
    for (let i = 0; i < width * height; i++) {
      const gray = Math.max(0, Math.min(255, Math.round(data[i] * 255)));
      const o = i * 4;
      imageData.data[o] = gray;
      imageData.data[o + 1] = gray;
      imageData.data[o + 2] = gray;
      imageData.data[o + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', objectFit: 'contain', imageRendering: 'pixelated' }}
    />
  );
}
