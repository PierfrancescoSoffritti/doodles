import * as THREE from 'three';

export function pickTarget(raycaster,camera,position,targets,pointer=new THREE.Vector2(0,0)){
 camera.updateWorldMatrix(true,false);raycaster.setFromCamera(pointer,camera);
 const near=targets.filter(target=>target.mesh.getWorldPosition(new THREE.Vector3()).distanceTo(position)<160);
 const hit=raycaster.intersectObjects(near.map(target=>target.mesh),false)[0];
 return hit?near.find(target=>target.mesh===hit.object):null;
}
export function hoverTarget(previous,next,hud){
 if(previous!==next){previous?.onHover(false);next?.onHover(true);hud.setHover(!!next);}
 return next;
}

// Resolve the release once: a moving target can use the last hover, but that
// same gesture must never also fall through to the player's world note.
export function dispatchPress(landmarks,playerNotes,duration){
 const charge=Math.max(0,Math.min(1,(duration-.28)/1.1));
 const target=landmarks.aim()||landmarks.hovered;
 if(target)target.onPress(charge);
 else playerNotes.send(charge);
}
