import type { HalsteadMetrics } from "../../parser/types";

export interface FrequencyTableProps {
    title: string;
    firstColumn: string;
    rows: HalsteadMetrics["operators"];
}