const {execFileSync}=require('node:child_process');
// Native FrameTimeline records presentation without host polling. Keep the raw
// trace for Perfetto SQL analysis; do not equate app rendering with presentation.
class AndroidFrameTimeline {
 constructor(adb,serial,directory){this.adb=adb;this.serial=serial;this.directory=directory;this.deviceFile='/data/misc/perfetto-traces/codex-mobile-'+Date.now()+'.pftrace';}
 adbCall(args,options={}){return execFileSync(this.adb,['-s',this.serial,...args],{encoding:'utf8',timeout:30000,...options});}
 start(seconds){
  const config=`buffers { size_kb: 65536 fill_policy: RING_BUFFER }
data_sources { config { name: "android.surfaceflinger.frametimeline" } }
data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }
${process.env.NATIVE_SCHED==='1'?`data_sources { config { name: "linux.ftrace" ftrace_config {
 ftrace_events: "sched/sched_switch"
 ftrace_events: "sched/sched_waking"
 ftrace_events: "power/cpu_frequency"
 ftrace_events: "power/cpu_idle"
${process.env.NATIVE_SCHED_ONLY==='1'?'':`atrace_categories: "audio"
 atrace_categories: "gfx"
 atrace_categories: "view"
 atrace_categories: "webview"
 atrace_apps: "com.android.chrome"`}
 compact_sched { enabled: true }
 buffer_size_kb: 8192
 drain_period_ms: 250
} } }`:''}
${process.env.NATIVE_SCHED==='1'?'write_into_file: true\nfile_write_period_ms: 1000':''}
duration_ms: ${Math.ceil((seconds+20)*1000)}
`;
  require('node:fs').writeFileSync(this.directory+'/perfetto-config.txt',config);
  const result=this.adbCall(['shell','perfetto','--txt','-c','-','--background-wait','-o',this.deviceFile],{input:config});
  const pid=Number(result.trim());if(!Number.isInteger(pid)||pid<1)throw Error('Unexpected Perfetto PID: '+result);this.pid=pid;
 }
 stop(){if(this.pid){this.adbCall(['shell','kill','-TERM',String(this.pid)]);this.pid=null;}}
 save(){const path=this.directory+'/frames.pftrace';this.adbCall(['pull',this.deviceFile,path]);this.adbCall(['shell','rm',this.deviceFile]);return path;}
}
module.exports={AndroidFrameTimeline};
