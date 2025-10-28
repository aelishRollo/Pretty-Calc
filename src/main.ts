type Op = "add" | "sub" | "mul" | "div" | null;

const valueEl = document.getElementById("value") as HTMLElement;
const historyEl = document.getElementById("history") as HTMLElement;
const keysEl = document.querySelector(".keys") as HTMLElement;

let current = "0";
let acc: number | null = null;
let op: Op = null;
let lastOperand: number | null = null;
let enteringNew = true;
let justEvaluated = false; // so typing a digit after "=" starts a fresh calc

function sym(o: Exclude<Op, null>): string {
  return o === "add" ? "+" : o === "sub" ? "−" : o === "mul" ? "×" : "÷";
}

function clampDigits(s: string, max = 16): string {
  if (s.includes("e") || s.includes("E")) return s;
  if (s.length <= max) return s;
  if (s.includes(".")) {
    const [i, d] = s.split(".");
    const room = Math.max(0, max - i.length - 1);
    return room > 0 ? i + "." + d.slice(0, room) : i.slice(0, max);
  }
  return s.slice(0, max);
}

function fmt(n: number): string {
  const s = n.toFixed(12);
  const trimmed = s.replace(/\.?0+$/, "");
  return clampDigits(trimmed);
}

function setValue(text: string) { valueEl.textContent = text; }
function setHistory(text: string) { historyEl.textContent = text; }

function render() {
  setValue(current);
  if (op && acc !== null) {
    const left = fmt(acc);
    const s = sym(op);
    if (enteringNew) setHistory(`${left}${s}`);
    else setHistory(`${left}${s}${current}`);
  } else {
    // leave history if we just evaluated; otherwise clear
    if (!justEvaluated) setHistory("");
  }
}

function resetAfterEqualsIfNeeded() {
  if (justEvaluated) {
    acc = null;
    op = null;
    lastOperand = null;
    setHistory("");
    justEvaluated = false;
  }
}

function inputDigit(d: string) {
  resetAfterEqualsIfNeeded();
  if (enteringNew) {
    current = d === "0" ? "0" : d;
    enteringNew = false;
  } else {
    if (current.replace("-", "").length >= 16) return;
    current = current === "0" ? d : current + d;
  }
  render();
}

function inputDot() {
  resetAfterEqualsIfNeeded();
  if (enteringNew) {
    current = "0.";
    enteringNew = false;
  } else if (!current.includes(".")) {
    current += ".";
  }
  render();
}

function clearAll() {
  current = "0";
  acc = null;
  op = null;
  lastOperand = null;
  enteringNew = true;
  justEvaluated = false;
  setHistory("");
  setValue(current);
}

function toggleSign() {
  if (current === "0") return;
  current = current.startsWith("-") ? current.slice(1) : "-" + current;
  render();
}

function percent() {
  const cur = Number(current);
  if (Number.isNaN(cur)) return;
  if (acc !== null && op) current = fmt((acc * cur) / 100);
  else current = fmt(cur / 100);
  render();
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
    acc = applyOp(acc, cur, op);
    current = fmt(acc);
  }
  op = next;
  enteringNew = true;
  lastOperand = null;
  justEvaluated = false;
  render();
}

function equals() {
  if (!op) return;

  const leftSnap = acc !== null ? fmt(acc) : current;
  const s = sym(op);

  let right: number;
  if (enteringNew && lastOperand != null) right = lastOperand;
  else {
    right = Number(current);
    lastOperand = right;
  }

  if (acc === null) acc = Number(current);
  else acc = applyOp(acc, right, op);

  current = fmt(acc);
  setHistory(`${leftSnap}${s}${fmt(right)}`); // keep compact history; no '=' per ref image
  setValue(current);
  enteringNew = true;
  justEvaluated = true;
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

keysEl.addEventListener("click", (e) => {
  const t = e.target as HTMLElement | null;
  const key = t?.getAttribute?.("data-key");
  if (key) handlePress(key);
});

window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/^\d$/.test(k)) return inputDigit(k);
  if (k === "." || k === ",") return inputDot();
  if (k === "Enter" || k === "=") return equals();
  if (k === "Backspace") {
    if (enteringNew) return;
    if (current.length <= 1 || (current.startsWith("-") && current.length === 2)) {
      current = "0";
      enteringNew = true;
    } else {
      current = current.slice(0, -1);
    }
    return render();
  }
  if (k === "+") return chooseOp("add");
  if (k === "-") return chooseOp("sub");
  if (k === "*" || k.toLowerCase() === "x") return chooseOp("mul");
  if (k === "/") return chooseOp("div");
  if (k.toLowerCase() === "c" || k.toLowerCase() === "a") return clearAll();
  if (k === "%") return percent();
});

render();
