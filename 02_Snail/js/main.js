var scene, 
    camera,
    controls,
    fieldOfView,
  	aspectRatio,
  	nearPlane,
  	farPlane,
    shadowLight, 
    backLight,
    light, 
    renderer,
		container;

var HEIGHT,
  	WIDTH,
    windowHalfX,
  	windowHalfY,
    mousePos = {x:0,y:0};

var rightIris, leftIris;
var eyeLineRight, eyeLineLeft;

function init() {
  scene = new THREE.Scene();

  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  windowHalfX = WIDTH / 2;
  windowHalfY = HEIGHT / 2;
  aspectRatio = WIDTH / HEIGHT;
  fieldOfView = 60;
  nearPlane = 1;
  farPlane = 2000; 
  camera = new THREE.PerspectiveCamera(
    fieldOfView,
    aspectRatio,
    nearPlane,
    farPlane);

  camera.position.z = 800;  
  camera.position.y = 0;
  camera.lookAt(new THREE.Vector3(0,0,0));   

  renderer = new THREE.WebGLRenderer({alpha: true, antialias: true });
  renderer.setSize(WIDTH, HEIGHT);
  renderer.shadowMap.enabled = true;

  container = document.getElementById('world');
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  
  window.addEventListener('resize', onWindowResize, false);
  document.addEventListener('mousemove', handleMouseMove, false);
  document.addEventListener('mousedown', handleMouseDown, false);
  document.addEventListener('mouseup', handleMouseUp, false);
  document.addEventListener('touchstart', handleTouchStart, false);
	document.addEventListener('touchend', handleTouchEnd, false);
	document.addEventListener('touchmove',handleTouchMove, false);  
}

function onWindowResize() {
  HEIGHT = window.innerHeight;
  WIDTH = window.innerWidth;
  windowHalfX = WIDTH / 2;
  windowHalfY = HEIGHT / 4;
  renderer.setSize(WIDTH, HEIGHT);
  camera.aspect = WIDTH / HEIGHT;
  camera.updateProjectionMatrix();
}

function handleMouseMove(event) {
  mousePos = {x:event.clientX, y:event.clientY};
}

function handleMouseDown(event) {
}
function handleMouseUp(event) {
}

function handleTouchStart(event) {
  if (event.touches.length > 1) {
    event.preventDefault();
		mousePos = {x:event.touches[0].pageX, y:event.touches[0].pageY};
  }
}

function handleTouchEnd(event) {
    mousePos = {x:windowHalfX, y:windowHalfY};
}

function handleTouchMove(event) {
  if (event.touches.length == 1) {
    event.preventDefault();
		mousePos = {x:event.touches[0].pageX, y:event.touches[0].pageY};
  }
}

function createLights() {
  light = new THREE.HemisphereLight(0xffffff, 0xffffff, .5)
  
  shadowLight = new THREE.DirectionalLight(0xffffff, .8);
  shadowLight.position.set(200, 200, 200);
  shadowLight.castShadow = true;
 	
  backLight = new THREE.DirectionalLight(0xffffff, .4);
  backLight.position.set(-100, 200, 50);
  backLight.castShadow = true;
 	
  scene.add(backLight);
  scene.add(light);
  scene.add(shadowLight);
}

// scene loop
function loop() {
  if (controls) 
    controls.update();

  render();
  
  requestAnimationFrame(loop);
}

function render() {
  var yOffset = 0;

  var xMousePos = (mousePos.x-windowHalfX);
  var yMousePos = (mousePos.y-windowHalfY);

  // update iris horizontal position
  var xStep = xMousePos/200 *-1;
  var newPosZ = leftIris.position.z + xStep;
  if(newPosZ >= -15 && newPosZ <= 15 ) {
    leftIris.position.z += xStep;
    rightIris.position.z += xStep;
  }  

  // update iris vertical position
  var yStep = yMousePos/200 *-1;
  var newPosY = leftIris.position.y + yStep;
  if(newPosY >= (-15 + yOffset) && newPosY <= (15 + yOffset) ) {
    leftIris.position.y += yStep;
    rightIris.position.y += yStep;
  }

  // move eyes up and down when mouse is near
  if(Math.abs(xMousePos) <= 100 && Math.abs(yMousePos) <= 200) {
    if(eyeLineRight.position.y > 15) {
      eyeLineRight.position.y -= 3;
      eyeLineLeft.position.y -= 3;

      yOffset -= 1;
    }
  } else if(eyeLineRight.position.y < 80) {
    eyeLineRight.position.y += 1;
    eyeLineLeft.position.y += 1;

    yOffset += 1;
  }

  renderer.render(scene, camera);
}

