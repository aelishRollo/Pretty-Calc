export type KeypadMode = "main" | "abc" | "func";
export type AngleMode = "deg" | "rad";

export type ExpressionLine = {
  input: string;
  output?: string;
};

export type SettingsState = {
  angleMode: AngleMode;
  fractionOutput: boolean;
};

export interface Ticket1Harness {
  getLines(): ExpressionLine[];
  getActiveLineIndex(): number;
  setActiveInput(input: string): void;
  evaluateActiveLine(): string;
  pressToken(token: string): void;
  getKeypadMode(): KeypadMode;
  setKeypadMode(mode: KeypadMode): void;
  getVisibleKeys(): string[];
  getSettings(): SettingsState;
  setAngleMode(mode: AngleMode): void;
  setFractionOutput(enabled: boolean): void;
}

const MAIN_KEYS = [
  "0",
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  ".",
  "+",
  "-",
  "*",
  "/",
  "(",
  ")",
  "ans",
  "=",
];

const ABC_KEYS = [
  "a",
  "b",
  "c",
  "x",
  "y",
  "z",
  ",",
  "ans",
  "(",
  ")",
];

const FUNC_KEYS = [
  "sin",
  "cos",
  "tan",
  "pi",
  "sqrt",
  "^",
  "(",
  ")",
  "ans",
];

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x || 1;
}

function reduceFraction(n: number, d: number): string {
  if (d === 0) return "Error";
  const sign = (n < 0) !== (d < 0) ? "-" : "";
  const num = Math.abs(n);
  const den = Math.abs(d);
  const div = gcd(num, den);
  return `${sign}${num / div}/${den / div}`;
}

function maybeFractionFromInput(input: string): string | null {
  const m = input.trim().match(/^(-?\d+)\s*\/\s*(-?\d+)$/);
  if (!m) return null;
  const num = Number(m[1]);
  const den = Number(m[2]);
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) return null;
  return reduceFraction(num, den);
}

function formatDecimal(n: number): string {
  if (!Number.isFinite(n)) return "Error";
  const rounded10 = Number(n.toFixed(10));
  if (Number.isInteger(rounded10)) return String(rounded10);
  return rounded10.toString();
}

function toEvalString(input: string, ansValue: number, angleMode: AngleMode): string {
  let s = input;
  s = s.replace(/−/g, "-").replace(/×/g, "*").replace(/÷/g, "/");
  s = s.replace(/\bans\b/g, `(${ansValue})`);
  s = s.replace(/\bpi\b/gi, `${Math.PI}`);
  s = s.replace(/\bsin\s*\(/g, "__sin(");
  s = s.replace(/\bcos\s*\(/g, "__cos(");
  s = s.replace(/\btan\s*\(/g, "__tan(");
  s = s.replace(/\bsqrt\s*\(/g, "__sqrt(");
  s = s.replace(/\^/g, "**");
  return s;
}

function evaluateExpression(input: string, ansValue: number, angleMode: AngleMode): number {
  const expr = toEvalString(input, ansValue, angleMode);
  const trigAdapter = (x: number): number => (angleMode === "deg" ? (x * Math.PI) / 180 : x);

  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(
      "__sin",
      "__cos",
      "__tan",
      "__sqrt",
      `return (${expr});`,
    ) as (
      sin: (x: number) => number,
      cos: (x: number) => number,
      tan: (x: number) => number,
      sqrt: (x: number) => number,
    ) => number;
    const value = fn(
      (x) => Math.sin(trigAdapter(x)),
      (x) => Math.cos(trigAdapter(x)),
      (x) => Math.tan(trigAdapter(x)),
      (x) => Math.sqrt(x),
    );
    if (typeof value !== "number" || !Number.isFinite(value)) return NaN;
    return value;
  } catch {
    return NaN;
  }
}

export function createTicket1Harness(): Ticket1Harness {
  let lines: ExpressionLine[] = [{ input: "" }];
  let activeLineIndex = 0;
  let keypadMode: KeypadMode = "main";
  let settings: SettingsState = {
    angleMode: "deg",
    fractionOutput: false,
  };
  let ansValue = 0;

  function ensureActiveLine(): void {
    if (!lines[activeLineIndex]) {
      lines[activeLineIndex] = { input: "" };
    }
  }

  function getActiveLine(): ExpressionLine {
    ensureActiveLine();
    return lines[activeLineIndex] as ExpressionLine;
  }

  return {
    getLines() {
      return lines.map((line) => ({ ...line }));
    },
    getActiveLineIndex() {
      return activeLineIndex;
    },
    setActiveInput(input: string) {
      const line = getActiveLine();
      line.input = input;
    },
    evaluateActiveLine() {
      const line = getActiveLine();
      const rawInput = line.input.trim();
      const numeric = evaluateExpression(rawInput, ansValue, settings.angleMode);
      const decimalOut = formatDecimal(numeric);
      const fractionOut = settings.fractionOutput ? maybeFractionFromInput(rawInput) : null;
      const finalOut = fractionOut ?? decimalOut;

      line.output = finalOut;
      if (Number.isFinite(numeric)) ansValue = numeric;

      lines = [...lines, { input: "" }];
      activeLineIndex = lines.length - 1;
      return finalOut;
    },
    pressToken(token: string) {
      const line = getActiveLine();
      line.input += token;
    },
    getKeypadMode() {
      return keypadMode;
    },
    setKeypadMode(mode: KeypadMode) {
      keypadMode = mode;
    },
    getVisibleKeys() {
      if (keypadMode === "abc") return ABC_KEYS.slice();
      if (keypadMode === "func") return FUNC_KEYS.slice();
      return MAIN_KEYS.slice();
    },
    getSettings() {
      return { ...settings };
    },
    setAngleMode(mode: AngleMode) {
      settings = { ...settings, angleMode: mode };
    },
    setFractionOutput(enabled: boolean) {
      settings = { ...settings, fractionOutput: enabled };
    },
  };
}
