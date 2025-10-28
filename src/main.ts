type Op = "add" | "sub" | "mul" | "div";
const valueEl = document.getElementById("value") as HTMLElement;
const historyEl = document.getElementById("history") as HTMLElement;
const keysEl = document.querySelector(".keys") as HTMLElement;

/** Expression shown while typing; becomes result string after '=' */
let expr = "0";
/** The previous calculation expression, persists until next '=' */
let historyText = "";
/** True immediately after '=', so next digit starts a new expression (history stays) */
let justEvaluated = false;

function setValue(s: string) {
  valueEl.textContent = s;
  updateDisplayFont();
}
function setHistory(s: string) { historyEl.textContent = s; }
function render() { setValue(expr); setHistory(historyText); }

/* Operators we render */
const OP_CHARS = "+\u2212×÷"; // + − × ÷
function isOpChar(c: string) { return OP_CHARS.includes(c); }
function endsWithOp(s: string) { return s.length > 0 && isOpChar(s[s.length - 1]); }

/* ---------- Adaptive display font ---------- */
function updateDisplayFont() {
  const len = (valueEl.textContent ?? "").length;
  let sizeVmin = 7.2; // baseline
  if (len > 10) sizeVmin = Math.max(3.4, 7.2 - (len - 10) * 0.35);
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
function getCurrentNumber(s: string) {
  const [a, b] = currentNumberBounds(s);
  const raw = s.slice(a, b);
  return { raw, a, b };
}
function replaceRange(s: string, a: number, b: number, repl: string) {
  return s.slice(0, a) + repl + s.slice(b);
}

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
  const repl = raw.length ? (raw + ".") : "0.";
  expr = replaceRange(expr, a, b, repl);
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
  const ch = which === "add" ? "+" :
             which === "sub" ? "\u2212" :
             which === "mul" ? "×" : "÷";
  if (justEvaluated) { justEvaluated = false; }
  if (expr === "0" && which !== "sub") return;
  if (endsWithOp(expr)) expr = expr.slice(0, -1) + ch;
  else expr += ch;
  render();
}

/* ---------- Parentheses ---------- */
function unmatchedLeftParens(s: string): number {
  let bal = 0;
  for (const ch of s) { if (ch === "(") bal++; else if (ch === ")") bal = Math.max(0, bal - 1); }
  return bal;
}
function insertLParen() {
  if (expr === "0") { expr = "("; }
  else if (endsWithOp(expr) || expr.endsWith("(")) expr += "(";
  else expr += "×(";
  render();
}
function insertRParen() {
  const need = unmatchedLeftParens(expr);
  if (need <= 0) return;
  if (endsWithOp(expr) || expr.endsWith("(")) expr = expr.slice(0, -1);
  expr += ")";
  render();
}

/* ---------- Evaluation (unary minus + parentheses) ---------- */
function normalizeForEval(s: string): string {
  let t = s.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  while (/[+\-*/.(]$/.test(t)) t = t.slice(0, -1);
  if (!t.length) t = "0";
  return t;
}
function evalExprWithUnaryAndParens(s: string): number {
  type Tok = { type: "num"; v: number } | { type: "op"; v: string } | { type: "lpar" } | { type: "rpar" };
  const toks: Tok[] = [];
  let i = 0;
  let prev: "start" | "num" | "op" | "lpar" | "rpar" = "start";

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
        const num = Number(s.slice(i, j));
        if (!Number.isFinite(num)) return NaN;
        toks.push({ type: "num", v: num });
        prev = "num"; i = j; continue;
      } else { toks.push({ type: "op", v: c }); prev = "op"; i++; continue; }
    }
    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i + 1; while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const num = Number(s.slice(i, j)); if (!Number.isFinite(num)) return NaN;
      toks.push({ type: "num", v: num }); prev = "num"; i = j; continue;
    }
    i++; // skip unknown
  }

  const prec: Record<string, number> = { "+":1, "-":1, "*":2, "/":2 };
  const out: (number|string)[] = []; const ops: string[] = [];
  for (const t of toks) {
    if (t.type === "num") out.push(t.v);
    else if (t.type === "op") {
      while (ops.length) {
        const top = ops[ops.length-1];
        if ("+-*/".includes(top) && prec[top] >= prec[t.v]) out.push(ops.pop() as string);
        else break;
      }
      ops.push(t.v);
    } else if (t.type === "lpar") ops.push("(");
    else if (t.type === "rpar") {
      while (ops.length && ops[ops.length-1] !== "(") out.push(ops.pop() as string);
      if (ops.length && ops[ops.length-1] === "(") ops.pop();
    }
  }
  while (ops.length) out.push(ops.pop() as string);

  const st: number[] = [];
  for (const tok of out) {
    if (typeof tok === "number") st.push(tok);
    else {
      const b = st.pop(); const a = st.pop();
      if (a === undefined || b === undefined) return NaN;
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
  historyText = raw;
  expr = out;
  justEvaluated = true;
  render();
}

/* ---------- Mystery: randomize theme + random background image ---------- */
function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}
function clamp(n: number, min: number, max: number){ return Math.min(max, Math.max(min, n)); }

