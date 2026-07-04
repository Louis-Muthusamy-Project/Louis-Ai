import { useEffect, useState } from "react";
import ElectronService from "../../services/electronService";

export default function SystemInfo(){

    const [info,setInfo]=useState(null);

    useEffect(()=>{

        ElectronService
            .getSystemInfo()
            .then(setInfo);

    },[]);

    if(!info){

        return null;

    }

    return(

        <div>

            <p>Platform : {info.platform}</p>

            <p>CPU : {info.cpus}</p>

            <p>RAM : {(info.memory/1024/1024/1024).toFixed(1)} GB</p>

        </div>

    );

}