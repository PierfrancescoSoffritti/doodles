const {execFileSync}=require('node:child_process');
// Run only after frame/audio collection, since the device-wide inventory itself
// can perturb scheduling. Keep this separately labelled in the report.
async function collectAndroidMemory(adb,serial,endpoint) {
 const targets=await(await fetch(endpoint+'/json/list')).json(),at=new Date().toISOString();
 const heaps=await Promise.all(targets.filter(t=>t.type==='worker'||t.type==='page').map(async target=>{
  const ws=new WebSocket(target.webSocketDebuggerUrl);
  try {
   await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
   const result=await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Memory inventory timed out')),5000);
    ws.onmessage=e=>{const message=JSON.parse(e.data);if(message.id===1){clearTimeout(timer);resolve(message);}};
    ws.send(JSON.stringify({id:1,method:'Runtime.getHeapUsage'}));
   });
   return {type:target.type,url:target.url,result};
  } finally {ws.close();}
 }));
 const args=['-s',serial,'shell'],ps=execFileSync(adb,[...args,'ps','-A','-o','PID,NAME'],{encoding:'utf8',timeout:10000});
 const processes=ps.split('\n').filter(row=>row.includes('com.android.chrome')&&!row.includes('zygote')).map(row=>({row,meminfo:execFileSync(adb,[...args,'dumpsys','meminfo','-s',row.trim().split(/\s+/)[0]],{encoding:'utf8',timeout:10000})}));
 return {at,afterMeasurement:true,heaps,processes};
}
module.exports={collectAndroidMemory};
