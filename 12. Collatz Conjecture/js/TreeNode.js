function TreeNode(value) {
	this.value = value;	
	this.children = new Array();

	this.isLeaf = function() {
		return this.children.length === 0;
	}
}