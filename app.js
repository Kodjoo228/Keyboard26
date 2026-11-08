console.log("FEATURE BRANCH");

/*
Piano Composer Pro ByDélé
Copyright © 2026 Nicolas
Tous droits réservés 
*/  


const keyboard = document.getElementById("keyboard");

const tempoSlider = document.getElementById("tempo"); 
const tempoValue = document.getElementById("tempoValue");

const notes = []; 
const pressedNotes = new Set();

const noteNames = [
"C","C#","D","D#","E","F",
"F#","G","G#","A","A#","B"
];

// Construction du clavier noir/blanc

const blackNotes =
["C#","D#","F#","G#","A#"];

let whiteKeyIndex = 0;

for(let i = 0; i < 61; i++){

    const key =
    document.createElement("div");

    const midiNote =
    36 + i;

    const noteName =
    noteNames[midiNote % 12];

    const octave =
    Math.floor(midiNote / 12) - 1;

    const isBlack =
    blackNotes.includes(noteName);

    key.className =
    isBlack
    ? "black"
    : "white";

    key.innerHTML =
    noteName + octave;


    
    if(isBlack){

    const positions = {
        "C#": -47,
        "D#": -15,
        "F#": -47,
        "G#": -31,
        "A#": -15
    };

    key.style.left =
    (
        whiteKeyIndex * 95 +
        positions[noteName]
    ) + "px";

    key.style.zIndex = "100";

}else{

    whiteKeyIndex++;
}


    
    keyboard.appendChild(key);

    key.addEventListener(
        "click",
        function(){

            playNoteFrequency(
                midiToFrequency(
                    midiNote
                )
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

    console.log(
    "MIDI NOTE =",
    note
);


    const index =
    note - 36;

    const key =
    notes[note];

    if(
        status === 144 &&
        velocity > 0
    ){

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
// REAL PIANO ENGINE V2
// ======================

const blackNotes =
["C#","D#","F#","G#","A#"];

let whiteIndex = 0;

for(let i = 0; i < 61; i++){

    const midiNote =
    36 + i;

    const noteName =
    noteNames[midiNote % 12];

    if(
        blackNotes.includes(
            noteName
        )
    ){
        continue;
    }

    const key =
    document.createElement("div");

    key.className =
    "white";

    const octave =
    Math.floor(
        midiNote / 12
    ) - 1;

    key.innerHTML =
    noteName + octave;

    keyboard.appendChild(key);

    notes[midiNote] = key;

    key.addEventListener(
        "click",
        function(){

            playNoteFrequency(
                midiToFrequency(
                    midiNote
                )
            );
        }
    );

    whiteIndex++;
}


// ======================
// NOIR
// ======================

whiteIndex = 0;

for(let i = 0; i < 61; i++){

    const midiNote =
    36 + i;

    const noteName =
    noteNames[midiNote % 12];

    if(
        !blackNotes.includes(
            noteName
        )
    ){
        whiteIndex++;
        continue;
    }

    const key =
    document.createElement("div");

    key.className =
    "black";

    const octave =
    Math.floor(
        midiNote / 12
    ) - 1;

    key.innerHTML =
    noteName + octave;

    let x = 0;

    switch(noteName){

        case "C#":
            x =
            whiteIndex * 95 - 25;
        break;

        case "D#":
            x =
            whiteIndex * 95 - 25;
        break;

        case "F#":
            x =
            whiteIndex * 95 - 25;
        break;

        case "G#":
            x =
            whiteIndex * 95 - 25;
        break;

        case "A#":
            x =
            whiteIndex * 95 - 25;
        break;
    }

    key.style.left =
    x + "px";

    key.style.zIndex =
    "100";

    keyboard.appendChild(key);

    notes[midiNote] = key;

    key.addEventListener(
        "click",
        function(){

            playNoteFrequency(
                midiToFrequency(
                    midiNote
                )
            );
        }
    );
}


function initAudio(){

    if(!audioContext){

        audioContext = new(
            window.AudioContext ||
            window.webkitAudioContext
        )();
    }
}

function midiToFrequency(note){

    return 440 *
    Math.pow(
        2,
        (note - 69) / 12
    );
}

function playNoteFrequency(freq){

    initAudio();

    const osc =
    audioContext.createOscillator();

    const gain =
    audioContext.createGain();

    osc.type = "triangle";

    osc.frequency.value = freq;

    gain.gain.value =
    masterVolume;

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
