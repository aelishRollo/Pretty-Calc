type Op = "add" | "sub" | "mul" | "div";
type KeypadMode = "main" | "abc" | "func";
type AngleMode = "deg" | "rad";
type HistoryLine = { input: string; output: string };
type ModeKey = { label: string; token: string };

const valueEl = document.getElementById("value") as HTMLElement;
const historyEl = document.getElementById("history") as HTMLElement;
const keysEl = document.querySelector(".keys") as HTMLElement;
const spinnerEl = document.getElementById("spinner") as HTMLElement;
const displayControlsEl = document.querySelector(".display-controls") as HTMLElement | null;
const modeKeysEl = document.getElementById("modeKeys") as HTMLElement | null;
const angleBtn = document.getElementById("angleBtn") as HTMLButtonElement | null;
const fracBtn = document.getElementById("fracBtn") as HTMLButtonElement | null;

/** Active expression shown while typing */
let expr = "0";
let historyText = "";
let justEvaluated = false;

/** Ticket #1 state */
const lines: HistoryLine[] = [];
let ansValue = 0;
let keypadMode: KeypadMode = "main";
let angleMode: AngleMode = "deg";
let fractionOutput = false;

const MODE_KEYS: Record<KeypadMode, ModeKey[]> = {
  main: [
    { label: "ANS", token: "ans" },
    { label: "(", token: "(" },
    { label: ")", token: ")" },
    { label: ".", token: "." },
    { label: "÷", token: "÷" },
  ],
  abc: [
    { label: "a", token: "a" },
    { label: "b", token: "b" },
    { label: "c", token: "c" },
    { label: "x", token: "x" },
    { label: "y", token: "y" },
  ],
  func: [
    { label: "sin", token: "sin(" },
    { label: "cos", token: "cos(" },
    { label: "tan", token: "tan(" },
    { label: "√", token: "sqrt(" },
    { label: "π", token: "pi" },
  ],
};

function setValue(s: string) { valueEl.textContent = s; updateDisplayFont(); }
function setHistory(s: string) { historyEl.textContent = s; }
function renderControls() {
  if (!displayControlsEl) return;
  const buttons = Array.from(displayControlsEl.querySelectorAll<HTMLButtonElement>(".ctrl-btn"));
  for (const btn of buttons) {
    const key = btn.dataset.key;
    const isActive =
      (key === "modeMain" && keypadMode === "main") ||
      (key === "modeAbc" && keypadMode === "abc") ||
      (key === "modeFunc" && keypadMode === "func");
    btn.classList.toggle("active", isActive);
  }
  if (angleBtn) {
    angleBtn.textContent = angleMode.toUpperCase();
    angleBtn.classList.toggle("active", angleMode === "rad");
  }
  if (fracBtn) {
    fracBtn.textContent = fractionOutput ? "FRAC" : "DEC";
    fracBtn.classList.toggle("active", fractionOutput);
  }

  if (modeKeysEl) {
    const buttons = Array.from(modeKeysEl.querySelectorAll<HTMLButtonElement>(".ctrl-btn-mini"));
    const keys = MODE_KEYS[keypadMode];
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const item = keys[i];
      if (!btn || !item) continue;
      btn.textContent = item.label;
      btn.setAttribute("aria-label", `Insert ${item.label}`);
    }
  }
}
function renderHistory() {
  const status = `${keypadMode.toUpperCase()} ${angleMode.toUpperCase()} ${fractionOutput ? "FRAC" : "DEC"}`;
  const recentLines = lines.slice(-3).map((line) => `${line.input} = ${line.output}`);
  historyText = [status, ...recentLines].join("\n");
}
function render() { renderControls(); renderHistory(); setValue(expr); setHistory(historyText); }

const OP_CHARS = "+\u2212×÷";
function isOpChar(c: string) { return OP_CHARS.includes(c); }
function endsWithOp(s: string) { return s.length > 0 && isOpChar(s[s.length - 1]); }

