import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { pipeline } from "@xenova/transformers";
import axios from "axios";
dotenv.config();
const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect("mongodb+srv://neelmaru63:neelmaru63@cluster0.5xgzbmr.mongodb.net/Ai_tools_assistent?retryWrites=true&w=majority&appName=Cluster0")
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log(err));

const Tool = mongoose.model("Tool", new mongoose.Schema({
    category: String,
    keywords: [String],
    embedding: [Number], // Vector embedding
    tools: [{ name: String, icon: String, link: String, description: String }],
}));

// Function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    return dotProduct / (normA * normB);
}

// API to fetch tools based on user search
app.post("/get-tools", async (req, res) => {
    const query = req.body.query;
    const searchEmbedding = await generateEmbedding(query);

    // Fetch all categories from MongoDB
    const categories = await Tool.find({});

    if (categories.length === 0) {
        return res.json([]); // No data available
    }

    // Find the most similar category using cosine similarity
    let bestMatch = null;
    let highestSimilarity = 0;

    const similarityPromises = categories.map(async (cat) => {
        if (cat.embedding) {
            const similarity = cosineSimilarity(searchEmbedding, cat.embedding);
            if (similarity > highestSimilarity) {
                highestSimilarity = similarity;
                bestMatch = cat;
            }
        }
    });

    // Wait for all similarity calculations to complete
    await Promise.all(similarityPromises);
    console.log("Similarity:", highestSimilarity);

    if (bestMatch && highestSimilarity > 0.7) { // Only accept highly similar matches
        return res.json(bestMatch);
    }

    const response = await axios.post(
        "https://api.together.xyz/v1/chat/completions",
        {
            model: "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
            messages: [{
                role: "user",
                content: `For the topic: "${query}", perform the following tasks:

1️⃣ Provide a broader and more general category name that can encompass similar future queries. The category name should be concise (2-4 words), relevant to related topics, and returned only as "Category: [Category Name]".

2️⃣ List exactly 3 AI tools that are best suited for this topic. These tools should be the most effective at performing the task the user is searching for. Each tool must be formatted exactly like this:

[Tool Name] 🛠 [Icon URL] 🔗 [Website Link] - [One-line description]

Ensure the recommended tools are highly relevant, widely used, and among the best available for the task.`
            }],
            max_tokens: 250,
        },
        { headers: { Authorization: `Bearer 1e0daf71863efea48b6822d5946b1917bce34d94e4d21229a0ffbafd0798b4f5` } }
    );

    const tools = await parseToolsAndCategory(response.data.choices[0].message.content);
    
    if(tools.tools.length === 0) {
        return res.json({ message: "No tools found for this query!" });
    }

    if(tools.category === "") {
        return res.json({ message: "Category not found!" });
    }

    if(tools.embedding.length === 0) {
        return res.json({ message: "Embedding not found!" });
    }

    // Save AI results in MongoDB
    // const newToolData = { category, embedding: categoryEmbedding, keywords: [query], tools };
    await Tool.create(tools);
    res.json(tools);
});

app.delete("/delete-tools", async (req, res) => {
    await Tool.deleteMany({category: req.body.category});
    res.json({ message: "All tools deleted successfully!" });
});

async function parseToolsAndCategory(responseContent) {
    const lines = responseContent.split("\n").map(line => line.trim()).filter(line => line !== "");

    // Extract category from the first line
    const categoryMatch = lines[0].match(/^Category:\s*(.+)/);
    const category = categoryMatch ? categoryMatch[1].trim() : "Unknown Category";

    // Extract tools from the next three lines
    const tools = lines.slice(1, 4).map(line => {
        const nameMatch = line.match(/^\d+\.?\s*(.*?)\s🛠/); // Extract tool name without leading number
        const iconMatch = line.match(/🛠\s(https?:\/\/[^\s]+)\s🔗/); // Extract icon URL
        const linkMatch = line.match(/🔗\s(https?:\/\/[^\s]+)/); // Extract website link
        const descriptionMatch = line.split(" - ").slice(1).join(" - ").trim();

        if (!nameMatch || !linkMatch) return null; // Skip invalid lines

        return {
            name: nameMatch[1].trim(),
            link: linkMatch[1].trim(),
            icon: `https://www.google.com/s2/favicons?sz=64&domain=${new URL(linkMatch[1].trim()).hostname}`,
            description: descriptionMatch || ""
        };
    }).filter(Boolean);

    // Convert category name to embedding
    const embedding = await generateEmbedding(category);

    return { category, tools, embedding };
}

async function generateEmbedding(text) {
    const extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    const embedding = await extractor(text, { pooling: "mean", normalize: true });
    return Array.isArray(embedding.data) ? [...embedding.data] : Object.values(embedding.data);
}

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));