import {getInputNumber} from "utils/nodeUtils";

export function assignSpeakerBehavior() {
  Array.from(document.getElementsByClassName("speaker")).forEach($speaker => {
    const $sibling = $speaker.previousElementSibling;
    $speaker.addEventListener("click", () => {
      if ($sibling instanceof HTMLInputElement) {
        speak($sibling.value);
      }
    });
  });
}

function speak(str: string) {
  const speaker = new SpeechSynthesisUtterance(str);
  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    const voiceId = getInputNumber("speakerVoice");
    speaker.voice = voices[voiceId];
  }
  speechSynthesis.speak(speaker);
}
