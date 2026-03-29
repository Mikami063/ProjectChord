const QUALITY_PATTERNS = [
  { suffixes: ["maj7"], quality: "maj7", label: "Major 7" },
  { suffixes: ["m7", "min7", "-7"], quality: "m7", label: "Minor 7" },
  { suffixes: ["7"], quality: "7", label: "Dominant 7" },
  { suffixes: ["sus2"], quality: "sus2", label: "Suspended 2" },
  { suffixes: ["sus4", "sus"], quality: "sus4", label: "Suspended 4" },
  { suffixes: ["dim"], quality: "dim", label: "Diminished" },
  { suffixes: ["aug", "+"], quality: "aug", label: "Augmented" },
  { suffixes: ["m", "min", "-"], quality: "m", label: "Minor" },
  { suffixes: [""], quality: "maj", label: "Major" },
];

const QUALITY_INTERVALS = {
  maj: [0, 4, 7],
  m: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  maj7: [0, 4, 7, 11],
  7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
};

const SEMITONE_FROM_NOTE = {
  C: 0,
  "B#": 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  F: 5,
  "E#": 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11,
  Cb: 11,
};

const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const KEYBOARD_START = 36;
const KEYBOARD_END = 83;
const STORAGE_KEY = "chord-blocks-project-v1";

const defaultProject = {
  bpm: 96,
  volume: 3,
  selectedBlockId: "block-1",
  playTimerId: null,
  blocks: [
    createBlock({
      id: "block-1",
      chordSymbol: "Ebm",
      rootOctave: 3,
      inversionIndex: 0,
      isRest: false,
    }),
    createBlock({
      id: "block-2",
      chordSymbol: "Ab",
      rootOctave: 3,
      inversionIndex: 1,
      isRest: false,
    }),
    createBlock({
      id: "block-3",
      chordSymbol: "Bb7",
      rootOctave: 3,
      inversionIndex: 0,
      isRest: false,
    }),
    createBlock({
      id: "block-4",
      chordSymbol: "",
      rootOctave: 3,
      inversionIndex: 0,
      isRest: true,
    }),
  ],
};

const state = loadProject();

const elements = {
  timeline: document.querySelector("#timeline"),
  blockTemplate: document.querySelector("#block-template"),
  selectedBlockLabel: document.querySelector("#selected-block-label"),
  chordInput: document.querySelector("#chord-input"),
  octaveInput: document.querySelector("#octave-input"),
  inversionInput: document.querySelector("#inversion-input"),
  restInput: document.querySelector("#rest-input"),
  resolvedNotes: document.querySelector("#resolved-notes"),
  analysisDetail: document.querySelector("#analysis-detail"),
  keyboard: document.querySelector("#keyboard"),
  bpmInput: document.querySelector("#bpm-input"),
  volumeInput: document.querySelector("#volume-input"),
  volumeValue: document.querySelector("#volume-value"),
  saveStatus: document.querySelector("#save-status"),
};

document.querySelector("#add-block-button").addEventListener("click", handleAddBlock);
document.querySelector("#duplicate-block-button").addEventListener("click", handleDuplicateBlock);
document.querySelector("#clear-block-button").addEventListener("click", handleClearBlock);
document.querySelector("#save-button").addEventListener("click", handleSaveProject);
document.querySelector("#reset-button").addEventListener("click", handleResetProject);
document.querySelector("#export-button").addEventListener("click", handleExportProject);
document.querySelector("#import-button").addEventListener("click", handleImportProject);
document.querySelector("#preview-button").addEventListener("click", playEditorPreview);
document.querySelector("#apply-button").addEventListener("click", applyEditorToSelectedBlock);
document.querySelector("#play-sequence-button").addEventListener("click", playSequence);
document.querySelector("#stop-sequence-button").addEventListener("click", stopSequence);
elements.bpmInput.addEventListener("change", () => {
  state.bpm = clamp(Number(elements.bpmInput.value) || 96, 40, 220);
  elements.bpmInput.value = String(state.bpm);
  persistProject("Tempo saved locally.");
});
elements.volumeInput.addEventListener("input", () => {
  state.volume = clamp(Number(elements.volumeInput.value) / 100, 0.25, 9);
  updateVolumeUI();
  updateMasterGain();
  persistProject("Volume saved locally.");
});
elements.chordInput.addEventListener("input", refreshEditorPreview);
elements.octaveInput.addEventListener("change", refreshEditorPreview);
elements.inversionInput.addEventListener("change", refreshEditorPreview);
elements.restInput.addEventListener("change", refreshEditorPreview);

