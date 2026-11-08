/*
Piano Composer Pro ByDélé
Copyright © 2026 Nicolas
Tous droits réservés
*/

// ======================
// CONFIGURATION
// ======================

const FIRST_NOTE = 36;      // C2
const KEY_COUNT  = 61;      // C2 → C7
const MIDDLE_C   = 60;      // C4

const WHITE_W = 95;         // doit correspondre à --white-w en CSS
const BLACK_W = 56;         // doit correspondre à --black-w en CSS

const NOTE_NAMES  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK_NAMES = ["C#","D#","F#","G#","A#"];

// Léger décalage réaliste par rapport au centre de la frontière entre deux blanches
const BLACK_SHIFT = { "C#":-6, "D#":6, "F#":-7, "G#":0, "A#":7 };

// Clavier d'ordinateur → notes (à partir de Do central)
const COMPUTER_KEYS = {
    a:60, w:61, s:62, e:63, d:64, f:65, t:66,
    g:67, y:68, h:69, u:70, j:71, k:72, o:73, l:74, p:75
};

const MAJOR_SCALE = [0,2,4,5,7,9,11];

const $ = id => document.getElementById(id);

const keyboard       = $("keyboard");
const tempoSlider    = $("tempo");
const tempoValue     = $("tempoValue");
const chordDisplay   = $("detectedChord");
const volumeSlider   = $("volume");
const volumeValue    = $("volumeValue");
const instrumentSel  = $("instrument");
const presetSel      = $("preset");
const scaleDisplay   = $("suggestedScale");
const noteCounterEl  = $("noteCounter");
const historyList    = $("historyList");
const progressionEl  = $("progression");

const keyElements  = {};          // midi → élément DOM
const pressedNotes = new Set();   // notes actuellement tenues

// ======================
// CONSTRUCTION DU CLAVIER
// ======================

function buildKeyboard(){
    if(!keyboard) return;

    keyboard.innerHTML = "";

    // Conteneur interne : référence de position pour les touches noires
    const keys = document.createElement("div");
    keys.className = "keys";
    keyboard.appendChild(keys);

    let whiteCount = 0;

    for(let i = 0; i < KEY_COUNT; i++){
        const midi    = FIRST_NOTE + i;
        const name    = NOTE_NAMES[midi % 12];
        const octave  = Math.floor(midi / 12) - 1;
        const isBlack = BLACK_NAMES.includes(name);

        const key = document.createElement("div");
        key.className = isBlack ? "black" : "white";
        key.textContent = name + octave;
        key.dataset.midi = midi;

        if(midi === MIDDLE_C) key.classList.add("c4");

        if(isBlack){
            // Centrée sur la frontière entre la blanche précédente et la suivante
            key.style.left = (whiteCount * WHITE_W - BLACK_W / 2 + BLACK_SHIFT[name]) + "px";
        }else{
            whiteCount++;
        }

        // Souris + tactile (Pointer Events)
        key.addEventListener("pointerdown", e => {
            e.preventDefault();
            if(key.setPointerCapture) key.setPointerCapture(e.pointerId);
            noteOn(midi, 100);
        });
        key.addEventListener("pointerup",     () => noteOff(midi));
        key.addEventListener("pointercancel", () => noteOff(midi));

        keys.appendChild(key);
        keyElements[midi] = key;
    }

    // Centrer le Do central au chargement
    const c4 = keyElements[MIDDLE_C];
    if(c4){
        keyboard.scrollLeft = c4.offsetLeft - keyboard.clientWidth / 2;
    }
}

buildKeyboard();

// ======================
// INSTRUMENTS & PRESETS
// ======================

// partials : [type d'onde, multiple de fréquence, gain, désaccord en cents]
const INSTRUMENTS = {
    piano:{
        partials:[["triangle",1,1,0],["sine",2,.30,0],["sine",3,.12,0]],
        attack:.005, decay:1.6, sustain:.25, release:.30
    },
    rhodes:{
        partials:[["sine",1,1,0],["sine",2,.25,0],["sine",4,.08,0]],
        attack:.005, decay:.9, sustain:.40, release:.40
    },
    organ:{
        partials:[["sine",1,1,0],["sine",2,.60,0],["sine",3,.40,0],["sine",4,.30,0]],
        attack:.02, decay:.01, sustain:1, release:.08
    },
    strings:{
        partials:[["sawtooth",1,.5,-6],["sawtooth",1,.5,6]],
        attack:.25, decay:.01, sustain:1, release:.60,
        cutoff:1800
    },
    guitar:{
        partials:[["sawtooth",1,.6,0],["triangle",2,.2,0]],
        attack:.003, decay:1.2, sustain:.05, release:.25,
        cutoff:4200, cutoffEnd:900
    },
    nylon:{
        partials:[["triangle",1,1,0],["sine",2,.35,0]],
        attack:.003, decay:1.0, sustain:.08, release:.25
    }
};

