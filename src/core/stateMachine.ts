/**
 * Centralized State Machine for AIRWRITE AI
 * Controls transitions between IDLE, TRACKING, WRITING, SELECTING, PAUSED, and PRESENTATION.
 */

import { InteractionState, HandGesture } from '../types';

export type StateMachineEvent =
  | 'HAND_DETECTED'
  | 'HAND_LOST'
  | 'PEN_DOWN'
  | 'PEN_UP'
  | 'TRIGGER_PAUSE'
  | 'RESUME_TRACKING'
  | 'TRIGGER_SELECTION'
  | 'TRIGGER_PRESENTATION'
  | 'EXIT_PRESENTATION';

export interface StateTransitionResult {
  from: InteractionState;
  to: InteractionState;
  allowed: boolean;
  actionPermitted: boolean;
}

export type StateChangeListener = (
  newState: InteractionState,
  oldState: InteractionState,
  event: StateMachineEvent
) => void;

export class AirWriteStateMachine {
  private currentState: InteractionState = 'IDLE';
  private listeners: Set<StateChangeListener> = new Set();

  constructor(initialState: InteractionState = 'IDLE') {
    this.currentState = initialState;
  }

  public getState(): InteractionState {
    return this.currentState;
  }

  public subscribe(listener: StateChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Evaluates permitted actions based on active state
   */
  public canDraw(): boolean {
    return this.currentState === 'WRITING';
  }

  public canHoverAim(): boolean {
    return this.currentState === 'TRACKING' || this.currentState === 'PRESENTATION';
  }

  public canErase(): boolean {
    return this.currentState === 'SELECTING';
  }

  public isPaused(): boolean {
    return this.currentState === 'PAUSED';
  }

  public isPresentation(): boolean {
    return this.currentState === 'PRESENTATION';
  }

  /**
   * Execute state transition with strict validation
   */
  public transition(event: StateMachineEvent): StateTransitionResult {
    const from = this.currentState;
    let to = from;
    let allowed = false;

    switch (this.currentState) {
      case 'IDLE':
        if (event === 'HAND_DETECTED') {
          to = 'TRACKING';
          allowed = true;
        }
        break;

      case 'TRACKING':
        if (event === 'HAND_LOST') {
          to = 'IDLE';
          allowed = true;
        } else if (event === 'PEN_DOWN') {
          to = 'WRITING';
          allowed = true;
        } else if (event === 'TRIGGER_SELECTION') {
          to = 'SELECTING';
          allowed = true;
        } else if (event === 'TRIGGER_PAUSE') {
          to = 'PAUSED';
          allowed = true;
        } else if (event === 'TRIGGER_PRESENTATION') {
          to = 'PRESENTATION';
          allowed = true;
        }
        break;

      case 'WRITING':
        if (event === 'PEN_UP') {
          to = 'TRACKING';
          allowed = true;
        } else if (event === 'HAND_LOST') {
          // Terminate stroke safely when tracking is lost
          to = 'IDLE';
          allowed = true;
        } else if (event === 'TRIGGER_PAUSE') {
          to = 'PAUSED';
          allowed = true;
        }
        break;

      case 'SELECTING':
        if (event === 'PEN_UP' || event === 'RESUME_TRACKING') {
          to = 'TRACKING';
          allowed = true;
        } else if (event === 'HAND_LOST') {
          to = 'IDLE';
          allowed = true;
        }
        break;

      case 'PAUSED':
        if (event === 'RESUME_TRACKING' || event === 'HAND_DETECTED') {
          to = 'TRACKING';
          allowed = true;
        } else if (event === 'HAND_LOST') {
          to = 'IDLE';
          allowed = true;
        }
        break;

      case 'PRESENTATION':
        if (event === 'EXIT_PRESENTATION' || event === 'RESUME_TRACKING') {
          to = 'TRACKING';
          allowed = true;
        } else if (event === 'HAND_LOST') {
          to = 'IDLE';
          allowed = true;
        }
        break;
    }

    if (allowed && to !== from) {
      this.currentState = to;
      this.listeners.forEach((fn) => fn(to, from, event));
    }

    return {
      from,
      to: this.currentState,
      allowed,
      actionPermitted: allowed,
    };
  }

  public reset(): void {
    this.transition('HAND_LOST');
  }
}
