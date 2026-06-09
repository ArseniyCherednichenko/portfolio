import { Canvas } from '@react-three/fiber'
import { Float, MeshDistortMaterial } from '@react-three/drei'
import { useReducedMotion } from 'framer-motion'

// A soft, slowly morphing 3D orb rendered with react-three-fiber + drei.
// Default export so it can be React.lazy'd (keeps three.js out of every other
// chunk). Floating/distortion are disabled under Reduce Motion.
export default function Scene3D() {
  const reduce = useReducedMotion() ?? false

  return (
    <Canvas camera={{ position: [0, 0, 4], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 3, 3]} intensity={1.3} />
      <directionalLight position={[-3, -2, -1]} intensity={0.5} color="#DCF87C" />
      <Float
        speed={reduce ? 0 : 1.5}
        rotationIntensity={reduce ? 0 : 0.9}
        floatIntensity={reduce ? 0 : 1.2}
      >
        <mesh scale={1.35}>
          <sphereGeometry args={[1, 128, 128]} />
          <MeshDistortMaterial
            color="#8fd3ff"
            distort={reduce ? 0 : 0.42}
            speed={reduce ? 0 : 2}
            roughness={0.15}
            metalness={0.25}
          />
        </mesh>
      </Float>
    </Canvas>
  )
}
