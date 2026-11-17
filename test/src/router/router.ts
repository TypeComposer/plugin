import { AppPage } from "@/app-page/AppPage";
import { Router } from "typecomposer";

Router.create({
    routes: [
        {
            path: "app",
            component: AppPage
        }

    ]
});