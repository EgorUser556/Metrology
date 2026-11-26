import { tokenizeRust } from "../gilb/tokens";
import type { RustToken } from "../gilb/types";
import type {
    ChepinGroup,
    ChepinRow,
    ChepinSummary,
    DataFlowMetrics,
    DeclarationKind,
    Occurrence,
    SpenRow,
    VariableInfo,
} from "./types";

/** Весовые коэффициенты метрики Чепина: Q = a1·p + a2·m + a3·c + a4·t */
export const CHEPIN_WEIGHTS: Record<ChepinGroup, number> = { P: 1, M: 2, C: 3, T: 0.5 };

export const GLOBAL_SCOPE = "глобальная";

const KEYWORDS = new Set([
    "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else", "enum",
    "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop", "match", "mod",
    "move", "mut", "pub", "ref", "return", "self", "Self", "static", "struct", "super",
    "trait", "true", "type", "unsafe", "use", "where", "while", "box", "_",
]);

/** Макросы ввода/вывода: их аргументы образуют «список ввода/вывода» */
const IO_MACROS = new Set(["print", "println", "eprint", "eprintln", "write", "writeln"]);
/** Макросы с форматной строкой, в которой возможен захват `{name}` */
const FORMAT_MACROS = new Set([...IO_MACROS, "format", "panic", "assert", "assert_eq", "assert_ne"]);
/** Методы, читающие данные из потока ввода в переданную переменную */
const INPUT_METHODS = new Set(["read_line", "read_to_string", "read_to_end"]);
/** Методы, изменяющие объект, у которого они вызваны */
const MUTATING_METHODS = new Set([
    "push", "push_str", "push_back", "push_front", "insert", "remove", "pop", "pop_back",
    "pop_front", "clear", "extend", "append", "truncate", "sort", "sort_by", "sort_by_key",
    "sort_unstable", "reverse", "retain", "drain", "dedup", "swap", "resize", "fill",
]);
const ASSIGN_OPERATORS = new Set(["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>="]);
const OPEN = new Set(["(", "[", "{"]);
const CLOSE = new Set([")", "]", "}"]);

const isIdentifier = (value: string): boolean => /^[\p{L}_][\p{L}\p{N}_]*$/u.test(value);
const isString = (value: string): boolean => value.startsWith('"');

type FunctionInfo = {
    name: string;
    start: number;
    paramsOpen: number;
    paramsClose: number;
    bodyOpen: number;
    bodyClose: number;
};

type Range = [number, number];
const inRanges = (index: number, ranges: Range[]): boolean =>
    ranges.some(([from, to]) => index >= from && index <= to);

/** Индексы парных скобок и ближайшей охватывающей «{» для каждого токена */
const buildBracketMaps = (tokens: RustToken[]) => {
    const pair = new Array<number>(tokens.length).fill(-1);
    const enclosingBrace = new Array<number>(tokens.length).fill(-1);
    const stack: number[] = [];
    const braces: number[] = [];

    tokens.forEach((token, index) => {
        enclosingBrace[index] = braces.length ? braces[braces.length - 1] : -1;

        if (OPEN.has(token.value)) {
            stack.push(index);
            if (token.value === "{") braces.push(index);
        } else if (CLOSE.has(token.value) && stack.length) {
            const open = stack.pop()!;
            pair[open] = index;
            pair[index] = open;
            if (tokens[open].value === "{") braces.pop();
        }
    });

    return { pair, enclosingBrace };
};

/** Первый токен из `stops` на нулевой глубине скобок начиная с `from` */
const findAtDepthZero = (
    tokens: RustToken[],
    pair: number[],
    from: number,
    stops: string[],
    limit = tokens.length,
): number => {
    for (let index = from; index < limit; index += 1) {
        const value = tokens[index].value;
        if (stops.includes(value)) return index;
        if (OPEN.has(value) && pair[index] > index) index = pair[index];
        else if (CLOSE.has(value)) return -1;
    }
    return -1;
};

