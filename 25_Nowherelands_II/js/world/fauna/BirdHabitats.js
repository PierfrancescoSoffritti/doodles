// World-anchored territories survive streaming and do not follow the observer.
export const BIRD_HABITAT_SIZE=300;
export function birdHash(x,z,seed=1){
 let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^(seed|0);
 h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;
}
export class BirdHabitats {
 constructor(seed=1){this.seed=seed;}
 at(x,z){
  const cx=Math.floor(x/BIRD_HABITAT_SIZE),cz=Math.floor(z/BIRD_HABITAT_SIZE),h=birdHash(cx,cz,this.seed);
  return {id:`${cx},${cz}`,x:(cx+.5)*BIRD_HABITAT_SIZE+((h>>>8)%61-30),z:(cz+.5)*BIRD_HABITAT_SIZE+((h>>>16)%61-30),count:h%100<14?0:h%100<26?1:2+(h>>>4)%3,species:(h>>>10)%3};
 }
 populate(groups,encounters,capacity,spawn){
  const counts=new Map();for(const e of encounters)counts.set(e.habitat.id,(counts.get(e.habitat.id)||0)+1);
  for(let round=0;round<4;round++)for(const area of groups){
   if(encounters.length>=capacity)return;
   if((counts.get(area.id)||0)>round||round>=area.count)continue;
   for(const site of area.sites){
    const e=spawn(site,area);if(!e)continue;
    encounters.push(e);counts.set(area.id,(counts.get(area.id)||0)+1);break;
   }
  }
 }
 groups(sites,observer){
  const groups=new Map();
  for(const site of sites){
   if(Math.hypot(site.position.x-observer.x,site.position.z-observer.z)>720)continue;
   const area=this.at(site.position.x,site.position.z);if(!area.count)continue;
   if(!groups.has(area.id))groups.set(area.id,{...area,sites:[]});groups.get(area.id).sites.push(site);
  }
  for(const area of groups.values())area.sites.sort((a,b)=>Math.hypot(a.position.x-area.x,a.position.z-area.z)-Math.hypot(b.position.x-area.x,b.position.z-area.z)||a.position.y-b.position.y);
  return [...groups.values()].sort((a,b)=>Math.hypot(a.x-observer.x,a.z-observer.z)-Math.hypot(b.x-observer.x,b.z-observer.z));
 }
}
