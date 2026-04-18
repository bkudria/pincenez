import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Readable } from "node:stream";
import type { Command } from "commander";

vi.mock("../src/config.js", () => ({
  loadChecksFile: vi.fn(),
}));
vi.mock("../src/runner.js", () => ({
  run: vi.fn(),
}));
vi.mock("../src/lint-runner.js", () => ({
  runLint: vi.fn(),
}));

import { loadChecksFile } from "../src/config.js";
import { run } from "../src/runner.js";
import { runLint } from "../src/lint-runner.js";
import { gradeAction, lintAction, readStdin } from "../src/cli.js";

const mockLoad = vi.mocked(loadChecksFile);
const mockRun = vi.mocked(run);
const mockRunLint = vi.mocked(runLint);

function makeProgramStub(): Command {
  const helpFn = vi.fn();
  return { help: helpFn } as unknown as Command;
}

describe("readStdin", () => {
  let originalIsTTY: boolean | undefined;
  let originalStdin: NodeJS.ReadStream;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    originalStdin = process.stdin;
  });

  afterEach(() => {
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
    Object.defineProperty(process, "stdin", { value: originalStdin, configurable: true });
  });

  it("returns empty string when stdin is a TTY", async () => {
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    await expect(readStdin()).resolves.toBe("");
  });

  it("reads concatenated chunks from non-TTY stdin", async () => {
    const fakeStdin = Readable.from([Buffer.from("hello "), Buffer.from("world")]) as unknown as NodeJS.ReadStream;
    Object.defineProperty(fakeStdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
    await expect(readStdin()).resolves.toBe("hello world");
  });
});

describe("gradeAction", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    originalIsTTY = process.stdin.isTTY;
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
    Object.defineProperty(process.stdin, "isTTY", { value: originalIsTTY, configurable: true });
  });

  it("calls program.help() when checksFileArg is undefined", async () => {
    const program = makeProgramStub();
    await gradeAction(undefined, undefined, {}, program);
    expect(program.help).toHaveBeenCalled();
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("calls program.help() when checksFileArg is 'help'", async () => {
    const program = makeProgramStub();
    await gradeAction("help", undefined, {}, program);
    expect(program.help).toHaveBeenCalled();
  });

  it("runs with provided output file and succeeds", async () => {
    mockLoad.mockResolvedValue({ checks: [{ id: "a", check: "c" }] });
    mockRun.mockResolvedValue({ results: [], passRate: 1, costUsd: 0 });
    const program = makeProgramStub();
    await gradeAction("checks.yaml", "output.md", {}, program);
    expect(mockRun).toHaveBeenCalled();
    expect(mockLoad).toHaveBeenCalled();
  });

  it("writes verbose summary to stderr when verbose is set", async () => {
    mockLoad.mockResolvedValue({ checks: [{ id: "a", check: "c" }] });
    mockRun.mockResolvedValue({ results: [], passRate: 0.5, costUsd: 0 });
    const program = makeProgramStub();
    await gradeAction("checks.yaml", "output.md", { verbose: true }, program);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Done: 1 checks"));
  });

  it("exits with code 1 when stdin is empty", async () => {
    mockLoad.mockResolvedValue({ checks: [{ id: "a", check: "c" }] });
    Object.defineProperty(process.stdin, "isTTY", { value: true, configurable: true });
    const program = makeProgramStub();
    await gradeAction("checks.yaml", undefined, {}, program);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("reads stdin and grades when no output file provided", async () => {
    mockLoad.mockResolvedValue({ checks: [{ id: "a", check: "c" }] });
    mockRun.mockResolvedValue({ results: [], passRate: 1, costUsd: 0 });
    const fakeStdin = Readable.from([Buffer.from("stdin-content")]) as unknown as NodeJS.ReadStream;
    Object.defineProperty(fakeStdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process, "stdin", { value: fakeStdin, configurable: true });
    const program = makeProgramStub();
    await gradeAction("checks.yaml", undefined, {}, program);
    expect(mockRun).toHaveBeenCalled();
  });

  it("exits with code 1 on ZodError", async () => {
    const zodErr = Object.assign(new Error("bad schema"), { name: "ZodError" });
    mockLoad.mockRejectedValue(zodErr);
    const program = makeProgramStub();
    await gradeAction("checks.yaml", "out.md", {}, program);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Checks file error"));
  });

  it("exits with code 2 on generic error", async () => {
    mockLoad.mockRejectedValue(new Error("kaboom"));
    const program = makeProgramStub();
    await gradeAction("checks.yaml", "out.md", {}, program);
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Error: kaboom"));
  });

  it("exits with code 2 on non-Error thrown value", async () => {
    mockLoad.mockRejectedValue("string-error");
    const program = makeProgramStub();
    await gradeAction("checks.yaml", "out.md", {}, program);
    expect(exitSpy).toHaveBeenCalledWith(2);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("string-error"));
  });
});

describe("lintAction", () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
    stdoutSpy.mockRestore();
    exitSpy.mockRestore();
  });

  it("calls lintCmd.help() when checksFileArg is undefined", async () => {
    const lintCmd = makeProgramStub();
    await lintAction(undefined, {}, lintCmd);
    expect(lintCmd.help).toHaveBeenCalled();
    expect(mockRunLint).not.toHaveBeenCalled();
  });

  it("runs and succeeds", async () => {
    mockLoad.mockResolvedValue({ checks: [{ id: "a", check: "c" }] });
    mockRunLint.mockResolvedValue({ results: [], checksWithIssues: 0 });
    const lintCmd = makeProgramStub();
    await lintAction("checks.yaml", {}, lintCmd);
    expect(mockRunLint).toHaveBeenCalled();
  });

  it("writes verbose summary to stderr when verbose is set", async () => {
    mockLoad.mockResolvedValue({ checks: [{ id: "a", check: "c" }] });
    mockRunLint.mockResolvedValue({ results: [], checksWithIssues: 2 });
    const lintCmd = makeProgramStub();
    await lintAction("checks.yaml", { verbose: true }, lintCmd);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Lint done: 1 checks, 2 with issues"));
  });

  it("exits with code 1 on ZodError", async () => {
    const zodErr = Object.assign(new Error("bad schema"), { name: "ZodError" });
    mockLoad.mockRejectedValue(zodErr);
    const lintCmd = makeProgramStub();
    await lintAction("checks.yaml", {}, lintCmd);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining("Checks file error"));
  });

  it("exits with code 2 on generic error", async () => {
    mockLoad.mockRejectedValue(new Error("kaboom"));
    const lintCmd = makeProgramStub();
    await lintAction("checks.yaml", {}, lintCmd);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exits with code 2 on non-Error thrown value", async () => {
    mockLoad.mockRejectedValue("string-error");
    const lintCmd = makeProgramStub();
    await lintAction("checks.yaml", {}, lintCmd);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
