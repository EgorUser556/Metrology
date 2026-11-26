import { useMemo, useState, type ChangeEvent } from "react";
import { analyzeDataFlow, CHEPIN_WEIGHTS, GLOBAL_SCOPE } from "../../parser/dataflow/dataflow";
import { sampleRustCode } from "../../parser/dataflow/sampleRustCode";
import type { ChepinGroup, ChepinSummary } from "../../parser/dataflow/types";
import "./styled.css";

const GROUPS: ChepinGroup[] = ["P", "M", "C", "T"];
/** Сколько идентификаторов помещается в одну строку таблицы 8 */
const SPEN_CHUNK = 8;

const groupNames: Record<ChepinGroup, string> = {
    P: "вводимые",
    M: "модифицируемые",
    C: "управляющие",
    T: "паразитные",
};

const kindNames = {
    const: "константа",
    parameter: "параметр",
    let: "переменная",
    loop: "параметр цикла",
    pattern: "привязка match",
    closure: "параметр замыкания",
};

const formatNumber = (value: number): string => value.toString().replace(".", ",");

const formula = (summary: ChepinSummary): string => {
    const parts = GROUPS.map((group) =>
        `${formatNumber(CHEPIN_WEIGHTS[group])}*${summary.counts[group]}`,
    );
    return `Q = ${parts.join(" + ")} = ${formatNumber(summary.q)}`;
};

