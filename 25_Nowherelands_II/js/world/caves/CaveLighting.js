// Shared by cave scenery and the animals standing on its floor.
export const caveLightingGlsl = /* glsl */`
vec3 caveLighting(vec3 base,vec3 p,vec3 n,float entranceLight,float lampStrength,vec3 camera){
 vec3 toLight=camera-p;float d=length(toLight);vec3 l=toLight/max(d,.01);
 float lamp=lampStrength*(.22+.78*max(dot(n,l),0.0))/(1.0+d*d*.0013);
 float sky=entranceLight*(.3+.4*max(n.y,0.0));
 vec3 lit=base*(vec3(.016,.012,.024)+vec3(.68,.61,.92)*sky+vec3(1.7,1.36,1.05)*lamp);
 return mix(lit,vec3(.004,.003,.009),1.0-exp(-d*.0018));
}
`;
