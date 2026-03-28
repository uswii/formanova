import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Classification patterns — same as the standalone GLB previewer
const gemRe =
  /diamond|gem|stone|crystal|jewel|brill|ruby|emerald|sapphire|topaz|opal|garnet|amethyst|pearl|cz|cubic|solitaire|pave|prong_stone|accent_stone|center_stone|main_stone/i;
const metalRe =
  /band|ring|shank|prong|setting|mount|bezel|basket|gallery|shoulder|bridge|head|collet|metal|gold|silver|platinum|frame|base/i;

function greenMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x77dd77,
    metalness: 0,
    roughness: 0.8,
    flatShading: true,
  });
}

function blueMat() {
  return new THREE.MeshStandardMaterial({
    color: 0x4a90d9,
    metalness: 0,
    roughness: 0.6,
    flatShading: true,
  });
}

function classify(mesh: THREE.Mesh) {
  const n = mesh.name || "";
  const m = mesh.material as THREE.MeshPhysicalMaterial | null;
  let gem = false;
  if (gemRe.test(n)) gem = true;
  if (metalRe.test(n)) gem = false;
  if (!gemRe.test(n) && !metalRe.test(n) && m) {
    if ((m as any).transmission > 0.5) gem = true;
    if ((m as any).ior > 2.0) gem = true;
  }
  const mat = gem ? blueMat() : greenMat();
  mesh.material = mat;
}

interface CADSandboxCanvasProps {
  hasModel: boolean;
  glbUrl?: string;
}

export default function CADSandboxCanvas({ hasModel, glbUrl }: CADSandboxCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const grpRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animIdRef = useRef<number>(0);

  // Set up renderer, scene, lighting, shadow plane — once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);
    sceneRef.current = scene;

    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    const camera = new THREE.PerspectiveCamera(28, w / h, 0.1, 100);
    camera.position.set(0, 0, 5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const grp = new THREE.Group();
    scene.add(grp);
    grpRef.current = grp;

    // Lighting
    const L1 = new THREE.DirectionalLight(0xffffff, 2);
    L1.position.set(3, 5, 3);
    scene.add(L1);
    const L2 = new THREE.DirectionalLight(0xffffff, 1);
    L2.position.set(-3, 2, -3);
    scene.add(L2);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));

    const sL = new THREE.DirectionalLight(0xffffff, 0.5);
    sL.position.set(0, 10, 0);
    sL.castShadow = true;
    sL.shadow.mapSize.set(1024, 1024);
    sL.shadow.camera.near = 0.1;
    sL.shadow.camera.far = 20;
    sL.shadow.camera.left = -3;
    sL.shadow.camera.right = 3;
    sL.shadow.camera.top = 3;
    sL.shadow.camera.bottom = -3;
    sL.shadow.bias = -0.003;
    sL.shadow.radius = 8;
    scene.add(sL);

    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.06 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.3;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Animate — slow auto-rotate, no orbit controls
    const animate = () => {
      animIdRef.current = requestAnimationFrame(animate);
      grp.rotation.y += 0.005;
      renderer.render(scene, camera);
    };
    animate();

    // Resize observer
    const ro = new ResizeObserver(() => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animIdRef.current);
      ro.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Load / reload model when glbUrl changes
  useEffect(() => {
    const grp = grpRef.current;
    if (!grp) return;

    // Clear previous model
    while (grp.children.length) grp.remove(grp.children[0]);

    if (!hasModel || !glbUrl) return;

    new GLTFLoader().load(glbUrl, (gltf) => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      model.position.sub(center);
      model.scale.setScalar(2.2 / Math.max(size.x, size.y, size.z));
      model.traverse((ch) => {
        if ((ch as THREE.Mesh).isMesh && (ch as THREE.Mesh).geometry) {
          (ch as THREE.Mesh).castShadow = true;
          classify(ch as THREE.Mesh);
        }
      });
      grp.add(model);
    });
  }, [hasModel, glbUrl]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ backgroundColor: "#ffffff" }}
    />
  );
}
