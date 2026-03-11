/**
 * ScissorGLBGrid — Single-canvas scissor-test renderer for multiple GLB previews.
 *
 * Architecture:
 * - One shared <canvas> covers the grid container
 * - Each GLB card registers a placeholder <div> ref
 * - On each frame, we iterate visible placeholders, set gl.viewport/scissor, swap camera, and render
 * - Per-card OrbitControls for interaction
 * - LRU cache for parsed GLTF scenes (max 20)
 *
 * This avoids the browser's ~8-16 WebGL context limit.
 */

import React, {
  createContext,
  useContext,
  useRef,
  useEffect,
  useCallback,
  useState,
  useMemo,
} from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three-stdlib';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Box } from 'lucide-react';

// ── LRU GLB Cache ────────────────────────────────────────────────────
const MAX_CACHE = 20;

interface CachedModel {
  scene: THREE.Group;
  lastUsed: number;
}

const glbCache = new Map<string, CachedModel>();
const glbLoading = new Map<string, Promise<THREE.Group>>();
const glbErrors = new Set<string>(); // Track permanently failed URLs

function getCachedScene(url: string): THREE.Group | null {
  const entry = glbCache.get(url);
  if (entry) {
    entry.lastUsed = Date.now();
    return entry.scene.clone(true);
  }
  return null;
}

function cacheScene(url: string, scene: THREE.Group) {
  if (glbCache.size >= MAX_CACHE) {
    // Evict least recently used
    let oldestKey = '';
    let oldestTime = Infinity;
    for (const [key, val] of glbCache) {
      if (val.lastUsed < oldestTime) {
        oldestTime = val.lastUsed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const evicted = glbCache.get(oldestKey);
      if (evicted) disposeScene(evicted.scene);
      glbCache.delete(oldestKey);
    }
  }
  glbCache.set(url, { scene: scene.clone(true), lastUsed: Date.now() });
}

function disposeScene(obj: THREE.Object3D) {
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => m?.dispose());
    }
  });
}

// ── Card registration ────────────────────────────────────────────────

interface CardEntry {
  id: string;
  glbUrl: string;
  divRef: HTMLDivElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  loaded: boolean;
  loading: boolean;
  error: boolean;
}

interface GridContextValue {
  registerCard: (id: string, glbUrl: string, div: HTMLDivElement) => void;
  unregisterCard: (id: string) => void;
  isLoading: (id: string) => boolean;
  isLoaded: (id: string) => boolean;
  hasError: (id: string) => boolean;
}

const GridContext = createContext<GridContextValue | null>(null);

export function useScissorGrid() {
  const ctx = useContext(GridContext);
  if (!ctx) throw new Error('useScissorGrid must be used within ScissorGLBGrid');
  return ctx;
}

// ── Provider + Canvas ────────────────────────────────────────────────

interface ScissorGLBGridProps {
  children: React.ReactNode;
}

