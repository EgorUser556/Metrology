import { tokenizeRust } from "./tokens";
import type { BranchInfo, BranchKind, GilbMetrics, RustToken } from "./types";

type PairMaps = {
    braces: Map<number, number>;
};

type MatchArm = {
    patternStart: number;
    arrow: number;
    expressionStart: number;
    expressionEnd: number;
    isDefault: boolean;
};

const buildPairMaps = (tokens: RustToken[]): PairMaps => {
    const braces = new Map<number, number>();
    const stack: number[] = [];

    tokens.forEach((token, index) => {
        if (token.value === "{") stack.push(index);

        if (token.value === "}") {
            const opening = stack.pop();

            if (opening !== undefined) {
                braces.set(opening, index);
            }
        }
    });

    return { braces };
};

const findBodyOpen = (
    tokens: RustToken[],
    start: number,
    end: number,
): number => {
    let parentheses = 0;
    let brackets = 0;

    for (let index = start; index < end; index += 1) {
        const value = tokens[index].value;

        if (value === "(") parentheses += 1;
        else if (value === ")") parentheses -= 1;
        else if (value === "[") brackets += 1;
        else if (value === "]") brackets -= 1;
        else if (value === "{" && parentheses === 0 && brackets === 0) {
            return index;
        }
    }

    return -1;
};

const readMatchArms = (
    tokens: RustToken[],
    bodyOpen: number,
    bodyClose: number,
): MatchArm[] => {
    const arms: MatchArm[] = [];
    let cursor = bodyOpen + 1;

    while (cursor < bodyClose) {
        while (cursor < bodyClose && tokens[cursor].value === ",") {
            cursor += 1;
        }

        if (cursor >= bodyClose) break;

        const patternStart = cursor;
        let arrow = -1;
        let parentheses = 0;
        let brackets = 0;
        let braces = 0;

        for (; cursor < bodyClose; cursor += 1) {
            const value = tokens[cursor].value;

            if (value === "(") parentheses += 1;
            else if (value === ")") parentheses -= 1;
            else if (value === "[") brackets += 1;
            else if (value === "]") brackets -= 1;
            else if (value === "{") braces += 1;
            else if (value === "}") braces -= 1;
            else if (
                value === "=>" &&
                parentheses === 0 &&
                brackets === 0 &&
                braces === 0
            ) {
                arrow = cursor;
                break;
            }
        }

        if (arrow < 0) break;

        const expressionStart = arrow + 1;
        cursor = expressionStart;
        parentheses = 0;
        brackets = 0;
        braces = 0;

        for (; cursor < bodyClose; cursor += 1) {
            const value = tokens[cursor].value;

            if (value === "(") parentheses += 1;
            else if (value === ")") parentheses -= 1;
            else if (value === "[") brackets += 1;
            else if (value === "]") brackets -= 1;
            else if (value === "{") braces += 1;
            else if (value === "}") braces -= 1;
            else if (
                value === "," &&
                parentheses === 0 &&
                brackets === 0 &&
                braces === 0
            ) {
                break;
            }
        }

        const pattern = tokens
            .slice(patternStart, arrow)
            .map((token) => token.value);

        arms.push({
            patternStart,
            arrow,
            expressionStart,
            expressionEnd: cursor,
            isDefault: pattern.length === 1 && pattern[0] === "_",
        });

        cursor += 1;
    }

    return arms;
};

const SIMPLE_STATEMENT_KEYWORDS = new Set([
    "let",
    "return",
    "break",
    "continue",
]);

const CONTROL_STATEMENT_KEYWORDS = new Set([
    "if",
    "for",
    "while",
    "loop",
    "match",
]);

const ASSIGNMENT_TOKENS = new Set([
    "=",
    "+=",
    "-=",
    "*=",
    "/=",
    "%=",
    "&=",
    "|=",
    "^=",
    "<<=",
    ">>=",
]);

const EXPRESSION_OPERATORS = new Set([
    "+",
    "-",
    "*",
    "/",
    "%",
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
    "&&",
    "||",
    "!",
    "&",
    "|",
    "^",
    "<<",
    ">>",
    "..",
    "..=",
    "?",
    "as",
]);

