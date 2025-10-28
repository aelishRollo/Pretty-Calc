type Op = "add" | "sub" | "mul" | "div" | "mod";
const valueEl = document.getElementById("value") as HTMLElement;
const historyEl = document.getElementById("history") as HTMLElement;
const keysEl = document.querySelector(".keys") as HTMLElement;

/** Expression shown while typing; becomes result string after '=' */
let expr = "0";
/** The previous calculation expression, persists until next '=' */
let historyText = "";
/** True immediately after '=', so next digit starts a new expression (history stays) */
let justEvaluated = false;

function setValue(s: string) { valueEl.textContent = s; }
function setHistory(s: string) { historyEl.textContent = s; }
function render() {
  setValue(expr);
  setHistory(historyText);
}

/* Helpers */
const OP_CHARS = "+\u2212×÷%"; // + − × ÷ %
function isOpChar(c: string) { return OP_CHARS.includes(c); }
function endsWithOp(s: string) { return s.length > 0 && isOpChar(s[s.length - 1]); }

function currentNumberBounds(s: string): [number, number] {
  // handle wrapped negative like "…(-123.4)"
  if (s.endsWith(")")) {
    const open = s.lastIndexOf("(");
    if (open !== -1 && s.slice(open, open + 2) === "(-") {
      return [open, s.length];
    }
  }
  let i = s.length - 1;
  while (i >= 0) {
    const ch = s[i];
    if ((ch >= "0" && ch <= "9") || ch === ".") { i--; continue; }
    break;
  }
  return [Math.max(0, i + 1), s.length];
}

function getCurrentNumber(s: string) {
  const [a, b] = currentNumberBounds(s);
  const raw = s.slice(a, b);
  const inner = raw.startsWith("(-") && raw.endsWith(")") ? raw.slice(2, -1) : raw;
  return { raw, inner, a, b };
}

function replaceRange(s: string, a: number, b: number, repl: string) {
  return s.slice(0, a) + repl + s.slice(b);
}

function insertDigit(d: string) {
  if (justEvaluated) { expr = "0"; justEvaluated = false; }
  const { raw, inner, a, b } = getCurrentNumber(expr);
  if (expr === "0" && !inner.includes(".")) {
    expr = d; // replace leading zero
  } else {
    expr = replaceRange(expr, a, b, raw === "" ? d : raw + d);
  }
  render();
}

function insertDot() {
  if (justEvaluated) { expr = "0"; justEvaluated = false; }
  const { raw, inner, a, b } = getCurrentNumber(expr);
  if (inner.includes(".")) return;
  if (raw === "" || inner === "") {
    expr = replaceRange(expr, a, b, (raw.startsWith("(-") ? "(-0.)" : "0."));
  } else {
    expr = replaceRange(expr, a, b, raw + ".");
  }
  render();
}

function toggleSign() {
  if (justEvaluated) { /* keep showing result but allow new negative start */ }
  const { raw, inner, a, b } = getCurrentNumber(expr);
  if (!inner || inner === "0") return;
  const wrapped = raw.startsWith("(-") && raw.endsWith(")");
  const repl = wrapped ? inner : "(-" + inner + ")";
  expr = replaceRange(expr, a, b, repl);
  render();
}

function backspace() {
  if (justEvaluated) return; // after '=', backspace does nothing until new input
  if (expr.length <= 1) { expr = "0"; return render(); }
  expr = expr.slice(0, -1);
  if (expr === "" || expr === "-" || expr === "(-") expr = "0";
  render();
}

function insertOp(which: Op) {
  const ch = which === "add" ? "+" :
             which === "sub" ? "\u2212" :
             which === "mul" ? "×" :
             which === "div" ? "÷" : "%";
  if (justEvaluated) { justEvaluated = false; } // continue from result
  if (expr === "0" && which !== "sub") return; // don't start with op except allow sign via ±
  if (endsWithOp(expr)) expr = expr.slice(0, -1) + ch;
  else expr += ch;
  render();
}

function clearAll() {
  expr = "0";
  historyText = "";
  justEvaluated = false;
  render();
}

/* Evaluation: shunting-yard with + - * / % and parentheses; '(-x)' becomes '(0-x)' */
function normalizeForEval(s: string): string {
  let t = s.replace(/\u2212/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  t = t.replace(/\(-/g, "(0-");
  // trim trailing operators/opens/dots
  while (/[+\-*/%(.]$/.test(t)) t = t.slice(0, -1);
  if (t === "") t = "0";
  return t;
}

function evalExpr(s: string): number {
  const prec: Record<string, number> = { "+":1, "-":1, "*":2, "/":2, "%":2 };
  const out: (number|string)[] = [];
  const ops: string[] = [];
  // tokenize
  for (let i=0;i<s.length;){
    const c = s[i];
    if (c >= "0" && c <= "9" || c === ".") {
      let j=i+1;
      while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
      out.push(parseFloat(s.slice(i,j)));
      i=j; continue;
    }
    if ("+-*/%".includes(c)) {
      while (ops.length){
        const top = ops[ops.length-1];
        if ("+-*/%".includes(top) && prec[top] >= prec[c]) {
          out.push(ops.pop() as string);
        } else break;
      }
      ops.push(c); i++; continue;
    }
    if (c === "("){ ops.push(c); i++; continue; }
    if (c === ")"){
      while (ops.length && ops[ops.length-1] !== "(") out.push(ops.pop() as string);
      if (ops.length && ops[ops.length-1] === "(") ops.pop();
      i++; continue;
    }
    // skip any stray spaces
    i++;
  }
  while (ops.length) out.push(ops.pop() as string);

  const st: number[] = [];
  for (const tok of out){
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
        case "%": r = b === 0 ? NaN : a % b; break;
      }
      st.push(r);
    }
  }
  return st.length ? st[0] : NaN;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const s = n.toFixed(12).replace(/\.?0+$/,"");
  return s;
}

/* Actions */
function equals() {
  const raw = expr;
  const norm = normalizeForEval(raw);
  const result = evalExpr(norm);
  const out = fmt(result);
  historyText = raw;  // persist previous expression above
  expr = out;         // show only the number after '='
  justEvaluated = true;
  render();
}

function handlePress(key: string) {
  if (/^[0-9]$/.test(key)) return insertDigit(key);
  switch (key) {
    case "dot": return insertDot();
    case "clear": return clearAll();
    case "sign": return toggleSign();
    case "percent": return insertOp("mod");
    case "divide": return insertOp("div");
    case "multiply": return insertOp("mul");
    case "minus": return insertOp("sub");
    case "plus": return insertOp("add");
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
  if (/^\d$/.test(k)) return insertDigit(k);
  if (k === "." || k === ",") return insertDot();
  if (k === "Enter" || k === "=") return equals();
  if (k === "Backspace") return backspace();
  if (k === "+") return insertOp("add");
  if (k === "-") return insertOp("sub");
  if (k === "*" || k.toLowerCase() === "x") return insertOp("mul");
  if (k === "/") return insertOp("div");
  if (k === "%") return insertOp("mod");
  if (k.toLowerCase() === "c" || k.toLowerCase() === "a") return clearAll();
});

render();