/* ---------- Adaptive display font ---------- */
function updateDisplayFont() {
  const len = (valueEl.textContent ?? "").length;
  let sizeVmin = 7.2;
  if (len > 10) sizeVmin = Math.max(3.2, 7.2 - (len - 10) * 0.35);
  (valueEl.parentElement as HTMLElement).style.setProperty("--value-size", sizeVmin + "vmin");
}

/* ---------- Current number helpers ---------- */
function currentNumberBounds(s: string): [number, number] {
  if (s.length === 0) return [0, 0];
  let end = s.length, start = end - 1;
  while (start >= 0 && ((s[start] >= "0" && s[start] <= "9") || s[start] === ".")) start--;
  if (start >= 0 && s[start] === "-") {
    const before = s[start - 1];
    if (start === 0 || before === "(" || isOpChar(before ?? "")) start--;
  }
  return [Math.max(0, start + 1), end];
}
function getCurrentNumber(s: string) { const [a, b] = currentNumberBounds(s); const raw = s.slice(a, b); return { raw, a, b }; }
function replaceRange(s: string, a: number, b: number, repl: string) { return s.slice(0, a) + repl + s.slice(b); }

/* ---------- Input editing ---------- */
function insertDigit(d: string) {
  if (justEvaluated) { expr = "0"; justEvaluated = false; }
  const { raw, a, b } = getCurrentNumber(expr);
  if (expr === "0") expr = d;
  else expr = replaceRange(expr, a, b, raw + d);
  render();
}
function insertToken(tok: string) {
  if (justEvaluated) { expr = "0"; justEvaluated = false; }
  if (expr === "0") expr = tok;
  else expr += tok;
  render();
}
function insertDot() {
  if (justEvaluated) { expr = "0"; justEvaluated = false; }
  const { raw, a, b } = getCurrentNumber(expr);
  if (raw.includes(".")) return;
  expr = replaceRange(expr, a, b, raw.length ? (raw + ".") : "0.");
  render();
}
function toggleSign() {
  const { raw, a, b } = getCurrentNumber(expr);
  if (!raw.length) return;
  let repl = raw.startsWith("-") ? raw.slice(1) : "-" + raw;
  if (repl === "-0" || repl === "-0.") repl = "0";
  expr = replaceRange(expr, a, b, repl);
  render();
}
function backspace() {
  if (justEvaluated) return;
  if (expr.length <= 1) { expr = "0"; return render(); }
  expr = expr.slice(0, -1);
  if (expr === "" || expr === "-") expr = "0";
  render();
}
function insertOp(which: Op) {
  const ch = which === "add" ? "+" : which === "sub" ? "\u2212" : which === "mul" ? "×" : "÷";
  if (justEvaluated) { justEvaluated = false; }
  if (expr === "0" && which !== "sub") return;
  expr = endsWithOp(expr) ? (expr.slice(0, -1) + ch) : (expr + ch);
  render();
}

/* ---------- Parentheses: () toggle (no implicit multiply) ---------- */
function unmatchedLeftParens(s: string): number {
  let bal = 0; for (const ch of s) { if (ch === "(") bal++; else if (ch === ")") bal = Math.max(0, bal - 1); } return bal;
}
function parenToggle() {
  if (expr.endsWith("()")) { expr = expr.slice(0, -2) || "0"; return render(); }
  const need = unmatchedLeftParens(expr);
  if (need > 0) {
    if (expr.endsWith("(")) { expr = expr.slice(0, -1) || "0"; }
    else { expr += ")"; }
  } else {
    if (expr === "0") expr = "(";
    else expr += "(";
  }
  render();
}
function insertLParen() { if (expr === "0") expr = "("; else expr += "("; render(); }
function insertRParen() { const need = unmatchedLeftParens(expr); if (need <= 0) return; if (endsWithOp(expr) || expr.endsWith("(")) expr = expr.slice(0, -1); expr += ")"; render(); }

