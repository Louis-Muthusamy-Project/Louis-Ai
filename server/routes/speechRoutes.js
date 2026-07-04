const express=require("express");

const router=express.Router();

router.post(

"/speech",

async(req,res)=>{

    res.json({

        success:true

    });

});

module.exports=router;