const PRESETS = {
    studio:   { reverb:.12, tone:12000, tempo:120, progression:["C","G","Am","F"] },
    concert:  { reverb:.45, tone:9000,  tempo:84,  progression:["C","Am","F","G"] },
    afrobeat: { reverb:.18, tone:14000, tempo:108, progression:["Am","F","C","G"] },
    gospel:   { reverb:.30, tone:8000,  tempo:76,  progression:["C","F","C","G"] }
};

// ======================
// MOTEUR AUDIO
// ======================

let audioContext = null;
let masterGain   = null;   // volume général
let voiceBus     = null;   // entrée de toutes les voix
let toneFilter   = null;   // brillance du preset
let reverbGain   = null;   // niveau de réverbération

let masterVolume = 0.5;
const activeVoices = new Map(); // midi → voix

function makeImpulse(seconds = 2.2, decay = 2.5){
    const rate = audioContext.sampleRate;
    const len  = Math.floor(rate * seconds);
    const buf  = audioContext.createBuffer(2, len, rate);

    for(let ch = 0; ch < 2; ch++){
        const data = buf.getChannelData(ch);
        for(let i = 0; i < len; i++){
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
        }
    }
    return buf;
}

function initAudio(){
    if(!audioContext){
        audioContext = new (window.AudioContext || window.webkitAudioContext)();

        masterGain = audioContext.createGain();
        masterGain.gain.value = masterVolume;

        const compressor = audioContext.createDynamicsCompressor();

        voiceBus   = audioContext.createGain();
        toneFilter = audioContext.createBiquadFilter();
        toneFilter.type = "lowpass";

        const convolver = audioContext.createConvolver();
        convolver.buffer = makeImpulse();
        reverbGain = audioContext.createGain();

        // voix → tone → master (son sec)
        voiceBus.connect(toneFilter);
        toneFilter.connect(masterGain);
        // voix → réverbération → master
        toneFilter.connect(convolver);
        convolver.connect(reverbGain);
        reverbGain.connect(masterGain);

        masterGain.connect(compressor);
        compressor.connect(audioContext.destination);

        applyPreset(false);
    }

    if(audioContext.state === "suspended"){
        audioContext.resume();
    }
}

function midiToFrequency(note){
    return 440 * Math.pow(2, (note - 69) / 12);
}

function startVoice(note, velocity){
    initAudio();

    const inst = INSTRUMENTS[instrumentSel ? instrumentSel.value : "piano"] || INSTRUMENTS.piano;
    const now  = audioContext.currentTime;
    const peak = Math.max(0.0001, 0.3 * (velocity / 127));
    const freq = midiToFrequency(note);

    // Enveloppe
    const env = audioContext.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + inst.attack);
    env.gain.exponentialRampToValueAtTime(
        Math.max(0.0001, peak * inst.sustain),
        now + inst.attack + inst.decay
    );
    env.connect(voiceBus);

    // Filtre propre à la voix (cordes, guitares)
    let entry = env;
    if(inst.cutoff){
        const lp = audioContext.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.setValueAtTime(inst.cutoff, now);
        if(inst.cutoffEnd){
            lp.frequency.exponentialRampToValueAtTime(inst.cutoffEnd, now + inst.decay);
        }
        lp.connect(env);
        entry = lp;
    }

    // Oscillateurs
    const oscs = inst.partials.map(([type, mult, gainValue, cents]) => {
        const osc = audioContext.createOscillator();
        const pg  = audioContext.createGain();

        osc.type = type;
        osc.frequency.value = freq * mult;
        osc.detune.value = cents;
        pg.gain.value = gainValue;

        osc.connect(pg);
        pg.connect(entry);
        osc.start(now);
        return osc;
    });

    activeVoices.set(note, { oscs, env, release: inst.release });
}

function stopVoice(note){
    const voice = activeVoices.get(note);
    if(!voice) return;

    const now = audioContext.currentTime;
    const current = Math.max(0.0001, voice.env.gain.value);

    voice.env.gain.cancelScheduledValues(now);
    voice.env.gain.setValueAtTime(current, now);
    voice.env.gain.exponentialRampToValueAtTime(0.0001, now + voice.release);
    voice.oscs.forEach(o => o.stop(now + voice.release + 0.05));

    activeVoices.delete(note);
}

