// Short, locally generated cues: no audio downloads or network requests.
const cues = {
  correct: [{frequency:660,start:0,duration:.12},{frequency:880,start:.09,duration:.17}],
  unmatched: [{frequency:260,endFrequency:205,start:0,duration:.18}],
  empty: [{frequency:440,start:0,duration:.09}]
};

export function createFeedback() {
  let enabled = true, context = null, generation = 0;
  const voices = new Set();

  function stop() {
    generation++;
    if (!context) return;
    const time = context.currentTime;
    for (const voice of voices) {
      // A short fade also makes rapid consecutive submissions comfortable.
      voice.gain.gain.cancelScheduledValues(time);
      voice.gain.gain.setTargetAtTime(0,time,.006);
      voice.oscillator.stop(time+.025);
    }
    voices.clear();
  }

  async function play(kind) {
    if (!enabled || !cues[kind]) return false;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      if (!context || context.state === 'closed') context = new AudioContext();
      stop();
      const currentGeneration = generation;
      // Called directly by a click / key submission so mobile browsers can unlock audio.
      if (context.state === 'suspended') await context.resume();
      if (!enabled || currentGeneration !== generation || context.state !== 'running' || document.hidden) return false;
      const time = context.currentTime+.008;
      for (const note of cues[kind]) {
        const oscillator = context.createOscillator(), gain = context.createGain();
        const start = time+note.start, end = start+note.duration;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(note.frequency,start);
        if (note.endFrequency) oscillator.frequency.exponentialRampToValueAtTime(note.endFrequency,end);
        gain.gain.setValueAtTime(0,start);
        gain.gain.linearRampToValueAtTime(.045,start+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,end);
        oscillator.connect(gain); gain.connect(context.destination);
        const voice = {oscillator,gain}; voices.add(voice);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); voices.delete(voice); };
        oscillator.start(start); oscillator.stop(end+.01);
      }
      return true;
    } catch {
      // Sound availability must never block the learning flow.
      return false;
    }
  }

  return {
    play,
    stop,
    setEnabled(value) { enabled = Boolean(value); if (!enabled) stop(); }
  };
}
