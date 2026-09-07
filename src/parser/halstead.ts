import type { FrequencyItem, HalsteadMetrics } from './types';
import { KEYWORD_OPERATORS, IGNORED_WORDS,
         TYPE_NAMES, SYMBOL_OPERATORS } from './config';

const OPERATOR_PATTERN = SYMBOL_OPERATORS
    .map((operator) => operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

const TOKEN_PATTERN = new RegExp(
    [
        String.raw`"(?:\\.|[^"\\])*"`,
        String.raw`'(?:\\.|[^'\\])*'`,
        String.raw`\b\d+(?:\.\d+)?\b`,
        String.raw`\b[A-Za-z_][A-Za-z0-9_]*\b`,
        OPERATOR_PATTERN,
        String.raw`[(){}\[\]]`,
    ].join("|"),
    "g",
);

const removeComments = (code: string): string => {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
}

const addToken = (tokens: Map<string, number>, token: string) => {
    tokens.set(token, (tokens.get(token) ?? 0) + 1);
}

const toFrequencyItems = (tokens: Map<string, number>): FrequencyItem[] => {
    return [...tokens.entries()]
        .map(([token, count]) => ({ token, count }))
        .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));
}

const isLiteral = (token: string): boolean => {
    return (
        /^"(?:\\.|[^"\\])*"$/.test(token) ||
        /^'(?:\\.|[^'\\])*'$/.test(token) ||
        /^\d+(?:\.\d+)?$/.test(token)
    );
}

const isIdentifier = (token: string): boolean => {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

const isFunctionCall = (tokens: string[], index: number): boolean => {
    return tokens[index + 1] === "(";
}

export const analyzeRustCode = (code: string): HalsteadMetrics => {
    const cleanCode = removeComments(code);
    const tokens = cleanCode.match(TOKEN_PATTERN) ?? [];

    const operators = new Map<string, number>();
    const operands = new Map<string, number>();

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];

        if (SYMBOL_OPERATORS.includes(token)) {
            addToken(operators, token);
            continue;
        }

        if (token === "(" || token === ")") {
            if (token === "(") {
                addToken(operators, "()");
            }
            continue;
        }

        if (token === "{" || token === "}") {
            if (token === "{") {
                addToken(operators, "{}");
            }
            continue;
        }

        if (token === "[" || token === "]") {
            if (token === "[") {
                addToken(operators, "[]");
            }
            continue;
        }

        if (KEYWORD_OPERATORS.has(token)) {
            addToken(operators, token);
            continue;
        }

        if (IGNORED_WORDS.has(token) || TYPE_NAMES.has(token)) {
            continue;
        }

        if (isFunctionCall(tokens, index)) {
            addToken(operators, `${token}()`);
            continue;
        }

        if (isLiteral(token) || isIdentifier(token)) {
            addToken(operands, token);
        }
    }

    const eta1 = operators.size;
    const eta2 = operands.size;
    const n1 = [...operators.values()].reduce((sum, count) => sum + count, 0);
    const n2 = [...operands.values()].reduce((sum, count) => sum + count, 0);
    const vocabulary = eta1 + eta2;
    const length = n1 + n2;
    const volume = vocabulary > 0 ? length * Math.log2(vocabulary) : 0;

    return {
        eta1,
        eta2,
        n1,
        n2,
        vocabulary,
        length,
        volume,
        operators: toFrequencyItems(operators),
        operands: toFrequencyItems(operands),
    };
}