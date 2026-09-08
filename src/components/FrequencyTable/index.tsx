import type { FrequencyTableProps } from "./types.ts";
import "../../styles/App.css";

const FrequencyTable = ({ title, firstColumn, rows }: FrequencyTableProps) => {
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
};

export default FrequencyTable;