export function ScissorGLBGrid({ children }: ScissorGLBGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cardsRef = useRef<Map<string, CardEntry>>(new Map());
  const rafRef = useRef<number>(0);
  const envMapRef = useRef<THREE.Texture | null>(null);
  const gltfLoaderRef = useRef(new GLTFLoader());
  const [tick, forceUpdate] = useState(0);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current = renderer;

    // Preload HDRI environment
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load('/hdri/jewelry-studio-v2.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      envMapRef.current = texture;
      // Apply to all existing card scenes
      for (const card of cardsRef.current.values()) {
        card.scene.environment = texture;
      }
    });

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      envMapRef.current?.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    let running = true;

    function render() {
      if (!running || !renderer) return;
      rafRef.current = requestAnimationFrame(render);

      const container = containerRef.current;
      if (!container) return;

      const canvas = renderer.domElement;
      const containerRect = container.getBoundingClientRect();

      // Resize canvas to match container
      const width = containerRect.width;
      const height = containerRect.height;
      if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) ||
          canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
      }

      renderer.setScissorTest(true);
      renderer.setClearColor(0x000000, 0);

      // Clear entire canvas
      renderer.setViewport(0, 0, width, height);
      renderer.setScissor(0, 0, width, height);
      renderer.clear();

      for (const card of cardsRef.current.values()) {
        if (!card.loaded || !card.divRef) continue;

        const rect = card.divRef.getBoundingClientRect();

        // Skip if not visible
        if (
          rect.bottom < containerRect.top ||
          rect.top > containerRect.bottom ||
          rect.right < containerRect.left ||
          rect.left > containerRect.right ||
          rect.width <= 0 ||
          rect.height <= 0
        ) continue;

        // Compute position relative to container
        const x = rect.left - containerRect.left;
        const y = containerRect.height - (rect.top - containerRect.top) - rect.height;
        const w = rect.width;
        const h = rect.height;

        renderer.setViewport(x, y, w, h);
        renderer.setScissor(x, y, w, h);

        card.camera.aspect = w / h;
        card.camera.updateProjectionMatrix();
        card.controls.update();

        renderer.render(card.scene, card.camera);
      }

      renderer.setScissorTest(false);
    }

    render();

    return () => { running = false; };
  }, []);

  // Load a GLB for a card — route through blob-proxy to avoid CORS
  const loadGlb = useCallback((card: CardEntry) => {
    if (card.loading || card.loaded || card.error) return;
    if (glbErrors.has(card.glbUrl)) {
      card.error = true;
      forceUpdate((n) => n + 1);
      return;
    }
    card.loading = true;
    console.log('[ScissorGLBGrid] Starting GLB load:', card.glbUrl);
    forceUpdate((n) => n + 1);
    const cached = getCachedScene(card.glbUrl);
    if (cached) {
      setupCardScene(card, cached);
      return;
    }

    // Deduplicate in-flight requests
    let promise = glbLoading.get(card.glbUrl);
    if (!promise) {
      promise = (async () => {
        // Fetch GLB binary via blob-proxy edge function to bypass CORS
        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/blob-proxy`;
        const resp = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ url: card.glbUrl }),
        });
        if (!resp.ok) throw new Error(`Proxy returned ${resp.status}`);
        const arrayBuffer = await resp.arrayBuffer();

        // Parse GLB from arraybuffer
        return new Promise<THREE.Group>((resolve, reject) => {
          gltfLoaderRef.current.parse(
            arrayBuffer,
            '',
            (gltf) => {
              cacheScene(card.glbUrl, gltf.scene);
              resolve(gltf.scene.clone(true));
            },
            reject,
          );
        });
      })();
      glbLoading.set(card.glbUrl, promise);
      promise.finally(() => glbLoading.delete(card.glbUrl));
    }

    promise.then((scene) => {
      console.log('[ScissorGLBGrid] GLB loaded successfully:', card.glbUrl);
      setupCardScene(card, scene.clone(true));
    }).catch((err) => {
      console.error('[ScissorGLBGrid] GLB load failed:', card.glbUrl, err);
      card.loading = false;
      card.error = true;
      glbErrors.add(card.glbUrl);
      forceUpdate((n) => n + 1);
    });
  }, []);

  const setupCardScene = useCallback((card: CardEntry, model: THREE.Group) => {
    // Normalize scale — fit model in a 3-unit bounding sphere
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 3 / maxDim;

    model.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    model.scale.setScalar(scale);

    // Apply default metallic material for nice preview
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        // Keep original materials — they usually look good
        if (mesh.material) {
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => {
            if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
              (m as THREE.MeshStandardMaterial).envMapIntensity = 1.2;
            }
          });
        }
      }
    });

    card.scene.add(model);

    if (envMapRef.current) {
      card.scene.environment = envMapRef.current;
    }

    card.loaded = true;
    card.loading = false;
    forceUpdate((n) => n + 1);
  }, []);

  const registerCard = useCallback((id: string, glbUrl: string, div: HTMLDivElement) => {
    if (cardsRef.current.has(id)) return;

    const renderer = rendererRef.current;
    if (!renderer) return;

    const scene = new THREE.Scene();

    // Add ambient + directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    if (envMapRef.current) {
      scene.environment = envMapRef.current;
    }

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    camera.position.set(0, 1.5, 6);
    camera.lookAt(0, 0, 0);

    const controls = new OrbitControls(camera, div);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 2;
    controls.maxDistance = 15;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.5;

    const entry: CardEntry = {
      id,
      glbUrl,
      divRef: div,
      scene,
      camera,
      controls,
      loaded: false,
      loading: false,
      error: false,
    };

    cardsRef.current.set(id, entry);
    loadGlb(entry);
  }, [loadGlb]);

  const unregisterCard = useCallback((id: string) => {
    const card = cardsRef.current.get(id);
    if (card) {
      card.controls.dispose();
      disposeScene(card.scene);
      cardsRef.current.delete(id);
    }
  }, []);

  const isLoading = useCallback((id: string) => {
    const card = cardsRef.current.get(id);
    return card ? card.loading : false;
  }, []);

  const isLoaded = useCallback((id: string) => {
    const card = cardsRef.current.get(id);
    return card ? card.loaded : false;
  }, []);

  const hasError = useCallback((id: string) => {
    const card = cardsRef.current.get(id);
    return card ? card.error : false;
  }, []);

  const ctxValue = useMemo<GridContextValue>(() => ({
    registerCard,
    unregisterCard,
    isLoading,
    isLoaded,
    hasError,
  }), [registerCard, unregisterCard, isLoading, isLoaded, hasError, tick]);

  return (
    <GridContext.Provider value={ctxValue}>
      <div ref={containerRef} className="relative">
        {/* Shared WebGL canvas — sits behind all cards */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ zIndex: 0 }}
        />
        {/* Card placeholders rendered on top */}
        <div className="relative" style={{ zIndex: 1 }}>
          {children}
        </div>
      </div>
    </GridContext.Provider>
  );
}

// ── GLB Preview Placeholder ──────────────────────────────────────────
// This is the div each card renders. It registers with the grid context
// so the shared canvas can render into its bounds.

interface GLBPreviewSlotProps {
  id: string;
  glbUrl: string;
  className?: string;
}

export function GLBPreviewSlot({ id, glbUrl, className = '' }: GLBPreviewSlotProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const { registerCard, unregisterCard, isLoaded, hasError } = useScissorGrid();
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    const div = divRef.current;
    if (!div || !glbUrl) return;

    registerCard(id, glbUrl, div);
    setRegistered(true);

    return () => {
      unregisterCard(id);
      setRegistered(false);
    };
  }, [id, glbUrl, registerCard, unregisterCard]);

  const loaded = registered && isLoaded(id);
  const errored = registered && hasError(id);

  return (
    <div
      ref={divRef}
      className={`relative ${className}`}
      style={{ touchAction: 'none' }}
    >
      {/* Loading state */}
      {!loaded && !errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-2">
            <div className="w-5 h-5 border-2 border-foreground/20 border-t-foreground/60 rounded-full animate-spin" />
            <span className="font-mono text-[8px] tracking-[0.2em] text-muted-foreground uppercase">
              Loading 3D
            </span>
          </div>
        </div>
      )}
      {/* Error fallback */}
      {errored && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
          <div className="flex flex-col items-center gap-1.5">
            <Box className="h-5 w-5 text-muted-foreground/40" />
            <span className="font-mono text-[8px] tracking-[0.2em] text-muted-foreground/60 uppercase">
              Preview unavailable
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