const findFunctions = (tokens: RustToken[], pair: number[]): FunctionInfo[] => {
    const functions: FunctionInfo[] = [];

    tokens.forEach((token, index) => {
        if (token.value !== "fn" || !isIdentifier(tokens[index + 1]?.value ?? "")) return;

        const paramsOpen = tokens.findIndex((t, i) => i > index && t.value === "(");
        if (paramsOpen < 0 || pair[paramsOpen] < 0) return;
        const paramsClose = pair[paramsOpen];
        const bodyOpen = findAtDepthZero(tokens, pair, paramsClose + 1, ["{", ";"]);
        if (bodyOpen < 0 || tokens[bodyOpen].value !== "{" || pair[bodyOpen] < 0) return;

        functions.push({
            name: tokens[index + 1].value,
            start: index,
            paramsOpen,
            paramsClose,
            bodyOpen,
            bodyClose: pair[bodyOpen],
        });
    });

    return functions;
};

/** Функции, которые (прямо или через вызовы) читают данные со стандартного ввода */
const findInputFunctions = (tokens: RustToken[], functions: FunctionInfo[]): Set<string> => {
    const result = new Set<string>();
    let changed = true;

    while (changed) {
        changed = false;
        for (const fn of functions) {
            if (result.has(fn.name)) continue;
            for (let i = fn.bodyOpen; i <= fn.bodyClose; i += 1) {
                const value = tokens[i].value;
                const isCall = tokens[i + 1]?.value === "(";
                if (value === "stdin" || (isCall && (INPUT_METHODS.has(value) || result.has(value)))) {
                    result.add(fn.name);
                    changed = true;
                    break;
                }
            }
        }
    }

    return result;
};

/** Имена-привязки внутри образца (let, for, match, параметры) */
const patternBindings = (tokens: RustToken[], from: number, to: number): number[] => {
    const result: number[] = [];

    for (let index = from; index <= to; index += 1) {
        const value = tokens[index].value;
        if (!isIdentifier(value) || KEYWORDS.has(value)) continue;
        if (!/^[\p{Ll}_]/u.test(value)) continue; // Some, Ok, None, CONST — не привязки

        const next = tokens[index + 1]?.value;
        const prev = tokens[index - 1]?.value;
        if (next === "(" || next === "{" || next === "::" || next === "!") continue;
        if (prev === "::" || prev === ".") continue;

        result.push(index);
    }

    return result;
};

/** Разбиение списка (параметры функции/замыкания) на сегменты по запятым и отбрасывание типов */
const parameterBindings = (tokens: RustToken[], pair: number[], from: number, to: number): number[] => {
    const result: number[] = [];
    let segmentStart = from;

    for (let index = from; index <= to + 1; index += 1) {
        const value = tokens[index]?.value;
        if (index <= to && OPEN.has(value) && pair[index] > index) {
            index = pair[index];
            continue;
        }
        if (index === to + 1 || value === ",") {
            const colon = findAtDepthZero(tokens, pair, segmentStart, [":"], index);
            const end = colon >= 0 ? colon - 1 : index - 1;
            result.push(...patternBindings(tokens, segmentStart, end).filter((i) => tokens[i].value !== "self"));
            segmentStart = index + 1;
        }
    }

    return result;
};

type Declaration = { tokenIndex: number; kind: DeclarationKind; initializer?: Range };

