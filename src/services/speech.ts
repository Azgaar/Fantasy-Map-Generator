/** Read a text out loud in the voice picked in the options */
export const speak = (text: string): void => {
  const speaker = new SpeechSynthesisUtterance(text);

  const voices = speechSynthesis.getVoices();
  if (voices.length) {
    speaker.voice = voices[Number(options.app.ui.speakerVoice)] ?? speaker.voice;
  }

  speechSynthesis.speak(speaker);
};
