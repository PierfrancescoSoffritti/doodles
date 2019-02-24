function Stack(value) {
	let top;
	if(value)
		top = new Node(value);
	else
		top = null;

	this.pop = function() {
		if(!top)
			return null;

		const result = top;
		top = top.next;

		return result.value;
	}

	this.push = function(value) {
		const newNode = new Node(value);

		newNode.next = top;
		top = newNode;
	}

	this.isEmpty = function() {
		return top === null;
	}

	function Node(value) {
		this.value = value;
		this.next = null;
	}
}