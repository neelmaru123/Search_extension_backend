const mongoose = require("mongoose");

const toolSchema = mongoose.model("Tool", new mongoose.Schema({
    category: String,
    keywords: [String],
    embedding: [Number], // Vector embedding
    tools: [{ name: String, icon: String, link: String, description: String }],
}));

module.exports = toolSchema;