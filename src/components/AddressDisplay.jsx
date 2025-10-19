import { useState } from "react"
import { Copy, Check } from "lucide-react"

function shortenAddress(address) {
  if (!address) return ""
  return `${address.slice(0, 4)}...${address.slice(-4)}`
}

export default function AddressDisplay({ address }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = (e) => {
    e.stopPropagation()
    e.preventDefault()
    const value = String(address || "")
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = (e) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }

  const addrStr = String(address || "")
  return (
    <div className="address-display" onClick={handleToggle}>
      {expanded ? addrStr : shortenAddress(addrStr)}
      <button
        className="address-copy-button"
        onClick={handleCopy}
        title={copied ? "Copied!" : "Copy address"}
      >
        {copied ? <Check size={12} /> : <Copy size={12} />}
      </button>
    </div>
  )
}
