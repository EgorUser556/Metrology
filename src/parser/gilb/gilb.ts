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
            if (opening !== undefined) braces.set(opening, index);
        }
    });

    return { braces };
};

const findBodyOpen = (tokens: RustToken[], start: number, end: number): number => {
    let parentheses = 0;
    let brackets = 0;

    for (let index = start; index < end; index += 1) {
        const value = tokens[index].value;
        if (value === "(") parentheses += 1;
        else if (value === ")") parentheses -= 1;
        else if (value === "[") brackets += 1;
        else if (value === "]") brackets -= 1;
        else if (value === "{" && parentheses === 0 && brackets === 0) return index;
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
        while (cursor < bodyClose && tokens[cursor].value === ",") cursor += 1;
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
            else if (value === "=>" && parentheses === 0 && brackets === 0 && braces === 0) {
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
            else if (value === "," && parentheses === 0 && brackets === 0 && braces === 0) break;
        }

        const pattern = tokens.slice(patternStart, arrow).map((token) => token.value);
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

const countStatementOperators = (tokens: RustToken[]): number => {
    const ignoredSemicolons = new Set<number>();
    const ignoredItems = new Set(["use", "mod", "type", "extern"]);

    for (let index = 0; index < tokens.length; index += 1) {
        if (!ignoredItems.has(tokens[index].value)) continue;

        for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
            if (tokens[cursor].value === ";") {
                ignoredSemicolons.add(cursor);
                break;
            }
        }
    }

    return tokens.reduce(
        (total, token, index) =>
            total + (token.value === ";" && !ignoredSemicolons.has(index) ? 1 : 0),
        0,
    );
};

export const analyzeGilb = (code: string): GilbMetrics => {
    const tokens = tokenizeRust(code);
    const pairs = buildPairMaps(tokens);
    const branches: BranchInfo[] = [];

    const addBranch = (kind: BranchKind, label: string, index: number, level: number) => {
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
                    if (bodyOpen < 0 || bodyClose === undefined) return ifIndex + 1;

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
                                analyzeRange(elseOpen + 1, elseClose, ifDepth + 1);
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
                    const defaultIndex = arms.findIndex((arm) => arm.isDefault);
                    const fallbackIndex = defaultIndex >= 0
                        ? defaultIndex
                        : Math.max(arms.length - 1, 0);
                    let conditionNumber = 0;

                    arms.forEach((arm, armIndex) => {
                        const isFallback = armIndex === fallbackIndex;

                        if (!isFallback) {
                            const level = depth + conditionNumber;
                            const pattern = tokens
                                .slice(arm.patternStart, arm.arrow)
                                .map((token) => token.value)
                                .join(" ");
                            addBranch("match-arm", `match: ${pattern}`, arm.patternStart, level);
                            conditionNumber += 1;
                        }

                        const armDepth = depth + conditionNumber;
                        const first = tokens[arm.expressionStart]?.value;

                        if (first === "{") {
                            const close = pairs.braces.get(arm.expressionStart);
                            if (close !== undefined) {
                                analyzeRange(arm.expressionStart + 1, close, armDepth);
                            }
                        } else {
                            analyzeRange(arm.expressionStart, arm.expressionEnd, armDepth);
                        }
                    });

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
    const totalOperators = countStatementOperators(tokens) + absoluteComplexity;
    const relativeComplexity = totalOperators === 0
        ? 0
        : absoluteComplexity / totalOperators;
    const maxNestingLevel = branches.length === 0
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