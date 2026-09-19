// Fixed analytic profile matching the pavilion's two folded slabs.
export const structureRoofGlsl=`
 uniform vec4 uStructureRoofPose;
 uniform vec4 uStructureRoofProfile;
 float structureRoofAt(vec2 p){
  vec2 d=p-uStructureRoofPose.xz;
  if(max(abs(d.x),abs(d.y))>86.0)return -1000000.0;
  float c=cos(uStructureRoofPose.w),s=sin(uStructureRoofPose.w);
  vec2 q=vec2(c*d.x-s*d.y,s*d.x+c*d.y);
  if(abs(q.x)>50.0||abs(q.y)>36.0)return -1000000.0;
  vec4 f=uStructureRoofProfile;
  float h=q.x< -46.?mix(0.,f.x,(q.x+50.)/4.):q.x<f.y?mix(f.x,f.z,(q.x+46.)/(f.y+46.)):q.x<46.?mix(f.z,f.w,(q.x-f.y)/(46.-f.y)):mix(f.w,0.,(q.x-46.)/4.);
  return uStructureRoofPose.y+h;
 }
`;
