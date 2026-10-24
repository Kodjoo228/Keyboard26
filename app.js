const keyboard = document.getElementById("keyboard");

const notes = [
"C","D","E","F","G","A","B",
"C","D","E","F","G","A","B"
];

notes.forEach(note => {

    const key = document.createElement("div");

    key.className = "white";

    key.dataset.note = note;

    keyboard.appendChild(key);

});

document
.getElementById("tempo")
.addEventListener("input", e => {

document.getElementById("tempoValue").innerText =
e.target.value + " BPM";

});

async function connectMidi(){

    if(!navigator.requestMIDIAccess){

        alert("Web MIDI non supporté");

        return;
    }

    const midi = await navigator.requestMIDIAccess();

    for(const input of midi.inputs.values()){

        document.getElementById("midiStatus")
        .innerText =
        "Connecté : " + input.name;

        input.onmidimessage = handleMidi;
    }
}

function handleMidi(event){

    const [status,note,velocity] = event.data;

    if(status === 144 && velocity > 0){

        const index = note % notes.length;

        const key =
        document.querySelectorAll(".white")[index];

        if(key){

            key.classList.add("active");

            setTimeout(() => {

                key.classList.remove("active");

            },200);
        }
    }
}

document
.getElementById("connectMidi")
.addEventListener("click", connectMidi);
