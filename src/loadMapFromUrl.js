function makeFileFromUrl(mapLink, callback) {
  fetch(mapLink, {
    method: 'GET',
    mode: 'cors',
  })
    .then(response => response.blob())
    .then(blob => callback(blob));
}

function loadMapFromUrl(uploadFile) {
  const url = new URL(location.href);
  const mapLink = url.searchParams.get('maplink');
  if (mapLink) {
    makeFileFromUrl(decodeURIComponent(mapLink), uploadFile);
  }
}

window.loadMapFromUrl = loadMapFromUrl;
