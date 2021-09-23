(window => {
  const noTrack = window.localStorage.getItem("noTrack");
  if (noTrack) return;

  const {
    screen: {width, height},
    navigator: {language},
    location: {hostname, pathname, search},
    document: {referrer}
  } = window;

  const website = "4f6fd0ae-646a-4946-a9da-7aad63284e48";
  const root = "https://fmg-stats.herokuapp.com";
  const screen = `${width}x${height}`;
  const url = `${pathname}${search}`;

  const post = (url, data) => {
    const req = new XMLHttpRequest();
    req.open("POST", url, true);
    req.setRequestHeader("Content-Type", "application/json");
    req.send(JSON.stringify(data));
  };

  const collect = (type, params) => {
    const payload = {website, hostname, screen, language, cache: false};
    Object.keys(params).forEach(key => {
      payload[key] = params[key];
    });

    post(`${root}/api/collect`, {type, payload});
  };

  // const addEvents = () => {
  //   document.querySelectorAll("[class*='umami--']").forEach(element => {
  //     element.className.split(" ").forEach(className => {
  //       if (/^umami--([a-z]+)--([\w]+[\w-]*)$/.test(className)) {
  //         const [, type, value] = className.split("--");
  //         const listener = () => collect("event", {event_type: type, event_value: value});
  //         element.addEventListener(type, listener, true);
  //       }
  //     });
  //   });
  // };
  // addEvents();

  collect("pageview", {url, referrer});
  window.track = (event_type = "reach", event_value = "") => collect("event", {event_type, event_value, url});
})(window);