render();

function createBlock(overrides = {}) {
  const id = overrides.id ?? `block-${createId()}`;
  const chordSymbol = overrides.chordSymbol ?? "";
  const rootOctave = overrides.rootOctave ?? 3;
  const inversionIndex = overrides.inversionIndex ?? 0;
  const isRest = overrides.isRest ?? false;
  const resolved = isRest || !chordSymbol ? createRestResolution() : resolveChord(chordSymbol, rootOctave, inversionIndex);

  return {
    id,
    chordSymbol,
    rootOctave,
    inversionIndex,
    isRest,
    resolution: resolved,
  };
}

function createRestResolution() {
  return {
    ok: true,
    quality: null,
    qualityLabel: "Rest",
    inversionChoices: [],
    notes: [],
    midiNotes: [],
    detail: "This block is silent.",
  };
}

function parseChordSymbol(symbol) {
  const trimmed = symbol.trim();
  const match = trimmed.match(/^([A-Ga-g])([#b]?)(.*)$/);
  if (!match) {
    throw new Error("Use a root note from A to G, for example Ebm or Cmaj7.");
  }

  const root = `${match[1].toUpperCase()}${match[2] ?? ""}`;
  const suffix = (match[3] ?? "").trim();
  const qualityEntry = QUALITY_PATTERNS.find((entry) => entry.suffixes.some((candidate) => candidate === suffix));

  if (!qualityEntry) {
    throw new Error(`Unsupported chord quality "${suffix || "major"}".`);
  }

  if (SEMITONE_FROM_NOTE[root] == null) {
    throw new Error(`Unsupported root note "${root}".`);
  }

  return {
    root,
    quality: qualityEntry.quality,
    qualityLabel: qualityEntry.label,
    intervals: QUALITY_INTERVALS[qualityEntry.quality],
  };
}

function resolveChord(symbol, octave, inversionIndex) {
  try {
    const parsed = parseChordSymbol(symbol);
    const rootSemitone = SEMITONE_FROM_NOTE[parsed.root];
    const rootMidi = 12 * (octave + 1) + rootSemitone;
    const midiNotes = parsed.intervals.map((interval) => rootMidi + interval);
    const invertedNotes = applyInversion(midiNotes, inversionIndex);
    const noteNames = invertedNotes.map((midi) => midiToName(midi, parsed.root.includes("b")));
    const inversionChoices = parsed.intervals.map((_, index) => index);
    const inversionLabel = describeInversion(indexToDegreeLabel(parsed.intervals, inversionIndex), inversionIndex);

    return {
      ok: true,
      quality: parsed.quality,
      qualityLabel: parsed.qualityLabel,
      inversionChoices,
      notes: noteNames,
      midiNotes: invertedNotes,
      detail: `${parsed.qualityLabel} voiced as ${inversionLabel}.`,
    };
  } catch (error) {
    return {
      ok: false,
      quality: null,
      qualityLabel: "Invalid chord",
      inversionChoices: [],
      notes: [],
      midiNotes: [],
      detail: error.message,
    };
  }
}

function applyInversion(midiNotes, inversionIndex) {
  const notes = [...midiNotes];
  for (let i = 0; i < inversionIndex; i += 1) {
    notes.push(notes.shift() + 12);
  }
  return notes;
}

function indexToDegreeLabel(intervals, inversionIndex) {
  const triadDegrees = ["1", "3", "5"];
  const seventhDegrees = ["1", "3", "5", "7"];
  const degrees = intervals.length === 4 ? seventhDegrees : triadDegrees;
  return degrees[inversionIndex] ?? "1";
}

function describeInversion(degree, inversionIndex) {
  if (inversionIndex === 0) {
    return "root position";
  }
  const labels = {
    1: "first inversion",
    2: "second inversion",
    3: "third inversion",
  };
  return `${labels[inversionIndex] ?? "inversion"} (start on ${degree})`;
}

function midiToName(midi, preferFlats = false) {
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  const noteName = (preferFlats ? FLAT_NAMES : SHARP_NAMES)[noteIndex];
  return `${noteName}${octave}`;
}

function getSelectedBlock() {
  return state.blocks.find((block) => block.id === state.selectedBlockId) ?? state.blocks[0];
}

function createId() {
  if (globalThis.crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function cloneDefaultProject() {
  return {
    bpm: defaultProject.bpm,
    volume: defaultProject.volume,
    selectedBlockId: defaultProject.selectedBlockId,
    playTimerId: null,
    blocks: defaultProject.blocks.map((block) =>
      createBlock({
        id: block.id,
        chordSymbol: block.chordSymbol,
        rootOctave: block.rootOctave,
        inversionIndex: block.inversionIndex,
        isRest: block.isRest,
      }),
    ),
  };
}

function loadProject() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultProject();
    }

    const parsed = JSON.parse(raw);
    const blocks = Array.isArray(parsed.blocks) && parsed.blocks.length > 0
      ? parsed.blocks.map((block) =>
          createBlock({
            id: typeof block.id === "string" ? block.id : undefined,
            chordSymbol: typeof block.chordSymbol === "string" ? block.chordSymbol : "",
            rootOctave: clamp(Number(block.rootOctave) || 3, 2, 5),
            inversionIndex: Math.max(0, Number(block.inversionIndex) || 0),
            isRest: Boolean(block.isRest),
          }),
        )
      : cloneDefaultProject().blocks;

    return {
      bpm: clamp(Number(parsed.bpm) || 96, 40, 220),
      volume: clamp(Number(parsed.volume) || defaultProject.volume, 0.25, 9),
      selectedBlockId: typeof parsed.selectedBlockId === "string" ? parsed.selectedBlockId : blocks[0].id,
      playTimerId: null,
      blocks,
    };
  } catch (error) {
    return cloneDefaultProject();
  }
}

function serializeProject() {
  return {
    bpm: state.bpm,
    volume: state.volume,
    selectedBlockId: state.selectedBlockId,
    blocks: state.blocks.map((block) => ({
      id: block.id,
      chordSymbol: block.chordSymbol,
      rootOctave: block.rootOctave,
      inversionIndex: block.inversionIndex,
      isRest: block.isRest,
    })),
  };
}

function persistProject(message = "Saved locally.") {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeProject()));
    elements.saveStatus.textContent = message;
  } catch (error) {
    elements.saveStatus.textContent = "Local save failed in this browser.";
  }
}

