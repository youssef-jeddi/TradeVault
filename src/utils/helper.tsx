// src/utils/helper.tsx
export function makeSafeKey(file: File): string {
  const maxLen = 48;

  // strip extension entirely
  const baseWithDots = file.name.replace(/\.[^.]+$/, ""); // remove last .ext
  const asciiBase = baseWithDots
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  // ensure starts with a letter (to be extra safe) and length bounded
  const normalized = (asciiBase || "file").slice(0, maxLen);
  return `f_${normalized}`; // e.g., f_strategy_pdf
}

