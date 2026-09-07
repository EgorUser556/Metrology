import { useState } from "react";
import "./App.css";
import { analyzeRustCode } from "./parser/halstead";
import type { HalsteadMetrics } from "./parser/types"

const INITIAL_CODE = `fn main() {
    let mut sum = 0;

    for number in 1..=5 {
        sum += number;
    }

    if sum > 10 {
        println!("Сумма больше 10: {}", sum);
    }
}`;

function MetricCard({
                        name,
                        value,
                        description,
                    }: {
    name: string;
    value: string | number;
    description: string;
}) {
    return (
        <article className="metric-card">
            <span className="metric-name">{name}</span>
            <strong>{value}</strong>
            <small>{description}</small>
        </article>
    );
}

function FrequencyTable({
                            title,
                            firstColumn,
                            rows,
                        }: {
    title: string;
    firstColumn: string;
    rows: HalsteadMetrics["operators"];
}) {
    return (
        <section className="table-section">
            <h2>{title}</h2>

            {rows.length === 0 ? (
                <p className="empty-message">Элементы не найдены.</p>
            ) : (
                <table>
                    <thead>
                    <tr>
                        <th>№</th>
                        <th>{firstColumn}</th>
                        <th>Частота</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.map((row, index) => (
                        <tr key={row.token}>
                            <td>{index + 1}</td>
                            <td>
                                <code>{row.token}</code>
                            </td>
                            <td>{row.count}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </section>
    );
}

function App() {
    const [code, setCode] = useState(INITIAL_CODE);
    const [metrics, setMetrics] = useState<HalsteadMetrics | null>(null);
    const [error, setError] = useState("");

    function handleAnalyze() {
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
                <p className="eyebrow">Курсовая работа по метрикам размера программ</p>
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
                        <div className="metric-grid">
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
                            <MetricCard
                                name="f₁ⱼ"
                                value={metrics.operators.length}
                                description="частоты операторов — в таблице"
                            />
                            <MetricCard
                                name="f₂ᵢ"
                                value={metrics.operands.length}
                                description="частоты операндов — в таблице"
                            />
                        </div>
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