const Lab3 = () => {
    const [code, setCode] = useState(sampleRustCode);
    const [submittedCode, setSubmittedCode] = useState(sampleRustCode);
    const metrics = useMemo(() => analyzeDataFlow(submittedCode), [submittedCode]);

    // Если имя встречается в нескольких функциях, рядом показываем область видимости
    const duplicateNames = useMemo(() => {
        const counts = new Map<string, number>();
        metrics.spens.forEach((row) => counts.set(row.name, (counts.get(row.name) ?? 0) + 1));
        return new Set([...counts].filter(([, count]) => count > 1).map(([name]) => name));
    }, [metrics]);

    const spenChunks = useMemo(() => {
        const chunks = [];
        for (let i = 0; i < metrics.spens.length; i += SPEN_CHUNK) {
            chunks.push(metrics.spens.slice(i, i + SPEN_CHUNK));
        }
        return chunks;
    }, [metrics]);

    const label = (name: string, scope: string) =>
        duplicateNames.has(name) && scope !== GLOBAL_SCOPE ? (
            <>
                {name}
                <sub>{scope}</sub>
            </>
        ) : (
            name
        );

    const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        file.text().then((text) => {
            setCode(text);
            setSubmittedCode(text);
        });
        event.target.value = "";
    };

    const renderGroupCells = (summary: ChepinSummary, kind: "vars" | "count") =>
        GROUPS.map((group) => (
            <td key={group}>
                {kind === "vars"
                    ? summary.groups[group].length
                        ? summary.groups[group].map((row, index) => (
                            <span key={row.key}>
                                {index > 0 && ", "}
                                {label(row.name, row.scope)}
                            </span>
                        ))
                        : "—"
                    : `${group.toLowerCase()} = ${summary.counts[group]}`}
            </td>
        ));

    return (
        <main className="df-page">
            <section className="df-intro" aria-labelledby="df-title">
                <p className="df-kicker">Лабораторная работа №3</p>
                <h1 id="df-title">Метрики потока данных</h1>
                <p>
                    Спены идентификаторов, полная метрика Чепина и метрика Чепина
                    ввода/вывода для программы на Rust.
                </p>
            </section>

            <section className="df-card df-workspace" aria-label="Анализ исходного кода">
                <div className="df-editor-heading">
                    <div>
                        <span className="df-kicker">Исходный код</span>
                        <small>Rust · комментарии исключаются</small>
                    </div>
                    <div className="df-actions">
                        <label className="df-button df-button-ghost">
                            Загрузить .rs
                            <input type="file" accept=".rs,.txt" onChange={handleFile} hidden />
                        </label>
                        <button
                            type="button"
                            className="df-button df-button-ghost"
                            onClick={() => {
                                setCode(sampleRustCode);
                                setSubmittedCode(sampleRustCode);
                            }}
                        >
                            Исходная программа
                        </button>
                        <button type="button" className="df-button" onClick={() => setSubmittedCode(code)}>
                            Рассчитать
                        </button>
                    </div>
                </div>

                <label className="df-sr-only" htmlFor="df-code">
                    Исходный код программы на Rust
                </label>
                <textarea
                    id="df-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    spellCheck={false}
                />
            </section>

            <section className="df-metrics" aria-label="Итоговые значения">
                <article><span>Σ спен</span><strong>{metrics.totalSpen}</strong><small>суммарный спен программы</small></article>
                <article><span>n</span><strong>{metrics.spens.length}</strong><small>идентификаторов</small></article>
                <article><span>Q</span><strong>{formatNumber(metrics.full.q)}</strong><small>полная метрика Чепина</small></article>
                <article><span>Q ввода/вывода</span><strong>{formatNumber(metrics.io.q)}</strong><small>метрика Чепина ввода/вывода</small></article>
            </section>

            <section className="df-card" aria-labelledby="spen-title">
                <div className="df-section-heading">
                    <div>
                        <p className="df-kicker">Таблица 8</p>
                        <h2 id="spen-title">Спен программы</h2>
                    </div>
                    <span>спен = число появлений − 1</span>
                </div>

                {metrics.spens.length > 0 ? (
                    <div className="df-spen-chunks">
                        {spenChunks.map((chunk, chunkIndex) => {
                            const isLast = chunkIndex === spenChunks.length - 1;
                            return (
                                <div className="df-table-wrap" key={chunkIndex}>
                                    <table className="df-table df-table-horizontal">
                                        <tbody>
                                        <tr>
                                            <th>Идентификатор</th>
                                            {chunk.map((row) => (
                                                <td key={row.key}><code>{label(row.name, row.scope)}</code></td>
                                            ))}
                                            {isLast && <th>Суммарный спен программы</th>}
                                        </tr>
                                        <tr>
                                            <th>Спен</th>
                                            {chunk.map((row) => <td key={row.key}>{row.spen}</td>)}
                                            {isLast && <td className="df-total">{metrics.totalSpen}</td>}
                                        </tr>
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p className="df-empty">Идентификаторы не найдены.</p>
                )}

                <details className="df-details">
                    <summary>Подробно: появления идентификаторов</summary>
                    <div className="df-table-wrap">
                        <table className="df-table">
                            <thead>
                            <tr><th>№</th><th>Идентификатор</th><th>Область</th><th>Вид</th><th>Появлений</th><th>Спен</th><th>Строки</th></tr>
                            </thead>
                            <tbody>
                            {metrics.spens.map((row, index) => (
                                <tr key={row.key}>
                                    <td>{index + 1}</td>
                                    <td><code>{row.name}</code></td>
                                    <td>{row.scope}</td>
                                    <td>{kindNames[row.kind]}</td>
                                    <td>{row.count}</td>
                                    <td>{row.spen}</td>
                                    <td className="df-lines">{row.lines.join(", ")}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            </section>

            <section className="df-card" aria-labelledby="chepin-title">
                <div className="df-section-heading">
                    <div>
                        <p className="df-kicker">Таблица 9</p>
                        <h2 id="chepin-title">Метрики Чепина программы</h2>
                    </div>
                    <span>Q = p + 2m + 3c + 0,5t</span>
                </div>

                <div className="df-table-wrap">
                    <table className="df-table df-table-chepin">
                        <thead>
                        <tr>
                            <th rowSpan={2}></th>
                            <th colSpan={4}>Полная метрика Чепина</th>
                            <th colSpan={4}>Метрика Чепина ввода/вывода</th>
                        </tr>
                        <tr>
                            {GROUPS.map((group) => <th key={`f-${group}`}>{group}</th>)}
                            {GROUPS.map((group) => <th key={`io-${group}`}>{group}</th>)}
                        </tr>
                        </thead>
                        <tbody>
                        <tr>
                            <th>Переменные, относящиеся к группе</th>
                            {renderGroupCells(metrics.full, "vars")}
                            {renderGroupCells(metrics.io, "vars")}
                        </tr>
                        <tr>
                            <th>Количество переменных в группе</th>
                            {renderGroupCells(metrics.full, "count")}
                            {renderGroupCells(metrics.io, "count")}
                        </tr>
                        <tr>
                            <th>Метрика Чепина</th>
                            <td colSpan={4} className="df-formula">{formula(metrics.full)}</td>
                            <td colSpan={4} className="df-formula">{formula(metrics.io)}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>

                <details className="df-details">
                    <summary>Подробно: почему переменная попала в группу</summary>
                    <div className="df-table-wrap">
                        <table className="df-table">
                            <thead>
                            <tr><th>Переменная</th><th>Область</th><th>Группа</th><th>Обоснование</th><th>Ввод/вывод</th></tr>
                            </thead>
                            <tbody>
                            {metrics.variables.map((row) => (
                                <tr key={row.key}>
                                    <td><code>{row.name}</code></td>
                                    <td>{row.scope}</td>
                                    <td><span className={`df-badge df-badge-${row.group}`}>{row.group}</span> {groupNames[row.group]}</td>
                                    <td>{row.reason}</td>
                                    <td>{row.inIO ? "да" : "—"}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </details>
            </section>

            <aside className="df-card df-rule">
                <strong>Правила разбора</strong>
                <ul>
                    <li>Идентификаторы — переменные, параметры функций и константы; одноимённые переменные в разных функциях считаются разными.</li>
                    <li>Первое появление — объявление (<code>let</code>, параметр, <code>const</code>), поэтому спен равен числу последующих появлений.</li>
                    <li>C — переменные в условиях <code>if</code>, <code>while</code>, <code>match</code>, диапазоне и параметре <code>for</code>.</li>
                    <li>P — параметры и значения, полученные со стандартного ввода, которые не изменяются; T — переменные, значение которых не используется.</li>
                    <li>Список ввода/вывода — аргументы <code>print!</code>, <code>println!</code>, <code>write!</code> и <code>read_line</code>.</li>
                </ul>
            </aside>
        </main>
    );
};

export default Lab3;
