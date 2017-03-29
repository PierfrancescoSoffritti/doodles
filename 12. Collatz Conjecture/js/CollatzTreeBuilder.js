function CollatzTreeBuilder() {

	this.build = function(values) {
		
		const tree = new TreeNode(8);

		for(let i=0; i<values.length; i++) {		    
		    const queue = new Queue();
		    collatz(values[i], number => queue.enqueue(number));

		    merge(tree, queue);
		}

    	return tree;
	}

    function merge(tree, queue) {
        
        const nodeList = new Array();

        while(!queue.isEmpty()) {
            const value = queue.dequeue();
            
            let treeNode = BFS(tree, node => { return node.value === value });

            if(treeNode) {
                for(let i=nodeList.length-1; i>=0; i--) {
                    const value = nodeList[i];
                    const tTreeNode = new TreeNode(value);

                    treeNode.children.push(tTreeNode);
                    treeNode = tTreeNode;
                }

                return;

            } else
                nodeList.push(value);
        }
    }
}