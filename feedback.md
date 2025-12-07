# Feedback – iExec Hackathon (Confidential DeFi)

Thank you for the tools and on-site support — overall the developer experience felt solid and the protocol is smart and well thought out. Below are concrete points we encountered and suggestions that could improve the DX and reliability for future builders.

---

## Summary

- ✅ **What worked well:** straightforward scaffolding with iApp Generator, clear separation between on-chain orchestration and TEE execution, good booth support.
- ⚠️ **What needs improvement:** network reliability under load, missing docs for some features (e.g., encrypted result handling), and UX friction around log retrieval.

---

## 1) Network instability under load (caused crashes / task stalls)

**Impact:** High  
**Symptoms:** During peak hackathon hours, several tasks stalled or failed to start; occasionally RPC-like calls and task status checks timed out. This created uncertainty for teams waiting on TEE execution.

**Why it matters:** Demos and iterative debugging rely on short feedback loops. Unstable infra makes teams hesitate to build deeper features.

**Suggestions:**
- Add **autoscaling** for the scheduler/executors and publish a **status page** (incident + capacity notes).
- Provide a **“retry with backoff” client helper** and best-practice timeouts in sample code.
- Expose a **graceful degradation mode**: queue transparency (ETA, queue position) so devs can plan around load.

---

## 2) Underdocumented feature: encrypted result workflow

**Impact:** Medium  
**Issue:** We found the feature to **encrypt results** (or return sealed outputs) not fully documented end-to-end:
- Which flags/config enable encrypted outputs per task?
- How to **retrieve and decrypt** results (key handling, access control, and attestation linkage)?
- Expected output formats and error codes.

**Suggestions:**
- Add a **docs section**: “Encrypted Results: End-to-End” with:
  - Minimal **code sample** (submit → poll → fetch → decrypt).
  - **Key management** page: who holds what, and security caveats.
  - **Attestation linkage**: how verifiers can confirm the enclave that produced the ciphertext.
- Provide a **reference client** (JS/TS) with `decryptResult(result, userKey)` helper.

---

## 3) Results visibility requires log download

**Impact:** Medium  
**Observation:** We had to **download logs** for results to be visible/understood; discussed this with a staff member. It slows down iteration and increases friction during debugging.

**Suggestions:**
- Add a **“Result Preview”** pane in the web UI (truncated but structured).
- Expose a **task stdout/stderr stream API** (or WebSocket) for live tailing during run.
- Normalize structured logs (JSON lines) and show **parsed key fields** (status, result pointer, error class).

---

## What worked well (kudos)

- **iApp Generator**: Quick start and sane defaults.
- **TEE + on-chain split**: Clear mental model; easy to explain to non-TEE devs.
- **Booth support**: Fast responses; staff were accessible and helpful.

---

## Prioritization (from a builder’s POV)

1. **Stability / scalability under load** (High): best ROI for hackathons and real users.
2. **Encrypted results doc + reference flow** (High): unlocks core privacy narrative.
3. **Faster results UX (no mandatory log download)** (Medium): sharpens the dev loop.

---

## Environment (for reproducibility)

- Chain: **Arbitrum Sepolia**  
- Tools: **iApp Generator**, **DataProtector**, JS/TS front-end  
- Time window: **peak hackathon hours** (multiple teams executing simultaneously)

---

## Final note

Only points to improve are listed above,  overall, the **protocol is smart and promising**. With better load resilience and clearer guides for encrypted outputs, the builder experience will be excellent.