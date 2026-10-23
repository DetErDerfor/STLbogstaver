// Initialization af Scene & Camera
const container = document.getElementById('viewport-container');
const canvas = document.getElementById('canvas3d');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xf3f4f6);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, -50, 80);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
dirLight.position.set(30, -30, 60);
scene.add(dirLight);

let beadGroup = null;
let loadedFont = null;
let manifoldModule = null;

// Hent Font og Initialize Manifold Wasm
Promise.all([
  new Promise((resolve) => {
    new THREE.FontLoader().load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
      loadedFont = font;
      resolve();
    });
  }),
  Module().then((mod) => {
    mod.setup();
    manifoldModule = mod;
    resolve();
  })
]).then(() => {
  document.getElementById('statusInfo').innerText = "Klar";
  generateLetterBeads();
});

function generateLetterBeads() {
  if (!loadedFont || !manifoldModule) return;

  const rawText = document.getElementById('textInput').value.trim() || 'T';
  const letters = rawText.toUpperCase().split('');
  const size = parseFloat(document.getElementById('sizeSlider').value);
  const depth = parseFloat(document.getElementById('depthSlider').value);
  const bevel = parseFloat(document.getElementById('bevelSlider').value);
  const holeDiam = parseFloat(document.getElementById('holeSlider').value);
  const holePosY = parseFloat(document.getElementById('holePosYSlider').value);
  const colorHex = parseInt(document.getElementById('colorSelect').value);

  document.getElementById('sizeVal').innerText = size + ' mm';
  document.getElementById('depthVal').innerText = depth + ' mm';
  document.getElementById('bevelVal').innerText = bevel + ' mm';
  document.getElementById('holeVal').innerText = holeDiam + ' mm';
  document.getElementById('holePosYVal').innerText = holePosY + ' mm';
  document.getElementById('letterCountInfo').innerText = letters.length;

  if (beadGroup) scene.remove(beadGroup);
  beadGroup = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: colorHex,
    roughness: 0.3,
    metalness: 0.1
  });

  let currentX = 0;
  const spacing = size * 1.25;

  letters.forEach((char) => {
    // 1. Opret Grundgeometri for Bogstavet
    const textGeo = new THREE.TextGeometry(char, {
      font: loadedFont,
      size: size,
      height: depth,
      curveSegments: 8,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel,
      bevelSize: bevel * 0.8,
      bevelSegments: 3
    });

    textGeo.computeBoundingBox();
    const bbox = textGeo.boundingBox;
    const charWidth = bbox.max.x - bbox.min.x;
    const charHeight = bbox.max.y - bbox.min.y;

    textGeo.translate(-charWidth / 2 - bbox.min.x, -charHeight / 2 - bbox.min.y, -depth / 2);
    
    // Konverter til BufferGeometry hvis nødvendigt
    const bufferGeo = textGeo.isBufferGeometry ? textGeo : new THREE.BufferGeometry().fromGeometry(textGeo);

    let finalMesh;

    if (holeDiam > 0) {
      try {
        // Opbyg cylinder til udskæring
        const holeLength = charWidth + 20;
        const holeGeo = new THREE.CylinderGeometry(holeDiam / 2, holeDiam / 2, holeLength, 24);
        holeGeo.rotateZ(Math.PI / 2);
        holeGeo.translate(0, holePosY, 0);

        // Konverter til Manifold Objekter
        const manifoldText = manifoldModule.Manifold.ofBufferGeometry(bufferGeo);
        const manifoldHole = manifoldModule.Manifold.ofBufferGeometry(holeGeo);

        // Eksekver 100% vandtæt subtration
        const resultManifold = manifoldModule.Manifold.difference(manifoldText, manifoldHole);

        // Konverter tilbage til Three.js Mesh
        const resultGeo = resultManifold.getBufferGeometry();
        finalMesh = new THREE.Mesh(resultGeo, mat);
      } catch (e) {
        console.warn("Manifold CSG fejlede, viser standard mesh:", e);
        finalMesh = new THREE.Mesh(bufferGeo, mat);
      }
    } else {
      finalMesh = new THREE.Mesh(bufferGeo, mat);
    }

    finalMesh.position.x = currentX;
    currentX += spacing;
    beadGroup.add(finalMesh);
  });

  const totalWidth = (letters.length - 1) * spacing;
  beadGroup.position.x = -totalWidth / 2;

  scene.add(beadGroup);
}

// Event Listeners
const inputs = ['textInput', 'sizeSlider', 'depthSlider', 'bevelSlider', 'holeSlider', 'holePosYSlider', 'colorSelect'];
inputs.forEach(id => {
  document.getElementById(id).addEventListener('input', generateLetterBeads);
});

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
});

// STL Export
document.getElementById('exportBtn').addEventListener('click', () => {
  if (!beadGroup) return;

  const exporter = new THREE.STLExporter();
  const result = exporter.parse(beadGroup, { binary: true });

  const blob = new Blob([result], { type: 'application/octet-stream' });
  const link = document.createElement('a');
  const filename = (document.getElementById('textInput').value.trim() || 'beads') + '_3d.stl';

  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
