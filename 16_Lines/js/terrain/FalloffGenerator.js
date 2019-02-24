function FalloffGenerator() {
	
	this.generateFalloffMap = function(size) {
		const map = [];

		for(let i=0; i<size; i++) {
			map.push([]);
			for(let j=0; j<size; j++) {
				const x = i/size * 2 -1;
				const y = j/size * 2 -1;

				const value = Math.max(Math.abs(x), Math.abs(y));
				map[i].push( evaluate(value) );
			}
		}

		return map;
	}

	function evaluate(value) {
		const a = 3;
		const b = 2.2;

		return Math.pow(value, a) / ( Math.pow(value,a) + Math.pow(b-b*value, a));
	}
}