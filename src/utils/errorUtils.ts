// parse error to get the readable string
export function parseError(error: Error) {
  const errorString = error.toString() + " " + error.stack;
  const regex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  const errorNoURL = errorString.replace(regex, url => "<i>" + url.split("/").at(-1) + "</i>");
  const errorParsed = errorNoURL.replace(/at /gi, "<br>&nbsp;&nbsp;at ");
  return errorParsed;
}
