const keyboard =
document.getElementById("keyboard");

const pianoNotes = [];

const noteNames = [
"C","C#","D","D#","E","F",
"F#","G","G#","A","A#","B"
];

function buildPiano(){

    keyboard.innerHTML = "";

    let whiteIndex = 0;

    for(let midi = 36; midi <= 96; midi++){

        const note =
        noteNames[midi % 12];

        const octave =
        Math.floor(midi / 12) - 1;

        const isBlack =
        note.includes("#");

        const key =
        document.createElement("div");

        if(isBlack){

            key.className = "black";

            key.innerHTML =
            note + octave;

            key.style.left =
            (whiteIndex * 42 - 14)
            + "px";

        }else{

            key.className = "white";

            key.innerHTML =
            note + octave;

            whiteIndex++;
        }

        key.dataset.midi = midi;

        keyboard.appendChild(key);

        pianoNotes[midi] = key;
    }
}

buildPiano();
