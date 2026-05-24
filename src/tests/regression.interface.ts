export interface RegressionDumpPayload {
  filename: string;
  data: any; // The standardized DTO object to be converted to JSON
}

export interface IRegressionRunner {
  name: string; // The display name for the console logger
  generateDumps(): Promise<RegressionDumpPayload[]>; // Returns an array of dumps
}
