export class LanternMiteSurvey {
 constructor(shared, mites, { mount = true } = {}) {
  this.shared = shared; this.mites = mites; this.tracking = false; this.target = null; this.autoAt = 0; this.autoTries = 0;
  const panel = this.panel = document.createElement('aside'); panel.className = 'fauna-guide';
  panel.innerHTML = '<div class="fauna-guide-kicker">NOWHERELANDS · FIELD NOTES</div><h2>Lantern mites</h2><p>Small conversations in the old forest.</p>';
  const actions = document.createElement('div'); actions.className = 'fauna-guide-list'; panel.append(actions);
  const button = (text, action) => { const b = document.createElement('button'); b.textContent = text; b.onclick = action; actions.append(b); };
  button('Find a colony', () => this.visit()); button('Next colony', () => this.visit(this.group));
  button('Approach slowly', () => { if ((!this.group || !this.tracking) && !this.visit()) return; this.mites.observing = false; this.target = 3.6; });
  button('Wait here', () => { this.target = null; this.mites.observing = false; });
  button('Play a soft note', () => { if(!this.mites.playerNote())this.detail.textContent='Enter the game to enable sound, then play a note near a colony.'; });
  button('Step away', () => { this.target = 7; this.mites.observing = false; });
  button('Explore here ↗', () => { this.tracking = false; this.mites.guided = false; this.mites.observing = false; this.shared.player.fly = false; });
  this.detail = document.createElement('p'); panel.append(this.detail);
  const hint=document.createElement('p');hint.textContent='In the world: click nearby to play a note. Pause to hear their answer; rapid or strongly charged notes send them into shelter.';panel.append(hint);
  const link = document.createElement('a'); link.href = './lantern-study.html'; link.textContent = 'Character & voice study ↗'; link.style.color = 'inherit'; panel.append(link);
  if (mount) document.body.append(panel);
  document.addEventListener('pointerlockchange', () => {
   panel.classList.toggle('playing', shared.player.locked);
   if (shared.player.locked) { this.tracking = false; mites.guided = false; mites.observing = false; }
  });
 }
 visit(current) {
  const colony = this.mites.visit(current);
  if (!colony) { this.detail.textContent = 'Looking for a dry, sheltered tree base as the forest loads…'; return false; }
  this.group = colony; this.tracking = true; this.mites.guided = true; this.target = null; this.distance = 7;
  const p = this.shared.player; if (p.locked) document.exitPointerLock();
  p.keys.clear(); p.velocity.set(0, 0, 0); p.fly = true;
  p.position.set(colony.site.arrival.x, colony.site.arrival.y, colony.site.arrival.z);
  this.guide(0); return true;
 }
 guide(dt) {
  if (!this.tracking || !this.group || this.shared.player.locked) return;
  const p = this.shared.player, site = this.group.site;
  p.fly = true; p.velocity.set(0, 0, 0);
  if (this.target !== null) {
   const delta = this.target - this.distance;
   this.distance += Math.sign(delta) * Math.min(Math.abs(delta), dt * 2.5 / site.scale);
   const at = site.point({ x: 0, y: 0.8, z: this.distance });
   p.position.set(at.x, this.shared.heightmap.height(at.x, at.z) + 11, at.z);
   if (Math.abs(this.target - this.distance) < 0.001) this.target = null;
  }
  const c = site.center;
  p.yaw = Math.atan2(-(c.x - p.position.x), -(c.z - p.position.z));
  p.pitch = Math.atan2(c.y - p.position.y, Math.hypot(c.x - p.position.x, c.z - p.position.z));
 }
 update() {
  if (!this.group && this.mites.time > this.autoAt && this.autoTries < 5) { this.autoAt = this.mites.time + 2; this.autoTries++; this.visit(); }
  if (this.group && !this.mites.colonies.has(this.group.id)) { this.group = null; this.tracking = false; }
  if (this.group) this.detail.textContent = this.group.model.sheltered ? 'Sheltering in the weather. Their light is dim.' : `${this.group.site.home.family} · ${this.group.model.caption.join(' · ')}`;
  this.panel.dataset.mites = JSON.stringify({ colonies: this.mites.colonies.size, hosts: this.mites.hosts().length, observing: this.mites.observing,
   subject: this.group?.id, home: this.group?.site.home?.family, position: this.group?.site.center, scale: this.group?.site.scale, sheltered: this.group?.model.sheltered,
   states: this.group?.model.mites.map(m => m.state), members: this.group?.model.mites.map(m => ({ position: this.group.position(m), brightness: m.brightness, calls: m.contacts })),
   voices: this.mites.audio?.voices.size || 0, played: this.mites.audio?.played || 0 });
 }
}
