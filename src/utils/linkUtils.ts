// open URL in a new tab or window
export function openURL(url: string) {
  window.open(url, "_blank");
}

// open project wiki-page
export function wiki(page: string) {
  window.open("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/" + page, "_blank");
}

// wrap URL into html anchor element
export function link(url: string, text: string) {
  return `<a href="${url}" rel="noopener" target="_blank">${text}</a>`;
}
