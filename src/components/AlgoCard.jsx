import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight } from "lucide-react"
import AddressDisplay from "./AddressDisplay"
import Stars from "./Stars"

export default function AlgoCard({ algo, onSelect, onRun, onDelist, canDelist }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
      className="strategy-card"
    >
      <div className="strategy-card-header">
        <div className="strategy-card-title-section">
          <div className="strategy-card-title-row">
            <span className="badge-asset">{algo.asset}</span>
            <h3 className="strategy-card-title">{algo.title}</h3>
          </div>
        </div>
        {isHovered && (
          <button
            className="strategy-card-arrow"
            onClick={(e) => {
              e.stopPropagation()
              onSelect?.()
            }}
            title="View details"
          >
            <ArrowRight size={18} />
          </button>
        )}
      </div>

      <div style={{ marginTop: "16px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
        <span
          style={{
            padding: "6px 12px",
            borderRadius: "6px",
            background: "#dbeafe",
            border: "2px solid #000000",
            fontSize: "12px",
            fontWeight: "700",
            color: "#1a1a1a",
          }}
        >
          {algo.reviews} reviews
        </span>
      </div>

      <div className="strategy-card-metrics">
        {algo.reviews === 0 ? (
          <>
            <Stars n={0} isEmpty />
            <span style={{ color: "#64748b", fontWeight: "600" }}>Not reviewed yet</span>
          </>
        ) : (
          <>
            <Stars n={Math.max(1, Math.round((algo.winRate || 70) / 20))} />
            <span style={{ color: "#64748b" }}>({algo.reviews})</span>
          </>
        )}
      </div>

      <div className="strategy-card-footer">
        <div className="strategy-card-owner">
          By <AddressDisplay address={algo.owner} />
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canDelist && (
            <button
              className="glass-button"
              style={{ padding: "6px 10px" }}
              onClick={(e) => {
                e.stopPropagation()
                onDelist?.(algo)
              }}
            >
              Delist
            </button>
          )}
          <button
            className="strategy-card-price-button"
            onClick={(e) => {
              e.stopPropagation()
              onRun?.()
            }}
          >
            Run
          </button>
        </div>
      </div>
    </motion.div>
  )
}
