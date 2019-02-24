function MarkowGraph(numberOfNodes) {
    if(numberOfNodes <= 0)
        console.error("number of nodes not valid");

    const graph = [numberOfNodes];
    let currentRowIndx = 0;

    for(let i=0; i<numberOfNodes; i++)
        graph[i] = [numberOfNodes];

    setProbabilities();

    this.getGraph = function() {
        return graph;
    }

    this.selectNextRow = function() {
        const currentRow = graph[currentRowIndx];

        let accumulator = 0;
        const rand = Math.random();

        for(let i=0; i<currentRow.length; i++) {
            accumulator += currentRow[i];

            if(accumulator >= rand) {
                const res = { newNote: i, currentNote: currentRowIndx };
                currentRowIndx = i;
                return res;
            }
        }

        // each row sums to a prob of 1, therefore i will never arrive here
        return -1;
    }

    function setProbabilities() {
        for(let i=0; i<numberOfNodes; i++) {
            const row = graph[i];
            setProbRec(row, i+1, 1, val => val+1);
            setProbRec(row, i-1, 1, val => val-1);

            row[i] = 0.01;

            normalizeRow(row);
        }
    }

    function setProbRec(row, col, distance, func) {
        if(col < 0 || col >= numberOfNodes)
            return;

        row[col] = Math.abs( Math.sin(distance) / distance );
        if(col%2 != 0)
            row[col] *= 2;

        distance += 1;
        col = func(col);

        setProbRec(row, col, distance, func);
    }

    function normalizeRow(row) {
        let sum = 0;
        for(let i=0; i<row.length; i++)
            sum += row[i];

        for(let i=0; i<row.length; i++)
            row[i] = row[i]/sum;
    }
}