function render() {
  elements.bpmInput.value = String(state.bpm);
  updateVolumeUI();
  renderTimeline();
  renderEditor();
  renderKeyboard();
}

function updateVolumeUI() {
  const percent = Math.round((state.volume ?? defaultProject.volume) * 100);
  elements.volumeInput.value = String(percent);
  elements.volumeValue.textContent = `${percent}%`;
}

function renderTimeline() {
  elements.timeline.innerHTML = "";

  state.blocks.forEach((block, index) => {
    const node = elements.blockTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".block-index").textContent = `Block ${index + 1}`;
    node.querySelector(".block-chord").textContent = block.isRest ? "Rest" : block.chordSymbol || "Chord";
    node.querySelector(".block-meta").textContent = block.isRest
      ? "Silent"
      : `${block.rootOctave} octave • ${describeInversion(indexToDegreeLabelFromBlock(block), block.inversionIndex)}`;
    node.querySelector(".block-notes").textContent = block.resolution.ok
      ? block.resolution.notes.join(" ")
      : block.resolution.detail;

    if (block.id === state.selectedBlockId) {
      node.classList.add("is-selected");
    }

    node.addEventListener("click", () => {
      state.selectedBlockId = block.id;
      render();
      playBlock(block);
    });
    elements.timeline.appendChild(node);
  });
}

function indexToDegreeLabelFromBlock(block) {
  return indexToDegreeLabel(block.resolution.midiNotes.length === 4 ? [0, 1, 2, 3] : [0, 1, 2], block.inversionIndex);
}

