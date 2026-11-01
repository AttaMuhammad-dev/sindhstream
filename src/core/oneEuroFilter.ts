/**
 * 1€ Filter (One Euro Filter) for Adaptive Low-Latency Smoothing
 * Reference: Casiez, Roussel, Vogel (CHI 2012) - "1 € Filter: A Simple Speed-based
 * Low-pass Filter for Noisy Input in Human-Computer Interaction"
 *
 * Provides extreme jitter reduction at low speeds while eliminating lag at high speeds.
 */

import { Point2D } from '../types';

class LowPassFilter {
  private y: number | null = null;
  private s: number | null = null;

  public filter(value: number, alpha: number): number {
    if (this.y === null) {
      this.s = value;
      this.y = value;
    } else {
      this.y = alpha * value + (1.0 - alpha) * this.s!;
      this.s = this.y;
    }
    return this.y;
  }

  public hasLastRawValue(): boolean {
    return this.y !== null;
  }

  public lastRawValue(): number {
    return this.y ?? 0;
  }

  public reset(): void {
    this.y = null;
    this.s = null;
  }
}

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastTime: number | null = null;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private calculateAlpha(rate: number, cutoff: number): number {
    const tau = 1.0 / (2 * Math.PI * cutoff);
    const te = 1.0 / rate;
    return 1.0 / (1.0 + tau / te);
  }

  public filter(value: number, timestamp: number): number {
    if (this.lastTime === null) {
      this.lastTime = timestamp;
      return this.xFilter.filter(value, 1.0);
    }

    // Determine dt in seconds
    const dt = Math.max(1e-4, (timestamp - this.lastTime) / 1000);
    this.lastTime = timestamp;
    const rate = 1.0 / dt;

    // Estimate derivative (velocity)
    const prevRaw = this.xFilter.lastRawValue();
    const dx = (value - prevRaw) * rate;
    const edx = this.dxFilter.filter(dx, this.calculateAlpha(rate, this.dCutoff));

    // Dynamic cutoff frequency: higher velocity increases cutoff to reduce lag
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const alpha = this.calculateAlpha(rate, cutoff);

    return this.xFilter.filter(value, alpha);
  }

  public updateParameters(minCutoff: number, beta: number, dCutoff = 1.0): void {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  public reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastTime = null;
  }
}

/**
 * 2D Point One Euro Filter for canvas coordinates
 */
export class PointOneEuroFilter {
  private filterX: OneEuroFilter;
  private filterY: OneEuroFilter;

  constructor(minCutoff = 1.0, beta = 0.007, dCutoff = 1.0) {
    this.filterX = new OneEuroFilter(minCutoff, beta, dCutoff);
    this.filterY = new OneEuroFilter(minCutoff, beta, dCutoff);
  }

  public filter(point: Point2D, timestamp = performance.now()): Point2D {
    const smoothedX = this.filterX.filter(point.x, timestamp);
    const smoothedY = this.filterY.filter(point.y, timestamp);
    return {
      x: smoothedX,
      y: smoothedY,
      pressure: point.pressure ?? 1,
      time: timestamp,
    };
  }

  public updateParameters(minCutoff: number, beta: number): void {
    this.filterX.updateParameters(minCutoff, beta);
    this.filterY.updateParameters(minCutoff, beta);
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
  }
}
