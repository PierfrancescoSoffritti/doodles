export function replyHighlight(time,start,end){
 if(time<start||time>=end)return 0;
 return Math.min(1,(time-start)/.08,(end-time)/.22);
}
