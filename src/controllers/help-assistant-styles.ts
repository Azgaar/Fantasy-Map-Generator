export const ASSISTANT_STYLES = /* html */ `
    <style>
      /* .ui-dialog turns selection off so dialogs drag cleanly; an answer is there to be copied,
         so the body opts back in and only the titlebar keeps the drag behaviour */
      #helpAssistant { display: flex; flex-direction: column; gap: .5em; overflow: hidden; padding: .6em .7em .5em; font-family: var(--sans-serif); font-size: 16px; line-height: 1.5; user-select: text; background: #fff; }
      #helpAssistant > div          { width: auto; }
      .ui-dialog:has(> #helpAssistant) { font-size: 16px; }
      .ui-dialog:has(> #helpAssistant) .ui-dialog-titlebar { font-size: 16px; }
      .ui-dialog:has(> #helpAssistant) .ui-dialog-titlebar button { min-width: 28px; min-height: 28px; font-size: 16px; }
      #helpAssistant :is(button, input, select, textarea) { font-family: inherit; font-size: inherit; }
      #helpAssistant :is(button, select, input) { min-height: 32px; }
      #helpAssistant .helpMapSetup { flex: none; padding: 12px; border: 1px solid #bbb; border-radius: 6px; background: #fff; }
      #helpAssistant .helpMapSetup p { margin: 0 0 8px; }
      #helpAssistant .helpMapSetup[hidden] { display: none; }
      #helpAssistant .helpMapSetup button { font-size: 15px; }
      .ui-dialog-titlebar .helpAssistantNewChat { font-size: 16px; }

      #helpAssistant .helpAssistantModes { display: none !important; }
      /* two chats in one panel: the switch is a tab strip, not a pair of buttons */
      #helpAssistant .helpAssistantModes { flex: none; display: flex; gap: .15em; padding: .15em; border-radius: .45em; background: rgb(0 0 0 / 6%); }
      #helpAssistant .helpAssistantMode  { flex: 1; padding: .25em .5em; border: 0; border-radius: .35em; background: none; color: inherit; font: inherit; font-size: .92em; opacity: .65; transition: .15s; }
      #helpAssistant .helpAssistantMode::before  { margin-right: .3em; }
      #helpAssistant .helpAssistantMode:hover    { opacity: .9; }
      #helpAssistant .helpAssistantMode.selected { background: var(--light-solid); opacity: 1; font-weight: bold; box-shadow: 0 1px 2px rgb(0 0 0 / 15%); }
      #helpAssistant .helpAssistantPanel { display: flex; flex-direction: column; flex: 1; min-height: 0; gap: .5em; }
      #helpAssistant .helpAssistantPanel[hidden] { display: none; }

      #helpAssistant .helpAssistantLog   { flex: 1; min-height: 0; overflow: hidden auto; padding-right: .2em; line-height: 1.4; }
      #helpAssistant .helpAssistantMsg   { display: flex; margin-bottom: .55em; }
      #helpAssistant .helpAssistantMsg.user { justify-content: flex-end; }
      #helpAssistant .helpAssistantStack { display: flex; flex-direction: column; min-width: 0; max-width: 88%; }
      #helpAssistant .helpAssistantBubble { padding: .45em .65em; border-radius: .4em; background: rgb(0 0 0 / 6%); overflow-wrap: anywhere; }
      #helpAssistant .helpAssistantMsg.user .helpAssistantBubble   { background: var(--header); color: #ffffff; }
      #helpAssistant .helpAssistantMsg.user .helpAssistantBubble a { color: #ffffff; }

      /* answers are rendered markdown: keep block spacing tight enough to read as one message */
      #helpAssistant .helpAssistantBubble > :first-child { margin-top: 0; }
      #helpAssistant .helpAssistantBubble > :last-child  { margin-bottom: 0; }
      #helpAssistant .helpAssistantBubble p              { margin: .4em 0; }
      #helpAssistant .helpAssistantBubble :is(h3, h4, h5, h6) { margin: .6em 0 .3em; font-size: 1em; }
      #helpAssistant .helpAssistantBubble :is(ol, ul)    { margin: .4em 0; padding-left: 1.3em; }
      #helpAssistant .helpAssistantBubble pre            { overflow-x: auto; margin: .4em 0; padding: .4em .5em; border-radius: .3em; background: rgb(0 0 0 / 6%); font-size: .9em; }
      #helpAssistant .helpAssistantBubble code           { font-family: var(--monospace); }
      #helpAssistant .helpAssistantBubble table          { display: block; overflow-x: auto; border-collapse: collapse; }
      #helpAssistant .helpAssistantBubble :is(td, th)    { padding: .15em .4em; border: 1px solid rgb(0 0 0 / 12%); }

      /* three dots standing in for the answer while the model is thinking */
      #helpAssistant .helpAssistantTyping   { display: flex; align-items: center; gap: .28em; padding: .65em; }
      #helpAssistant .helpAssistantTyping i { width: .4em; height: .4em; border-radius: 50%; background: currentcolor; opacity: .35; animation: helpAssistantTyping 1.2s infinite ease-in-out; }
      #helpAssistant .helpAssistantTyping i:nth-child(2) { animation-delay: .15s; }
      #helpAssistant .helpAssistantTyping i:nth-child(3) { animation-delay: .3s; }
      @keyframes helpAssistantTyping { 0%, 60%, 100% { opacity: .25; transform: none; } 30% { opacity: .8; transform: translateY(-.18em); } }
      @media (prefers-reduced-motion: reduce) { #helpAssistant .helpAssistantTyping i { animation: none; } }

      #helpAssistant .helpAssistantDivider { display: flex; align-items: center; gap: .6em; margin: .6em 0; opacity: .5; font-size: .82em; text-transform: uppercase; letter-spacing: .06em; }
      #helpAssistant .helpAssistantDivider::before,
      #helpAssistant .helpAssistantDivider::after { content: ""; flex: 1; height: 1px; background: currentcolor; }

      #helpAssistant .helpAssistantFeedback        { display: flex; gap: .2em; margin-top: .15em; }
      #helpAssistant .helpAssistantFeedback button { padding: 0 .15em; border: none; background: none; opacity: .35; font-size: .9em; transition: .15s; }
      #helpAssistant .helpAssistantFeedback button:hover    { opacity: .75; }
      #helpAssistant .helpAssistantFeedback button.selected { opacity: 1; }

      /* server refusals and countdowns: loud enough to notice, quiet enough to stay out of the way */
      #helpAssistant .helpAssistantNotice { flex: none; max-height: 30%; overflow-y: auto; padding: .45em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #helpAssistant .helpAssistantNotice > :first-child { margin-top: 0; }
      #helpAssistant .helpAssistantNotice > :last-child  { margin-bottom: 0; }
      #helpAssistant .helpAssistantCountdown { margin-top: .3em; opacity: .7; font-variant-numeric: tabular-nums; }

      #helpAssistant .helpAssistantComposer          { flex: none; display: flex; align-items: flex-end; gap: .4em; padding: .3em .3em .3em .5em; border: 1px solid rgb(0 0 0 / 18%); border-radius: .5em; background: rgb(255 255 255 / 55%); transition: border-color .15s; }
      #helpAssistant .helpAssistantComposer:focus-within { border-color: var(--header); }
      #helpAssistant .helpAssistantComposer textarea { flex: 1; min-width: 0; height: 1.7em; max-height: 108px; padding: .2em 0; border: 0; background: none; resize: none; font: inherit; line-height: 1.4; }
      #helpAssistant .helpAssistantSend              { flex: none; display: flex; align-items: center; justify-content: center; width: 1.9em; height: 1.9em; border: 0; border-radius: .4em; background: var(--header); color: #ffffff; font-size: 1em; transition: .15s; }
      #helpAssistant .helpAssistantSend::before      { margin: 0; }
      #helpAssistant .helpAssistantSend:hover        { background: var(--header-active); }
      #helpAssistant .helpAssistantSend:disabled     { opacity: .4; cursor: default; }

      /* quick links and the account state: present, but plainly secondary to the transcript */
      #helpAssistant .helpAssistantBar     { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2em .8em; padding-top: .4em; border-top: 1px solid rgb(0 0 0 / 10%); font-size: .9em; }
      #helpAssistant .helpAssistantLinks   { display: flex; gap: .8em; }
      #helpAssistant .helpAssistantAccount { display: flex; align-items: center; gap: .5em; opacity: .85; }
      #helpAssistant .helpAssistantLink        { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline; }
      #helpAssistant .helpAssistantLink:hover  { color: var(--header-active); }

      #helpAssistant .helpAssistantUnlisted { flex: none; line-height: 1.4; }

      /* This map: the same transcript, plus what only a scripted assistant needs */
      #helpAssistant .helpMapEmpty        { display: flex; flex-direction: column; align-items: center; gap: .4em; padding: .3em 0; text-align: center; }
      #helpAssistant .helpMapEmpty > p    { margin: 0 0 .2em; opacity: .7; }
      #helpAssistant .helpMapEmpty button { max-width: 100%; padding: .3em .7em; border: 1px solid rgb(0 0 0 / 15%); border-radius: 1em; background: none; color: inherit; font: inherit; font-size: .9em; transition: .15s; }
      #helpAssistant .helpMapEmpty button:hover { border-color: var(--header); color: var(--header-active); }

      /* the script the model ran: folded away, because the answer is the point */
      #helpAssistant .helpMapStep         { align-self: flex-start; max-width: 100%; margin-bottom: .55em; font-size: .9em; opacity: .8; }
      #helpAssistant .helpMapStep summary { cursor: pointer; user-select: none; }
      #helpAssistant .helpMapStep pre     { max-height: 14em; overflow: auto; margin: .25em 0 0; padding: .35em .45em; border-radius: .3em; background: rgb(0 0 0 / 6%); font-size: .92em; }

      /* an edit is an event in the transcript, not a message: flat, and it carries its own undo */
      #helpAssistant .helpMapEdit        { display: flex; align-items: center; gap: .5em; margin-bottom: .55em; padding: .35em .6em; border-left: 3px solid var(--header); border-radius: .25em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #helpAssistant .helpMapEdit span   { flex: 1; min-width: 0; }
      #helpAssistant .helpMapEdit button { flex: none; padding: .1em .5em; border: 1px solid rgb(0 0 0 / 15%); border-radius: .3em; background: none; color: inherit; font: inherit; font-size: .92em; }
      #helpAssistant .helpMapEdit button:disabled { opacity: .45; cursor: default; }

      #helpAssistant .helpMapNoteProposal { margin-bottom: 12px; }
      #helpAssistant .helpMapNoteActions { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
      #helpAssistant .helpMapNoteStatus { display: inline-flex; align-items: center; min-height: 36px; padding: 6px 12px; box-sizing: border-box; border: 1px solid #606770; border-radius: 6px; background: #f3f4f6; color: #242a32; font-size: 16px; font-weight: 700; }
      #helpAssistant .helpMapNoteStatus[data-state="applied"] { background: #e1f4e7; color: #17532d; border-color: #38734c; }
      #helpAssistant .helpMapNoteStatus[data-state="undone"] { background: #e4edfb; color: #163f78; border-color: #41679c; }
      #helpAssistant .helpMapNoteActions button { min-height: 36px; padding: 6px 14px; border: 1px solid #606770; border-radius: 6px; background: #fff; color: #242a32; font-weight: 600; }
      #helpAssistant .helpMapNoteDetail { margin: 8px 0 0; font-size: 14px; }
      #helpAssistant .helpMapNoteError { color: #872020; background: #fff0f0; padding: 8px; border-radius: 6px; }
      #helpMapNotePreview.ui-dialog-content { padding: 20px; overflow: auto; background: #fff; color: #242a32; font-family: var(--sans-serif); font-size: 16px; line-height: 1.6; user-select: text; overflow-wrap: anywhere; }
      #helpMapNotePreview > h2 { margin-top: 0; font-size: 20px; }
      #helpMapNotePreview > p { padding-bottom: 12px; border-bottom: 1px solid #ccc; }
      .ui-dialog:has(> #helpMapNotePreview) { font-size: 16px; }
      .ui-dialog:has(> #helpMapNotePreview) button { min-width: 28px; min-height: 28px; font-size: 16px; }
      .ui-dialog:has(> #helpMapNotePreview) .ui-dialog-buttonpane button { min-height: 36px; padding: 6px 14px; }
      #helpAssistant .helpMapContext { flex: none; align-self: flex-start; max-width: 100%; padding: .1em .6em; border-radius: 1em; background: rgb(0 0 0 / 8%); font-size: 14px; }

      /* model and key: reachable in a click, never in the way of the conversation */
      #helpAssistant .helpMapDrawer       { flex: none; display: flex; flex-direction: column; gap: .35em; max-height: 45%; overflow-y: auto; padding: .5em; border-radius: .4em; background: rgb(0 0 0 / 5%); font-size: .9em; }
      #helpAssistant .helpMapDrawer label { display: flex; align-items: center; gap: .4em; }
      #helpAssistant .helpMapDrawer label > span       { flex: none; width: 4.6em; opacity: .8; }
      #helpAssistant .helpMapDrawer :is(select, input) { flex: 1; min-width: 0; }
      #helpAssistant .helpMapDrawer button             { flex: none; }
      #helpAssistant .helpMapHint   { color: #b03030; }
      #helpAssistant .helpMapStatus { flex: none; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: .2em .8em; padding-top: .4em; border-top: 1px solid rgb(0 0 0 / 10%); font-size: .9em; }
      #helpAssistant .helpMapStatus button       { padding: 0; border: 0; background: none; color: inherit; font: inherit; text-decoration: underline dotted; }
      #helpAssistant .helpMapStatus button:hover { color: var(--header-active); }
      #helpAssistant .helpMapStatusEnd { display: flex; align-items: center; gap: .5em; }
      #helpAssistant .helpMapGear   { text-decoration: none; font-size: 20px; min-width: 36px; min-height: 36px; }
      #helpAssistant .helpMapUsage  { font-size: 14px; }
      #helpAssistant .helpMapErrorBubble { background: rgb(176 48 48 / 12%); }

      /* last word: the display rules above are more specific than the hidden attribute, and a
         panel, drawer or row that is switched off must stay off */
      #helpAssistant [hidden] { display: none !important; }
    </style>`;
