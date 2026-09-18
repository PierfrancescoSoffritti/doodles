// Where a recording's bytes go while it is being made. On disk (the origin private
// file system) when the browser has it, so memory stays flat however long the take;
// otherwise in memory, capped so the take ends itself before the tab runs out.
//
// A store hands out one take at a time: begin(name, type) resolves to a take, or to
// null while another tab is recording. A take has append(blob), which rejects once it
// can hold no more (append nothing after that, or the take would have a gap), finish(),
// which resolves to everything appended as one Blob, and discard(), which frees it.
// The store frees nothing by itself: a download is a copy, so whoever downloads a take
// discards it afterwards. sweep() is only the backstop for takes that never got that far.

const DIRECTORY = 'recordings';
const LOCK = 'nowherelands-recording';
const MAX_PENDING_WRITES = 3;
const MEMORY_CAP_BYTES = 256 * 1024 * 1024;

// Resolves to a function releasing the cross-tab lock, or to null if another tab holds it.
function acquireLock() {
	return new Promise((resolve, reject) => {
		navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
			if (!lock) { resolve(null); return undefined; }
			return new Promise((release) => resolve(release));
		}).catch(reject);
	});
}

class DiskTake {
	constructor(directory, handle, writable, release) {
		this.directory = directory;
		this.handle = handle;
		this.writable = writable;
		this.release = release;
		this.pending = 0;
	}

	append(blob) {
		if (this.pending >= MAX_PENDING_WRITES) return Promise.reject(new Error('Storage is slower than the recording'));
		this.pending++;
		return this.writable.write(blob).finally(() => { this.pending--; });
	}

	// close() runs after the writes already queued, and is what commits them to the file.
	async finish() {
		try {
			await this.writable.close();
			return await this.handle.getFile();
		} finally {
			this.release();
		}
	}

	discard() { return this.directory.removeEntry(this.handle.name).catch(() => {}); }
}

class DiskStore {
	constructor(directory) {
		this.directory = directory;
	}

	// Removes what takes that were never discarded left behind: a crash, or a tab closed early.
	// The caller must hold the lock, so a take being written by another tab is never swept.
	// An entry that will not go now is left for the next sweep.
	async sweep() {
		for await (const name of this.directory.keys()) await this.directory.removeEntry(name).catch(() => {});
	}

	async begin(name) {
		const release = await acquireLock();
		if (!release) return null;
		try {
			await this.sweep();
			const handle = await this.directory.getFileHandle(name, { create: true });
			return new DiskTake(this.directory, handle, await handle.createWritable(), release);
		} catch (error) {
			release();
			throw error;
		}
	}
}

class MemoryTake {
	constructor(type) {
		this.type = type;
		this.chunks = [];
		this.bytes = 0;
	}

	async append(blob) {
		if (this.bytes + blob.size > MEMORY_CAP_BYTES) throw new Error('Recording reached the in-memory limit');
		this.chunks.push(blob);
		this.bytes += blob.size;
	}

	async finish() { return new Blob(this.chunks, { type: this.type }); }

	async discard() { this.chunks = []; }
}

class MemoryStore {
	async begin(name, type) { return new MemoryTake(type); }
}

export async function openRecordingStore() {
	try {
		if (!navigator.locks || !('createWritable' in FileSystemFileHandle.prototype)) return new MemoryStore();
		const root = await navigator.storage.getDirectory();
		const store = new DiskStore(await root.getDirectoryHandle(DIRECTORY, { create: true }));
		// Whatever an earlier session left behind is stale, unless another tab is recording right now.
		const release = await acquireLock();
		if (release) await store.sweep().finally(release);
		return store;
	} catch {
		return new MemoryStore();
	}
}
