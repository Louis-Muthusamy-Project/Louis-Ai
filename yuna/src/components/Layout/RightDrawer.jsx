import { Suspense, lazy } from "react";
import { Drawer, Spin } from "antd";

import useLayoutStore from "../../store/layoutStore";

const SettingsView = lazy(() => import("../../views/SettingsView/SettingsView"));

export default function RightDrawer() {

    const open = useLayoutStore(
        state => state.rightDrawerOpen
    );

    const activeDrawer = useLayoutStore(
        state => state.activeDrawer
    );

    const closeDrawer = useLayoutStore(
        state => state.closeDrawer
    );

    return (

        <Drawer
            title={activeDrawer === "settings" ? "Settings" : activeDrawer}
            open={open}
            onClose={closeDrawer}
            width={420}
            destroyOnHidden
        >

            {
                activeDrawer === "settings" && (
                    <Suspense fallback={<Spin size="large" style={{ margin: "40px auto", display: "block" }} />}>
                        <SettingsView />
                    </Suspense>
                )
            }

        </Drawer>

    );

}