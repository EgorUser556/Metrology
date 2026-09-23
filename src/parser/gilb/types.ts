export type BranchKind = "if" | "for" | "while" | "loop" | "match-arm";

export type BranchInfo = {
    id: number;
    kind: BranchKind;
    label: string;
    line: number;
    level: number;
};

export type GilbMetrics = {
    absoluteComplexity: number;
    relativeComplexity: number;
    maxNestingLevel: number;
    totalOperators: number;
    branches: BranchInfo[];
};

export type RustToken = {
    value: string;
    line: number;
    column: number;
};