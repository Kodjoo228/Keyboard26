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
for(let i = 0; i < 61; i++){

    const key = document.createElement("div");

    key.className = "white";

    const octave =
    Math.floor(i / 12) + 2;

    key.innerHTML =
    noteNames[i % 12] + octave;

    keyboard.appendChild(key);

    key.addEventListener(
    "click",
    function(){

        const midi =
        36 + i;

        playNoteFrequency(
            midiToFrequency(midi)
        );
    }
);

    notes.push(key);
}

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
// AUDIO ENGINE V1
// ======================

let audioContext = null;

let masterVolume = 0.5;

function initAudio(){

    if(!audioContext){

        audioContext =
        new (
            window.AudioContext ||
            window.webkitAudioContext
        )();
    }
}

function playNoteFrequency(freq){

    initAudio();

    const osc =
    audioContext.createOscillator();

    const gain =
    audioContext.createGain();

    osc.type = "triangle";

    osc.frequency.value = freq;

    gain.gain.value = masterVolume;

    osc.connect(gain);

    gain.connect(
        audioContext.destination
    );

    osc.start();

    gain.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 1
    );

    osc.stop(
        audioContext.currentTime + 1
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
document.getElementById("volume");

const volumeValue =
document.getElementById("volumeValue");

if(volumeSlider){

    volumeSlider.addEventListener(
        "input",
        function(){

            masterVolume =
            volumeSlider.value / 100;

            volumeValue.innerText =
            volumeSlider.value + "%";
        }
    );
}
