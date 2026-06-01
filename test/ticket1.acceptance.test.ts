import { describe, expect, it } from "vitest";
import { createTicket1Harness } from "../src/ticket1/harness";

describe("Ticket #1 acceptance: scientific calculator UX baseline", () => {
  it("starts with one active expression line", () => {
    const calc = createTicket1Harness();
    expect(calc.getLines()).toEqual([{ input: "" }]);
    expect(calc.getActiveLineIndex()).toBe(0);
  });

  it("evaluates the active line and appends a new line", () => {
    const calc = createTicket1Harness();
    calc.setActiveInput("2+3");
    expect(calc.evaluateActiveLine()).toBe("5");
    expect(calc.getLines()).toEqual([{ input: "2+3", output: "5" }, { input: "" }]);
    expect(calc.getActiveLineIndex()).toBe(1);
  });

  it("supports ans token as previous result", () => {
    const calc = createTicket1Harness();
    calc.setActiveInput("2+3");
    calc.evaluateActiveLine();
    calc.setActiveInput("ans*4");
    expect(calc.evaluateActiveLine()).toBe("20");
  });

  it("defaults to main keypad mode", () => {
    const calc = createTicket1Harness();
    expect(calc.getKeypadMode()).toBe("main");
  });

  it("switches keypad mode to abc and func", () => {
    const calc = createTicket1Harness();
    calc.setKeypadMode("abc");
    expect(calc.getKeypadMode()).toBe("abc");
    calc.setKeypadMode("func");
    expect(calc.getKeypadMode()).toBe("func");
  });

  it("changes visible keys when keypad mode changes", () => {
    const calc = createTicket1Harness();
    calc.setKeypadMode("main");
    const mainKeys = calc.getVisibleKeys();
    calc.setKeypadMode("abc");
    const abcKeys = calc.getVisibleKeys();
    calc.setKeypadMode("func");
    const funcKeys = calc.getVisibleKeys();

    expect(mainKeys).not.toEqual(abcKeys);
    expect(abcKeys).not.toEqual(funcKeys);
  });

  it("keeps input intact while switching keypad modes", () => {
    const calc = createTicket1Harness();
    calc.setActiveInput("12+");
    calc.setKeypadMode("abc");
    calc.setKeypadMode("func");
    calc.setKeypadMode("main");
    expect(calc.getLines()[0]?.input).toBe("12+");
  });

  it("defaults to degree mode", () => {
    const calc = createTicket1Harness();
    expect(calc.getSettings().angleMode).toBe("deg");
  });

  it("uses degree mode in trig evaluation", () => {
    const calc = createTicket1Harness();
    calc.setAngleMode("deg");
    calc.setActiveInput("sin(90)");
    expect(calc.evaluateActiveLine()).toBe("1");
  });

  it("uses radian mode in trig evaluation", () => {
    const calc = createTicket1Harness();
    calc.setAngleMode("rad");
    calc.setActiveInput("sin(90)");
    expect(calc.evaluateActiveLine()).toBe("0.8939966636");
  });

  it("supports decimal/fraction display toggle", () => {
    const calc = createTicket1Harness();
    calc.setActiveInput("1/2");
    calc.setFractionOutput(true);
    expect(calc.evaluateActiveLine()).toBe("1/2");

    calc.setActiveInput("1/2");
    calc.setFractionOutput(false);
    expect(calc.evaluateActiveLine()).toBe("0.5");
  });

  it("exposes settings surface with both required toggles", () => {
    const calc = createTicket1Harness();
    const settings = calc.getSettings();
    expect(settings).toHaveProperty("angleMode");
    expect(settings).toHaveProperty("fractionOutput");
  });
});
