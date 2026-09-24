import type { RustToken } from "./types";

const MULTI_CHAR_TOKENS = [
    "<<=", ">>=", "..=", "::", "=>", "->", "==", "!=", ">=", "<=",
    "&&", "||", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
    "<<", ">>", "..",
];

const isIdentifierStart = (char: string): boolean => /[\p{L}_]/u.test(char);
const isIdentifierPart = (char: string): boolean => /[\p{L}\p{N}_]/u.test(char);

export const tokenizeRust = (code: string): RustToken[] => {
    const tokens: RustToken[] = [];
    let index = 0;
    let line = 1;
    let column = 1;

    const advance = (): string => {
        const char = code[index++];
        if (char === "\n") {
            line += 1;
            column = 1;
        } else {
            column += 1;
        }
        return char;
    };

    const push = (value: string, tokenLine: number, tokenColumn: number) => {
        tokens.push({ value, line: tokenLine, column: tokenColumn });
    };

    while (index < code.length) {
        const char = code[index];

        if (/\s/.test(char)) {
            advance();
            continue;
        }

        if (code.startsWith("//", index)) {
            while (index < code.length && code[index] !== "\n") {
                advance();
            }
            continue;
        }

        if (code.startsWith("/*", index)) {
            advance();
            advance();
            let depth = 1;

            while (index < code.length && depth > 0) {
                if (code.startsWith("/*", index)) {
                    advance();
                    advance();
                    depth += 1;
                } else if (code.startsWith("*/", index)) {
                    advance();
                    advance();
                    depth -= 1;
                } else {
                    advance();
                }
            }

            continue;
        }

        const tokenLine = line;
        const tokenColumn = column;

        if (char === '"' || char === "'") {
            const quote = advance();
            let value = quote;

            while (index < code.length) {
                const current = advance();
                value += current;

                if (current === "\\" && index < code.length) {
                    value += advance();
                    continue;
                }

                if (current === quote) break;
            }

            push(value, tokenLine, tokenColumn);
            continue;
        }

        const compound = MULTI_CHAR_TOKENS.find((operator) =>
            code.startsWith(operator, index),
        );

        if (compound) {
            for (let count = 0; count < compound.length; count += 1) {
                advance();
            }

            push(compound, tokenLine, tokenColumn);
            continue;
        }

        if (isIdentifierStart(char)) {
            let value = "";

            while (index < code.length && isIdentifierPart(code[index])) {
                value += advance();
            }

            push(value, tokenLine, tokenColumn);
            continue;
        }

        if (/\d/.test(char)) {
            let value = "";

            while (index < code.length && /\d/.test(code[index])) {
                value += advance();
            }

            if (
                code[index] === "." &&
                code[index + 1] !== "." &&
                /\d/.test(code[index + 1] ?? "")
            ) {
                value += advance();

                while (index < code.length && /\d/.test(code[index])) {
                    value += advance();
                }
            }

            while (index < code.length && /[\p{L}\p{N}_]/u.test(code[index])) {
                value += advance();
            }

            push(value, tokenLine, tokenColumn);
            continue;
        }

        push(advance(), tokenLine, tokenColumn);
    }

    return tokens;
};