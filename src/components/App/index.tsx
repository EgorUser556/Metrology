import { Route, Routes } from "react-router";
import Header from "../Header";
import { routes } from "./config.tsx";

const App = () => {
    return (
        <>
            <Header />
            <Routes>
                {routes.map((route) => (
                    <Route
                        key={route.path}
                        path={route.path}
                        element={route.element}
                    />
                ))}
            </Routes>
        </>
    );
}

export default App;