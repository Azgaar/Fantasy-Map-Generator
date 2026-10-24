declare global {
  // Vendored libraries, each loaded by its own <script> tag in index.html
  var THREE: any; // lazy-loaded by the 3d view
}

export type Point = [number, number];
