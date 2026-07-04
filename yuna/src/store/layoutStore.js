import { create } from "zustand";

const useLayoutStore = create((set) => ({

    rightDrawerOpen: false,

    activeDrawer: null,

    toggleDrawer(name) {

        set(state => ({

            rightDrawerOpen:

                state.activeDrawer === name

                    ? !state.rightDrawerOpen

                    : true,

            activeDrawer: name

        }));

    },

    closeDrawer() {

        set({

            rightDrawerOpen: false,

            activeDrawer: null

        });

    }

}));

export default useLayoutStore;