import type { MetricCardProps } from "./types"
import "../../styles/App.css";

const MetricCard = ({ name, value, description } : MetricCardProps) =>  {
    return (
        <article className="metric-card">
            <span className="metric-name">{name}</span>
            <strong>{value}</strong>
            <small>{description}</small>
        </article>
    );
};

export default MetricCard;