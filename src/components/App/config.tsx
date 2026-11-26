import type { RouteType } from './types';
import Lab1 from "../../pages/Lab1";
import Lab2 from "../../pages/Lab2";
import Lab3 from "../../pages/Lab3";

export const routes: RouteType[] = [
    {
        path: "/",
        element: <Lab1 />,
    },
    {
        path: "/lab-2",
        element: <Lab2 />,
    },
    {
        path: "/lab-3",
        element: <Lab3 />,
    },
];