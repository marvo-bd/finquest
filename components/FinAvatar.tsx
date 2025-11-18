import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame, extend } from '@react-three/fiber';
import { Sphere, Box } from '@react-three/drei';
import * as THREE from 'three';

// Fix: Extending the entire THREE namespace was causing a type error due to non-constructor exports.
// This has been changed to a selective extend, including only the THREE components used as JSX elements in this file.
extend({
  Group: THREE.Group,
  MeshStandardMaterial: THREE.MeshStandardMaterial,
  AmbientLight: THREE.AmbientLight,
  DirectionalLight: THREE.DirectionalLight,
  SpotLight: THREE.SpotLight,
});

// This is our new programmatic model for Fin, created with basic shapes.
function FinModel({ animationName }: { animationName: 'idle' | 'cheer' }) {
  const group = useRef<THREE.Group>(null!);
  const leftArm = useRef<THREE.Mesh>(null!);
  const rightArm = useRef<THREE.Mesh>(null!);

  // The useFrame hook runs on every rendered frame
  useFrame((state) => {
    if (!group.current || !leftArm.current || !rightArm.current) return;

    if (animationName === 'cheer') {
      // Cheering animation: wave arms up and down enthusiastically
      const time = state.clock.elapsedTime * 8;
      leftArm.current.rotation.x = Math.sin(time) * 0.7 - 0.9;
      rightArm.current.rotation.x = -Math.sin(time) * 0.7 - 0.9;
      group.current.position.y = -1.4 + Math.abs(Math.sin(time * 0.5)) * 0.2; // Bounce slightly
    } else {
      // Idle animation: slight bobbing
      const time = state.clock.elapsedTime * 2;
      group.current.position.y = Math.sin(time) * 0.1 - 1.4;
      leftArm.current.rotation.x = -0.7; // Reset arm position
      rightArm.current.rotation.x = -0.7; // Reset arm position
    }
  });

  return (
    <group ref={group} position={[0, -1.5, 0]}>
      {/* Body */}
      <Sphere args={[0.8, 32, 32]} position={[0, 0.8, 0]}>
        <meshStandardMaterial color="#8884d8" roughness={0.5} />
      </Sphere>
      {/* Head */}
      <Sphere args={[0.5, 32, 32]} position={[0, 2, 0]}>
        <meshStandardMaterial color="#a3a0e6" roughness={0.5}/>
      </Sphere>
      {/* Eyes */}
      <Sphere args={[0.08, 16, 16]} position={[-0.2, 2.1, 0.4]}>
        <meshStandardMaterial color="black" />
      </Sphere>
      <Sphere args={[0.08, 16, 16]} position={[0.2, 2.1, 0.4]}>
        <meshStandardMaterial color="black" />
      </Sphere>
      {/* Arms */}
      <Box ref={leftArm} args={[0.2, 1, 0.2]} position={[-1, 1.2, 0]}>
        <meshStandardMaterial color="#8884d8" roughness={0.5}/>
      </Box>
      <Box ref={rightArm} args={[0.2, 1, 0.2]} position={[1, 1.2, 0]}>
        <meshStandardMaterial color="#8884d8" roughness={0.5}/>
      </Box>
    </group>
  );
}


// This is our main avatar component
interface FinAvatarProps {
  animationName: 'idle' | 'cheer';
}

const FinAvatar: React.FC<FinAvatarProps> = ({ animationName }) => {
  return (
    <Canvas camera={{ position: [0, 0.5, 8], fov: 30 }}>
      {/* Add some lighting to make the model visible and look good */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[3, 5, 2]} intensity={2.5} />
      <spotLight position={[-3, 5, 4]} angle={0.3} penumbra={1} intensity={2} castShadow />

      {/* Suspense is good practice for components that might load assets */}
      <Suspense fallback={null}>
        <FinModel animationName={animationName} />
      </Suspense>
    </Canvas>
  );
};

export default FinAvatar;