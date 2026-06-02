let incomingAudio: HTMLAudioElement | null = null;
let outgoingAudio: HTMLAudioElement | null = null;

export const playIncomingRingtone = () => {
  console.log('[AudioUtils] playIncomingRingtone called');
  stopRingtone();
  incomingAudio = new Audio('/sounds/nhacchuong.mp3');
  incomingAudio.loop = true;
  incomingAudio.play()
    .then(() => console.log('[AudioUtils] playIncomingRingtone success'))
    .catch(e => console.error("[AudioUtils] Error playing incoming ringtone:", e));
};

export const playOutgoingRingtone = () => {
  console.log('[AudioUtils] playOutgoingRingtone called');
  stopRingtone();
  outgoingAudio = new Audio('/sounds/nhaccho.mp3');
  outgoingAudio.loop = true;
  outgoingAudio.play()
    .then(() => console.log('[AudioUtils] playOutgoingRingtone success'))
    .catch(e => console.error("[AudioUtils] Error playing outgoing ringtone:", e));
};

export const stopRingtone = () => {
  console.log('[AudioUtils] stopRingtone called');
  if (incomingAudio) {
    incomingAudio.pause();
    incomingAudio.currentTime = 0;
    incomingAudio = null;
  }
  if (outgoingAudio) {
    outgoingAudio.pause();
    outgoingAudio.currentTime = 0;
    outgoingAudio = null;
  }
};
