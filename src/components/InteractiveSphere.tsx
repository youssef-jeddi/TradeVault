"use client"

import { useRef, useMemo } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { MeshDistortMaterial, Sphere } from "@react-three/drei"
import * as THREE from "three"

function AnimatedSphere() {
    const meshRef = useRef<THREE.Mesh>(null)
    const materialRef = useRef<any>(null)

    // Create gradient texture for iridescent effect
    const gradientTexture = useMemo(() => {
        const canvas = document.createElement("canvas")
        canvas.width = 512
        canvas.height = 512
        const ctx = canvas.getContext("2d")!

        const gradient = ctx.createLinearGradient(0, 0, 512, 512)
        gradient.addColorStop(0, "#06b6d4") // cyan
        gradient.addColorStop(0.3, "#3b82f6") // blue
        gradient.addColorStop(0.6, "#8b5cf6") // purple
        gradient.addColorStop(0.8, "#ec4899") // pink
        gradient.addColorStop(1, "#f59e0b") // amber

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 512, 512)

        const texture = new THREE.CanvasTexture(canvas)
        texture.needsUpdate = true
        return texture
    }, [])

    useFrame((state) => {
        if (!meshRef.current) return

        const time = state.clock.getElapsedTime()

        // Rotate the sphere
        meshRef.current.rotation.x = time * 0.2
        meshRef.current.rotation.y = time * 0.3

        // Subtle floating animation
        meshRef.current.position.y = Math.sin(time * 0.5) * 0.1
    })

    return (
        <Sphere ref={meshRef} args={[1, 128, 128]} scale={2.2}>
            <MeshDistortMaterial
                ref={materialRef}
                map={gradientTexture}
                distort={0.4}
                speed={1.5}
                roughness={0.2}
                metalness={0.8}
                envMapIntensity={1.5}
                clearcoat={1}
                clearcoatRoughness={0.1}
                side={THREE.DoubleSide}
            />
        </Sphere>
    )
}

export default function InteractiveSphere() {
    return (
        <div className="sphere-container">
            <Canvas
                camera={{ position: [0, 0, 5], fov: 45 }}
                gl={{
                    antialias: true,
                    alpha: true,
                    powerPreference: "high-performance",
                }}
            >
                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <directionalLight position={[-10, -10, -5]} intensity={0.5} color="#06b6d4" />
                <pointLight position={[0, 0, 5]} intensity={1} color="#3b82f6" />
                <AnimatedSphere />
            </Canvas>
        </div>
    )
}