const CALL_EXCLUDED_KEYWORDS = new Set([
    "if",
    "else",
    "match",
    "for",
    "while",
    "loop",
    "return",
    "let",
    "fn",
]);

const isIdentifier = (value: string): boolean =>
    /^[\p{L}_][\p{L}\p{N}_]*$/u.test(value);

const countStatementOperators = (tokens: RustToken[]): number => {
    let total = 0;

    for (let index = 0; index < tokens.length; index += 1) {
        const current = tokens[index].value;
        const next = tokens[index + 1]?.value ?? "";
        const next2 = tokens[index + 2]?.value ?? "";

        if (SIMPLE_STATEMENT_KEYWORDS.has(current)) {
            total += 1;
            continue;
        }

        if (CONTROL_STATEMENT_KEYWORDS.has(current)) {
            total += 1;
            continue;
        }

        if (ASSIGNMENT_TOKENS.has(current)) {
            total += 1;
            continue;
        }

        const previous = tokens[index - 1]?.value ?? "";
        const afterNext = tokens[index + 1]?.value ?? "";

        const isMacroBang =
            current === "!" &&
            isIdentifier(previous) &&
            afterNext === "(";

        if (EXPRESSION_OPERATORS.has(current) && !isMacroBang) {
            total += 1;
            continue;
        }
        if (
            isIdentifier(current) &&
            next === "(" &&
            !CALL_EXCLUDED_KEYWORDS.has(current)
        ) {
            total += 1;
            continue;
        }

        if (
            isIdentifier(current) &&
            next === "!" &&
            next2 === "("
        ) {
            total += 1;
            continue;
        }
    }

    return total;
};

