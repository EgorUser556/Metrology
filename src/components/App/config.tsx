import type { RouteType } from './types';
import Lab1 from "../../pages/Lab1";
import Lab2 from "../../pages/Lab2";

export const routes: RouteType[] = [
    {
        path: "/",
        element: <Lab1 />,
    },
    {
        path: "/lab-2",
        element: <Lab2 />,
    },
];