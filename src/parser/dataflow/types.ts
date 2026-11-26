export type ChepinGroup = "P" | "M" | "C" | "T";

export type DeclarationKind =
    | "const"
    | "parameter"
    | "let"
    | "loop"
    | "pattern"
    | "closure";

export type Occurrence = {
    tokenIndex: number;
    line: number;
    isDeclaration: boolean;
    isWrite: boolean;
    isRead: boolean;
    isControl: boolean;
    isIO: boolean;
    isInputTarget: boolean;
};

export type VariableInfo = {
    key: string;
    name: string;
    scope: string;
    kind: DeclarationKind;
    declarationLine: number;
    occurrences: Occurrence[];
    initializedFromInput: boolean;
};

export type SpenRow = {
    key: string;
    name: string;
    scope: string;
    kind: DeclarationKind;
    count: number;
    spen: number;
    lines: number[];
};

export type ChepinRow = {
    key: string;
    name: string;
    scope: string;
    group: ChepinGroup;
    reason: string;
    inIO: boolean;
};

export type ChepinSummary = {
    groups: Record<ChepinGroup, ChepinRow[]>;
    counts: Record<ChepinGroup, number>;
    q: number;
};

export type DataFlowMetrics = {
    spens: SpenRow[];
    totalSpen: number;
    variables: ChepinRow[];
    full: ChepinSummary;
    io: ChepinSummary;
    inputFunctions: string[];
};
