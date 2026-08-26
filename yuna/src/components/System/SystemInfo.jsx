import { useEffect, useState } from "react";
import { Descriptions, Spin } from "antd";
import ElectronService from "../../services/electronService";

export default function SystemInfo() {

    const [info, setInfo] = useState(null);

    useEffect(() => {

        ElectronService
            .getSystemInfo()
            .then(setInfo);

    }, []);

    if (!info) {
        return <Spin size="small" />;
    }

    return (

        <Descriptions
            column={1}
            size="small"
            items={[
                { key: "platform", label: "Platform", children: info.platform },
                { key: "cpus", label: "CPU", children: info.cpus },
                {
                    key: "memory",
                    label: "RAM",
                    children: `${(info.memory / 1024 / 1024 / 1024).toFixed(1)} GB`
                }
            ]}
        />

    );

}