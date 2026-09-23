export type FrequencyItem = {
    token: string;
    count: number;
};

export type HalsteadMetrics = {
    eta1: number;
    eta2: number;
    n1: number;
    n2: number;
    vocabulary: number;
    length: number;
    volume: number;
    operators: FrequencyItem[];
    operands: FrequencyItem[];
};