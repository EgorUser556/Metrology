import { NavLink } from "react-router";
import "./styled.css";

const navigationItems = [
    { to: "/", label: "ЛР1", end: true },
    { to: "/lab-2", label: "ЛР2", end: false },
];

const Header = () => {
    return (
        <header className="site-header">
            <div className="header-content">
                <NavLink to="/" end className="brand" aria-label="МСиСвИТ — главная">
          <span className="brand-mark" aria-hidden="true">
            M
          </span>

                    <span className="brand-text">
            <span className="brand-title">МСиСвИТ</span>
            <span className="brand-subtitle">Метрики программ</span>
          </span>
                </NavLink>

                <nav className="main-navigation" aria-label="Навигация по лабораторным работам">
                    {navigationItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                                `navigation-link${isActive ? " navigation-link-active" : ""}`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </div>
        </header>
    );
}

export default Header;