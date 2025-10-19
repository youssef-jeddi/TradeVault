"use client"

import type React from "react"

const WelcomeBlock: React.FC = () => {
  return (
    <div
      className="rounded-3xl p-12 md:p-8 mb-8 text-center relative overflow-hidden"
      style={{
        backdropFilter: "blur(24px) saturate(200%)",
        backgroundColor: "rgba(10, 10, 15, 0.7)",
        border: "1px solid rgba(6, 182, 212, 0.15)",
        boxShadow: `
          0 20px 60px rgba(0, 0, 0, 0.6),
          0 0 40px rgba(6, 182, 212, 0.1),
          inset 0 1px 0 rgba(255, 255, 255, 0.08)
        `,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "100%",
          background: "radial-gradient(circle at 50% 0%, rgba(6, 182, 212, 0.15), transparent 70%)",
          pointerEvents: "none",
          opacity: 0.6,
        }}
      />

      <div className="max-w-4xl mx-auto relative z-10">
        <h1
          className="text-4xl md:text-3xl font-bold mb-4"
          style={{
            background: "linear-gradient(135deg, #06b6d4 0%, #0ea5e9 50%, #06b6d4 100%)",
            backgroundSize: "200% 200%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            animation: "gradient-shift 3s ease infinite",
            letterSpacing: "-0.02em",
          }}
        >
          Welcome to the iExec React Starter
        </h1>
        <p className="text-xl md:text-lg mb-8 leading-relaxed" style={{ color: "#a0aec0" }}>
          This starter allows you to quickly get started with iExec DataProtector. Connect your wallet to protect your
          data on the blockchain.
        </p>

        <div className="mb-8">
          <a href="https://docs.iex.ec/" target="_blank" rel="noopener noreferrer" className="secondary">
            📖 See our documentation
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {[
            { icon: "🔒", title: "Data Protection", desc: "Protect your sensitive data with iExec technology" },
            { icon: "🌐", title: "Decentralized", desc: "Leverage the power of decentralized cloud" },
            { icon: "🚀", title: "Ready to use", desc: "A minimal starter for your iExec projects" },
          ].map((item, i) => (
            <div
              key={i}
              className="p-6 rounded-xl text-left transition-all duration-300"
              style={{
                backdropFilter: "blur(20px) saturate(180%)",
                backgroundColor: "rgba(6, 182, 212, 0.05)",
                border: "1px solid rgba(6, 182, 212, 0.15)",
                boxShadow: `
                  0 4px 12px rgba(0, 0, 0, 0.3),
                  inset 0 1px 0 rgba(6, 182, 212, 0.1)
                `,
                transformStyle: "preserve-3d",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px) rotateX(2deg)"
                e.currentTarget.style.boxShadow = `
                  0 8px 20px rgba(0, 0, 0, 0.4),
                  0 0 20px rgba(6, 182, 212, 0.15),
                  inset 0 1px 0 rgba(6, 182, 212, 0.15)
                `
                e.currentTarget.style.backgroundColor = "rgba(6, 182, 212, 0.08)"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0) rotateX(0)"
                e.currentTarget.style.boxShadow = `
                  0 4px 12px rgba(0, 0, 0, 0.3),
                  inset 0 1px 0 rgba(6, 182, 212, 0.1)
                `
                e.currentTarget.style.backgroundColor = "rgba(6, 182, 212, 0.05)"
              }}
            >
              <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>{item.icon}</div>
              <h3 className="text-lg font-medium mb-2" style={{ color: "#ffffff" }}>
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "#a0aec0" }}>
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default WelcomeBlock