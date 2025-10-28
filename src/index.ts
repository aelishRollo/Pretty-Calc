export function add(a: number, b: number): number {
  return a + b;
}

if (require.main === module) {
  console.log("2 + 3 =", add(2, 3));
}
