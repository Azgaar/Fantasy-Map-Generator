(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global.Names = factory());
}(this, (function () { 'use strict';

  const chains = [];

  // calculate Markov chain for a namesbase
  const calculateChain = function(b) {
    const chain = [];
    const d = nameBase[b].join(" ").toLowerCase();

    for (let i = -1, prev = " ", str = ""; i < d.length - 2; prev = str, i += str.length, str = "") {
      let v = 0, f = " ";

      for (let c=i+1; str.length < 5; c++) {
        if (d[c] === undefined) break;
        str += d[c];
        if (str === " ") break;
        if (d[c] !== "o" && d[c] !== "e" && vowel(d[c]) && d[c+1] === d[c]) break;
        if (d[c+2] === " ") {str += d[c+1]; break;}
        if (vowel(d[c])) v++;
        if (v && vowel(d[c+2])) break;
      }

      if (i >= 0) f = d[i];
      if (chain[f] === undefined) chain[f] = [];
      chain[f].push(str);
    }

    return chain;
  }

  // update chain for specific base
  const updateChain = (b) => chains[b] = nameBase[b] ? calculateChain(b) : null;

  // update chains for all used bases
  const updateChains = () => chains.forEach((c, i) => chains[i] = nameBase[i] ? calculateChain(i) : null); 

  // generate name using Markov's chain
  const getBase = function(base, min, max, dupl, multi) {
    if (base === undefined) {console.error("Please define a base"); return;}
    if (!chains[base]) chains[base] = nameBase[base] ? calculateChain(base) : null;

    const data = chains[base];
    if (!data || data[" "] === undefined) {
      tip("Namesbase " + base + " is incorrect. Please checl in namesbase editor", false, "error"); 
      console.error("nameBase " + base + " is incorrect!"); 
      return "ERROR";
    }

    if (!min) min = nameBases[base].min;
    if (!max) max = nameBases[base].max;
    if (!dupl) dupl = nameBases[base].d;
    if (!multi) multi = nameBases[base].m;

    let v = data[" "], cur = v[rand(v.length-1)], w = "";
    for (let i=0; i < 21; i++) {
      if (cur === " " && Math.random() > multi) {
        if (w.length < min) {cur = ""; w = ""; v = data[" "];} else break;
      } else {
        if ((w+cur).length > max) {
          if (w.length < min) w += cur;
          break;
        } else if (cur === " " && w.length+1 < min) {
          cur = "";
          v = data[" "];
        } else {
          v = data[cur.slice(-1)];
        }
      }

      w += cur;
      cur = v[rand(v.length - 1)];
    }

    // parse word to get a final name
    let name = [...w].reduce(function(r, c, i, d) {
      if (c === d[i+1] && !dupl.includes(c)) return r; // duplication is not allowed
      if (!r.length) return c.toUpperCase();
      if (r.slice(-1) === " ") return r + c.toUpperCase();
      if (c === "a" && d[i+1] === "e") return r; // "ae" => "e"
      if (c === " " && i+1 === d.length) return r;
      // remove consonant before 2 consonants
      if (i+2 < d.length && !vowel(c) && !vowel(d[i+1]) && !vowel(d[i+2])) return r;
      if (i+2 < d.length && c === d[i+1] && c === d[i+2]) return r; // remove tree same letters in a row
      return r + c;
    }, "");

    if (name.length < 2) name = nameBase[base][rand(nameBase[base].length-1)]; // rare case when no name generated
    return name;
  }

  // generate name for culture
  const getCulture = function(culture, min, max, dupl, multi) {
    if (culture === undefined) {console.error("Please define a culture"); return;}
    const base = pack.cultures[culture].base;
    return getBase(base, min, max, dupl, multi);
  }

  // generate state name based on capital or random name and culture-specific suffix
  const getState = function(name, culture) {
    if (name === undefined) {console.error("Please define a base name"); return;}
    if (culture === undefined) {console.error("Please define a culture"); return;}
    const base = pack.cultures[culture].base;

    // exclude endings inappropriate for states name
    if (name.includes(" ")) name = capitalize(name.replace(/ /g, "").toLowerCase()); // don't allow multiword state names
    if (name.length > 6 && name.slice(-4) === "berg") name = name.slice(0,-4); // remove -berg for any
    if (base === 5 && ["sk", "ev", "ov"].includes(name.slice(-2))) name = name.slice(0,-2); // remove -sk/-ev/-ov for Ruthenian
    else if (base === 1 && name.length > 5 && name.slice(-3) === "ton") name = name.slice(0,-3); // remove -ton for English
    else if (base === 12) return vowel(name.slice(-1)) ? name : name + "u"; // Japanese ends on any vowel or -u
    else if (base === 18 && Math.random() < .4) name = vowel(name.slice(0,1).toLowerCase()) ? "Al" + name.toLowerCase() : "Al " + name; // Arabic starts with -Al

    // define if suffix should be used
    if (name.length > 3 && vowel(name.slice(-1))) {
      if (vowel(name.slice(-2,-1)) && Math.random() < .85) name = name.slice(0,-2); // 85% for vv
      else if (Math.random() < .7) name = name.slice(0,-1); // ~60% for cv
      else return name;
    } else if (Math.random() < .4) return name; // 60% for cc and vc

    // define suffix
    let suffix = "";
    const rnd = Math.random(), l = name.length;
    if (base === 3) suffix = rnd < .03 && l < 7 ? "terra" : "ia"; // Italian
    else if (base === 4) suffix = rnd < .03 && l < 7 ? "terra" : "ia"; // Spanish
    else if (base === 13) suffix = rnd < .03 && l < 7 ? "terra" : "ia"; // Portuguese
    else if (base === 2) suffix = rnd < .03 && l < 7 ? "terre" : "ia"; // French
    else if (base === 0) suffix = rnd < .5 && l < 7 ? "land" : "ia"; // German
    else if (base === 1) suffix = rnd < .4 && l < 7 ? "land" : "ia"; // English
    else if (base === 6) suffix = rnd < .3 && l < 7 ? "land" : "ia"; // Nordic
    else if (base === 7) suffix = rnd < .1 ? "eia" : "ia"; // Greek
    else if (base === 9) suffix = rnd < .35 ? "maa" : "ia"; // Finnic
    else if (base === 15) suffix = rnd < .6 && l < 6 ? "orszag" : "ia"; // Hungarian
    else if (base === 16) suffix = rnd < .5 ? "stan" : "ya"; // Turkish
    else if (base === 10) suffix = "guk"; // Korean
    else if (base === 11) suffix = " Guo"; // Chinese
    else if (base === 14) suffix = rnd < .6 && l < 7 ? "tlan" : "co"; // Nahuatl
    else if (base === 17) suffix = rnd < .8 ? "a" : "ia"; // Berber
    else if (base === 18) suffix = rnd < .8 ? "a" : "ia"; // Arabic
    else suffix = "ia" // other

    if (name.slice(-1 * suffix.length) === suffix) return name; // no suffix if name already ends with it
    const s1 = suffix.charAt(0);
    if (name.slice(-1) === s1) name = name.slice(0, -1); // remove name last letter if it's a suffix first letter
    if (vowel(s1) === vowel(name.slice(-1)) && vowel(s1) === vowel(name.slice(-2,-1))) name = name.slice(0, -1); // remove name last char if 2 last chars are the same type as suffix's 1st
    return name + suffix;
  }

  return {getBase, getCulture, getState, updateChain, updateChains};
})));
