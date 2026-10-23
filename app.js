// --- INITIALISATION AF SCENE & KAMERA ---
const container = document.getElementById('viewport-container');
const canvas = document.getElementById('canvas3d');

const scene = new THREE.Scene();
// Mørkere pastelblå baggrund så designet står helt skarpt
scene.background = new THREE.Color(0xa0c4ff);

const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
camera.position.set(0, -45, 85);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const controls = new THREE.OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.65);
dirLight.position.set(30, -30, 60);
scene.add(dirLight);

let beadGroup = null;
let loadedFont = null;

// Indlæs font
const loader = new THREE.FontLoader();
loader.load('https://threejs.org/examples/fonts/helvetiker_bold.typeface.json', (font) => {
  loadedFont = font;
  document.getElementById('statusInfo').innerText = "Klar";
  generateLetterBeads();
});

function generateLetterBeads() {
  if (!loadedFont) return;

  const rawText = document.getElementById('textInput').value.trim() || 'NAVN';
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
    roughness: 0.35,
    metalness: 0.05,
    side: THREE.DoubleSide
  });

  // Mørkere nuance til den indvendige hule tunnel for høj kontrast i 3D
  const innerTunnelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.6,
    side: THREE.BackSide
  });

  let currentX = 0;
  const spacing = size * 1.25;

  letters.forEach((char) => {
    const charGroup = new THREE.Group();
    const shapes = loadedFont.generateShapes(char, size);

    shapes.forEach((shape) => {
      const extrudeSettings = {
        depth: depth,
        curveSegments: 12,
        bevelEnabled: bevel > 0,
        bevelThickness: bevel,
        bevelSize: bevel * 0.8,
        bevelSegments: 4
      };

      const fullGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      fullGeo.computeBoundingBox();
      const bbox = fullGeo.boundingBox;
      const charWidth = bbox.max.x - bbox.min.x;
      const charHeight = bbox.max.y - bbox.min.y;

      const halfHole = holeDiam / 2;
      const holeYCenter = holePosY;

      // 1. TOP-DEL AF BOGSTAVET (Klippes ved toppen af hullet)
      const topGeo = fullGeo.clone();
      topGeo.translate(-charWidth / 2 - bbox.min.x, -charHeight / 2 - bbox.min.y, -depth / 2);
      const topPos = topGeo.attributes.position;
      for (let i = 0; i < topPos.count; i++) {
        if (topPos.getY(i) < holeYCenter + halfHole) {
          topPos.setY(i, holeYCenter + halfHole);
        }
      }
      topGeo.computeVertexNormals();
      const topMesh = new THREE.Mesh(topGeo, mat);
      charGroup.add(topMesh);

      // 2. BUND-DEL AF BOGSTAVET (Klippes ved bunden af hullet)
      const botGeo = fullGeo.clone();
      botGeo.translate(-charWidth / 2 - bbox.min.x, -charHeight / 2 - bbox.min.y, -depth / 2);
      const botPos = botGeo.attributes.position;
      for (let i = 0; i < botPos.count; i++) {
        if (botPos.getY(i) > holeYCenter - halfHole) {
          botPos.setY(i, holeYCenter - halfHole);
        }
      }
      botGeo.computeVertexNormals();
      const botMesh = new THREE.Mesh(botGeo, mat);
      charGroup.add(botMesh);

      // 3. INDVENDIG CYLINDRISK TUNNEL (Udgør væggen i snørehullet)
      if (holeDiam > 0) {
        const tunnelLength = charWidth + 2;
        const tunnelGeo = new THREE.CylinderGeometry(halfHole, halfHole, tunnelLength, 32, 1, true);
        tunnelGeo.rotateZ(Math.PI / 2);
        tunnelGeo.translate(0, holeYCenter, 0);

        const tunnelMesh = new THREE.Mesh(tunnelGeo, innerTunnelMat);
        charGroup.add(tunnelMesh);
      }
    });

    charGroup.position.x = currentX;
    currentX += spacing;
    beadGroup.add(charGroup);
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
  const filename = (document.getElementById('textInput').value.trim() || 'NAVN') + '_3d.stl';

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