function renderEditor() {
  const block = getSelectedBlock();
  elements.selectedBlockLabel.textContent = `Block ${state.blocks.indexOf(block) + 1}`;
  elements.chordInput.value = block.chordSymbol;
  elements.octaveInput.value = String(block.rootOctave);
  elements.restInput.checked = block.isRest;
  populateInversionOptions(block.chordSymbol, Number(elements.octaveInput.value), block.inversionIndex);
  const resolution = previewEditorResolution();

  elements.resolvedNotes.textContent = resolution.notes.length ? resolution.notes.join(" ") : "No notes";
  elements.analysisDetail.textContent = resolution.detail;
}

function populateInversionOptions(chordSymbol, octave, preferredIndex = 0) {
  const preview = chordSymbol.trim() ? resolveChord(chordSymbol, octave, preferredIndex) : createRestResolution();
  const parsed = chordSymbol.trim() && preview.ok ? parseChordSymbol(chordSymbol) : null;
  const count = parsed ? parsed.intervals.length : 3;
  const degrees = count === 4 ? ["1", "3", "5", "7"] : ["1", "3", "5"];
  elements.inversionInput.innerHTML = "";

  degrees.forEach((degree, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = `${degree} on bottom`;
    elements.inversionInput.appendChild(option);
  });

  const safeIndex = Math.min(Math.max(0, preferredIndex), degrees.length - 1);
  elements.inversionInput.value = String(safeIndex);
}

function previewEditorResolution() {
  if (elements.restInput.checked) {
    return createRestResolution();
  }

  return resolveChord(
    elements.chordInput.value,
    Number(elements.octaveInput.value),
    Number(elements.inversionInput.value) || 0,
  );
}

function refreshEditorPreview() {
  populateInversionOptions(elements.chordInput.value, Number(elements.octaveInput.value), Number(elements.inversionInput.value) || 0);
  const preview = previewEditorResolution();
  elements.resolvedNotes.textContent = preview.notes.length ? preview.notes.join(" ") : "No notes";
  elements.analysisDetail.textContent = preview.detail;
  renderKeyboard(preview.midiNotes);
}

function renderKeyboard(overrideMidiNotes) {
  const activeNotes = overrideMidiNotes ?? getSelectedBlock().resolution.midiNotes;
  const frame = document.createElement("div");
  frame.className = "keyboard-frame";

  const whiteWidth = 58;
  let whiteIndex = 0;

  for (let midi = KEYBOARD_START; midi <= KEYBOARD_END; midi += 1) {
    const pitchClass = midi % 12;
    const isBlack = [1, 3, 6, 8, 10].includes(pitchClass);

    if (!isBlack) {
      const key = document.createElement("div");
      key.className = "white-key";
      if (activeNotes.includes(midi)) {
        key.classList.add("is-active");
      }
      key.style.left = `${whiteIndex * whiteWidth}px`;
      key.textContent = midiToName(midi, true);
      frame.appendChild(key);
      whiteIndex += 1;
    } else {
      const key = document.createElement("div");
      key.className = "black-key";
      if (activeNotes.includes(midi)) {
        key.classList.add("is-active");
      }
      key.style.left = `${whiteIndex * whiteWidth - 17}px`;
      key.textContent = midiToName(midi, true);
      frame.appendChild(key);
    }
  }

  elements.keyboard.innerHTML = "";
  elements.keyboard.appendChild(frame);
}

function applyEditorToSelectedBlock() {
  const block = getSelectedBlock();
  const isRest = elements.restInput.checked;
  const chordSymbol = elements.chordInput.value.trim();
  const rootOctave = Number(elements.octaveInput.value);
  const inversionIndex = Number(elements.inversionInput.value) || 0;
  const resolution = isRest || !chordSymbol ? createRestResolution() : resolveChord(chordSymbol, rootOctave, inversionIndex);

  Object.assign(block, {
    isRest,
    chordSymbol,
    rootOctave,
    inversionIndex,
    resolution,
  });

  render();
  persistProject("Block saved locally.");
}

function playEditorPreview() {
  const preview = previewEditorResolution();
  playBlock({
    isRest: elements.restInput.checked,
    resolution: preview,
  });
}

