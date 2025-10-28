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

/* ---------- Adaptive font size for long input ---------- */
function updateDisplayFont() {
  const len = (valueEl.textContent ?? "").length;
  // Start shrinking after ~10 chars; never go below ~3.4vmin.
  let sizeVmin = 7.2; // baseline
  if (len > 10) sizeVmin = Math.max(3.4, 7.2 - (len - 10) * 0.35);
  (valueEl.parentElement as HTMLElement).style.setProperty("--value-size", sizeVmin + "vmin");
}

/* ---------- Current number helpers (for ±, dot, digit insert) ---------- */
function currentNumberBounds(s: string): [number, number] {
  if (s.length === 0) return [0,0];
  let end = s.length;
  let start = end - 1;
  while (start >= 0 && ((s[start] >= "0" && s[start] <= "9") || s[start] === ".")) start--;
  // attach unary '-' if present right before number or at start
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
  if (expr === "0" && which !== "sub") return; // force a number before op (except unary '-')
  if (endsWithOp(expr)) expr = expr.slice(0, -1) + ch;
  else expr += ch;
  render();
}

/* ---------- Parentheses UX ---------- */
/* Most user-friendly: single "(" button; we auto-insert matching ")" on "=" if needed.
   Keyboard ")" works directly, and we'll allow it if there is an unmatched "(". */
function unmatchedLeftParens(s: string): number {
  let bal = 0;
  for (const ch of s) {
    if (ch === "(") bal++;
    else if (ch === ")") bal = Math.max(0, bal - 1);
  }
  return bal;
}
function insertLParen() {
  // If expression is "0" or ends with operator or "(", insert "(".
  // If it ends with a number or ")", implicitly insert a multiplication "×(" (nice UX).
  if (expr === "0") { expr = "("; }
  else if (endsWithOp(expr) || expr.endsWith("(")) expr += "(";
  else expr += "×(";
  render();
}
function insertRParen() {
  const need = unmatchedLeftParens(expr);
  if (need <= 0) return;
  // If last char is operator or "(", avoid dangling operator before ')'
  if (endsWithOp(expr) || expr.endsWith("(")) expr = expr.slice(0, -1);
  expr += ")";
  render();
}

function clearAll() {
  expr = "0";
  historyText = "";
  justEvaluated = false;
  render();
}

/* ---------- Evaluation (shunting-yard with unary minus & parentheses) ---------- */
function normalizeForEval(s: string): string {
  let t = s.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  // trim trailing operator/dot/left paren
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
        let j = i + 1;
        if (s[j] === ".") j++;
        while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
        const num = Number(s.slice(i, j));
        if (!Number.isFinite(num)) return NaN;
        toks.push({ type: "num", v: num });
        prev = "num";
        i = j;
      } else {
        toks.push({ type: "op", v: c });
        prev = "op";
        i++;
      }
      continue;
    }

    if ((c >= "0" && c <= "9") || c === ".") {
      let j = i + 1;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      const num = Number(s.slice(i, j));
      if (!Number.isFinite(num)) return NaN;
      toks.push({ type: "num", v: num });
      prev = "num";
      i = j;
      continue;
    }

    i++; // skip unknown
  }

  const prec: Record<string, number> = { "+":1, "-":1, "*":2, "/":2 };
  const out: (number|string)[] = [];
  const ops: string[] = [];

  for (const t of toks) {
    if (t.type === "num") out.push(t.v);
    else if (t.type === "op") {
      while (ops.length) {
        const top = ops[ops.length-1];
        if ("+-*/".includes(top) && prec[top] >= prec[t.v]) out.push(ops.pop() as string);
        else break;
      }
      ops.push(t.v);
    } else if (t.type === "lpar") {
      ops.push("(");
    } else if (t.type === "rpar") {
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
      let r = 0;
      switch (tok){
        case "+": r = a + b; break;
        case "-": r = a - b; break;
        case "*": r = a * b; break;
        case "/": r = b === 0 ? NaN : a / b; break;
      }
      st.push(r);
    }
  }
  return st.length ? st[0] : NaN;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  return n.toFixed(12).replace(/\.?0+$/,"");
}

function equals() {
  // Auto-close any unmatched left parens for user-friendliness
  const missing = unmatchedLeftParens(expr);
  let balanced = expr;
  for (let i=0;i<missing;i++) balanced += ")";

  const raw = balanced;
  const norm = normalizeForEval(raw.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/"));
  const result = evalExprWithUnaryAndParens(norm);
  const out = fmt(result);
  historyText = raw;  // keep the expression above
  expr = out;         // show numeric result below
  justEvaluated = true;
  render();
}

/* Mystery idea #1: insert a random digit (keeps math valid) */
function insertMystery() {
  const d = Math.floor(Math.random() * 10).toString();
  insertDigit(d);
}

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
    case "mystery": return insertMystery();
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
  if (k === "?") return insertMystery();
  if (k.toLowerCase() === "c" || k.toLowerCase() === "a") return clearAll();
});

render();
