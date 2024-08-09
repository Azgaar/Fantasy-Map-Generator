"use strict";
// FMG helper functions

// clip polygon by graph bbox
function clipPoly(points, secure = 0) {
  return polygonclip(points, [0, 0, graphWidth, graphHeight], secure);
}

// get segment of any point on polyline
function getSegmentId(points, point, step = 10) {
  if (points.length === 2) return 1;

  let minSegment = 1;
  let minDist = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const length = Math.sqrt(dist2(p1, p2));
    const segments = Math.ceil(length / step);
    const dx = (p2[0] - p1[0]) / segments;
    const dy = (p2[1] - p1[1]) / segments;

    for (let s = 0; s < segments; s++) {
      const x = p1[0] + s * dx;
      const y = p1[1] + s * dy;
      const dist = dist2(point, [x, y]);

      if (dist >= minDist) continue;
      minDist = dist;
      minSegment = i + 1;
    }
  }

  return minSegment;
}

function debounce(func, ms) {
  let isCooldown = false;

  return function () {
    if (isCooldown) return;
    func.apply(this, arguments);
    isCooldown = true;
    setTimeout(() => (isCooldown = false), ms);
  };
}

function throttle(func, ms) {
  let isThrottled = false;
  let savedArgs;
  let savedThis;

  function wrapper() {
    if (isThrottled) {
      savedArgs = arguments;
      savedThis = this;
      return;
    }

    func.apply(this, arguments);
    isThrottled = true;

    setTimeout(function () {
      isThrottled = false;
      if (savedArgs) {
        wrapper.apply(savedThis, savedArgs);
        savedArgs = savedThis = null;
      }
    }, ms);
  }

  return wrapper;
}

// parse error to get the readable string in Chrome and Firefox
function parseError(error) {
  const isFirefox = navigator.userAgent.toLowerCase().indexOf("firefox") > -1;
  const errorString = isFirefox ? error.toString() + " " + error.stack : error.stack;
  const regex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/gi;
  const errorNoURL = errorString.replace(regex, url => "<i>" + last(url.split("/")) + "</i>");
  const errorParsed = errorNoURL.replace(/at /gi, "<br>&nbsp;&nbsp;at ");
  return errorParsed;
}

function getBase64(url, callback) {
  const xhr = new XMLHttpRequest();
  xhr.onload = function () {
    const reader = new FileReader();
    reader.onloadend = function () {
      callback(reader.result);
    };
    reader.readAsDataURL(xhr.response);
  };
  xhr.open("GET", url);
  xhr.responseType = "blob";
  xhr.send();
}

// open URL in a new tab or window
function openURL(url) {
  window.open(url, "_blank");
}

// open project wiki-page
function wiki(page) {
  window.open("https://github.com/Azgaar/Fantasy-Map-Generator/wiki/" + page, "_blank");
}

// wrap URL into html a element
function link(URL, description) {
  return `<a href="${URL}" rel="noopener" target="_blank">${description}</a>`;
}

function isCtrlClick(event) {
  // meta key is cmd key on MacOs
  return event.ctrlKey || event.metaKey;
}

function generateDate(from = 100, to = 1000) {
  return new Date(rand(from, to), rand(12), rand(31)).toLocaleDateString("en", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getLongitude(x, decimals = 2) {
  return rn(mapCoordinates.lonW + (x / graphWidth) * mapCoordinates.lonT, decimals);
}

function getLatitude(y, decimals = 2) {
  return rn(mapCoordinates.latN - (y / graphHeight) * mapCoordinates.latT, decimals);
}

function getCoordinates(x, y, decimals = 2) {
  return [getLongitude(x, decimals), getLatitude(y, decimals)];
}

// prompt replacer (prompt does not work in Electron)
void (function () {
  const prompt = document.getElementById("prompt");
  const form = prompt.querySelector("#promptForm");

  const defaultText = "Please provide an input";
  const defaultOptions = {default: 1, step: 0.01, min: 0, max: 100, required: true};

  window.prompt = function (promptText = defaultText, options = defaultOptions, callback) {
    if (options.default === undefined)
      return ERROR && console.error("Prompt: options object does not have default value defined");

    const input = prompt.querySelector("#promptInput");
    prompt.querySelector("#promptText").innerHTML = promptText;

    const type = typeof options.default === "number" ? "number" : "text";
    input.type = type;

    if (options.step !== undefined) input.step = options.step;
    if (options.min !== undefined) input.min = options.min;
    if (options.max !== undefined) input.max = options.max;

    input.required = options.required === false ? false : true;
    input.placeholder = "type a " + type;
    input.value = options.default;
    prompt.style.display = "block";

    form.addEventListener(
      "submit",
      event => {
        event.preventDefault();
        prompt.style.display = "none";
        const v = type === "number" ? +input.value : input.value;
        if (callback) callback(v);
      },
      {once: true}
    );
  };

  const cancel = prompt.querySelector("#promptCancel");
  cancel.addEventListener("click", () => {
    prompt.style.display = "none";
  });
})();
