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
