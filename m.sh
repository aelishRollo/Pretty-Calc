#!/usr/bin/env bash
set -euo pipefail

# 1) Make the calculator box a bit bigger by reducing the outer padding
#    (this gives it more room without changing the aspect ratio)
cat <<'EOF' > src/style.css
:root{
  /* Dark green theme */
  --bg: #0b2b24;

  /* ↓ slightly reduced so the calculator grows a bit more */
  --pad-block: clamp(12px, 3vmin, 40px);
  --pad-inline: clamp(12px, 3vmin, 32px);

  --panel: #0f3a31;
  --panel-2: #114238;
  --bevel: rgba(255,255,255,0.06);
  --shadow: rgba(0,0,0,0.35);

  --ink: #e6ffef;
  --ink-dim: #bde6cc;

  --btn: #155348;
  --btn-hover: #1a5e52;
  --btn-active: #11463d;

  --fn: #0e4b40;
  --fn-hover: #10564a;
  --fn-active: #0a3c33;

  --op: #1b6f60;
  --op-hover: #1f7b6b;
  --op-active: #166556;

  --eq: #2d9c86;
  --eq-hover: #31a892;
  --eq-active: #278c79;

  --radius-lg: 20px;
  --radius-md: 14px;

  --gap: clamp(6px, 1.2vmin, 10px);
  --spacing: clamp(10px, 2vmin, 16px);

  --font-num: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --font-ui: system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji";
}

*,
*::before,
*::after { box-sizing: border-box; }

html, body {
  margin: 0;
  height: 100%;
  font-family: var(--font-ui);
  background: radial-gradient(1200px 1200px at 10% -10%, #0e3a31 0%, #0b2b24 40%, #081f1a 100%);
  color: var(--ink);
}

.wrapper {
  min-height: 100svh;
  padding-block: var(--pad-block);
  padding-inline: var(--pad-inline);
  display: grid;
  place-items: center;
}

/* Aspect-ratio calculator that maximizes within viewport padding */
#calculator{
  aspect-ratio: 3 / 4;
  width: min(
    calc(100vw - 2 * var(--pad-inline)),
    calc((100svh - 2 * var(--pad-block)) * (3 / 4))
  );
  background: linear-gradient(180deg, var(--panel), var(--panel-2));
  border-radius: var(--radius-lg);
  box-shadow:
    0 24px 60px var(--shadow),
    inset 0 1px 0 var(--bevel);
  display: grid;
  grid-template-rows: 1fr 3fr; /* display + keys */
  overflow: hidden;
}

