import { useRef, useState, useCallback, Suspense, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Environment, ContactShadows, OrbitControls } from "@react-three/drei";
import * as THREE from "three";

function RingModel({
  mousePosition,
  autoRotate,
}: {
  mousePosition: { x: number; y: number };
  autoRotate: boolean;
}) {
  const { scene } = useGLTF("/models/ring.glb");
  const groupRef = useRef<THREE.Group>(null);
  const targetRotation = useRef({ x: 0, y: 0 });
  const autoAngle = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (autoRotate) {
      autoAngle.current += delta * 0.3;
      groupRef.current.rotation.y = autoAngle.current;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, 0.15, 0.04);
    } else {
      targetRotation.current.x = mousePosition.y * 0.3;
      targetRotation.current.y = mousePosition.x * 0.3;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotation.current.x, 0.06);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation.current.y, 0.06);
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={scene.clone()} scale={10} position={[0, 0, 0]} />
    </group>
  );
}

interface CADViewportProps {
  isGenerating: boolean;
  hasModel: boolean;
  progress: number;
  progressStep: string;
}

export default function CADViewport({ isGenerating, hasModel, progress, progressStep }: CADViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    setMouse({ x, y });
  }, []);

  const handleMouseLeave = useCallback(() => setMouse({ x: 0, y: 0 }), []);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full h-full bg-background"
    >
      {/* 3D Canvas */}
      <Canvas
        gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
        style={{ background: "transparent" }}
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 1.5, 6] }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 5, 5]} intensity={1.6} color="#fffaf0" />
          <directionalLight position={[-3, 3, -3]} intensity={0.5} color="#e8dcc8" />
          <spotLight position={[0, 8, 0]} intensity={0.8} angle={0.5} penumbra={1} color="#fff5e6" />
          <Environment preset="studio" />
          {hasModel && <RingModel mousePosition={mouse} autoRotate={!hasModel} />}
          <ContactShadows position={[0, -1.4, 0]} opacity={0.2} scale={8} blur={2.5} />
          <OrbitControls enablePan={false} enableZoom={true} minDistance={3} maxDistance={12} />
        </Suspense>
      </Canvas>

      {/* Loading overlay */}
      {isGenerating && (
        <div className="absolute inset-0 bg-background/90 backdrop-blur-xl flex items-center justify-center z-20">
          <div className="w-[360px] text-center">
            <div className="text-5xl font-black tracking-tighter text-primary mb-2">{progress}%</div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground tracking-wide uppercase">{progressStep}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasModel && !isGenerating && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full border border-border/50 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-2.25-1.313M21 7.5v2.25m0-2.25l-2.25 1.313M3 7.5l2.25-1.313M3 7.5l2.25 1.313M3 7.5v2.25m9 3l2.25-1.313M12 12.75l-2.25-1.313M12 12.75V15m0 6.75l2.25-1.313M12 21.75V15m0 0l-2.25 1.313" />
              </svg>
            </div>
            <p className="text-muted-foreground/50 text-xs uppercase tracking-[3px]">
              Describe your ring to begin
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

useGLTF.preload("/models/ring.glb");
