import { useRef, useState, useCallback, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows } from "@react-three/drei";
import * as THREE from "three";

function RingModel({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const { scene } = useGLTF("/models/ring.glb");
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });

  // Apply a gold metallic material to all meshes
  const clonedScene = scene.clone();
  clonedScene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xd4af37),
        metalness: 0.95,
        roughness: 0.15,
        envMapIntensity: 1.5,
      });
    }
  });

  useFrame(() => {
    if (!groupRef.current) return;
    targetRotation.current.x = mousePosition.y * 0.26;
    targetRotation.current.y = mousePosition.x * 0.26;

    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotation.current.x,
      0.06
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotation.current.y,
      0.06
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

  useFrame(() => {
    if (!groupRef.current) return;
    targetRotation.current.x = mousePosition.y * 0.26;
    targetRotation.current.y = mousePosition.x * 0.26;
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

function Scene({ mousePosition }: { mousePosition: { x: number; y: number } }) {
  const [hasError, setHasError] = useState(false);

  return (
    <>
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

  const handleMouseLeave = useCallback(() => {
    setMouse({ x: 0, y: 0 });
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="w-full h-48 sm:h-56"
    >
      <Canvas
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        style={{ background: "transparent" }}
        camera={{ fov: 35, near: 0.1, far: 100, position: [0, 1.5, 5] }}
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
