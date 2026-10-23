declare global {
  // Vendored libraries, each loaded by its own <script> tag in index.html
  var $: (selector: any) => any; // jQuery + jQuery UI
  var THREE: any; // lazy-loaded by the 3d view
}

export type Point = [number, number];
