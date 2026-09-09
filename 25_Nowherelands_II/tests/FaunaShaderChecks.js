import { lumenLightGlsl } from '../js/world/fauna/LumenLight.js';
import { faunaGeometry } from '../js/world/fauna/FaunaGeometry.js';
import { faunaDeformation } from '../js/world/fauna/FaunaDeformation.js';

// Capture the actual GPU-deformed positions with an identity object transform.
// Distance changes between vertex pairs rule out whole-object rigid motion.
export function checkFaunaShaders(detail = 0) {
	const canvas = document.createElement('canvas'), gl = canvas.getContext('webgl2');
	if (!gl) throw new Error('WebGL 2 is required');
	const reports = [];
	for (const [kind, id] of Object.entries({ lumen: 0, hopper: 3 })) {
		const program = gl.createProgram(), shaders = [];
		for (const [type, source] of [
			[gl.VERTEX_SHADER, `#version 300 es\n#define KIND ${id}\nprecision highp float;\nin vec3 position; uniform vec4 aLife, aMotion; uniform vec3 aVelocity, aElastic; out vec3 deformed;\n${faunaDeformation}\nvoid main(){deformed=deformFauna(position);gl_Position=vec4(deformed,1.0);}`],
			[gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;out vec4 color;void main(){color=vec4(1.0);}'],
		]) {
			const shader = gl.createShader(type); gl.shaderSource(shader, source); gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(kind + ': ' + gl.getShaderInfoLog(shader));
			gl.attachShader(program, shader); shaders.push(shader);
		}
		gl.transformFeedbackVaryings(program, ['deformed'], gl.INTERLEAVED_ATTRIBS); gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
		gl.useProgram(program);
		const geometry = faunaGeometry(kind, detail), positions = geometry.attributes.position.array, n = positions.length / 3;
		const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
		const input = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, input); gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(program, 'position'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
		const output = gl.createBuffer(), feedback = gl.createTransformFeedback(); gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, feedback);
		gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, output); gl.bufferData(gl.TRANSFORM_FEEDBACK_BUFFER, positions.byteLength, gl.DYNAMIC_READ);
		gl.uniform4f(gl.getUniformLocation(program, 'aLife'), 0, 0, kind === 'lumen' ? 28 : 6, 0.2);
		gl.uniform3f(gl.getUniformLocation(program,'aVelocity'),28,0,0);gl.uniform3f(gl.getUniformLocation(program,'aElastic'),0.4,0.2,0.1);
		const frames = [];
		for (const phase of [0.4, 2.2]) {
			gl.uniform4f(gl.getUniformLocation(program, 'aMotion'), phase, 0.85, phase * 0.3, phase);
			gl.enable(gl.RASTERIZER_DISCARD); gl.beginTransformFeedback(gl.POINTS); gl.drawArrays(gl.POINTS, 0, n); gl.endTransformFeedback(); gl.disable(gl.RASTERIZER_DISCARD);
			const result = new Float32Array(positions.length); gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER, 0, result); frames.push(result);
		}
		if (frames.some(f => f.some(v => !Number.isFinite(v)))) throw new Error(kind + ': non-finite vertex');
		let displacement = 0, nonRigid = 0;
		const distance = (f, i, j) => Math.hypot(f[i] - f[j], f[i + 1] - f[j + 1], f[i + 2] - f[j + 2]);
		for (let i = 0; i < positions.length; i += 3) {
			displacement = Math.max(displacement, Math.hypot(frames[0][i] - frames[1][i], frames[0][i + 1] - frames[1][i + 1], frames[0][i + 2] - frames[1][i + 2]));
			const j = ((i / 3 + Math.floor(n * 0.37)) % n) * 3;
			nonRigid = Math.max(nonRigid, Math.abs(distance(frames[0], i, j) - distance(frames[1], i, j)));
		}
		if (kind === 'hopper' && (displacement > 0.00001 || nonRigid > 0.00001)) throw new Error('Stone body deforms during locomotion');
		if (kind !== 'hopper' && (displacement < 0.1 || nonRigid < 0.05)) throw new Error(kind + ': no meaningful non-rigid deformation');
		const report = { kind, vertices: n, displacement: +displacement.toFixed(3), nonRigid: +nonRigid.toFixed(3) };
		if (kind === 'lumen') {
			if(nonRigid<0.3)throw new Error(`Lumen detail ${detail} surface deformation is too subtle: ${nonRigid}`);
			let maxRadius=0,minRadius=Infinity;
			const lengths=[];
			for(const velocity of [[0,0,0],[120,0,0],[0,120,0],[0,0,-120]]) {
				gl.uniform3f(gl.getUniformLocation(program,'aVelocity'),...velocity);
				gl.uniform4f(gl.getUniformLocation(program,'aMotion'),0.4,0.8,0,0.4);
				gl.enable(gl.RASTERIZER_DISCARD);gl.beginTransformFeedback(gl.POINTS);gl.drawArrays(gl.POINTS,0,n);gl.endTransformFeedback();gl.disable(gl.RASTERIZER_DISCARD);
				const result=new Float32Array(positions.length);gl.getBufferSubData(gl.TRANSFORM_FEEDBACK_BUFFER,0,result);
				const extents=[0,1,2].map(axis=>{let min=Infinity,max=-Infinity;for(let i=axis;i<result.length;i+=3){min=Math.min(min,result[i]);max=Math.max(max,result[i]);}return max-min;});
				for(let i=0;i<result.length;i+=3){const radius=Math.hypot(result[i],result[i+1],result[i+2]);maxRadius=Math.max(maxRadius,radius);minRadius=Math.min(minRadius,radius);}
				lengths.push(extents);
			}
			if(maxRadius>1.85 || minRadius<0.55)throw new Error(`Lumen volume outside bounds: radius ${minRadius}–${maxRadius}`);
			if(lengths[1][0]<lengths[1][1]*1.15 || lengths[2][1]<lengths[2][0]*1.15 || lengths[3][2]<lengths[3][0]*1.15)throw new Error('Blob deformation did not follow the velocity direction');
			report.maxRadius=+maxRadius.toFixed(3);report.minRadius=+minRadius.toFixed(3);report.velocityAxes='pass';
		}
		reports.push(report);
		geometry.dispose(); gl.deleteBuffer(input); gl.deleteBuffer(output); gl.deleteVertexArray(vao); gl.deleteTransformFeedback(feedback); shaders.forEach(s => gl.deleteShader(s)); gl.deleteProgram(program);
	}
	reports.push(checkShoreLight(gl));
	gl.getExtension('WEBGL_lose_context')?.loseContext(); return reports;
}


