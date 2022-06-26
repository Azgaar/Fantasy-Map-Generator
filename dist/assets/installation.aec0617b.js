import{t as l}from"./index.73bf34f9.js";let n=null,o=null;function r(t){localStorage.getItem("installationDontAsk")||(n=i(),o=t,window.addEventListener("appinstalled",()=>{l("Application is installed",!1,"success",8e3),cleanup()}))}function i(){const t=document.createElement("button");return t.style=`
      position: fixed;
      top: 1em;
      right: 1em;
      padding: 0.6em 0.8em;
      width: auto;
    `,t.className="options glow",t.innerHTML="Install",t.onclick=a,t.onmouseenter=()=>l("Install the Application"),document.querySelector("body").appendChild(t),t}function a(){alertMessage.innerHTML=`You can install the tool so that it will look and feel like desktop application:
    have its own icon on your home screen and work offline with some limitations
  `,$("#alert").dialog({resizable:!1,title:"Install the Application",width:"38em",buttons:{Install:function(){$(this).dialog("close"),o.prompt()},Cancel:function(){$(this).dialog("close")}},open:function(){const e='<span><input id="dontAsk" class="checkbox" type="checkbox"><label for="dontAsk" class="checkbox-label dontAsk"><i>do not ask again</i></label><span>';this.parentElement.querySelector(".ui-dialog-buttonpane").insertAdjacentHTML("afterbegin",e)},close:function(){const e=this.parentElement.querySelector(".checkbox");e!=null&&e.checked&&(localStorage.setItem("installationDontAsk",!0),t()),$(this).dialog("destroy")}});function t(){n.remove(),n=null,o=null}}export{r as init};
