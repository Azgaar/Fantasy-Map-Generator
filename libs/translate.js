"use strict";function translate(n,t){const a=translation[n];return a||t}!function(){if(window.lang="en",localStorage.getItem("lang"))window.lang=localStorage.getItem("lang");else{const n=n=>["ru"].includes(n),t=navigator.language.split("-")[0];n(t)&&(window.lang=t)}selectLanguage.value=window.lang,"en"!==window.lang&&async function(){if(!await new Promise(n=>{const t=document.createElement("script");t.src=`lang/lang-${window.lang}.js`,document.head.append(t),t.onload=()=>n(!0),t.onerror=()=>n(!1)}))return tip(`Cannot load ${window.lang} translation, check files in lang folder`,!1,"error",4e3),window.lang,!1;translation.titleFull&&(document.title=translation.titleFull);Array.from(document.getElementsByTagName("t")).forEach(n=>{const t=n.dataset.t,a=translation[t];a&&(n.innerHTML=a)})}()}();