function checkShoreLight(gl) {
	// Render the shared terrain/water lighting function itself, comparing a dark
	// control, a nearby emitter and an emitter beyond its finite falloff radius.
	const program=gl.createProgram(),shaders=[];
	for(const [type,source] of [
		[gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0.0,1.0);}'],
		[gl.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;out vec4 color;${lumenLightGlsl}void main(){color=vec4(lumenIllumination(vec3(0.0),vec3(0.0,0.0,1.0),vec3(0.0,0.0,1.0),0.0),1.0);}`],
	]) {
		const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
		if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shader));
		gl.attachShader(program,shader);shaders.push(shader);
	}
	gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
	gl.useProgram(program);gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,1,1);
	const samples=[];
	for(const [height,intensity] of [[4,0],[4,1],[100,1]]) {
		const lights=new Float32Array(32);lights[2]=height;lights[3]=intensity;
		gl.uniform3fv(gl.getUniformLocation(program,'uLumenColors[0]'),new Float32Array(Array.from({length:8},()=>[0.33,0.82,0.96]).flat()));
		gl.uniform4fv(gl.getUniformLocation(program,'uLumenLights[0]'),lights);gl.drawArrays(gl.TRIANGLES,0,3);
		const pixel=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,pixel);samples.push(pixel[1]);
	}
	if(samples[0]!==0 || samples[1]<80 || samples[2]!==0)throw new Error('Lumen does not illuminate nearby surfaces with bounded falloff');
	shaders.forEach(shader=>gl.deleteShader(shader));gl.deleteProgram(program);
	return {kind:'shore-light',dark:samples[0],near:samples[1],far:samples[2]};
}
