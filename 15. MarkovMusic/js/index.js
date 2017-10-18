const table = document.getElementById("table");

const nodes = [];
for(key in notes)
    nodes.push({ name: key, freq: notes[key]});

const graph = new MarkowGraph(nodes.length);

buildTable(graph);

const notesGenerator = new NotesGenerator();

let prevElm = table;

setInterval(function() {
    const note = graph.selectNextRow();
    notesGenerator.playNote( nodes[note.newNote].freq, true );
    
    highligthTableCell(note);
    
}, 500);

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