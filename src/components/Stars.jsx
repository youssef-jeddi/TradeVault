import { Star } from "lucide-react"

export default function Stars({ n = 4, isEmpty = false }) {
  return (
    <span style={{ display: "inline-flex", gap: "2px" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={16}
          style={{
            fill: isEmpty ? "transparent" : i < n ? "#fbbf24" : "transparent",
            stroke: isEmpty ? "#cbd5e1" : i < n ? "#fbbf24" : "#cbd5e1",
            strokeWidth: 2,
          }}
        />
      ))}
    </span>
  )
}
