import * as THREE from 'three';
import {plantGeometry} from '../RiverEcology.js';

export class EntranceDressing {
	constructor(shared) {
		this.rock=new THREE.IcosahedronGeometry(1,1);
		// Split edges expose a handful of broad planes rather than smooth spherical stones.
		const p=this.rock.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,Math.round(p.getY(i)*3)/3);
		this.rock.computeVertexNormals();
		this.plants=Object.fromEntries(['fern','bramble','sedge','moss'].map(k=>[k,plantGeometry(k)]));
		this.plantMaterial=new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,emissive:'#1b2033',emissiveIntensity:.2});
	}
	add(group,habitat,caveMaterial) {
		const transform=new THREE.Object3D();
		const inside=caveMaterial.clone();inside.uniforms=caveMaterial.uniforms;
		inside.vertexShader=inside.vertexShader.replace('vWorldPos=position;gl_Position=projectionMatrix*viewMatrix*vec4(position,1.0);','vec4 p=modelMatrix*instanceMatrix*vec4(position,1.0);vWorldPos=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;');
		const rocks=habitat.flatMap(h=>h.rocks);
		if(rocks.length) {
			const mesh=new THREE.InstancedMesh(this.rock,inside,rocks.length);mesh.name='cave-entrance-collapse';
			rocks.forEach((r,i)=>{transform.position.set(r.x,r.y,r.z);transform.rotation.set(r.tilt,r.yaw,r.tilt*.7);transform.scale.set(r.sx,r.sy,r.sz);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
			mesh.computeBoundingSphere();group.add(mesh);
		}
		for(const [type,geometry] of Object.entries(this.plants)) {
			const plants=habitat.flatMap(h=>h.plants).filter(p=>p.type===type);if(!plants.length)continue;
			const mesh=new THREE.InstancedMesh(geometry,this.plantMaterial,plants.length);mesh.name=`cave-entrance-${type}`;
			plants.forEach((p,i)=>{transform.position.set(p.x,p.y,p.z);transform.rotation.set(0,p.yaw,0);transform.scale.setScalar(p.scale);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);});
			mesh.computeBoundingSphere();group.add(mesh);
		}
	}
}