/* ---------- Ticket #1 evaluation ---------- */
function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) { const t = y; y = x % y; x = t; }
  return x || 1;
}
function maybeFractionFromInput(raw: string): string | null {
  const m = raw.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return null;
  const n = Number(m[1]), d = Number(m[2]);
  if (!Number.isInteger(n) || !Number.isInteger(d) || d === 0) return null;
  const sign = (n < 0) !== (d < 0) ? "-" : "";
  const an = Math.abs(n), ad = Math.abs(d);
  const div = gcd(an, ad);
  return `${sign}${an / div}/${ad / div}`;
}
function normalizeForEval(s: string): string {
  let t = s
    .replace(/\u2212/g, "-")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\bans\b/gi, `(${ansValue})`)
    .replace(/\bpi\b/gi, `${Math.PI}`)
    .replace(/\bsin\s*\(/gi, "__sin(")
    .replace(/\bcos\s*\(/gi, "__cos(")
    .replace(/\btan\s*\(/gi, "__tan(")
    .replace(/\bsqrt\s*\(/gi, "__sqrt(")
    .replace(/\^/g, "**");
  while (/[+\-*/.(]$/.test(t)) t = t.slice(0, -1);
  return t.length ? t : "0";
}
function evaluate(raw: string): number {
  const norm = normalizeForEval(raw);
  const trigArg = (x: number) => (angleMode === "deg" ? (x * Math.PI) / 180 : x);
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "__sin",
      "__cos",
      "__tan",
      "__sqrt",
      `return (${norm});`,
    ) as (sin: (x: number) => number, cos: (x: number) => number, tan: (x: number) => number, sqrt: (x: number) => number) => number;
    const out = fn(
      (x) => Math.sin(trigArg(x)),
      (x) => Math.cos(trigArg(x)),
      (x) => Math.tan(trigArg(x)),
      (x) => Math.sqrt(x),
    );
    return Number.isFinite(out) ? out : NaN;
  } catch {
    return NaN;
  }
}
function fmt(raw: string, n: number): string {
  if (!Number.isFinite(n)) return "Error";
  if (fractionOutput) {
    const frac = maybeFractionFromInput(raw.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/"));
    if (frac) return frac;
  }
  return n.toFixed(12).replace(/\.?0+$/, "");
}
function equals() {
  const missing = unmatchedLeftParens(expr);
  let balanced = expr; for (let i = 0; i < missing; i++) balanced += ")";
  const raw = balanced;
  const result = evaluate(raw);
  const out = fmt(raw, result);
  lines.push({ input: raw, output: out });
  if (lines.length > 30) lines.shift();
  if (Number.isFinite(result)) ansValue = result;
  expr = out;
  justEvaluated = true;
  render();
}

/* =========================
   ROBUST PREFETCH (BLOB) QUEUE
   ========================= */
function hsl(h: number, s: number, l: number, a = 1) { return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`; }
function showSpinner(on: boolean) {
  if (!spinnerEl) return;
  spinnerEl.classList.toggle("active", on);
  spinnerEl.setAttribute("aria-hidden", on ? "false" : "true");
}
function randomIn(min: number, max: number) { return Math.random() * (max - min) + min; }
function randomInt(min: number, max: number) { return Math.floor(randomIn(min, max)); }

function randomizePalette() {
  const theme = ["deep", "mid", "light"][randomInt(0, 3)];
  const baseHue = randomIn(0, 360);
  const satBase = theme === "deep" ? randomIn(44, 58) : theme === "mid" ? randomIn(38, 52) : randomIn(30, 45);
  const lightBase = theme === "deep" ? randomIn(12, 20) : theme === "mid" ? randomIn(18, 26) : randomIn(26, 34);
  const panel = hsl(baseHue, satBase, lightBase, 0.48);
  const panel2 = hsl(baseHue + randomIn(-8, 8), satBase - randomIn(0, 6), lightBase - randomIn(2, 6), 0.48);
  const btn = hsl(baseHue + randomIn(4, 12), satBase + randomIn(0, 6), lightBase + randomIn(2, 6), 0.50);
  const fn = hsl(baseHue - randomIn(4, 12), satBase + randomIn(0, 6), lightBase + randomIn(0, 4), 0.50);
  const op = hsl(baseHue + randomIn(16, 28), satBase + randomIn(2, 8), lightBase + randomIn(6, 10), 0.54);
  const eq = hsl(baseHue + randomIn(120, 180), satBase + randomIn(8, 16), lightBase + randomIn(10, 16), 0.62);

  const root = document.documentElement.style;
  root.setProperty("--panel", panel);
  root.setProperty("--panel-2", panel2);
  root.setProperty("--btn", btn);
  root.setProperty("--fn", fn);
  root.setProperty("--op", op);
  root.setProperty("--eq", eq);

  const lMatch = panel.match(/hsla\(\d+,\s*\d+%\,\s*(\d+)%/);
  const l = lMatch ? parseFloat(lMatch[1]) : 18;
  if (l > 55) { root.setProperty("--ink", "#0b1420"); root.setProperty("--ink-dim", "#273344"); }
  else { root.setProperty("--ink", "#f6fff9"); root.setProperty("--ink-dim", "#d6e8e0"); }
}

class BlobPrefetcher {
  private TARGET = 10;
  private ready: string[] = [];
  private inFlight = 0;
  private waiters: Array<(url: string) => void> = [];
  private toppingUp = false;
  private lastApplied: string | null = null;

  constructor(target = 10) { this.TARGET = target; }

  private makePicsumUrl() {
    const w = Math.max(800, window.innerWidth);
    const h = Math.max(600, window.innerHeight);
    return `https://picsum.photos/${w}/${h}?random=${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private deliver(url: string) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(url);
    else if (this.ready.length < this.TARGET) this.ready.push(url);
  }

  private async prefetchOne(): Promise<void> {
    this.inFlight++;
    try {
      const res = await fetch(this.makePicsumUrl(), { cache: "no-store", mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = objUrl;
        (img as { decoding?: string }).decoding = "async";
        (img as { referrerPolicy?: string }).referrerPolicy = "no-referrer";
      }).catch(() => { });

      this.deliver(objUrl);
    } catch {
      // swallow errors
    } finally {
      this.inFlight--;
    }
  }

  async topUp() {
    if (this.toppingUp) return;
    this.toppingUp = true;
    try {
      const deficit = this.TARGET - (this.ready.length + this.inFlight);
      if (deficit > 0) await Promise.all(Array.from({ length: deficit }, () => this.prefetchOne()));
    } finally {
      this.toppingUp = false;
      if (this.ready.length + this.inFlight < this.TARGET) queueMicrotask(() => this.topUp());
    }
  }

  async consumeOrWait(timeoutMs = 6000): Promise<string | null> {
    const url = this.ready.shift();
    if (url) return url;

    if (this.inFlight > 0) {
      return new Promise<string | null>((resolve) => {
        const t = window.setTimeout(() => resolve(null), timeoutMs);
        this.waiters.push((u) => { window.clearTimeout(t); resolve(u); });
      });
    }
    return null;
  }

  applied(url: string) {
    if (this.lastApplied) URL.revokeObjectURL(this.lastApplied);
    this.lastApplied = url;
  }
}

const prefetcher = new BlobPrefetcher(10);

function setBackground(url: string) {
  document.body.style.backgroundImage = `url("${url}")`;
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundAttachment = "fixed";
  prefetcher.applied(url);
}

async function setBackgroundSmart() {
  let url = await prefetcher.consumeOrWait(6000);
  if (url) { setBackground(url); return; }

  showSpinner(true);
  await prefetcher.topUp();
  url = await prefetcher.consumeOrWait(6000);
  showSpinner(false);

  if (url) setBackground(url);
}

/* ---------- Mystery click ---------- */
async function onMystery() {
  randomizePalette();
  await setBackgroundSmart();
  const calc = document.getElementById("calculator");
  calc?.animate([{ filter: "brightness(1.2)" }, { filter: "brightness(1.0)" }], { duration: 350, easing: "ease-out" });
  void prefetcher.topUp();
}

/* ---------- Dispatcher ---------- */
function handlePress(key: string) {
  if (/^[0-9]$/.test(key)) return insertDigit(key);
  switch (key) {
    case "modeMain": keypadMode = "main"; return render();
    case "modeAbc": keypadMode = "abc"; return render();
    case "modeFunc": keypadMode = "func"; return render();
    case "toggleAngle": angleMode = angleMode === "deg" ? "rad" : "deg"; return render();
    case "toggleFrac": fractionOutput = !fractionOutput; return render();
    case "ans": return insertToken("ans");
    case "dot": return insertDot();
    case "clear": return clearAll();
    case "sign": return toggleSign();
    case "parenToggle": return parenToggle();
    case "divide": return insertOp("div");
    case "multiply": return insertOp("mul");
    case "minus": return insertOp("sub");
    case "plus": return insertOp("add");
    case "equals": return equals();
    case "mystery": return onMystery();
  }
}

function clearAll() {
  expr = "0";
  justEvaluated = false;
  render();
}

function insertFuncKeyFromMode(letter: string): boolean {
  if (keypadMode !== "func") return false;
  if (letter === "s") { insertToken("sin("); return true; }
  if (letter === "c") { insertToken("cos("); return true; }
  if (letter === "t") { insertToken("tan("); return true; }
  if (letter === "q") { insertToken("sqrt("); return true; }
  if (letter === "p") { insertToken("pi"); return true; }
  return false;
}

function cycleMode() {
  keypadMode = keypadMode === "main" ? "abc" : keypadMode === "abc" ? "func" : "main";
  render();
}

function applyModeSlot(index: number) {
  const slot = MODE_KEYS[keypadMode][index];
  if (!slot) return;
  if (slot.token === ".") return insertDot();
  if (slot.token === "÷") return insertOp("div");
  return insertToken(slot.token);
}

/* Events */
keysEl.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement | null)?.closest("button[data-key]") as HTMLElement | null;
  const key = t?.getAttribute?.("data-key");
  if (key) handlePress(key);
});
displayControlsEl?.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement | null)?.closest("button[data-key]") as HTMLElement | null;
  const key = t?.getAttribute?.("data-key");
  if (key) handlePress(key);
});
modeKeysEl?.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement | null)?.closest("button[data-key]") as HTMLElement | null;
  const key = t?.getAttribute?.("data-key");
  if (!key || !key.startsWith("modeSlot")) return;
  const idx = Number(key.replace("modeSlot", ""));
  if (!Number.isInteger(idx)) return;
  applyModeSlot(idx);
});
window.addEventListener("keydown", (e) => {
  const k = e.key;
  const lower = k.toLowerCase();

  if (e.altKey && lower === "d") { e.preventDefault(); angleMode = angleMode === "deg" ? "rad" : "deg"; return render(); }
  if (e.altKey && lower === "f") { e.preventDefault(); fractionOutput = !fractionOutput; return render(); }
  if (e.altKey && k === "1") { e.preventDefault(); keypadMode = "main"; return render(); }
  if (e.altKey && k === "2") { e.preventDefault(); keypadMode = "abc"; return render(); }
  if (e.altKey && k === "3") { e.preventDefault(); keypadMode = "func"; return render(); }
  if (e.altKey && lower === "m") { e.preventDefault(); return cycleMode(); }

  if (/^\d$/.test(k)) return insertDigit(k);
  if (k === "." || k === ",") return insertDot();
  if (k === "(") return insertLParen();
  if (k === ")") return insertRParen();
  if (k === "Enter" || k === "=") return equals();
  if (k === "Backspace") return backspace();
  if (k === "+") return insertOp("add");
  if (k === "-") return insertOp("sub");
  if (k === "*" || lower === "x") return insertOp("mul");
  if (k === "/") return insertOp("div");
  if (k === "?") return onMystery();
  if (lower === "c" || lower === "a") return clearAll();

  if (insertFuncKeyFromMode(lower)) return;
  if (keypadMode === "abc" && /^[a-z]$/.test(lower)) return insertToken(lower);
});

void prefetcher.topUp();
render();
