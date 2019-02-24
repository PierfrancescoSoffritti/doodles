const table = document.getElementById("table");
let time = 0;
let rand = 0;

const nodes = [];
for(key in notes)
    nodes.push({ name: key, freq: notes[key]});

const graph = new MarkowGraph(nodes.length);
const graphBackground = new MarkowGraph(nodes.length);

const notesGenerator = new NotesGenerator();

let prevElm = table;

buildTable(graph);
render();

function render() {
    requestAnimationFrame(render);
    time++;
    notesGenerator.update(time);

    if(time > rand) {
        const note = graph.selectNextRow();
        notesGenerator.playNote( nodes[note.newNote].freq );
        
        highligthTableCell(note); 

        time = 0;
        rand = getRandomInt(10, 110);
    }
}

setInterval(function() {
    const note = graphBackground.selectNextRow();
    notesGenerator.playNoteBackground( nodes[note.newNote].freq );
}, 5000);

function highligthTableCell(note) {
    const row = document.getElementById("row" +note.currentNote).getElementsByTagName("*");
    for (var i = 0; i < row.length; i++) {
        if (row[i].id === note.newNote+"") {
            elm = row[i];
            elm.style.backgroundColor = "red";
            
            prevElm.style.backgroundColor = "transparent";

            prevElm = elm;
            break;
        }
    }
}

function buildTable(graph) {
    for(let i=0; i<nodes.length; i++) {
        const row = table.insertRow();
        row.id = "row"+i;
        for(let j=0; j<nodes.length; j++) {
            const cell = row.insertCell();
            cell.id = j;
            cell.innerHTML = graph.getGraph()[i][j].toFixed(4);
        }
    }
}

function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}