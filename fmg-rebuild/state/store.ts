import { Grid, Pack } from "../core/types";

export interface AppState {
  width: number;
  height: number;
  seed: string;
  cellsDesired: number;
  grid: Grid | null;
  heights: Uint8Array | null;
  temp: Float32Array | null;
  prec: Uint8Array | null;
  flowDirections: Int32Array | null;
  flux: Float32Array | null;
  rivers: Uint16Array | null;
  biomes: Uint8Array | null;
}

type StateListener = (state: AppState) => void;

class StateStore {
  private state: AppState;
  private listeners: Set<StateListener> = new Set();

  constructor() {
    this.state = {
      width: 1000,
      height: 600,
      seed: "rebuild-seed",
      cellsDesired: 10000,
      grid: null,
      heights: null,
      temp: null,
      prec: null,
      flowDirections: null,
      flux: null,
      rivers: null,
      biomes: null
    };
  }

  getState(): AppState {
    return { ...this.state };
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    // Fire initial state
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const currentState = this.getState();
    for (const listener of this.listeners) {
      listener(currentState);
    }
  }

  updateState(updatedFields: Partial<AppState>) {
    this.state = {
      ...this.state,
      ...updatedFields
    };
    this.notify();
  }
}

export const store = new StateStore();
export default store;
