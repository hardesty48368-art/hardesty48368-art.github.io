const audio = document.querySelector("#background-music");
const visualizerBars = document.querySelectorAll(".frequency-bar");
const shockwaveButtons = document.querySelectorAll("#nav-ul li, #interests li");
const root = document.documentElement;
const visualizerLevels = Array.from(visualizerBars, () => 4);
let titleLetters = [];
let previousLowBassLevel = 0;
let bassSurgeActive = false;
let lastShockwaveTime = 0;

function triggerTitleShockwave() {
  titleLetters.forEach((letter) => {
    const shockwave = document.createElement("span");
    shockwave.className = "shockwave-letter";
    shockwave.textContent = letter.dataset.character;
    shockwave.addEventListener("animationend", () => {
      shockwave.remove();
    });
    letter.append(shockwave);
  });

  shockwaveButtons.forEach((button) => {
    const shockwave = document.createElement("span");
    shockwave.className = "shockwave-button";
    if (button.matches("#nav-ul li")) {
      shockwave.classList.add("shockwave-button--nav");
    }
    if (button.matches("#interests li")) {
      shockwave.classList.add("shockwave-button--interest");
    }
    shockwave.addEventListener("animationend", () => {
      shockwave.remove();
    });
    button.append(shockwave);
  });
}

let audioContext;
let analyser;
let frequencyData;
let animationFrame;
let musicStartPromise;

function updateVisualizer() {
  const barCount = visualizerBars.length;

  visualizerBars.forEach((bar, index) => {
    const spectrumEnd = frequencyData.length * 0.65;
    const start = Math.floor((index / barCount) * spectrumEnd);
    const end = Math.max(
      start + 1,
      Math.floor(((index + 1) / barCount) * spectrumEnd),
    );
    let frequencyPeak = 0;
    let frequencyTotal = 0;

    for (
      let frequencyIndex = start;
      frequencyIndex < end;
      frequencyIndex += 1
    ) {
      const frequencyValue = frequencyData[frequencyIndex];
      frequencyPeak = Math.max(frequencyPeak, frequencyValue);
      frequencyTotal += frequencyValue;
    }

    const frequencyAverage = frequencyTotal / (end - start);
    const frequencyLevel = (frequencyPeak * 0.6 + frequencyAverage * 0.4) / 255;
    const noiseFloor = 0.1;
    const gatedLevel =
      frequencyLevel <= noiseFloor
        ? 0
        : (frequencyLevel - noiseFloor) / (1 - noiseFloor);
    const highFrequencyBoost = 1 + (index / (barCount - 1)) * 2;
    const boostedLevel = Math.min(1, gatedLevel * highFrequencyBoost);
    const targetHeight = 4 + Math.pow(boostedLevel, 0.5) * 176;
    const responseRate = targetHeight > visualizerLevels[index] ? 0.25 : 0.5;
    visualizerLevels[index] +=
      (targetHeight - visualizerLevels[index]) * responseRate;
    bar.style.height = `${visualizerLevels[index].toFixed(1)}px`;
  });
}

function wrapTextInLetters() {
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest("script, style, audio")) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let currentNode = walker.nextNode();
  while (currentNode) {
    textNodes.push(currentNode);
    currentNode = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const fragment = document.createDocumentFragment();

    for (const character of textNode.nodeValue) {
      const letter = document.createElement("span");
      letter.className = "audio-letter";
      letter.textContent = character;
      letter.dataset.character = character;
      fragment.append(letter);
    }

    textNode.replaceWith(fragment);
  });
}

function updateScale() {
  if (!analyser) return;

  analyser.getByteFrequencyData(frequencyData);

  const bassEnd = Math.max(1, Math.floor(frequencyData.length * 0.25));
  let bassTotal = 0;

  for (let index = 0; index < bassEnd; index += 1) {
    bassTotal += frequencyData[index];
  }

  const bassLevel = bassTotal / (bassEnd * 255);
  const bassPulse = Math.pow(bassLevel, 0.65);
  const buttonScale = 1 + Math.min(bassPulse * 0.14, 0.14);
  const letterScale = 1 + Math.min(bassPulse * 0.22, 0.22);
  root.style.setProperty("--audio-scale", buttonScale.toFixed(3));
  root.style.setProperty("--audio-letter-scale", letterScale.toFixed(3));

  let lowBassTotal = 0;
  let lowBassPeak = 0;
  const lowBassEnd = Math.min(10, frequencyData.length);
  for (let index = 1; index < lowBassEnd; index += 1) {
    const lowBassValue = frequencyData[index];
    lowBassTotal += lowBassValue;
    lowBassPeak = Math.max(lowBassPeak, lowBassValue);
  }

  const lowBassAverage = lowBassTotal / (lowBassEnd - 1);
  const lowBassLevel = (lowBassPeak * 0.7 + lowBassAverage * 0.3) / 255;
  const lowBassSurge = lowBassLevel - previousLowBassLevel;
  const isBassSurging = lowBassSurge > 0.03;
  const currentTime = performance.now();
  if (
    isBassSurging &&
    !bassSurgeActive &&
    currentTime - lastShockwaveTime > 280
  ) {
    triggerTitleShockwave();
    lastShockwaveTime = currentTime;
  }
  bassSurgeActive = isBassSurging;
  previousLowBassLevel = lowBassLevel;

  updateVisualizer();
  animationFrame = requestAnimationFrame(updateScale);
}

function setupAnalyser() {
  if (audioContext) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.55;
  frequencyData = new Uint8Array(analyser.frequencyBinCount);

  const source = audioContext.createMediaElementSource(audio);
  source.connect(analyser);
  analyser.connect(audioContext.destination);
}

async function startMusic() {
  setupAnalyser();
  await audioContext.resume();
  await audio.play();
  cancelAnimationFrame(animationFrame);
  updateScale();
}

function ensureMusicPlaying() {
  if (!audio.paused && audioContext?.state === "running") return;
  if (musicStartPromise) return;

  musicStartPromise = startMusic()
    .catch((error) => {
      console.info("Background music could not start:", error);
    })
    .finally(() => {
      musicStartPromise = null;
    });
}

wrapTextInLetters();
titleLetters = document.querySelectorAll("h2 .audio-letter");
audio.addEventListener("error", () => {
  console.error("Background music could not load.");
});
document.addEventListener("mousemove", ensureMusicPlaying);
ensureMusicPlaying();
