import { useEffect } from "react";
import SocketService from "../services/socketService";

export default function useSocket() {

    useEffect(() => {

        if (!SocketService.isConnected()) {
            SocketService.connect();
        }

    }, []);

    return SocketService;

}