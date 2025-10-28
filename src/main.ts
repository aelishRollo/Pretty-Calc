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