function handleAddBlock() {
  const newBlock = createBlock({
    chordSymbol: "",
    rootOctave: 3,
    inversionIndex: 0,
    isRest: true,
  });
  state.blocks.push(newBlock);
  state.selectedBlockId = newBlock.id;
  render();
  persistProject("New block added.");
}

function handleDuplicateBlock() {
  const block = getSelectedBlock();
  const duplicate = createBlock({
    chordSymbol: block.chordSymbol,
    rootOctave: block.rootOctave,
    inversionIndex: block.inversionIndex,
    isRest: block.isRest,
  });
  state.blocks.splice(state.blocks.indexOf(block) + 1, 0, duplicate);
  state.selectedBlockId = duplicate.id;
  render();
  persistProject("Block duplicated.");
}

function handleClearBlock() {
  const block = getSelectedBlock();
  Object.assign(block, createBlock({ id: block.id, chordSymbol: "", rootOctave: 3, inversionIndex: 0, isRest: true }));
  render();
  persistProject("Block cleared.");
}

function handleSaveProject() {
  persistProject("Project saved locally.");
}

function handleResetProject() {
  stopSequence();
  const replacement = cloneDefaultProject();
  state.bpm = replacement.bpm;
  state.volume = replacement.volume;
  state.selectedBlockId = replacement.selectedBlockId;
  state.blocks = replacement.blocks;
  render();
  updateMasterGain();
  persistProject("Project reset to defaults.");
}

function handleExportProject() {
  const blob = new Blob([JSON.stringify(serializeProject(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "chord-blocks-project.json";
  link.click();
  URL.revokeObjectURL(url);
  elements.saveStatus.textContent = "Project exported.";
}

function handleImportProject() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const loaded = {
        bpm: clamp(Number(parsed.bpm) || 96, 40, 220),
        volume: clamp(Number(parsed.volume) || defaultProject.volume, 0.25, 9),
        selectedBlockId: typeof parsed.selectedBlockId === "string" ? parsed.selectedBlockId : "block-1",
        playTimerId: null,
        blocks: Array.isArray(parsed.blocks)
          ? parsed.blocks.map((block) =>
              createBlock({
                id: typeof block.id === "string" ? block.id : undefined,
                chordSymbol: typeof block.chordSymbol === "string" ? block.chordSymbol : "",
                rootOctave: clamp(Number(block.rootOctave) || 3, 2, 5),
                inversionIndex: Math.max(0, Number(block.inversionIndex) || 0),
                isRest: Boolean(block.isRest),
              }),
            )
          : [],
      };

      if (loaded.blocks.length === 0) {
        throw new Error("No blocks found.");
      }

      stopSequence();
      state.bpm = loaded.bpm;
      state.volume = loaded.volume;
      state.selectedBlockId = loaded.selectedBlockId;
      state.blocks = loaded.blocks;
      if (!state.blocks.some((block) => block.id === state.selectedBlockId)) {
        state.selectedBlockId = state.blocks[0].id;
      }
      render();
      updateMasterGain();
      persistProject("Project imported and saved locally.");
    } catch (error) {
      elements.saveStatus.textContent = "Import failed. Use a valid project JSON file.";
    }
  });
  input.click();
}

let audioContext;
let masterGainNode;
let masterCompressorNode;

function ensureAudioGraph() {
  if (!audioContext) {
    audioContext = new AudioContext();
  }

  if (!masterCompressorNode) {
    masterCompressorNode = audioContext.createDynamicsCompressor();
    masterCompressorNode.threshold.value = -24;
    masterCompressorNode.knee.value = 24;
    masterCompressorNode.ratio.value = 3;
    masterCompressorNode.attack.value = 0.003;
    masterCompressorNode.release.value = 0.2;
    masterCompressorNode.connect(audioContext.destination);
  }

  if (!masterGainNode) {
    masterGainNode = audioContext.createGain();
    masterGainNode.connect(masterCompressorNode);
  }

  updateMasterGain();
}

