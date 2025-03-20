const express = require("express")
const router = express.Router();
const toolsController = require("../Controller/tools_controller")

const { deleteTools, getTools } = toolsController;

router
    .route("/get-tools")
    .post(getTools)

router
    .route("/delete-tools")
    .delete(deleteTools)

module.exports = router;