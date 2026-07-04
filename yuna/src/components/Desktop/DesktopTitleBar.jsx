import ElectronService from "../../services/electronService";

export default function DesktopTitleBar() {

    return (

        <div className="desktop-titlebar">

            <div className="title">

                🌸 Yuna AI

            </div>

            <div className="window-buttons">

                <button
                    onClick={() =>
                        ElectronService.minimize()
                    }
                >
                    —
                </button>

                <button
                    onClick={() =>
                        ElectronService.maximize()
                    }
                >
                    □
                </button>

                <button
                    onClick={() =>
                        ElectronService.close()
                    }
                >
                    ✕
                </button>

            </div>

        </div>

    );

}