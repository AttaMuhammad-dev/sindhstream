import React, { useRef, useEffect, useState } from 'react';
import type { MathGraphData } from '../../types/ai';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface MathGraphViewerProps {
  graphData: MathGraphData;
}

export const MathGraphViewer: React.FC<MathGraphViewerProps> = ({ graphData }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverCoord, setHoverCoord] = useState<{ x: number; y: number } | null>(null);
  const [scaleMultiplier, setScaleMultiplier] = useState(1.0);

  const { functionExpression, domain, points, roots = [], extrema = [], label } = graphData;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !points || points.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#080E1A';
    ctx.fillRect(0, 0, width, height);

    // Compute bounding ranges
    const xMin = domain[0] * scaleMultiplier;
    const xMax = domain[1] * scaleMultiplier;

    let yMin = Infinity;
    let yMax = -Infinity;
    for (const p of points) {
      if (p.y < yMin) yMin = p.y;
      if (p.y > yMax) yMax = p.y;
    }

    // Add 20% margin to range
    const yPad = Math.max(1, (yMax - yMin) * 0.2);
    const effYMin = (yMin - yPad) * scaleMultiplier;
    const effYMax = (yMax + yPad) * scaleMultiplier;

    // Coordinate transforms
    const toCanvasX = (x: number) => {
      return ((x - xMin) / (xMax - xMin)) * (width - 40) + 20;
    };

    const toCanvasY = (y: number) => {
      return height - 20 - ((y - effYMin) / (effYMax - effYMin)) * (height - 40);
    };

    // Draw grid
    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 1;

    const xStep = Math.max(1, Math.round((xMax - xMin) / 8));
    for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += xStep) {
      const cx = toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();

      // Tick label
      ctx.fillStyle = '#64748B';
      ctx.font = '9px monospace';
      ctx.fillText(`${x}`, cx - 4, height - 6);
    }

    const yStep = Math.max(1, Math.round((effYMax - effYMin) / 6));
    for (let y = Math.ceil(effYMin); y <= Math.floor(effYMax); y += yStep) {
      const cy = toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '9px monospace';
      ctx.fillText(`${y}`, 4, cy - 2);
    }

    // Main Axes (x = 0 and y = 0)
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1.5;

    // X Axis (where y = 0)
    if (effYMin <= 0 && effYMax >= 0) {
      const cy0 = toCanvasY(0);
      ctx.beginPath();
      ctx.moveTo(0, cy0);
      ctx.lineTo(width, cy0);
      ctx.stroke();
    }

    // Y Axis (where x = 0)
    if (xMin <= 0 && xMax >= 0) {
      const cx0 = toCanvasX(0);
      ctx.beginPath();
      ctx.moveTo(cx0, 0);
      ctx.lineTo(cx0, height);
      ctx.stroke();
    }

    // Plot Curve
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#38BDF8';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    let started = false;
    for (const p of points) {
      const cx = toCanvasX(p.x);
      const cy = toCanvasY(p.y);
      if (!started) {
        ctx.moveTo(cx, cy);
        started = true;
      } else {
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Draw Roots (y = 0)
    for (const r of roots) {
      const cx = toCanvasX(r);
      const cy = toCanvasY(0);

      ctx.fillStyle = '#10B981';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ECFDF5';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#A7F3D0';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`(${r}, 0)`, cx - 12, cy - 8);
    }

    // Draw Extrema
    for (const ext of extrema) {
      const cx = toCanvasX(ext.x);
      const cy = toCanvasY(ext.y);

      ctx.fillStyle = ext.type === 'min' ? '#F59E0B' : '#EC4899';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FDE68A';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${ext.type.toUpperCase()} (${ext.x}, ${ext.y})`, cx + 6, cy + 4);
    }

    // Hover crosshair
    if (hoverCoord) {
      const cx = toCanvasX(hoverCoord.x);
      const cy = toCanvasY(hoverCoord.y);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [graphData, scaleMultiplier, hoverCoord, domain, points, roots, extrema]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !points || points.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const normX = mouseX / rect.width;

    const xMin = domain[0] * scaleMultiplier;
    const xMax = domain[1] * scaleMultiplier;
    const currentX = xMin + normX * (xMax - xMin);

    // Find nearest point
    let closest = points[0];
    let minDiff = Infinity;
    for (const p of points) {
      const diff = Math.abs(p.x - currentX);
      if (diff < minDiff) {
        minDiff = diff;
        closest = p;
      }
    }

    setHoverCoord(closest);
  };

  return (
    <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-100 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-xs font-bold font-mono text-cyan-300">{functionExpression}</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
          <button
            onClick={() => setScaleMultiplier((prev) => Math.max(0.5, prev * 0.8))}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => setScaleMultiplier((prev) => Math.min(2.5, prev * 1.25))}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3 h-3" />
          </button>
          <button
            onClick={() => setScaleMultiplier(1.0)}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
            title="Reset"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-[#080E1A]">
        <canvas
          ref={canvasRef}
          width={360}
          height={200}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverCoord(null)}
          className="w-full h-[180px] cursor-crosshair block"
        />

        {hoverCoord && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded bg-slate-950/90 border border-cyan-500/50 text-[10px] font-mono text-cyan-300 pointer-events-none">
            x: {hoverCoord.x.toFixed(2)}, y: {hoverCoord.y.toFixed(2)}
          </div>
        )}
      </div>

      {label && <p className="text-[11px] text-slate-400 italic">{label}</p>}
    </div>
  );
};