function applyPreset(updateUI = true){
    const preset = PRESETS[presetSel ? presetSel.value : "studio"] || PRESETS.studio;

    if(audioContext){
        const t = audioContext.currentTime;
        reverbGain.gain.setTargetAtTime(preset.reverb, t, 0.05);
        toneFilter.frequency.setTargetAtTime(preset.tone, t, 0.05);
    }

    if(updateUI){
        if(tempoSlider) tempoSlider.value = preset.tempo;
        if(tempoValue)  tempoValue.innerText = preset.tempo + " BPM";
        setProgression(preset.progression);
    }
}

if(presetSel) presetSel.addEventListener("change", () => applyPreset(true));

if(volumeSlider){
    volumeSlider.addEventListener("input", () => {
        masterVolume = volumeSlider.value / 100;
        if(volumeValue) volumeValue.innerText = volumeSlider.value + "%";
        if(masterGain) masterGain.gain.setTargetAtTime(masterVolume, audioContext.currentTime, 0.02);
    });
}

if(tempoSlider && tempoValue){
    tempoSlider.addEventListener("input", e => {
        tempoValue.innerText = e.target.value + " BPM";
    });
}

// ======================
// DÉTECTION D'ACCORDS
// ======================

const CHORD_PATTERNS = [
    { name:"Majeur", short:"",     intervals:[0,4,7] },
    { name:"Mineur", short:"m",    intervals:[0,3,7] },
    { name:"Dim",    short:"dim",  intervals:[0,3,6] },
    { name:"Aug",    short:"aug",  intervals:[0,4,8] },
    { name:"sus2",   short:"sus2", intervals:[0,2,7] },
    { name:"sus4",   short:"sus4", intervals:[0,5,7] },
    { name:"7",      short:"7",    intervals:[0,4,7,10] },
    { name:"maj7",   short:"maj7", intervals:[0,4,7,11] },
    { name:"m7",     short:"m7",   intervals:[0,3,7,10] }
];

// Retourne { label, short } ou null
function getChord(noteList){
    if(noteList.length < 3) return null;

    const sorted = [...noteList].sort((a,b) => a - b);
    const pitchClasses = [...new Set(sorted.map(n => n % 12))];

    if(pitchClasses.length < 3) return null;

    const bass = sorted[0] % 12;

    // On teste en priorité la basse comme fondamentale, puis les renversements
    const candidates = [bass, ...pitchClasses.filter(pc => pc !== bass)];

    for(const root of candidates){
        const shifted = pitchClasses
            .map(n => (n - root + 12) % 12)
            .sort((a,b) => a - b);

        for(const pattern of CHORD_PATTERNS){
            const same =
                shifted.length === pattern.intervals.length &&
                pattern.intervals.every((v,i) => v === shifted[i]);

            if(same){
                const inversion = bass !== root ? " / " + NOTE_NAMES[bass] : "";
                return {
                    label: NOTE_NAMES[root] + " " + pattern.name + inversion,
                    short: NOTE_NAMES[root] + pattern.short
                };
            }
        }
    }

    return { label:"Accord inconnu", short:null };
}

let lastChordLabel = null;

function updateChord(){
    const result = getChord(Array.from(pressedNotes));

    if(chordDisplay){
        chordDisplay.innerText = "🎼 Accord : " + (result ? result.label : "-");
    }

    const label = result ? result.label : null;

    if(label && label !== lastChordLabel){
        addHistory("Accord " + label);
        if(result.short) checkProgression(result.short);
    }

    lastChordLabel = label;
}

// ======================
// PROGRESSION D'ACCORDS
// ======================

let progression = PRESETS.studio.progression;
let progIndex = 0;

function renderProgression(){
    if(!progressionEl) return;

    progressionEl.innerHTML = "";

    progression.forEach((name, i) => {
        const span = document.createElement("span");
        span.className = "chord";
        if(i < progIndex)   span.classList.add("done");
        if(i === progIndex) span.classList.add("active");
        span.textContent = name;
        progressionEl.appendChild(span);
    });
}

function setProgression(list){
    progression = list;
    progIndex = 0;
    renderProgression();
}

function checkProgression(shortName){
    if(shortName === progression[progIndex]){
        progIndex++;
        if(progIndex >= progression.length) progIndex = 0;
        renderProgression();
    }
}

renderProgression();

// ======================
// GAMME SUGGÉRÉE
// ======================

const recentPitchClasses = [];

