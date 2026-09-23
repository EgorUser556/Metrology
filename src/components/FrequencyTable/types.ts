import type { HalsteadMetrics } from "../../parser/halstead/types.ts";

export interface FrequencyTableProps {
    title: string;
    firstColumn: string;
    rows: HalsteadMetrics["operators"];
}