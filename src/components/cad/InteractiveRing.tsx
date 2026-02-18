import { useRef, useState, useCallback, useEffect, useMemo, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

// Premium material definitions
const goldMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0xd4a017),
  metalness: 1.0,
  roughness: 0.18,
  envMapIntensity: 2.0,
  clearcoat: 0.4,
  clearcoatRoughness: 0.1,
  reflectivity: 1.0,
});

const blackDiamondMaterial = new THREE.MeshPhysicalMaterial({
  color: new THREE.Color(0x0a0a0a),
  metalness: 0.3,
  roughness: 0.05,
  envMapIntensity: 3.0,
  clearcoat: 1.0,
  clearcoatRoughness: 0.02,
  reflectivity: 1.0,
  ior: 2.42,
  transmission: 0.15,
  thickness: 0.5,
  sheen: 0.8,
  sheenRoughness: 0.2,
  sheenColor: new THREE.Color(0x333344),
});

function RingModel({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const { scene } = useGLTF("/models/ring.glb");
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  // Clone and apply custom materials per mesh name
  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const name = mesh.name.toLowerCase();
        if (name.includes("circle")) {
          mesh.material = goldMaterial;
        } else if (name.includes("round")) {
          mesh.material = blackDiamondMaterial;
        }
      }
    });
    return clone;
  }, [scene]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const idleX = Math.sin(t * 0.4) * 0.08;
    const idleY = t * 0.15 + Math.cos(t * 0.3) * 0.05;

    targetRotation.current.x = mousePosition.y * 0.6 + idleX;
    targetRotation.current.y = mousePosition.x * 0.6 + idleY;

    groupRef.current.position.y = Math.sin(t * 0.6) * 0.15;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotation.current.x,
      0.12
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotation.current.y,
      0.12
    );
  });

  return (
    <group ref={groupRef}>
      <primitive object={clonedScene} scale={8} position={[0, 0, 0]} />
    </group>
  );
}

function FallbackRing({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    const idleX = Math.sin(t * 0.4) * 0.08;
    const idleY = t * 0.15 + Math.cos(t * 0.3) * 0.05;
    targetRotation.current.x = mousePosition.y * 0.26 + idleX;
    targetRotation.current.y = mousePosition.x * 0.26 + idleY;
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotation.current.x, 0.06);
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation.current.y, 0.06);
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <torusGeometry args={[1, 0.35, 32, 64]} />
        <meshStandardMaterial color={0xd4af37} metalness={0.95} roughness={0.15} envMapIntensity={1.5} />
      </mesh>
    </group>
  );
}

// Pauses the render loop when the document is hidden (tab switch / navigation)
function VisibilityController() {
  const { gl } = useThree();
  const state = useThree();

  useEffect(() => {
    const handle = () => {
      if (document.hidden) {
        gl.setAnimationLoop(null); // stop render loop
      } else {
        gl.setAnimationLoop(() => state.advance(performance.now())); // restart
      }
    };
    document.addEventListener("visibilitychange", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      gl.setAnimationLoop(null); // cleanup on unmount
    };
  }, [gl, state]);

  return null;
}

function Scene({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const [hasError, setHasError] = useState(false);

  return (
    <>
      <VisibilityController />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#fffaf0" />
      <directionalLight position={[-3, 3, -3]} intensity={0.6} color="#e8dcc8" />
      <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />
      <Environment preset="studio" />
      {hasError ? (
        <FallbackRing mousePosition={mousePosition} />
      ) : (
        <ErrorBoundary3D onError={() => setHasError(true)}>
          <RingModel mousePosition={mousePosition} />
        </ErrorBoundary3D>
      )}
      <ContactShadows position={[0, -1.2, 0]} opacity={0.25} scale={6} blur={2.5} />
    </>
  );
}

// Simple error boundary for 3D content
function ErrorBoundary3D({ children, onError }: { children: React.ReactNode; onError: () => void }) {
  try {
    return <>{children}</>;
  } catch {
    onError();
    return null;
  }
}

export default function InteractiveRing() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    setMouse({ x, y });
  }, []);

  // Also react to scroll position
  const handleScroll = useCallback(() => {
    const scrollY = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const normalized = maxScroll > 0 ? (scrollY / maxScroll) * 2 - 1 : 0;
    setMouse((prev) => ({ ...prev, y: normalized * 0.5 }));
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMouse({ x: 0, y: 0 })}
      className="w-full h-full"
    >
      <Canvas
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        style={{ background: "transparent" }}
        camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1, 4] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          <Scene mousePosition={mouse} />
        </Suspense>
      </Canvas>
    </div>
  );
}

useGLTF.preload("/models/ring.glb");
