const keyboard = document.getElementById("keyboard");

const tempoSlider = document.getElementById("tempo");
const tempoValue = document.getElementById("tempoValue");

const notes = []; 
const pressedNotes = new Set();

const noteNames = [
"C","C#","D","D#","E","F",
"F#","G","G#","A","A#","B"
];

// Construction du clavier simple
const blackNotes =
["C#","D#","F#","G#","A#"];

let whiteIndex = 0;

for(let i = 0; i < 61; i++){

    const noteName =
    noteNames[i % 12];

    const octave =
    Math.floor(i / 12) + 2;

    const midi =
    36 + i;

    const isBlack =
    blackNotes.includes(
        noteName
    );

    const key =
    document.createElement("div");

    key.className =
    isBlack
    ? "black"
    : "white";

    key.innerHTML =
    noteName + octave;

    if(isBlack){

        key.style.position =
        "absolute";

        key.style.left =
        (
            whiteIndex * 90
            - 22
        ) + "px";

        key.style.zIndex =
        "500";

    }else{

        whiteIndex++;
    }

    keyboard.appendChild(key);

    notes.push(key);

    key.addEventListener(
        "click",
        function(){

            playNoteFrequency(
                midiToFrequency(
                    midi
                )
            );
        }
    );
}

    notes.push(key);

tempoSlider.addEventListener("input", e => {

    tempoValue.innerText =
    e.target.value + " BPM";

});

const chordDisplay =
document.getElementById("detectedChord");

function getChord(noteSet){

    if(noteSet.length < 3){
        return "-";
    }

    const normalized =
    noteSet
    .map(n => n % 12)
    .sort((a,b)=>a-b);

    const patterns = [

        {
            name:"Majeur",
            intervals:[0,4,7]
        },

        {
            name:"Mineur",
            intervals:[0,3,7]
        },

        {
            name:"Dim",
            intervals:[0,3,6]
        },

        {
            name:"Aug",
            intervals:[0,4,8]
        }

    ];

    for(const root of normalized){

        const shifted =
        normalized.map(
            n => (n-root+12)%12
        );

        for(const pattern of patterns){

            const ok =
            pattern.intervals.every(
                i => shifted.includes(i)
            );

            if(ok){

                return (
                    noteNames[root]
                    + " "
                    + pattern.name
                );
            }
        }
    }

    return "Accord inconnu";
}

function updateChord(){

    const current =
    Array.from(pressedNotes);

    chordDisplay.innerText =
    "Accord : " +
    getChord(current);
}

async function connectMidi(){

    if(!navigator.requestMIDIAccess){

        alert(
            "Web MIDI non supporté"
        );

        return;
    }

    const midi =
    await navigator.requestMIDIAccess();

    for(const input of midi.inputs.values()){

        document
        .getElementById("midiStatus")
        .innerText =
        "Connecté : "
        + input.name;

        input.onmidimessage =
        handleMidi;
    }
}

function handleMidi(event){

    const [status,note,velocity] =
    event.data;

    const index =
    note % notes.length;

    const key =
    notes[index];

    if(status === 144 &&
       velocity > 0){

        pressedNotes.add(note);

        playNoteFrequency(
    midiToFrequency(note)
);

        if(key){

            key.classList.add(
                "active"
            );
        }

        const currentNote =
        document.getElementById(
            "currentNote"
        );

        if(currentNote){

            currentNote.innerText =
            "Note : "
            + noteNames[note % 12];
        }

        updateChord();
    }

    if(
        status === 128 ||
        (
            status === 144 &&
            velocity === 0
        )
    ){

        pressedNotes.delete(note);

        if(key){

            key.classList.remove(
                "active"
            );
        }

        updateChord();
    }
}

document
.getElementById("connectMidi")
.addEventListener(
    "click",
    connectMidi
);

function toggleFullscreen(){

    if(!document.fullscreenElement){

        document.documentElement
        .requestFullscreen();

    }else{

        document.exitFullscreen();
    }
}

// ======================
// AUDIO ENGINE V2
// ======================

let audioContext = null;

let masterVolume =

localStorage.getItem("volume")

?

parseFloat(
localStorage.getItem("volume")
)

:

0.5;

let currentInstrument =

localStorage.getItem("instrument")

||

"piano";

let currentPreset =

localStorage.getItem("preset")

||

"studio";


function initAudio(){

    if(!audioContext){

        audioContext = new (
            window.AudioContext ||
            window.webkitAudioContext
        )();
    }
}

const instrumentSelect =
document.getElementById("instrument");

if(instrumentSelect){

    instrumentSelect.value =
    currentInstrument;

    instrumentSelect.addEventListener(
        "change",
        async function(){

            currentInstrument =
            this.value;

            localStorage.setItem(
                "instrument",
                currentInstrument
            );

            await loadInstrument();
        }
    );
}


const presetSelect =
document.getElementById("preset");

if(presetSelect){

    presetSelect.value =
    currentPreset;

    presetSelect.addEventListener(
        "change",
        function(){

            currentPreset =
            this.value;

            localStorage.setItem(
                "preset",
                currentPreset
            );
        }
    );
}

function playNoteFrequency(freq){

    initAudio();

    const osc =
    audioContext.createOscillator();

    const gain =
    audioContext.createGain();

    switch(currentInstrument){

        case "piano":
            osc.type = "triangle";
            break;

        case "rhodes":
            osc.type = "sine";
            break;

        case "organ":
            osc.type = "square";
            break;

        case "strings":
            osc.type = "sawtooth";
            break;

        case "guitar":
            osc.type = "triangle";
            break;

        case "nylon":
            osc.type = "sine";
            break;

        default:
            osc.type = "triangle";
    }

    osc.frequency.value = freq;

    let presetVolume =
    masterVolume;

    if(currentPreset === "concert"){
        presetVolume *= 1.1;
    }

    if(currentPreset === "afrobeat"){
        presetVolume *= 0.9;
    }

    if(currentPreset === "gospel"){
        presetVolume *= 1.2;
    }

    osc.connect(gain);
    gain.connect(audioContext.destination);

    gain.gain.setValueAtTime(
        0,
        audioContext.currentTime
    );

    gain.gain.linearRampToValueAtTime(
        presetVolume,
        audioContext.currentTime + 0.03
    );

    osc.start();

    let release = 2;

    if(
        currentInstrument === "guitar" ||
        currentInstrument === "nylon"
    ){
        release = 1.5;
    }

    if(
        currentInstrument === "strings"
    ){
        release = 3;
    }

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + release
    );

    osc.stop(
        audioContext.currentTime + release
    );
}

function midiToFrequency(note){

    return 440 *

    Math.pow(
        2,
        (note - 69) / 12
    );
}

const volumeSlider =
document.getElementById(
    "volume"
);

const volumeValue =
document.getElementById(
    "volumeValue"
);

if(volumeSlider){

    volumeSlider.value =
    masterVolume * 100;

    volumeValue.innerText =
    volumeSlider.value + "%";

    volumeSlider.addEventListener(
        "input",
        function(){

            masterVolume =
            volumeSlider.value / 100;

            volumeValue.innerText =
            volumeSlider.value + "%";

            localStorage.setItem(
                "volume",
                masterVolume
            );
        }
    );
}
