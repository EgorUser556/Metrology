import type { FrequencyItem, HalsteadMetrics } from "./types";
import { CONTROL_OPERATORS, DECLARATION_WORDS, IGNORED_WORDS, TYPE_NAMES, SYMBOL_OPERATORS }  from "./config";

const ESCAPED_OPERATORS = SYMBOL_OPERATORS
    .map((operator) => operator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");

const TOKEN_PATTERN = new RegExp(
    [
        String.raw`"(?:\\.|[^"\\])*"`,
        String.raw`'(?:\\.|[^'\\])*'`,
        String.raw`\b\d+(?:\.\d+)?(?:_[A-Za-z0-9]+)?\b`,
        String.raw`\b[A-Za-z_][A-Za-z0-9_]*\b`,
        ESCAPED_OPERATORS,
        String.raw`[(){}\[\]]`,
    ].join("|"),
    "g",
);

const removeComments = (code: string): string => {
    return code
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
}

const addToken = (map: Map<string, number>, token: string) => {
    map.set(token, (map.get(token) ?? 0) + 1);
}

const getTotal = (map: Map<string, number>): number => {
    return [...map.values()].reduce((sum, count) => sum + count, 0);
}

const toFrequencyItems =(map: Map<string, number>): FrequencyItem[] => {
    return [...map.entries()]
        .map(([token, count]) => ({ token, count }))
        .sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));
}

const isIdentifier = (token: string): boolean => {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(token);
}

const isLiteral = (token: string): boolean => {
    return (
        /^"(?:\\.|[^"\\])*"$/.test(token) ||
        /^'(?:\\.|[^'\\])*'$/.test(token) ||
        /^\d+(?:\.\d+)?(?:_[A-Za-z0-9]+)?$/.test(token)
    );
}

const isPathSegment = (tokens: string[], index: number): boolean => {
    return tokens[index + 1] === "::" || tokens[index - 1] === "::";
}

const isMacroCall = (tokens: string[], index: number): boolean => {
    return tokens[index + 1] === "!" && tokens[index + 2] === "(";
}

const isFunctionCall = (tokens: string[], index: number): boolean => {
    return tokens[index + 1] === "(";
}

const isCallOpeningBracket = (tokens: string[], index: number): boolean => {
    const previous = tokens[index - 1];
    const beforePrevious = tokens[index - 2];

    const isFunctionOrMethodCall =
        previous !== undefined && isIdentifier(previous);

    const isMacroCall =
        previous === "!" &&
        beforePrevious !== undefined &&
        isIdentifier(beforePrevious);

    return isFunctionOrMethodCall || isMacroCall;
}

export const analyzeRustCode = (code: string): HalsteadMetrics => {
    const cleanCode = removeComments(code);
    const tokens = cleanCode.match(TOKEN_PATTERN) ?? [];

    const operators = new Map<string, number>();
    const operands = new Map<string, number>();

    for (let index = 0; index < tokens.length; index += 1) {
        const token = tokens[index];

        if (token === "{") {
            addToken(operators, "{}");
            continue;
        }

        if (token === "[") {
            addToken(operators, "[]");
            continue;
        }

        if (token === "(") {
            if (!isCallOpeningBracket(tokens, index)) {
                addToken(operators, "()");
            }
            continue;
        }

        if (token === ")" || token === "}" || token === "]") {
            continue;
        }


        if (SYMBOL_OPERATORS.includes(token)) {
            const previous = tokens[index - 1];
            const next = tokens[index + 1];

            if (token === "!" && previous && next === "(") {
                continue;
            }

            addToken(operators, token);
            continue;
        }

        if (CONTROL_OPERATORS.has(token)) {
            addToken(operators, token);
            continue;
        }

        if (DECLARATION_WORDS.has(token)) {
            addToken(operators, token);
            continue;
        }

        if (IGNORED_WORDS.has(token) || TYPE_NAMES.has(token)) {
            continue;
        }

        if (isPathSegment(tokens, index)) {
            continue;
        }

        if (isMacroCall(tokens, index)) {
            addToken(operators, `${token}!()`);
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
    const n1 = getTotal(operators);
    const n2 = getTotal(operands);
    const vocabulary = eta1 + eta2;
    const length = n1 + n2;
    const volume = vocabulary === 0 ? 0 : length * Math.log2(vocabulary);

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