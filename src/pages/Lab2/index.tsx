import { useMemo, useState } from "react";
import { analyzeGilb } from "../../parser/gilb/gilb";
import { sampleRustCode } from '../../parser/gilb/sampleRustCode'
import "./styled.css";

const kindNames = {
    if: "Условие",
    for: "Цикл for",
    while: "Цикл while",
    loop: "Цикл loop",
    "match-arm": "Ветвь match",
};

const Lab2 = () => {
    const [code, setCode] = useState(sampleRustCode);
    const [submittedCode, setSubmittedCode] = useState(sampleRustCode);
    const metrics = useMemo(() => analyzeGilb(submittedCode), [submittedCode]);

    return (
        <main className="gilb-page">
            <section className="gilb-intro" aria-labelledby="gilb-title">
                <p className="gilb-kicker">Лабораторная работа №2</p>
                <h1 id="gilb-title">Метрика Джилба</h1>
                <p>
                    Анализ ветвлений Rust: абсолютная и относительная сложность,
                    максимальная глубина вложенности.
                </p>
            </section>

            <section className="gilb-workspace" aria-label="Анализ исходного кода">
                <div className="gilb-editor-heading">
                    <div>
                        <span className="gilb-label">Исходный код</span>
                        <small>Rust · комментарии исключаются</small>
                    </div>
                    <button type="button" onClick={() => setSubmittedCode(code)}>
                        Рассчитать
                    </button>
                </div>

                <label className="gilb-sr-only" htmlFor="gilb-code">
                    Исходный код программы на Rust
                </label>
                <textarea
                    id="gilb-code"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    spellCheck={false}
                />
            </section>

            <section className="gilb-metrics" aria-label="Результаты расчёта">
                <article><span>CL</span><strong>{metrics.absoluteComplexity}</strong><small>абсолютная сложность</small></article>
                <article><span>cl</span><strong>{metrics.relativeComplexity.toFixed(3)}</strong><small>CL / N</small></article>
                <article><span>CLI</span><strong>{metrics.maxNestingLevel}</strong><small>максимальная вложенность</small></article>
                <article><span>N</span><strong>{metrics.totalOperators}</strong><small>операторов программы</small></article>
            </section>

            <section className="gilb-details" aria-labelledby="branches-title">
                <div className="gilb-details-heading">
                    <div>
                        <p className="gilb-kicker">Проверка результата</p>
                        <h2 id="branches-title">Найденные ветвления</h2>
                    </div>
                    <span>{metrics.branches.length} элементов</span>
                </div>

                {metrics.branches.length > 0 ? (
                    <div className="gilb-table-wrap">
                        <table>
                            <thead>
                            <tr><th>№</th><th>Конструкция</th><th>Фрагмент</th><th>Строка</th><th>Уровень</th></tr>
                            </thead>
                            <tbody>
                            {metrics.branches.map((branch) => (
                                <tr key={branch.id}>
                                    <td>{branch.id}</td>
                                    <td>{kindNames[branch.kind]}</td>
                                    <td><code>{branch.label}</code></td>
                                    <td>{branch.line}</td>
                                    <td>{branch.level}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="gilb-empty">Ветвления в коде не найдены.</p>
                )}
            </section>

            <aside className="gilb-rule">
                <strong>Правило match</strong>
                <p>
                    Оператор с n ветвями заменяется на n − 1 условий.
                    Селектор и завершающая ветвь по умолчанию не увеличивают CL.
                </p>
            </aside>
        </main>
    );
};

export default Lab2;