function Queue(value) {
	let top;
	if(value)
		top = new Node(value);
	else
		top = null;

	let last = top;

	this.dequeue = function() {
		if(!top)
			return null;

		const result = top;
		top = top.next;

		return result.value;
	}

	this.enqueue = function(value) {
		const newNode = new Node(value);

		if(top === null)
			top = newNode;
		else
			last.next = newNode;

		last = newNode;
	}

	this.isEmpty = function() {
		return top === null;
	}

	function Node(value) {
		this.value = value;
		this.next = null;
	}
}