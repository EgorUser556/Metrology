import { useState } from "react";
import "../../styles/App.css";
import { analyzeRustCode } from "../../parser/halstead";
import type { HalsteadMetrics } from "../../parser/types"
import INITIAL_CODE from "./config";
import MetricCard from "../MetricCard/index"
import FrequencyTable from "../FrequencyTable";

const App = () => {
    const [code, setCode] = useState(INITIAL_CODE);
    const [metrics, setMetrics] = useState<HalsteadMetrics | null>(null);
    const [error, setError] = useState("");

    const handleAnalyze = ()=> {
        if (!code.trim()) {
            setMetrics(null);
            setError("Вставьте Rust-код для анализа.");
            return;
        }

        setError("");
        setMetrics(analyzeRustCode(code));
    }

    return (
        <main className="app">
            <header>
                <h1>Анализатор метрик Холстеда для Rust</h1>
                <p className="subtitle">
                    Вставьте исходный код Rust и получите частоты операторов,
                    операндов и производные метрики Холстеда.
                </p>
            </header>

            <section className="editor-section">
                <label htmlFor="rust-code">Исходный код Rust</label>
                <textarea
                    id="rust-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    spellCheck="false"
                />
                <div className="editor-actions">
                    <span>{code.split("\n").length} строк</span>
                    <button type="button" onClick={handleAnalyze}>
                        Анализировать
                    </button>
                </div>
                {error && <p className="error">{error}</p>}
            </section>

            {metrics && (
                <>
                    <section className="metrics-section">
                        <h2>Базовые метрики</h2>

                        <div className="metric-grid basic-metric-grid">
                            <MetricCard
                                name="η₁"
                                value={metrics.eta1}
                                description="словарь операторов"
                            />
                            <MetricCard
                                name="N₁"
                                value={metrics.n1}
                                description="общее число операторов"
                            />
                            <MetricCard
                                name="η₂"
                                value={metrics.eta2}
                                description="словарь операндов"
                            />
                            <MetricCard
                                name="N₂"
                                value={metrics.n2}
                                description="общее число операндов"
                            />
                        </div>

                        <p className="metrics-note">
                            Частоты f₁ⱼ каждого оператора и f₂ᵢ каждого операнда приведены
                            в столбце «Частота» соответствующих таблиц.
                        </p>
                    </section>

                    <section className="metrics-section">
                        <h2>Расширенные метрики</h2>
                        <div className="metric-grid">
                            <MetricCard
                                name="η"
                                value={metrics.vocabulary}
                                description="словарь программы"
                            />
                            <MetricCard
                                name="N"
                                value={metrics.length}
                                description="длина программы"
                            />
                            <MetricCard
                                name="V"
                                value={metrics.volume.toFixed(2)}
                                description="объём программы, бит"
                            />
                        </div>
                    </section>

                    <div className="tables-grid">
                        <FrequencyTable
                            title="Операторы"
                            firstColumn="Оператор"
                            rows={metrics.operators}
                        />
                        <FrequencyTable
                            title="Операнды"
                            firstColumn="Операнд"
                            rows={metrics.operands}
                        />
                    </div>
                </>
            )}
        </main>
    );
}

export default App;