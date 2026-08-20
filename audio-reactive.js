const audio = document.querySelector("#background-music");
const pageIntro = document.querySelector("#page-intro");
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
let resumeMusicOnReturn = false;
let volumeFadeFrame;
let smoothedBackgroundScale = 1.08;
let smoothedGifScale = 1.75;

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
        if (node.parentElement.closest("script, style, audio, #page-intro")) {
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
  const highRangeStart = Math.floor(frequencyData.length * 0.65);
  let highRangeTotal = 0;
  let highRangePeak = 0;
  for (
    let frequencyIndex = highRangeStart;
    frequencyIndex < frequencyData.length;
    frequencyIndex += 1
  ) {
    const highRangeValue = frequencyData[frequencyIndex];
    highRangeTotal += highRangeValue;
    highRangePeak = Math.max(highRangePeak, highRangeValue);
  }
  const highRangeLevel =
    highRangeTotal / ((frequencyData.length - highRangeStart) * 255);
  const highRangePeakLevel = highRangePeak / 255;
  const highRangeResponse = highRangeLevel * 0.4 + highRangePeakLevel * 0.6;
  const targetBackgroundScale = 1.08 + Math.min(highRangeResponse * 0.52, 0.52);
  smoothedBackgroundScale +=
    (targetBackgroundScale - smoothedBackgroundScale) * 0.12;
  const targetGifScale = 1.75 + Math.min(highRangeResponse * 0.9, 0.9);
  smoothedGifScale += (targetGifScale - smoothedGifScale) * 0.12;
  root.style.setProperty("--audio-scale", buttonScale.toFixed(3));
  root.style.setProperty("--audio-letter-scale", letterScale.toFixed(3));
  const backgroundSize = `${(smoothedBackgroundScale * 100).toFixed(1)}% ${(smoothedBackgroundScale * 100).toFixed(1)}%`;
  const gifBackgroundSize = `${(smoothedGifScale * 100).toFixed(1)}% ${(smoothedGifScale * 100).toFixed(1)}%`;
  root.style.setProperty("--background-size", backgroundSize);
  root.style.setProperty("--gif-background-size", gifBackgroundSize);

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

function fadeAudioTo(targetVolume) {
  cancelAnimationFrame(volumeFadeFrame);

  const startVolume = audio.volume;
  const fadeStart = performance.now();
  const fadeDuration = 300;

  function updateVolume(currentTime) {
    const progress = Math.min((currentTime - fadeStart) / fadeDuration, 1);
    audio.volume = startVolume + (targetVolume - startVolume) * progress;

    if (progress < 1) {
      volumeFadeFrame = requestAnimationFrame(updateVolume);
    }
  }

  volumeFadeFrame = requestAnimationFrame(updateVolume);
}

function dismissPageIntro() {
  if (!pageIntro || pageIntro.classList.contains("is-fading")) return;

  pageIntro.classList.add("is-fading");
  pageIntro.addEventListener("transitionend", () => pageIntro.remove(), {
    once: true,
  });
}

function setupPageIntro() {
  if (!pageIntro) return;

  pageIntro.addEventListener("click", () => {
    startMusic().catch((error) => {
      console.info("Background music could not start:", error);
    });
  });

  if (!audio.paused) dismissPageIntro();
}

wrapTextInLetters();
setupPageIntro();
titleLetters = document.querySelectorAll("h2 .audio-letter");
audio.addEventListener("error", () => {
  console.error("Background music could not load.");
});
audio.addEventListener("playing", dismissPageIntro);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    resumeMusicOnReturn = !audio.paused;
    if (resumeMusicOnReturn) {
      fadeAudioTo(0);
      window.setTimeout(() => {
        if (document.hidden) {
          audio.pause();
          cancelAnimationFrame(animationFrame);
        }
      }, 300);
    }
    return;
  }

  if (resumeMusicOnReturn) {
    resumeMusicOnReturn = false;
    if (audio.paused) {
      startMusic()
        .then(() => fadeAudioTo(1))
        .catch((error) =>
          console.info("Background music could not resume:", error),
        );
    } else {
      fadeAudioTo(1);
    }
  }
});
document.addEventListener("mousemove", ensureMusicPlaying);
document.addEventListener(
  "click",
  () => {
    startMusic().catch((error) => {
      console.info("Background music could not start:", error);
    });
  },
  { once: true },
);
ensureMusicPlaying();
