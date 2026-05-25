export interface IRegressionRunner<T = any> {
  name: string;
  filename: string;
  // This extracts the specific slice of data this test case needs
  execute: () => Promise<T>;
}

export interface IRegressionSuite {
  name: string;
  runners: IRegressionRunner<any>[];
}
