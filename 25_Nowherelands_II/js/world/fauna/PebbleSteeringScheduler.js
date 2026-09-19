// Expensive local path searches share one allowance across all colonies.
// Snapshot the search, publish only complete decisions, and rotate after each
// footprint probe so one obstructed animal cannot monopolize the allowance.
export class PebbleSteeringScheduler {
 constructor({budgetMs=2,now=()=>performance.now()}={}) {
  this.budgetMs=budgetMs;this.now=now;this.jobs=new Map();
 }
 request(c,model,t,search) {
  const b=c.pebble,old=this.jobs.get(c);
  if(old&&old.goal===b.refuge&&old.returning===b.returning)return;
  old?.work.return();
  const snapshot={...c,pos:{...c.pos},pebble:{...b,refuge:{...b.refuge}}};
  snapshot.group={...c.group,members:c.group.members.map(o=>o===c?snapshot:{...o,pos:{...o.pos}})};
  const context={...model,listener:{...model.listener}};
  this.jobs.set(c,{goal:b.refuge,returning:b.returning,snapshot,work:search(snapshot,context,t)});
 }
 advance(model) {
  const deadline=this.now()+this.budgetMs;
  while(this.jobs.size&&this.now()<deadline){
   const [c,job]=this.jobs.entries().next().value;
   this.jobs.delete(c);
   const b=c.pebble;
   if(!model.creatures.includes(c)||b.refuge!==job.goal||b.returning!==job.returning||!['rise','flee','regroup','brake'].includes(b.state)){
    job.work.return();continue;
   }
   const step=job.work.next();
   if(!step.done){this.jobs.set(c,job);continue;}
   const result=job.snapshot.pebble;
   b.heading=result.heading;b.avoiding=result.avoiding;
   b.pathBlocked=result.pathBlocked;b.steeringReach=result.steeringReach;
   b.steerAt=model.time+.18;
  }
 }
}