function updateScale(note){
    const pc = note % 12;

    const idx = recentPitchClasses.indexOf(pc);
    if(idx !== -1) recentPitchClasses.splice(idx, 1);
    recentPitchClasses.push(pc);
    if(recentPitchClasses.length > 7) recentPitchClasses.shift();

    if(!scaleDisplay) return;

    const matches = [];
    for(let root = 0; root < 12; root++){
        const scale = MAJOR_SCALE.map(i => (root + i) % 12);
        if(recentPitchClasses.every(p => scale.includes(p))){
            const relative = NOTE_NAMES[(root + 9) % 12];
            matches.push(NOTE_NAMES[root] + " majeur / " + relative + " mineur");
        }
    }

    scaleDisplay.innerText = "🎵 Gamme : " + (matches.length ? matches.slice(0, 2).join(" ou ") : "-");
}

// ======================
// COMPTEUR & HISTORIQUE
// ======================

let noteCount = 0;

function addHistory(text){
    if(!historyList) return;

    const li = document.createElement("li");
    const time = document.createElement("span");
    time.textContent = new Date().toLocaleTimeString("fr-FR");
    li.appendChild(time);
    li.appendChild(document.createTextNode(text));

    historyList.prepend(li);

    while(historyList.children.length > 50){
        historyList.removeChild(historyList.lastChild);
    }
}

// ======================
// NOTE ON / OFF (souris, tactile, MIDI, clavier PC)
// ======================

function noteOn(note, velocity = 100){
    if(pressedNotes.has(note)) return;

    pressedNotes.add(note);
    startVoice(note, velocity);

    const key = keyElements[note];
    if(key) key.classList.add("active");

    const fullName = NOTE_NAMES[note % 12] + (Math.floor(note / 12) - 1);

    const currentNote = $("currentNote");
    if(currentNote) currentNote.innerText = "🎹 Note : " + fullName;

    noteCount++;
    if(noteCounterEl) noteCounterEl.innerText = "Notes jouées : " + noteCount;

    addHistory("Note " + fullName);
    updateScale(note);
    updateChord();
}

function noteOff(note){
    if(!pressedNotes.has(note)) return;

    pressedNotes.delete(note);
    stopVoice(note);

    const key = keyElements[note];
    if(key) key.classList.remove("active");

    updateChord();
}

function releaseAll(){
    Array.from(pressedNotes).forEach(noteOff);
}

// ======================
// CLAVIER D'ORDINATEUR
// ======================

document.addEventListener("keydown", e => {
    if(e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;

    const note = COMPUTER_KEYS[e.key.toLowerCase()];
    if(note !== undefined) noteOn(note, 100);
});

document.addEventListener("keyup", e => {
    const note = COMPUTER_KEYS[e.key.toLowerCase()];
    if(note !== undefined) noteOff(note);
});

window.addEventListener("blur", releaseAll);

// ======================
// MIDI
// ======================

let midiAccess = null;

function bindMidiInputs(){
    if(!midiAccess) return;

    const status = $("midiStatus");
    const names = [];

    for(const input of midiAccess.inputs.values()){
        input.onmidimessage = handleMidi;
        names.push(input.name);
    }

    if(status){
        status.innerText = names.length
            ? "Connecté : " + names.join(", ")
            : "Aucun périphérique MIDI détecté";
    }
}

async function connectMidi(){
    if(!navigator.requestMIDIAccess){
        alert("Web MIDI non supporté par ce navigateur (essaie Chrome ou Edge).");
        return;
    }

    try{
        midiAccess = await navigator.requestMIDIAccess();
        midiAccess.onstatechange = bindMidiInputs; // branchement / débranchement à chaud
        bindMidiInputs();
    }catch(err){
        console.error("Erreur MIDI :", err);
        const status = $("midiStatus");
        if(status) status.innerText = "Accès MIDI refusé";
    }
}

function handleMidi(event){
    const [statusByte, note, velocity] = event.data;
    const command = statusByte & 0xF0; // ignore le numéro de canal

    if(command === 0x90 && velocity > 0){
        noteOn(note, velocity);
    }else if(command === 0x80 || (command === 0x90 && velocity === 0)){
        noteOff(note);
    }
}

const connectBtn = $("connectMidi");
if(connectBtn) connectBtn.addEventListener("click", connectMidi);

// ======================
// PLEIN ÉCRAN
// ======================

function toggleFullscreen(){
    if(!document.fullscreenElement){
        document.documentElement.requestFullscreen();
    }else{
        document.exitFullscreen();
    }
}

const fullscreenBtn = $("fullscreenBtn");
if(fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);
