// require('dotenv').config()
import dotenv from "dotenv"

import express from "express"
import connectDB from "./db/db.connect.js";
const app = express()

dotenv.config({
    path:'./env'
})


// Approach 2 to connect to DB
connectDB()
.then(() => {
    app.listen(process.env.port || 8000, () => {
        console.log(`Server is runnning on port : ${process.env.port}`)
        
        app.on("error", (error)=> {
            console.log("ERROR: ", error);
            throw error;
        })

    })
})
.catch((err) => {
    console.log("MONGO DB Connection failed", err)
}) 











// Approach 1 to connect to Mongo DB

/*
(async() => {
    try{
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error)=> {
            console.log("ERROR: ", error);
            throw error;
        })

        app.listen(process.env.PORT, () => {
            console.log(`App is listening on port ${process.env.PORT}`)
        })


    } catch(error){
        console.error("ERROR: ", error)
        throw err
    }
})()

*/