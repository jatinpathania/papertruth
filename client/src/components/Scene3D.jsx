import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Billboard, Float, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

const PALETTES = {
  cool: { core: '#22e2f5', shell: '#c084fc', ring: '#7cf3ff', ring2: '#c084fc', ink: '#22e2f5', spark: '#9ff6ff', spark2: '#d8a8ff' },
  warm: { core: '#ffb020', shell: '#ff5c7a', ring: '#ffd27a', ring2: '#ff5c7a', ink: '#ffb020', spark: '#ffe2a0', spark2: '#ff9bb0' },
  mint: { core: '#34e7a8', shell: '#22e2f5', ring: '#a7ffe0', ring2: '#7cf3ff', ink: '#34e7a8', spark: '#c8fff0', spark2: '#9ff6ff' }
};

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeSheetTexture(ink, seed) {
  const rand = seeded(seed * 7919 + 13);
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  const r = 16;
  g.scale(0.75, 0.753);
  g.beginPath();
  g.moveTo(r, 0);
  g.arcTo(256, 0, 256, 340, r);
  g.arcTo(256, 340, 0, 340, r);
  g.arcTo(0, 340, 0, 0, r);
  g.arcTo(0, 0, 256, 0, r);
  g.closePath();
  const bg = g.createLinearGradient(0, 0, 256, 340);
  bg.addColorStop(0, 'rgba(26, 38, 58, 0.96)');
  bg.addColorStop(1, 'rgba(9, 14, 24, 0.96)');
  g.fillStyle = bg;
  g.fill();
  g.lineWidth = 3;
  g.strokeStyle = ink;
  g.globalAlpha = 0.7;
  g.stroke();
  g.globalAlpha = 1;

  g.fillStyle = ink;
  g.globalAlpha = 0.9;
  g.fillRect(26, 26, 110, 12);
  g.globalAlpha = 0.35;
  g.fillRect(26, 46, 70, 7);
  g.globalAlpha = 1;

  for (let row = 0; row < 8; row += 1) {
    const y = 88 + row * 30;
    g.globalAlpha = 0.35;
    g.fillStyle = '#9aabc7';
    g.fillRect(26, y - 3, 18, 6);
    const pick = Math.floor(rand() * 4);
    for (let option = 0; option < 4; option += 1) {
      const x = 80 + option * 40;
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      if (option === pick) {
        g.globalAlpha = 1;
        g.fillStyle = ink;
        g.fill();
      } else {
        g.globalAlpha = 0.45;
        g.lineWidth = 2;
        g.strokeStyle = '#9aabc7';
        g.stroke();
      }
    }
  }
  g.globalAlpha = 1;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

function makeGlowTexture(color) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const g = canvas.getContext('2d');
  g.scale(0.75, 0.75);
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  const c = new THREE.Color(color);
  const rgb = `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
  grad.addColorStop(0, `rgba(${rgb}, 0.9)`);
  grad.addColorStop(0.25, `rgba(${rgb}, 0.35)`);
  grad.addColorStop(0.6, `rgba(${rgb}, 0.08)`);
  grad.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Crystal({ palette }) {
  const core = useRef(null);
  const shell = useRef(null);
  const glow = useMemo(() => makeGlowTexture(palette.core), [palette.core]);
  useEffect(() => () => glow.dispose(), [glow]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (core.current) {
      core.current.rotation.y += delta * 0.35;
      core.current.rotation.x = Math.sin(t * 0.4) * 0.25;
    }
    if (shell.current) {
      shell.current.rotation.y -= delta * 0.18;
      shell.current.rotation.z += delta * 0.08;
      const s = 1.38 + Math.sin(t * 1.3) * 0.03;
      shell.current.scale.setScalar(s);
    }
  });

  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.6}>
      <Billboard>
        <mesh renderOrder={-1}>
          <planeGeometry args={[6.5, 6.5]} />
          <meshBasicMaterial map={glow} transparent depthWrite={false} blending={THREE.AdditiveBlending} opacity={0.85} />
        </mesh>
      </Billboard>
      <mesh ref={core}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color={palette.core}
          emissive={palette.core}
          emissiveIntensity={0.55}
          metalness={0.55}
          roughness={0.18}
          flatShading
        />
      </mesh>
      <mesh ref={shell}>
        <icosahedronGeometry args={[1, 1]} />
        <meshBasicMaterial color={palette.shell} wireframe transparent opacity={0.4} />
      </mesh>
    </Float>
  );
}

function Orbit({ radius, tilt, speed, color, satellites = 2, thickness = 0.012 }) {
  const group = useRef(null);
  useFrame((_state, delta) => {
    if (group.current) group.current.rotation.z += delta * speed;
  });
  return (
    <group rotation={tilt}>
      <mesh>
        <torusGeometry args={[radius, thickness, 8, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
      <group ref={group}>
        {Array.from({ length: satellites }, (_, i) => {
          const a = (i / satellites) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * radius, Math.sin(a) * radius, 0]}>
              <sphereGeometry args={[0.07, 10, 10]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          );
        })}
      </group>
    </group>
  );
}

function Sheet({ texture, position, rotation, speed }) {
  const ref = useRef(null);
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime * speed;
    ref.current.rotation.y = rotation[1] + Math.sin(t) * 0.35;
    ref.current.rotation.x = rotation[0] + Math.cos(t * 0.8) * 0.15;
  });
  return (
    <Float speed={speed * 2} rotationIntensity={0.3} floatIntensity={1.2}>
      <mesh ref={ref} position={position} rotation={rotation}>
        <planeGeometry args={[0.95, 1.26]} />
        <meshStandardMaterial
          map={texture}
          emissiveMap={texture}
          emissive="#ffffff"
          emissiveIntensity={0.55}
          transparent
          alphaTest={0.05}
          side={THREE.DoubleSide}
          roughness={0.5}
        />
      </mesh>
    </Float>
  );
}

function SheetRing({ palette, count, radius, withCore, spread = 8 }) {
  const group = useRef(null);
  const textures = useMemo(
    () => Array.from({ length: count }, (_, i) => makeSheetTexture(i % 3 === 2 ? palette.shell : palette.ink, i + 1)),
    [count, palette.ink, palette.shell]
  );
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures]);

  const sheets = useMemo(() => {
    const rand = seeded(count * 31 + 7);
    return textures.map((texture, i) => {
      const a = (i / count) * Math.PI * 2 + rand() * 0.4;
      const r = radius + rand() * 0.9;
      const side = i % 2 === 0 ? -1 : 1;
      const edgeX = side * (spread * 0.3 + rand() * spread * 0.18);
      const y = (rand() - 0.5) * (withCore ? 2.2 : 4.2);
      return {
        texture,
        position: withCore ? [Math.cos(a) * r, y, Math.sin(a) * r * 0.6] : [edgeX, y, -rand() * 1.5],
        rotation: [(rand() - 0.5) * 0.6, -a + Math.PI / 2, (rand() - 0.5) * 0.5],
        speed: 0.5 + rand() * 0.6
      };
    });
  }, [textures, count, radius, withCore, spread]);

  useFrame((_state, delta) => {
    if (group.current && withCore) group.current.rotation.y += delta * 0.06;
  });

  return (
    <group ref={group}>
      {sheets.map((sheet, i) => (
        <Sheet key={i} {...sheet} />
      ))}
    </group>
  );
}

function Rig({ children, layout }) {
  const group = useRef(null);
  const pointer = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  useEffect(() => {
    const onMove = (event) => {
      pointer.current.x = event.clientX / window.innerWidth - 0.5;
      pointer.current.y = event.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const offsetX = layout === 'right' ? viewport.width * 0.24 : layout === 'left' ? -viewport.width * 0.24 : 0;
  const scale = Math.min(viewport.height / 6.4, viewport.width / 7.5);

  useFrame(() => {
    if (!group.current) return;
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.current.x * 0.5, 0.05);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pointer.current.y * 0.3, 0.05);
  });

  return (
    <group position={[offsetX, 0, 0]} scale={scale}>
      <group ref={group}>{children}</group>
    </group>
  );
}

function SceneContents({ palette, layout }) {
  const withCore = layout !== 'scatter';
  const { viewport } = useThree();
  const spread = viewport.width / Math.min(viewport.height / 6.4, viewport.width / 7.5);
  return (
    <Rig layout={layout}>
      {withCore && (
        <>
          <Crystal palette={palette} />
          <Orbit radius={1.9} tilt={[Math.PI / 2.4, 0.2, 0]} speed={0.5} color={palette.ring} />
          <Orbit radius={2.35} tilt={[Math.PI / 1.7, -0.5, 0.3]} speed={-0.35} color={palette.ring2} satellites={3} thickness={0.008} />
        </>
      )}
      <SheetRing palette={palette} count={withCore ? 5 : 7} radius={2.9} withCore={withCore} spread={spread} />
      <Sparkles count={34} scale={[9, 5.5, 5]} size={2.6} speed={0.3} opacity={0.85} color={palette.spark} />
      <Sparkles count={18} scale={[7, 4.5, 4]} size={3.4} speed={0.22} opacity={0.6} color={palette.spark2} />
    </Rig>
  );
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

class SceneBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Scene3D({ className = '', layout = 'right', palette = 'cool' }) {
  const host = useRef(null);
  const [visible, setVisible] = useState(true);
  const colors = PALETTES[palette] || PALETTES.cool;

  useEffect(() => {
    if (!host.current || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '120px' });
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);

  const fallback = <div className={`scene3d scene3d-fallback ${className}`} aria-hidden="true" />;
  if (prefersReducedMotion()) return fallback;

  return (
    <div ref={host} className={`scene3d ${className}`} aria-hidden="true">
      <SceneBoundary fallback={fallback}>
        <Canvas
          dpr={[1, 1.25]}
          frameloop={visible ? 'always' : 'never'}
          camera={{ position: [0, 0, 8], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.55} />
          <pointLight position={[4, 4, 5]} intensity={60} color={colors.core} />
          <pointLight position={[-5, -3, 3]} intensity={40} color={colors.shell} />
          <directionalLight position={[0, 5, 5]} intensity={0.8} />
          <Suspense fallback={null}>
            <SceneContents palette={colors} layout={layout} />
          </Suspense>
        </Canvas>
      </SceneBoundary>
    </div>
  );
}
