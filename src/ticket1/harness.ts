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

export function createTicket1Harness(): Ticket1Harness {
  throw new Error("Ticket #1 harness not implemented yet.");
}
