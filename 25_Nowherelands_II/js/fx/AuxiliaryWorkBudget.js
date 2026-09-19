// Background captures share one allowance. Independent reflection timers can
// otherwise spend all the headroom in a frame even after the image queue fills.
export class AuxiliaryWorkBudget {
 constructor({fraction=.15,burst=4,now=()=>performance.now()}={}){
  this.fraction=fraction;this.burst=burst;this.now=now;this.at=now();this.credit=0;
 }
 run(work){
  const at=this.now();
  this.credit=Math.min(this.burst,this.credit+Math.max(0,at-this.at)*this.fraction);this.at=at;
  if(this.credit<0)return false;
  try{work();return true;}
  finally{const end=this.now();this.credit-=Math.max(0,end-at);this.at=end;}
 }
}
