#!/usr/bin/env bash
set -euo pipefail

mkdir -p src

# ---------- index.html ----------
cat <<'EOF' > index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Calculator</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div class="wrapper">
      <div id="calculator" role="application" aria-label="Calculator">
        <header class="display" aria-live="polite" aria-atomic="true" id="display">0</header>

        <main class="keys" aria-label="Calculator keypad">
          <!-- Row 1 -->
          <button class="key fn" data-key="clear" aria-label="All Clear">AC</button>
          <button class="key fn" data-key="sign" aria-label="Toggle Sign">±</button>
          <button class="key fn" data-key="percent" aria-label="Percent">%</button>
          <button class="key op" data-key="divide" aria-label="Divide">÷</button>

          <!-- Row 2 -->
          <button class="key" data-key="7">7</button>
          <button class="key" data-key="8">8</button>
          <button class="key" data-key="9">9</button>
          <button class="key op" data-key="multiply" aria-label="Multiply">×</button>

          <!-- Row 3 -->
          <button class="key" data-key="4">4</button>
          <button class="key" data-key="5">5</button>
          <button class="key" data-key="6">6</button>
          <button class="key op" data-key="minus" aria-label="Minus">−</button>

          <!-- Row 4 -->
          <button class="key" data-key="1">1</button>
          <button class="key" data-key="2">2</button>
          <button class="key" data-key="3">3</button>
          <button class="key op" data-key="plus" aria-label="Plus">+</button>

          <!-- Row 5 -->
          <button class="key zero" data-key="0" aria-label="Zero">0</button>
          <button class="key" data-key="dot" aria-label="Decimal">.</button>
          <button class="key eq" data-key="equals" aria-label="Equals">=</button>
        </main>
      </div>
    </div>

    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
EOF

# ---------- src/style.css ----------
cat <<'EOF' > src/style.css
:root{
  /* Dark green theme */
  --bg: #0b2b24;            /* page background */
  --pad-block: clamp(20px, 4vmin, 56px); /* comfy top/bottom padding */
  --pad-inline: clamp(16px, 4vmin, 40px);

  --panel: #0f3a31;         /* calculator body */
  --panel-2: #114238;       /* inner surfaces */
  --bevel: rgba(255,255,255,0.06);
  --shadow: rgba(0,0,0,0.35);

  --ink: #e6ffef;           /* primary text */
  --ink-dim: #bde6cc;       /* secondary text */

  --btn: #155348;           /* number button */
  --btn-hover: #1a5e52;
  --btn-active: #11463d;

  --fn: #0e4b40;            /* function (AC, ±, %) */
  --fn-hover: #10564a;
  --fn-active: #0a3c33;

  --op: #1b6f60;            /* operators */
  --op-hover: #1f7b6b;
  --op-active: #166556;

  --eq: #2d9c86;            /* equals */
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

# ---------- src/main.ts ----------
# Minimal hookup: no real math yet, just a shell (keeps display at "0" and logs button presses)
cat <<'EOF' > src/main.ts
const displayEl = document.getElementById("display") as HTMLElement;
const keys = document.querySelector(".keys") as HTMLElement;

let current = "0";

function render() {
  displayEl.textContent = current;
}

function handlePress(key: string) {
  // Placeholder behavior; real math to be added later
  if (/^[0-9]$/.test(key)) {
    current = current === "0" ? key : current + key;
  } else if (key === "dot") {
    if (!current.includes(".")) current += ".";
  } else if (key === "clear") {
    current = "0";
  } else if (key === "sign") {
    if (current.startsWith("-")) current = current.slice(1);
    else if (current !== "0") current = "-" + current;
  } else if (key === "percent") {
    const n = Number(current);
    if (!Number.isNaN(n)) current = String(n / 100);
  } else {
    // ops/equals are stubs for now
  }
  render();
}

keys.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  const key = target?.getAttribute?.("data-key");
  if (key) handlePress(key);
});

render();
EOF

echo "✅ UI updated: dark green theme, comfy padding, structured display & keypad."
echo "Run: pnpm dev   (or npm run dev) to see the new look."
