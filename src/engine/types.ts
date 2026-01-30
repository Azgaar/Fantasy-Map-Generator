export interface WorkerInitMessage {
  type: "init";
  buffer: SharedArrayBuffer;
  width: number;
  height: number;
  seed: string;
}

export interface WorkerCompleteMessage {
  type: "complete";
}

export type WorkerMessage = WorkerInitMessage | WorkerCompleteMessage;
