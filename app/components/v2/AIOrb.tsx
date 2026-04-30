'use client';

import { Canvas } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Environment, ContactShadows } from '@react-three/drei';
import { Suspense } from 'react';

/**
 * Orb 3D real — glassmorphic distortion sphere com Three.js.
 * Substitui ChipBadge estático na Performance section.
 */
export function AIOrb({ size = 280 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        margin: '0 auto',
      }}
    >
      <Canvas
        camera={{ position: [0, 0, 4], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.4} />
          <pointLight position={[5, 5, 5]} intensity={2} color="#b39dff" />
          <pointLight position={[-5, -3, 2]} intensity={1.5} color="#6E56CF" />
          <pointLight position={[0, 4, -3]} intensity={1.2} color="#5746AF" />

          <Float speed={1.5} rotationIntensity={1.2} floatIntensity={1.5}>
            <mesh>
              <icosahedronGeometry args={[1.3, 64]} />
              <MeshDistortMaterial
                color="#6E56CF"
                distort={0.45}
                speed={2.2}
                roughness={0.15}
                metalness={0.6}
                emissive="#5746AF"
                emissiveIntensity={0.35}
              />
            </mesh>
          </Float>

          <ContactShadows
            position={[0, -1.6, 0]}
            opacity={0.4}
            scale={6}
            blur={2.4}
            far={3}
            color="#6E56CF"
          />

          <Environment preset="city" />
        </Suspense>
      </Canvas>

      {/* Glow halo CSS atrás do canvas */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: '-20%',
          background:
            'radial-gradient(50% 50% at 50% 50%, rgba(110,86,207,0.5), rgba(110,86,207,0) 70%)',
          filter: 'blur(40px)',
          zIndex: -1,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