/* Display box */
.display{
  display: flex;
  align-items: end;
  justify-content: end;
  padding: clamp(16px, 3vmin, 28px);
  font: 700 clamp(24px, 7vmin, 48px) / 1 var(--font-num);
  color: var(--ink);
  background:
    linear-gradient(180deg, rgba(255,255,255,0.05), rgba(0,0,0,0)) ,
    linear-gradient(180deg, #0f3f35, #0d352d);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  text-shadow: 0 1px 0 rgba(0,0,0,0.4);
}

/* Keypad grid box */
.keys{
  padding: var(--spacing);
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 1fr;
  gap: var(--gap);
  background: linear-gradient(180deg, #0f3a31, #0c2f28);
}

/* Buttons */
.key{
  appearance: none;
  border: 0;
  border-radius: var(--radius-md);
  background: var(--btn);
  color: var(--ink);
  font: 600 clamp(14px, 2.3vmin, 18px) / 1 var(--font-ui);
  box-shadow:
    0 8px 18px rgba(0,0,0,0.35),
    inset 0 1px 0 var(--bevel);
  display: grid;
  place-items: center;
  transition: transform 80ms ease, background 120ms ease, box-shadow 120ms ease, filter 120ms ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}
.key:hover{ background: var(--btn-hover); }
.key:active{
  background: var(--btn-active);
  transform: translateY(1px) scale(0.99);
  box-shadow:
    0 6px 12px rgba(0,0,0,0.45),
    inset 0 1px 0 var(--bevel);
}

/* Variants */
.key.fn{ background: var(--fn); }
.key.fn:hover{ background: var(--fn-hover); }
.key.fn:active{ background: var(--fn-active); }

.key.op{ background: var(--op); }
.key.op:hover{ background: var(--op-hover); }
.key.op:active{ background: var(--op-active); }

.key.eq{ background: var(--eq); }
.key.eq:hover{ background: var(--eq-hover); }
.key.eq:active{ background: var(--eq-active); }

/* 0 spans two columns like many physical calculators */
.key.zero{
  grid-column: span 2;
  justify-content: start;
  padding-inline: clamp(16px, 2.5vmin, 20px);
}

/* Slightly rounder focus ring for keyboard nav */
.key:focus-visible{
  outline: 2px solid #b8f6de;
  outline-offset: 2px;
}

/* Landscape can breathe a bit wider */
@media (orientation: landscape){
  #calculator { aspect-ratio: 4 / 3; }
}
EOF

# 2) Wire up real calculator logic
cat <<'EOF' > src/main.ts
type Op = "add" | "sub" | "mul" | "div" | null;

const displayEl = document.getElementById("display") as HTMLElement;
const keysEl = document.querySelector(".keys") as HTMLElement;

let current = "0";           // what's shown on display
let acc: number | null = null; // accumulator (left operand)
let op: Op = null;           // pending operator
let lastOperand: number | null = null; // for repeated equals
let enteringNew = true;      // if true, next digit replaces display

function clampDigits(s: string, max = 16): string {
  // Keep length reasonable; don't strip necessary minus or dot
  if (s.includes("e") || s.includes("E")) return s; // scientific notation—leave as is
  if (s.length <= max) return s;
  // Try to limit decimals while keeping integer part
  if (s.includes(".")) {
    const [i, d] = s.split(".");
    const room = Math.max(0, max - i.length - 1);
    return room > 0 ? i + "." + d.slice(0, room) : i.slice(0, max);
  }
  return s.slice(0, max);
}

function fmt(n: number): string {
  // Format with up to ~12 decimal places, then trim trailing zeros
  const s = n.toFixed(12);
  const trimmed = s.replace(/\.?0+$/, "");
  return clampDigits(trimmed);
}

function setDisplay(text: string) {
  displayEl.textContent = text;
}

function inputDigit(d: string) {
  if (enteringNew) {
    current = d === "0" ? "0" : d;
    enteringNew = false;
  } else {
    if (current.replace("-", "").length >= 16) return; // avoid overflow
    current = current === "0" ? d : current + d;
  }
  setDisplay(current);
}

function inputDot() {
  if (enteringNew) {
    current = "0.";
    enteringNew = false;
  } else if (!current.includes(".")) {
    current += ".";
  }
  setDisplay(current);
}

function clearAll() {
  current = "0";
  acc = null;
  op = null;
  lastOperand = null;
  enteringNew = true;
  setDisplay(current);
}

function toggleSign() {
  if (current === "0") return;
  current = current.startsWith("-") ? current.slice(1) : "-" + current;
  setDisplay(current);
}

function percent() {
  const cur = Number(current);
  if (Number.isNaN(cur)) return;

  // iOS-like behavior: if we have a left operand, percent is relative to it
  if (acc !== null && op) {
    current = fmt((acc * cur) / 100);
  } else {
    current = fmt(cur / 100);
  }
  setDisplay(current);
}

function applyOp(a: number, b: number, which: Exclude<Op, null>): number {
  switch (which) {
    case "add": return a + b;
    case "sub": return a - b;
    case "mul": return a * b;
    case "div": return b === 0 ? NaN : a / b;
  }
}

function chooseOp(next: Exclude<Op, null>) {
  const cur = Number(current);
  if (acc === null) {
    acc = cur;
  } else if (!enteringNew && op) {
    // chain operations: compute old op first
    acc = applyOp(acc, cur, op);
    current = fmt(acc);
    setDisplay(current);
  }
  op = next;
  enteringNew = true;
  lastOperand = null; // reset repeated equals memory
}

function equals() {
  if (!op) return;

  let right: number;
  if (enteringNew && lastOperand != null) {
    // repeated equals: use the last operand again
    right = lastOperand;
  } else {
    right = Number(current);
    lastOperand = right;
  }

  if (acc === null) {
    acc = Number(current); // edge case: equals with no left; show current
  } else {
    acc = applyOp(acc, right, op);
  }

  current = fmt(acc);
  setDisplay(current);
  enteringNew = true;
}

function handlePress(key: string) {
  if (/^[0-9]$/.test(key)) return inputDigit(key);
  switch (key) {
    case "dot": return inputDot();
    case "clear": return clearAll();
    case "sign": return toggleSign();
    case "percent": return percent();
    case "divide": return chooseOp("div");
    case "multiply": return chooseOp("mul");
    case "minus": return chooseOp("sub");
    case "plus": return chooseOp("add");
    case "equals": return equals();
  }
}

// Click handling
keysEl.addEventListener("click", (e) => {
  const t = e.target as HTMLElement | null;
  const key = t?.getAttribute?.("data-key");
  if (key) handlePress(key);
});

// Basic keyboard support
window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/\d/.test(k)) return inputDigit(k);
  if (k === "." || k === ",") return inputDot();
  if (k === "Enter" || k === "=") return equals();
  if (k === "Backspace") {
    // Simple backspace behavior
    if (enteringNew) return;
    if (current.length <= 1 || (current.startsWith("-") && current.length === 2)) {
      current = "0";
      enteringNew = true;
    } else {
      current = current.slice(0, -1);
    }
    setDisplay(current);
    return;
  }
  if (k === "+") return chooseOp("add");
  if (k === "-") return chooseOp("sub");
  if (k === "*" || k.toLowerCase() === "x") return chooseOp("mul");
  if (k === "/") return chooseOp("div");
  if (k.toLowerCase() === "c" || k.toLowerCase() === "a") return clearAll();
  if (k === "%") return percent();
});

setDisplay(current);
EOF

echo "✅ Calculator logic wired up and UI spacing adjusted."
echo "Run: pnpm dev   (or npm run dev) and try the buttons/keyboard."
