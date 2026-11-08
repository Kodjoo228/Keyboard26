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

const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK_NAMES = ["C#","D#","F#","G#","A#"];

// Léger décalage réaliste par rapport au centre de la frontière entre deux blanches
const BLACK_SHIFT = { "C#":-6, "D#":6, "F#":-7, "G#":0, "A#":7 };

// Clavier d'ordinateur → notes (à partir de Do central)
const COMPUTER_KEYS = {
    a:60, w:61, s:62, e:63, d:64, f:65, t:66,
    g:67, y:68, h:69, u:70, j:71, k:72, o:73, l:74, p:75
};

const $ = id => document.getElementById(id);

const keyboard     = $("keyboard");
const tempoSlider  = $("tempo");
const tempoValue   = $("tempoValue");
const chordDisplay = $("detectedChord");
const volumeSlider = $("volume");
const volumeValue  = $("volumeValue");

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
        const midi   = FIRST_NOTE + i;
        const name   = NOTE_NAMES[midi % 12];
        const octave = Math.floor(midi / 12) - 1;
        const isBlack = BLACK_NAMES.includes(name);

        const key = document.createElement("div");
        key.className = isBlack ? "black" : "white";
        key.textContent = name + octave;
        key.dataset.midi = midi;

        if(midi === MIDDLE_C) key.classList.add("c4");

        if(isBlack){
            // Centrée sur la frontière entre la blanche précédente et la suivante
            const left = whiteCount * WHITE_W - BLACK_W / 2 + BLACK_SHIFT[name];
            key.style.left = left + "px";
        }else{
            whiteCount++;
        }

        // Souris + tactile (Pointer Events)
        key.addEventListener("pointerdown", e => {
            e.preventDefault();
            key.setPointerCapture?.(e.pointerId);
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
// TEMPO
// ======================

if(tempoSlider && tempoValue){
    tempoSlider.addEventListener("input", e => {
        tempoValue.innerText = e.target.value + " BPM";
    });
}

// ======================
// DÉTECTION D'ACCORDS
// ======================

const CHORD_PATTERNS = [
    { name:"Majeur", intervals:[0,4,7] },
    { name:"Mineur", intervals:[0,3,7] },
    { name:"Dim",    intervals:[0,3,6] },
    { name:"Aug",    intervals:[0,4,8] },
    { name:"sus2",   intervals:[0,2,7] },
    { name:"sus4",   intervals:[0,5,7] },
    { name:"7",      intervals:[0,4,7,10] },
    { name:"maj7",   intervals:[0,4,7,11] },
    { name:"m7",     intervals:[0,3,7,10] }
];

function getChord(noteList){
    if(noteList.length < 3) return "-";

    // Notes triées de la plus grave à la plus aiguë
    const sorted = [...noteList].sort((a,b) => a - b);
    const pitchClasses = [...new Set(sorted.map(n => n % 12))];

    if(pitchClasses.length < 3) return "-";

    // On teste d'abord la basse comme fondamentale, puis les autres (renversements)
    const candidates = [...new Set(sorted.map(n => n % 12))];

    for(const root of candidates){
        const shifted = pitchClasses
            .map(n => (n - root + 12) % 12)
            .sort((a,b) => a - b);

        for(const pattern of CHORD_PATTERNS){
            const same =
                shifted.length === pattern.intervals.length &&
                pattern.intervals.every((v,i) => v === shifted[i]);

            if(same){
                const bass = sorted[0] % 12;
                const inversion = bass !== root ? " / " + NOTE_NAMES[bass] : "";
                return NOTE_NAMES[root] + " " + pattern.name + inversion;
            }
        }
    }

    return "Accord inconnu";
}

function updateChord(){
    if(!chordDisplay) return;
    chordDisplay.innerText = "Accord : " + getChord(Array.from(pressedNotes));
}

// ======================
// MOTEUR AUDIO
// ======================

let audioContext = null;
let masterVolume = 0.5;

const activeVoices = new Map(); // midi → { osc, gain }

if(volumeSlider){
    volumeSlider.addEventListener("input", () => {
        masterVolume = volumeSlider.value / 100;
        if(volumeValue) volumeValue.innerText = volumeSlider.value + "%";
    });
}

function initAudio(){
    if(!audioContext){
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
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

    const now  = audioContext.currentTime;
    const peak = Math.max(0.0001, masterVolume * (velocity / 127) * 0.6);

    const osc  = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.type = "triangle";
    osc.frequency.value = midiToFrequency(note);

    // Enveloppe : attaque courte puis maintien légèrement plus bas
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(peak * 0.6, now + 0.4);

    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start(now);

    activeVoices.set(note, { osc, gain });
}

function stopVoice(note){
    const voice = activeVoices.get(note);
    if(!voice) return;

    const now = audioContext.currentTime;
    const current = Math.max(0.0001, voice.gain.gain.value);

    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(current, now);
    voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    voice.osc.stop(now + 0.35);

    activeVoices.delete(note);
}

// ======================
// NOTE ON / OFF (commun souris, MIDI, clavier PC)
// ======================

function noteOn(note, velocity = 100){
    if(pressedNotes.has(note)) return;

    pressedNotes.add(note);
    startVoice(note, velocity);

    const key = keyElements[note];
    if(key) key.classList.add("active");

    const currentNote = $("currentNote");
    if(currentNote){
        const octave = Math.floor(note / 12) - 1;
        currentNote.innerText = "Note : " + NOTE_NAMES[note % 12] + octave;
    }

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

const heldComputerKeys = new Set();

document.addEventListener("keydown", e => {
    if(e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if(["INPUT","TEXTAREA","SELECT"].includes(e.target.tagName)) return;

    const note = COMPUTER_KEYS[e.key.toLowerCase()];
    if(note === undefined) return;

    heldComputerKeys.add(e.key.toLowerCase());
    noteOn(note, 100);
});

document.addEventListener("keyup", e => {
    const k = e.key.toLowerCase();
    const note = COMPUTER_KEYS[k];
    if(note === undefined) return;

    heldComputerKeys.delete(k);
    noteOff(note);
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
