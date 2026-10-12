/**
 * Shared helpers for the maintainer CLIs in scripts/: terminal colours (off when the output
 * is not a terminal or NO_COLOR is set) and a runner that turns an unexpected failure into
 * a readable one-line message and exit code 1 instead of a stack trace.
 */

const useColour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code: number) => (text: string) => (useColour ? `\x1b[${code}m${text}\x1b[0m` : text);

export const red = paint(31);
export const green = paint(32);
export const yellow = paint(33);
export const bold = paint(1);
export const dim = paint(2);

export const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Run a CLI's `main()` and set the exit code from its result; report crashes readably. */
export function runCli(name: string, main: () => Promise<number>): void {
  main().then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(red(`${name} could not run: ${error instanceof Error ? error.message : String(error)}`));
      process.exitCode = 1;
    },
  );
}