export const analyzeDataFlow = (code: string): DataFlowMetrics => {
    const tokens = tokenizeRust(code);
    const { pair, enclosingBrace } = buildBracketMaps(tokens);
    const functions = findFunctions(tokens, pair);
    const inputFunctions = findInputFunctions(tokens, functions);
    const functionNames = new Set(functions.map((fn) => fn.name));

    // Область видимости каждого токена: функция (самая вложенная) или глобальная
    const scopeOf = new Array<string>(tokens.length).fill(GLOBAL_SCOPE);
    for (const fn of functions) {
        for (let i = fn.start; i <= fn.bodyClose; i += 1) scopeOf[i] = fn.name;
    }

    // Токены, которые не анализируются: use-объявления и атрибуты #[...]
    const ignored = new Set<number>();
    tokens.forEach((token, index) => {
        if (token.value === "use" && scopeOf[index] === GLOBAL_SCOPE) {
            const end = tokens.findIndex((t, i) => i > index && t.value === ";");
            for (let i = index; i <= (end < 0 ? index : end); i += 1) ignored.add(i);
        }
        if (token.value === "#" && tokens[index + 1]?.value === "[" && pair[index + 1] > 0) {
            for (let i = index; i <= pair[index + 1]; i += 1) ignored.add(i);
        }
    });

    // ---------- 1. Диапазоны: условия, ввод/вывод, тела match ----------
    const controlRanges: Range[] = [];
    const ioRanges: Range[] = [];
    const inputRanges: Range[] = [];
    const formatRanges: Range[] = [];
    const matchBodies = new Set<number>();

    tokens.forEach((token, index) => {
        const value = token.value;

        if (value === "if" || value === "while" || value === "match") {
            const end = findAtDepthZero(tokens, pair, index + 1, ["{", "=>", ";"]);
            if (end > index + 1) controlRanges.push([index + 1, end - 1]);
            if (value === "match" && end > 0 && tokens[end].value === "{") matchBodies.add(end);
        }

        if (value === "for") {
            const inIndex = findAtDepthZero(tokens, pair, index + 1, ["in"]);
            const end = inIndex > 0 ? findAtDepthZero(tokens, pair, inIndex + 1, ["{"]) : -1;
            if (end > inIndex + 1) controlRanges.push([inIndex + 1, end - 1]);
        }

        const next = tokens[index + 1]?.value;
        if (isIdentifier(value) && next === "!" && OPEN.has(tokens[index + 2]?.value ?? "")) {
            const range: Range = [index + 3, pair[index + 2] - 1];
            if (IO_MACROS.has(value)) ioRanges.push(range);
            if (FORMAT_MACROS.has(value)) formatRanges.push(range);
        }

        if (INPUT_METHODS.has(value) && next === "(" && pair[index + 1] > 0) {
            const range: Range = [index + 2, pair[index + 1] - 1];
            ioRanges.push(range);
            inputRanges.push(range);
        }
    });

    // ---------- 2. Объявления ----------
    const declarations: Declaration[] = [];

    tokens.forEach((token, index) => {
        if (ignored.has(index)) return;
        const value = token.value;

        if ((value === "const" || value === "static") && scopeOf[index] === GLOBAL_SCOPE) {
            let nameIndex = index + 1;
            if (tokens[nameIndex]?.value === "mut") nameIndex += 1;
            if (isIdentifier(tokens[nameIndex]?.value ?? "") && tokens[nameIndex + 1]?.value === ":") {
                const eq = findAtDepthZero(tokens, pair, nameIndex + 1, ["=", ";"]);
                const end = eq > 0 ? findAtDepthZero(tokens, pair, eq, [";"]) : -1;
                declarations.push({
                    tokenIndex: nameIndex,
                    kind: "const",
                    initializer: eq > 0 && tokens[eq].value === "=" ? [eq + 1, end - 1] : undefined,
                });
            }
        }

        if (value === "let") {
            const inCondition = ["if", "while", "&&"].includes(tokens[index - 1]?.value ?? "");
            const patternEnd = findAtDepthZero(tokens, pair, index + 1, ["=", ";", ":"]);
            if (patternEnd < 0) return;
            const eq = tokens[patternEnd].value === "="
                ? patternEnd
                : findAtDepthZero(tokens, pair, patternEnd, ["=", ";"]);
            let initializer: Range | undefined;
            if (eq > 0 && tokens[eq].value === "=") {
                const end = findAtDepthZero(tokens, pair, eq + 1, inCondition ? ["{"] : [";"]);
                initializer = [eq + 1, (end < 0 ? tokens.length : end) - 1];
            }
            for (const binding of patternBindings(tokens, index + 1, patternEnd - 1)) {
                declarations.push({ tokenIndex: binding, kind: "let", initializer });
            }
        }

        if (value === "for") {
            const inIndex = findAtDepthZero(tokens, pair, index + 1, ["in"]);
            if (inIndex > 0) {
                for (const binding of patternBindings(tokens, index + 1, inIndex - 1)) {
                    declarations.push({ tokenIndex: binding, kind: "loop" });
                }
            }
        }

        if (value === "=>" && matchBodies.has(enclosingBrace[index])) {
            let start = index - 1;
            let depth = 0;
            while (start > 0) {
                const current = tokens[start].value;
                if (depth === 0 && [",", "{", "}", ";"].includes(current)) break;
                if (current === ")" || current === "]") depth += 1;
                if (current === "(" || current === "[") depth -= 1;
                start -= 1;
            }
            const guard = findAtDepthZero(tokens, pair, start + 1, ["if"], index);
            const end = guard >= 0 ? guard - 1 : index - 1;
            for (const binding of patternBindings(tokens, start + 1, end)) {
                declarations.push({ tokenIndex: binding, kind: "pattern" });
            }
        }

        if (value === "|") {
            const prev = tokens[index - 1]?.value ?? "";
            if (["(", ",", "=", "move", "{", ";", "=>", "return"].includes(prev)) {
                const close = tokens.findIndex((t, i) => i > index && t.value === "|");
                if (close > index) {
                    for (const binding of parameterBindings(tokens, pair, index + 1, close - 1)) {
                        declarations.push({ tokenIndex: binding, kind: "closure" });
                    }
                }
            }
        }
    });

    for (const fn of functions) {
        for (const binding of parameterBindings(tokens, pair, fn.paramsOpen + 1, fn.paramsClose - 1)) {
            declarations.push({ tokenIndex: binding, kind: "parameter" });
        }
    }

    // ---------- 3. Таблица переменных ----------
    const variables = new Map<string, VariableInfo>();
    const declarationKeys = new Map<number, string>();
    const keyOf = (scope: string, name: string) => `${scope}::${name}`;

    const containsInputCall = (range?: Range): boolean => {
        if (!range) return false;
        for (let i = range[0]; i <= range[1]; i += 1) {
            const value = tokens[i]?.value;
            if (value === "stdin") return true;
            if (tokens[i + 1]?.value === "(" && (inputFunctions.has(value) || INPUT_METHODS.has(value))) return true;
        }
        return false;
    };

    declarations
        .sort((a, b) => a.tokenIndex - b.tokenIndex)
        .forEach((declaration) => {
            const token = tokens[declaration.tokenIndex];
            const scope = scopeOf[declaration.tokenIndex];
            const key = keyOf(scope, token.value);
            declarationKeys.set(declaration.tokenIndex, key);

            const existing = variables.get(key);
            if (existing) {
                existing.initializedFromInput ||= containsInputCall(declaration.initializer);
                return;
            }

            variables.set(key, {
                key,
                name: token.value,
                scope,
                kind: declaration.kind,
                declarationLine: token.line,
                occurrences: [],
                initializedFromInput: containsInputCall(declaration.initializer),
            });
        });

    const resolve = (scope: string, name: string): VariableInfo | undefined =>
        variables.get(keyOf(scope, name)) ?? variables.get(keyOf(GLOBAL_SCOPE, name));

    // ---------- 4. Вхождения идентификаторов ----------
    const isWriteAt = (index: number): boolean => {
        let next = index + 1;
        while (tokens[next]?.value === "[" && pair[next] > next) next = pair[next] + 1;
        const after = tokens[next]?.value ?? "";
        if (ASSIGN_OPERATORS.has(after)) return true;
        if (after === "." && MUTATING_METHODS.has(tokens[next + 1]?.value ?? "") && tokens[next + 2]?.value === "(") {
            return true;
        }
        return tokens[index - 1]?.value === "mut" && tokens[index - 2]?.value === "&";
    };

    const addOccurrence = (variable: VariableInfo, index: number, isDeclaration: boolean, fromString = false) => {
        const isInputTarget = !fromString && inRanges(index, inputRanges)
            && tokens[index - 1]?.value === "mut" && tokens[index - 2]?.value === "&";
        const isWrite = !isDeclaration && !fromString && !isInputTarget && isWriteAt(index);
        const isControl = (!fromString && inRanges(index, controlRanges)) || (isDeclaration && variable.kind === "loop");

        const occurrence: Occurrence = {
            tokenIndex: index,
            line: tokens[index].line,
            isDeclaration,
            isWrite,
            isRead: !isDeclaration && !isWrite && !isInputTarget,
            isControl: isControl && !(isDeclaration && variable.kind !== "loop"),
            isIO: inRanges(index, ioRanges),
            isInputTarget,
        };
        variable.occurrences.push(occurrence);
    };

    tokens.forEach((token, index) => {
        if (ignored.has(index)) return;
        const value = token.value;

        if (isString(value) && inRanges(index, formatRanges)) {
            const captures = value.replace(/\{\{|\}\}/g, "").matchAll(/\{([\p{L}_][\p{L}\p{N}_]*)(?::[^}]*)?\}/gu);
            for (const capture of captures) {
                const variable = resolve(scopeOf[index], capture[1]);
                if (variable) addOccurrence(variable, index, false, true);
            }
            return;
        }

        if (!isIdentifier(value) || KEYWORDS.has(value)) return;

        const declarationKey = declarationKeys.get(index);
        if (declarationKey) {
            addOccurrence(variables.get(declarationKey)!, index, true);
            return;
        }

        const prev = tokens[index - 1]?.value;
        const next = tokens[index + 1]?.value;
        if (prev === "." || prev === "::" || next === "::" || next === "!") return;
        if (prev === "fn" || (functionNames.has(value) && next === "(")) return;

        const variable = resolve(scopeOf[index], value);
        if (variable) addOccurrence(variable, index, false);
    });

    // ---------- 5. Спен ----------
    const ordered = [...variables.values()].sort(
        (a, b) => (a.occurrences[0]?.tokenIndex ?? 0) - (b.occurrences[0]?.tokenIndex ?? 0),
    );

    const spens: SpenRow[] = ordered.map((variable) => ({
        key: variable.key,
        name: variable.name,
        scope: variable.scope,
        kind: variable.kind,
        count: variable.occurrences.length,
        spen: Math.max(variable.occurrences.length - 1, 0),
        lines: variable.occurrences.map((occurrence) => occurrence.line),
    }));

    // ---------- 6. Метрика Чепина ----------
    const classify = (variable: VariableInfo): { group: ChepinGroup; reason: string } => {
        const uses = variable.occurrences.filter((o) => !o.isDeclaration);
        const reads = uses.filter((o) => o.isRead);
        const controls = variable.occurrences.filter((o) => o.isControl);
        const writes = uses.filter((o) => o.isWrite);
        const isInput = variable.kind === "parameter"
            || variable.initializedFromInput
            || variable.occurrences.some((o) => o.isInputTarget);

        if (variable.kind === "loop") {
            return { group: "C", reason: "параметр цикла for" };
        }
        if (reads.length === 0) {
            return { group: "T", reason: uses.length ? "значение не используется (только запись)" : "объявлена и не используется" };
        }
        if (controls.length > 0) {
            const lines = [...new Set(controls.map((o) => o.line))].join(", ");
            return { group: "C", reason: `участвует в условии / управлении (стр. ${lines})` };
        }
        if (isInput && writes.length === 0) {
            const source = variable.kind === "parameter"
                ? "входной параметр функции"
                : variable.occurrences.some((o) => o.isInputTarget)
                    ? "читается из потока ввода"
                    : "получает значение функции ввода";
            return { group: "P", reason: `${source}, не модифицируется` };
        }
        if (variable.kind === "const") {
            return { group: "M", reason: "константа, созданная в программе" };
        }
        if (writes.length > 0) {
            const lines = [...new Set(writes.map((o) => o.line))].join(", ");
            return { group: "M", reason: `модифицируется (стр. ${lines})` };
        }
        return { group: "M", reason: "вычисляется внутри программы" };
    };

    const rows: ChepinRow[] = ordered.map((variable) => ({
        key: variable.key,
        name: variable.name,
        scope: variable.scope,
        ...classify(variable),
        inIO: variable.occurrences.some((o) => o.isIO),
    }));

    const summarize = (list: ChepinRow[]): ChepinSummary => {
        const groups: Record<ChepinGroup, ChepinRow[]> = { P: [], M: [], C: [], T: [] };
        list.forEach((row) => groups[row.group].push(row));
        const counts = {
            P: groups.P.length,
            M: groups.M.length,
            C: groups.C.length,
            T: groups.T.length,
        };
        const q = (Object.keys(counts) as ChepinGroup[])
            .reduce((sum, group) => sum + CHEPIN_WEIGHTS[group] * counts[group], 0);
        return { groups, counts, q };
    };

    return {
        spens,
        totalSpen: spens.reduce((sum, row) => sum + row.spen, 0),
        variables: rows,
        full: summarize(rows),
        io: summarize(rows.filter((row) => row.inIO)),
        inputFunctions: [...inputFunctions],
    };
};
