type Op = "add" | "sub" | "mul" | "div";
const valueEl = document.getElementById("value") as HTMLElement;
const historyEl = document.getElementById("history") as HTMLElement;
const keysEl = document.querySelector(".keys") as HTMLElement;
const spinnerEl = document.getElementById("spinner") as HTMLElement;

/** Expression shown while typing; becomes result string after '=' */
let expr = "0";
let historyText = "";
let justEvaluated = false;

function setValue(s: string) { valueEl.textContent = s; updateDisplayFont(); }
function setHistory(s: string) { historyEl.textContent = s; }
function render() { setValue(expr); setHistory(historyText); }

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
  if (s.length === 0) return [0,0];
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

/* ---------- Evaluation ---------- */
function normalizeForEval(s: string): string {
  let t = s.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  while (/[+\-*/.(]$/.test(t)) t = t.slice(0, -1);
  return t.length ? t : "0";
}
function evalExprWithUnaryAndParens(s: string): number {
  type Tok = { type: "num"; v: number } | { type: "op"; v: string } | { type: "lpar" } | { type: "rpar" };
  const toks: Tok[] = []; let i = 0; let prev: "start" | "num" | "op" | "lpar" | "rpar" = "start";
  while (i < s.length) {
    const c = s[i];
    if (c === " ") { i++; continue; }
    if (c === "(") { toks.push({ type: "lpar" }); prev = "lpar"; i++; continue; }
    if (c === ")") { toks.push({ type: "rpar" }); prev = "rpar"; i++; continue; }
    if ("+-*/".includes(c)) {
      const isUnaryMinus = (c === "-" && (prev === "start" || prev === "op" || prev === "lpar"));
      if (isUnaryMinus) {
        let j = i + 1; if (s[j] === ".") j++;
        while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
        const num = Number(s.slice(i, j)); if (!Number.isFinite(num)) return NaN;
        toks.push({ type: "num", v: num }); prev = "num"; i = j; continue;
      } else { toks.push({ type: "op", v: c }); prev = "op"; i++; continue; }
    }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i + 1; while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const num = Number(s.slice(i, j)); if (!Number.isFinite(num)) return NaN;
      toks.push({ type: "num", v: num }); prev = "num"; i = j; continue;
    }
    i++;
  }
  const prec: Record<string, number> = { "+":1, "-":1, "*":2, "/":2 };
  const out: (number|string)[] = []; const ops: string[] = [];
  for (const t of toks) {
    if (t.type === "num") out.push(t.v);
    else if (t.type === "op") {
      while (ops.length) {
        const top = ops[ops.length-1];
        if ("+-*/".includes(top) && prec[top] >= prec[t.v]) out.push(ops.pop() as string); else break;
      }
      ops.push(t.v);
    } else if (t.type === "lpar") ops.push("(");
    else if (t.type === "rpar") { while (ops.length && ops[ops.length-1] !== "(") out.push(ops.pop() as string); if (ops.length && ops[ops.length-1] === "(") ops.pop(); }
  }
  while (ops.length) out.push(ops.pop() as string);
  const st: number[] = [];
  for (const tok of out) {
    if (typeof tok === "number") st.push(tok);
    else { const b = st.pop(), a = st.pop(); if (a===undefined||b===undefined) return NaN;
      st.push(tok === "+" ? a + b : tok === "-" ? a - b : tok === "*" ? a * b : (b === 0 ? NaN : a / b));
    }
  }
  return st.length ? st[0] : NaN;
}
function fmt(n: number): string { return (!Number.isFinite(n)) ? "Error" : n.toFixed(12).replace(/\.?0+$/,""); }
function equals() {
  const missing = unmatchedLeftParens(expr);
  let balanced = expr; for (let i=0;i<missing;i++) balanced += ")";
  const raw = balanced;
  const norm = normalizeForEval(raw);
  const result = evalExprWithUnaryAndParens(norm);
  const out = fmt(result);
  historyText = raw; expr = out; justEvaluated = true; render();
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
function randomIn(min: number, max: number){ return Math.random() * (max - min) + min; }
function randomInt(min: number, max: number){ return Math.floor(randomIn(min, max)); }

function randomizePalette() {
  const theme = ["deep","mid","light"][randomInt(0,3)];
  const baseHue = randomIn(0, 360);
  const satBase = theme === "deep" ? randomIn(44, 58) : theme === "mid" ? randomIn(38, 52) : randomIn(30, 45);
  const lightBase = theme === "deep" ? randomIn(12, 20) : theme === "mid" ? randomIn(18, 26) : randomIn(26, 34);
  const panel   = hsl(baseHue,                   satBase,                 lightBase, 0.48);
  const panel2  = hsl(baseHue + randomIn(-8,8),  satBase - randomIn(0,6), lightBase - randomIn(2,6), 0.48);
  const btn     = hsl(baseHue + randomIn(4,12),  satBase + randomIn(0,6), lightBase + randomIn(2,6), 0.50);
  const fn      = hsl(baseHue - randomIn(4,12),  satBase + randomIn(0,6), lightBase + randomIn(0,4), 0.50);
  const op      = hsl(baseHue + randomIn(16,28), satBase + randomIn(2,8), lightBase + randomIn(6,10), 0.54);
  const eq      = hsl(baseHue + randomIn(120,180), satBase + randomIn(8,16), lightBase + randomIn(10,16), 0.62);

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

/** Blob-based prefetcher (never re-requests on swap) */
class BlobPrefetcher {
  private TARGET = 10;
  private ready: string[] = [];          // object URLs
  private inFlight = 0;
  private waiters: Array<(url: string) => void> = [];
  private toppingUp = false;
  private lastApplied: string | null = null; // for URL.revokeObjectURL

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

  /** Fetch to blob, create object URL, and decode once to ensure it’s render-ready */
  private async prefetchOne(): Promise<void> {
    this.inFlight++;
    try {
      const res = await fetch(this.makePicsumUrl(), { cache: "no-store", mode: "cors", credentials: "omit" });
      if (!res.ok) throw new Error("image fetch failed");
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);

      // Decode via Image.decode() to ensure paint-ready (no jank on apply)
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("decode failed"));
        img.src = objUrl;
        (img as any).decoding = "async";
        (img as any).referrerPolicy = "no-referrer";
      }).catch(() => { /* if decode fails, still deliver; browser will handle */ });

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

  /** Consume ASAP; wait for in-flight before giving up */
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
    // Revoke previously applied to avoid leaks
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

  // Last resort: urgent top-up (still blob-based, so no flicker after)
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
  const calc = document.getElementById("calculator")!;
  calc.animate([{ filter: "brightness(1.2)" }, { filter: "brightness(1.0)" }], { duration: 350, easing: "ease-out" });
  void prefetcher.topUp();
}

/* ---------- Dispatcher ---------- */
function handlePress(key: string) {
  if (/^[0-9]$/.test(key)) return insertDigit(key);
  switch (key) {
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

/* Clear/all */
function clearAll() { expr = "0"; historyText = ""; justEvaluated = false; render(); }

/* Events (click fix: use closest button) */
keysEl.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement | null)?.closest("button[data-key]") as HTMLElement | null;
  const key = t?.getAttribute?.("data-key");
  if (key) handlePress(key);
});
window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/^\d$/.test(k)) return insertDigit(k);
  if (k === "." || k === ",") return insertDot();
  if (k === "(") return insertLParen();
  if (k === ")") return insertRParen();
  if (k === "Enter" || k === "=") return equals();
  if (k === "Backspace") return backspace();
  if (k === "+") return insertOp("add");
  if (k === "-") return insertOp("sub");
  if (k === "*" || k.toLowerCase() === "x") return insertOp("mul");
  if (k === "/") return insertOp("div");
  if (k === "?") return onMystery();
  if (k.toLowerCase() === "c" || k.toLowerCase() === "a") return clearAll();
});

/* Bootstrap: warm the cache only (no UI changes until user clicks) */
void prefetcher.topUp();

render();
