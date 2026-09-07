// Tour destinations outlive the small population streamed around the player.
export class PebbleColonyTour {
	constructor(sites = []) {
		this.locations = new Map(sites.map(s => [`pebble-site:${s.id}`, { ...s, id: `pebble-site:${s.id}` }]));
		this.visited = new Set(); this.stops = 0;
	}
	remember(groups) {
		for (const g of groups) {
			if (g.kind !== 'hopper' || !g.members.length || this.locations.has(g.id)) continue;
			this.locations.set(g.id, { id: g.id, x: g.home.x, z: g.home.z, radius: 1, sample: g.sample, habitat: g.habitat });
		}
	}
	next(current, load) {
		if (current) this.visited.add(current.id);
		// Keep the catalogue order: newly streamed local patches go at the end,
		// so they cannot keep pushing the distant cave and lake stops back.
		const destinations = [...this.locations.values()];
		let remaining = destinations.filter(s => !this.visited.has(s.id));
		if (!remaining.length) {
			this.visited.clear(); if (current) this.visited.add(current.id);
			remaining = destinations.filter(s => !this.visited.has(s.id));
		}
		for (const site of remaining) {
			this.visited.add(site.id);
			const group = load(site);
			if (group?.members.length && group.id !== current?.id) { this.stops++; return group; }
		}
		return null;
	}
}