function randomizeTheme() {
  // 1) Random background photo sized to viewport
  const w = Math.max(800, window.innerWidth);
  const hgt = Math.max(600, window.innerHeight);
  const url = `https://picsum.photos/${w}/${hgt}?random=${Date.now()}`;
  document.body.style.backgroundImage = `url("${url}")`;
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundAttachment = "fixed";

  // 2) Harmonized palette (single hue with offsets), semi-transparent for glass effect
  const base = Math.random() * 360;
  const panel   = hsl(base,             50, 18, 0.82);
  const panel2  = hsl(base,             48, 14, 0.82);
  const btn     = hsl(base + 6,         54, 22, 0.86);
  const fn      = hsl(base - 6,         54, 20, 0.86);
  const op      = hsl(base + 24,        56, 28, 0.88);
  const eq      = hsl(base + 140,       62, 36, 0.92); // pop color

  const root = document.documentElement.style;
  root.setProperty("--panel", panel);
  root.setProperty("--panel-2", panel2);
  root.setProperty("--btn", btn);
  root.setProperty("--fn", fn);
  root.setProperty("--op", op);
  root.setProperty("--eq", eq);

  // 3) Ensure readable text: pick ink vs ink-dim based on panel luminance proxy
  // lightness from panel color string (quick parse of "hsla(h, s%, l%, a)")
  const match = panel.match(/hsla\(\d+,\s*\d+%\,\s*(\d+)%/);
  const l = match ? parseFloat(match[1]) : 18;
  if (l > 55) {
    root.setProperty("--ink", "#0b1420");
    root.setProperty("--ink-dim", "#273344");
  } else {
    root.setProperty("--ink", "#f6fff9");
    root.setProperty("--ink-dim", "#d6e8e0");
  }

  // Subtle flash to indicate change
  const calc = document.getElementById("calculator")!;
  calc.animate([{ filter: "brightness(1.2)" }, { filter: "brightness(1.0)" }], { duration: 350, easing: "ease-out" });
}

/* ---------- Mystery (button) ---------- */
function onMystery() {
  randomizeTheme();
}

/* ---------- Dispatcher ---------- */
function handlePress(key: string) {
  if (/^[0-9]$/.test(key)) return insertDigit(key);
  switch (key) {
    case "dot": return insertDot();
    case "clear": return clearAll();
    case "sign": return toggleSign();
    case "lparen": return insertLParen();
    case "rparen": return insertRParen();
    case "divide": return insertOp("div");
    case "multiply": return insertOp("mul");
    case "minus": return insertOp("sub");
    case "plus": return insertOp("add");
    case "equals": return equals();
    case "mystery": return onMystery();
  }
}

keysEl.addEventListener("click", (e) => {
  const t = e.target as HTMLElement | null;
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

render();