export const analyzeGilb = (code: string): GilbMetrics => {
    const tokens = tokenizeRust(code);
    const pairs = buildPairMaps(tokens);
    const branches: BranchInfo[] = [];

    const addBranch = (
        kind: BranchKind,
        label: string,
        index: number,
        level: number,
    ) => {
        branches.push({
            id: branches.length + 1,
            kind,
            label,
            line: tokens[index]?.line ?? 1,
            level,
        });
    };

    const analyzeRange = (start: number, end: number, depth: number): void => {
        let index = start;

        while (index < end) {
            const value = tokens[index].value;

            if (value === "fn") {
                const bodyOpen = findBodyOpen(tokens, index + 1, end);
                const bodyClose = pairs.braces.get(bodyOpen);

                if (bodyOpen >= 0 && bodyClose !== undefined) {
                    analyzeRange(bodyOpen + 1, bodyClose, depth);
                    index = bodyClose + 1;
                    continue;
                }
            }

            if (value === "if") {
                const analyzeIf = (ifIndex: number, ifDepth: number): number => {
                    addBranch("if", "if", ifIndex, ifDepth);

                    const bodyOpen = findBodyOpen(tokens, ifIndex + 1, end);
                    const bodyClose = pairs.braces.get(bodyOpen);

                    if (bodyOpen < 0 || bodyClose === undefined) {
                        return ifIndex + 1;
                    }

                    analyzeRange(bodyOpen + 1, bodyClose, ifDepth + 1);

                    let next = bodyClose + 1;

                    if (tokens[next]?.value === "else") {
                        if (tokens[next + 1]?.value === "if") {
                            return analyzeIf(next + 1, ifDepth + 1);
                        }

                        if (tokens[next + 1]?.value === "{") {
                            const elseOpen = next + 1;
                            const elseClose = pairs.braces.get(elseOpen);

                            if (elseClose !== undefined) {
                                analyzeRange(
                                    elseOpen + 1,
                                    elseClose,
                                    ifDepth + 1,
                                );
                                next = elseClose + 1;
                            }
                        }
                    }

                    return next;
                };

                index = analyzeIf(index, depth);
                continue;
            }

            if (value === "for" || value === "while" || value === "loop") {
                const kind = value as "for" | "while" | "loop";
                addBranch(kind, kind, index, depth);

                const bodyOpen = findBodyOpen(tokens, index + 1, end);
                const bodyClose = pairs.braces.get(bodyOpen);

                if (bodyOpen >= 0 && bodyClose !== undefined) {
                    analyzeRange(bodyOpen + 1, bodyClose, depth + 1);
                    index = bodyClose + 1;
                    continue;
                }
            }

            if (value === "match") {
                const bodyOpen = findBodyOpen(tokens, index + 1, end);
                const bodyClose = pairs.braces.get(bodyOpen);

                if (bodyOpen >= 0 && bodyClose !== undefined) {
                    const arms = readMatchArms(tokens, bodyOpen, bodyClose);
                    let conditionNumber = 0;

                    for (const arm of arms) {
                        if (arm.isDefault) {
                            const defaultBodyDepth = depth + conditionNumber;
                            const firstToken = tokens[arm.expressionStart]?.value;

                            if (firstToken === "{") {
                                const close = pairs.braces.get(arm.expressionStart);

                                if (close !== undefined) {
                                    analyzeRange(
                                        arm.expressionStart + 1,
                                        close,
                                        defaultBodyDepth,
                                    );
                                }
                            } else {
                                analyzeRange(
                                    arm.expressionStart,
                                    arm.expressionEnd,
                                    defaultBodyDepth,
                                );
                            }

                            continue;
                        }

                        const conditionLevel = depth + conditionNumber;

                        const pattern = tokens
                            .slice(arm.patternStart, arm.arrow)
                            .map((token) => token.value)
                            .join(" ");

                        addBranch(
                            "match-arm",
                            `match: ${pattern}`,
                            arm.patternStart,
                            conditionLevel,
                        );

                        const armBodyDepth = conditionLevel + 1;
                        const firstToken = tokens[arm.expressionStart]?.value;

                        if (firstToken === "{") {
                            const close = pairs.braces.get(arm.expressionStart);

                            if (close !== undefined) {
                                analyzeRange(
                                    arm.expressionStart + 1,
                                    close,
                                    armBodyDepth,
                                );
                            }
                        } else {
                            analyzeRange(
                                arm.expressionStart,
                                arm.expressionEnd,
                                armBodyDepth,
                            );
                        }

                        conditionNumber += 1;
                    }

                    index = bodyClose + 1;
                    continue;
                }
            }

            if (value === "{") {
                const close = pairs.braces.get(index);

                if (close !== undefined) {
                    analyzeRange(index + 1, close, depth);
                    index = close + 1;
                    continue;
                }
            }

            index += 1;
        }
    };

    analyzeRange(0, tokens.length, 0);

    const absoluteComplexity = branches.length;

    const matchArrowCount = tokens.filter(
        (token) => token.value === "=>",
    ).length;

    const totalOperators =
        countStatementOperators(tokens) + matchArrowCount;

    const countedTokens = tokens.filter((token, index) => {
        const current = token.value;
        const previous = tokens[index - 1]?.value ?? "";
        const next = tokens[index + 1]?.value ?? "";
        const next2 = tokens[index + 2]?.value ?? "";

        const isMacroBang =
            current === "!" &&
            isIdentifier(previous) &&
            next === "(";

        return (
            SIMPLE_STATEMENT_KEYWORDS.has(current) ||
            CONTROL_STATEMENT_KEYWORDS.has(current) ||
            ASSIGNMENT_TOKENS.has(current) ||
            (EXPRESSION_OPERATORS.has(current) && !isMacroBang) ||
            (
                isIdentifier(current) &&
                next === "(" &&
                !CALL_EXCLUDED_KEYWORDS.has(current)
            ) ||
            (
                isIdentifier(current) &&
                next === "!" &&
                next2 === "("
            )
        );
    });

    console.table(
        countedTokens.map((token) => ({
            line: token.line,
            operator: token.value,
        })),
    );

    console.log("Операторы без =>:", countedTokens.length);
    console.log("Все =>:", matchArrowCount);
    console.log("Итог N:", totalOperators);

    const relativeComplexity =
        totalOperators === 0
            ? 0
            : absoluteComplexity / totalOperators;

    const maxNestingLevel =
        branches.length === 0
            ? 0
            : Math.max(...branches.map((branch) => branch.level));

    return {
        absoluteComplexity,
        relativeComplexity,
        maxNestingLevel,
        totalOperators,
        branches,
    };
};