function updateMasterGain() {
  if (!masterGainNode || !audioContext) {
    return;
  }

  const now = audioContext.currentTime;
  const safeVolume = clamp(state.volume ?? defaultProject.volume, 0.25, 9);
  masterGainNode.gain.cancelScheduledValues(now);
  masterGainNode.gain.setValueAtTime(masterGainNode.gain.value || safeVolume, now);
  masterGainNode.gain.linearRampToValueAtTime(safeVolume, now + 0.04);
}

async function playBlock(block) {
  if (!block || block.isRest || !block.resolution.ok || block.resolution.midiNotes.length === 0) {
    return;
  }

  ensureAudioGraph();

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  const now = audioContext.currentTime;
  const output = audioContext.createGain();
  const blockFilter = audioContext.createBiquadFilter();
  blockFilter.type = "lowpass";
  blockFilter.frequency.setValueAtTime(2200, now);
  blockFilter.Q.value = 0.8;
  blockFilter.frequency.exponentialRampToValueAtTime(1350, now + 0.42);

  output.gain.value = 0.42;
  output.connect(blockFilter);
  blockFilter.connect(masterGainNode);

  block.resolution.midiNotes.forEach((midi, noteIndex) => {
    playVoice(midi, now, output, noteIndex);
  });
}

function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

function playVoice(midi, startTime, destination, noteIndex) {
  const frequency = midiToFrequency(midi);
  const voiceGain = audioContext.createGain();
  const partialMix = audioContext.createGain();
  const shimmerMix = audioContext.createGain();
  const noteFilter = audioContext.createBiquadFilter();
  const noteDuration = 1.7;
  const baseLevel = noteIndex === 0 ? 0.34 : 0.24;

  voiceGain.gain.setValueAtTime(0.0001, startTime);
  voiceGain.gain.exponentialRampToValueAtTime(baseLevel, startTime + 0.02);
  voiceGain.gain.exponentialRampToValueAtTime(baseLevel * 0.58, startTime + 0.18);
  voiceGain.gain.exponentialRampToValueAtTime(0.0001, startTime + noteDuration);

  noteFilter.type = "lowpass";
  noteFilter.frequency.setValueAtTime(Math.min(4200, frequency * 7.5), startTime);
  noteFilter.frequency.exponentialRampToValueAtTime(Math.min(2200, frequency * 4.2), startTime + 0.22);
  noteFilter.Q.value = 1.1;

  partialMix.gain.value = 0.7;
  shimmerMix.gain.value = 0.22;

  partialMix.connect(noteFilter);
  shimmerMix.connect(noteFilter);
  noteFilter.connect(voiceGain);
  voiceGain.connect(destination);

  createOscillatorVoice("triangle", frequency, 0, startTime, noteDuration, partialMix);
  createOscillatorVoice("sawtooth", frequency, -5, startTime, noteDuration, partialMix);
  createOscillatorVoice("sine", frequency * 2, 3, startTime, noteDuration * 0.72, shimmerMix);
}

function createOscillatorVoice(type, frequency, detune, startTime, duration, destination) {
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  oscillator.detune.setValueAtTime(detune, startTime);

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(type === "sine" ? 0.12 : 0.2, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playSequence() {
  stopSequence();
  const stepDurationMs = (60 / state.bpm) * 1000;
  let currentIndex = 0;

  const playNext = () => {
    const block = state.blocks[currentIndex];
    if (!block) {
      stopSequence();
      return;
    }

    state.selectedBlockId = block.id;
    render();
    markPlayingBlock(block.id);
    playBlock(block);
    currentIndex += 1;

    if (currentIndex >= state.blocks.length) {
      state.playTimerId = window.setTimeout(() => stopSequence(), stepDurationMs);
      return;
    }

    state.playTimerId = window.setTimeout(playNext, stepDurationMs);
  };

  playNext();
}

function stopSequence() {
  if (state.playTimerId != null) {
    window.clearTimeout(state.playTimerId);
    state.playTimerId = null;
  }
  markPlayingBlock(null);
}

function markPlayingBlock(blockId) {
  [...elements.timeline.querySelectorAll(".block-card")].forEach((node, index) => {
    const isPlaying = blockId != null && state.blocks[index]?.id === blockId;
    node.classList.toggle("is-playing", isPlaying);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
