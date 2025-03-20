const dotenv = require("dotenv");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Tool = require("./Model/tools")
const axios = require("axios"); 

dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));


const toolsRoutes = require("./Routes/tools_routes")
app.use("/", toolsRoutes)

// Start Server
app.listen(process.env.PORT, () => console.log(`Server running on port ${process.env.PORT}`));