function createSnail(){
  var snail = new THREE.Group();
  snail.position.y = -20;
  
  // body
  var bodyGeom = new THREE.BoxGeometry(120, 120, 120);
  var bodyMat = new THREE.MeshLambertMaterial({
    color: 0xCC6600 ,
  });
  var body = new THREE.Mesh(bodyGeom, bodyMat);
  
  // lips
  var lipsGeom = new THREE.BoxGeometry(25, 10, 120);
  var lipsMat = new THREE.MeshLambertMaterial({
    color: 0x994C00 ,
  });
  var lips = new THREE.Mesh(lipsGeom, lipsMat);
  lips.position.x = 65;
  lips.position.y = -47;
  lips.rotation.z = Math.PI/2;

  // shell 
  var shellGeom = new THREE.BoxGeometry(250, 250, 200);
  var shellMat = new THREE.MeshLambertMaterial({
    color: 0x663300 ,
  });
  var shell = new THREE.Mesh(shellGeom, shellMat);
  shell.position.x = -185;
  shell.position.y = 65;
  shell.position.z = 0;

  // tail 
  var tailGeom = new THREE.BoxGeometry(80, 80, 80);
  var tailMat = new THREE.MeshLambertMaterial({
    color: 0xCC6600 ,
  });
  var tail = new THREE.Mesh(tailGeom, tailMat);
  tail.position.x = -350;
  tail.position.y = -20;
  tail.position.z = 0;

  // eyes body
  var eyeLinesGeom = new THREE.BoxGeometry(10, 150, 10);
  var eyeLinesMat = new THREE.MeshLambertMaterial({
    color: 0xCC6600 ,
  });
  eyeLineLeft = new THREE.Mesh(eyeLinesGeom, eyeLinesMat);
  eyeLineRight = new THREE.Mesh(eyeLinesGeom, eyeLinesMat);

  eyeLineLeft.position.x = 50;
  eyeLineLeft.position.y = 80;
  eyeLineLeft.position.z = 20;

  eyeLineRight.position.x = 50;
  eyeLineRight.position.y = 80;
  eyeLineRight.position.z = -20;
  
  // Eyes
  var eyeGeom = new THREE.BoxGeometry(40, 40, 40);
  var eyeMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
  });

  var irisGeom = new THREE.BoxGeometry(10, 10, 10);
  var irisMat = new THREE.MeshLambertMaterial({
    color: 0x330000,
  });
  
  var rightEye = new THREE.Mesh(eyeGeom,eyeMat );
  rightEye.position.y = 80;
  rightEye.position.z = -5;
  
  var leftEye = new THREE.Mesh(eyeGeom,eyeMat );
  leftEye.position.y = 80;
  leftEye.position.z = 5;

  rightIris = new THREE.Mesh(irisGeom,irisMat );
  rightIris.position.x = 20;
  
  leftIris = new THREE.Mesh(irisGeom,irisMat );
  leftIris.position.x = 20;
    
  var toothGeom = new THREE.BoxGeometry(20, 4, 20);
  var toothMat = new THREE.MeshLambertMaterial({
    color: 0xffffff,
  });
  
  // Teeth
  var tooth1 = new THREE.Mesh(toothGeom,toothMat);
  tooth1.position.x = 65;
  tooth1.position.y = -35;
  tooth1.position.z = -50;
  tooth1.rotation.z = Math.PI/2;
  tooth1.rotation.x = -Math.PI/2;
  
  var tooth2 = new THREE.Mesh(toothGeom,toothMat);
  tooth2.position.x = 65;
  tooth2.position.y = -30;
  tooth2.position.z = -25;
  tooth2.rotation.z = Math.PI/2;
  tooth2.rotation.x = -Math.PI/12;
  
  var tooth3 = new THREE.Mesh(toothGeom,toothMat);
  tooth3.position.x = 65;
  tooth3.position.y = -25;
  tooth3.position.z = 0;
  tooth3.rotation.z = Math.PI/2;
  
  var tooth4 = new THREE.Mesh(toothGeom,toothMat);
  tooth4.position.x = 65;
  tooth4.position.y = -30;
  tooth4.position.z = 25;
  tooth4.rotation.z = Math.PI/2;
  tooth4.rotation.x = Math.PI/12;
  
  var tooth5 = new THREE.Mesh(toothGeom,toothMat);
  tooth5.position.x = 65;
  tooth5.position.y = -35;
  tooth5.position.z = 50;
  tooth5.rotation.z = Math.PI/2;
  tooth5.rotation.x = Math.PI/8;  
  
  snail.add(body);
  snail.add(tooth1);
  snail.add(tooth2);
  snail.add(tooth3);
  snail.add(tooth4);
  snail.add(tooth5);
  snail.add(lips);

  snail.add(eyeLineRight);

  snail.add(eyeLineLeft);

  snail.add(shell);
  snail.add(tail);

  eyeLineRight.add(rightEye); rightEye.add(rightIris);
  eyeLineLeft.add(leftEye); leftEye.add(leftIris);

  snail.traverse( function ( object ) {
    if ( object instanceof THREE.Mesh ) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  } );
  
  snail.rotation.y = -Math.PI/4;
  scene.add(snail);
}

function createGrass(){
  var grass = new THREE.Group();
  
  // terrain 
  var terrainGeom = new THREE.BoxGeometry(850, 20, 600);
  var terrainMat = new THREE.MeshLambertMaterial({
    color: 0x006600 ,
  });
  var terrain = new THREE.Mesh(terrainGeom, terrainMat);
  terrain.position.x = -150;
  terrain.position.y = -85;

  var gressGeom = new THREE.BoxGeometry(4, 80, 20);
  var gressMat = new THREE.MeshLambertMaterial({
    color: 0x003300,
  });
  
  // grass
  var grass1 = new THREE.Mesh(gressGeom,gressMat);
  grass1.position.x = 200;
  grass1.position.y = -40;
  grass1.position.z = -150;
  
  var grass2 = new THREE.Mesh(gressGeom,gressMat);
  grass2.position.x = 208;
  grass2.position.y = -50;
  grass2.position.z = -160;
  
  var grass3 = new THREE.Mesh(gressGeom,gressMat);
  grass3.position.x = 40;
  grass3.position.y = -40;
  grass3.position.z = 160;
  
  var grass4 = new THREE.Mesh(gressGeom,gressMat);
  grass4.position.x = 48;
  grass4.position.y = -50;
  grass4.position.z = 170;
  
  grass.add(terrain);
  grass.add(grass1);
  grass.add(grass2);
  grass.add(grass3);
  grass.add(grass4);

  grass.traverse( function ( object ) {
    if ( object instanceof THREE.Mesh ) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  } );
  
  grass.rotation.y = -Math.PI/4;
  scene.add(grass);
}

init();
createLights();
createSnail();
createGrass();
loop();