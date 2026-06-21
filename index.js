const express = require("express");
const dontenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dontenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT || 5000;

app.use(
  cors({
    credentials: true,
    origin: [process.env.CLIENT_URL || "http://localhost:3000"],
  }),
);
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const db = client.db("arthub");
    const artworksCollection = db.collection("artworks"); 

    app.post("/api/artworks", async (req, res) => {
      const newArtwork = req.body;
      try {
        const result = await artworksCollection.insertOne(newArtwork);
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to add artwork", error });
      }
    });

    app.post("/api/comments", async (req, res) => {
      const { artworkId, userId, userName, comment } = req.body;
      try {
        const result = await db.collection("comments").insertOne({
          artworkId,
          userId,
          userName,
          comment,
          createdAt: new Date(),
        });
        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Failed to post comment", error });
      }
    });

    app.get("/api/comments/:artworkId", async (req, res) => {
      const { artworkId } = req.params;
      try {
        const comments = await db.collection("comments")
          .find({ artworkId })
          .sort({ createdAt: -1 })
          .toArray();
        res.send(comments);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch comments", error });
      }
    });

    app.get("/api/check-purchase/:userId/:artworkId", async (req, res) => {
      const { userId, artworkId } = req.params;
      try {
        const purchase = await db.collection("purchases").findOne({
          userId,
          artworkId,
        });
        res.send({ hasPurchased: !!purchase });
      } catch (error) {
        res.status(500).send({ message: "Error checking purchase", error });
      }
    });

    
    app.post("/api/purchases", async (req, res) => {
      const { userId, artworkId, sessionId } = req.body;
      try {
        const existingPurchase = await db.collection("purchases").findOne({ userId, artworkId });
        if (existingPurchase) {
          return res.send({ message: "Already purchased", success: true });
        }

        const result = await db.collection("purchases").insertOne({
          userId,
          artworkId,
          sessionId,
           artworkName, 
         artistName,  
             price, 
          purchasedAt: new Date(),
        });
        
        res.send({ success: true, result });
      } catch (error) {
        res.status(500).send({ message: "Failed to save purchase", error });
      }
    });

    
app.post("/api/update-user-plan", async (req, res) => {
  const { userId, plan, sessionId } = req.body;

  try {
    
    let queryId;
    if (ObjectId.isValid(userId)) {
      queryId = new ObjectId(userId);
    } else {
      queryId = userId; 
    }

    
    const result = await db.collection("user").updateOne(
      { _id: queryId },
      { $set: { plan: plan, stripeSessionId: sessionId, updatedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      res.send({ success: true, message: "Plan updated successfully" });
    } else {
      res.send({ success: false, message: "User not found or plan is already the same" });
    }
  } catch (error) {
    console.error("Plan update error:", error);
    res.status(500).send({ message: "Failed to update plan", error });
  }
});
   
    app.get("/api/artworks", async (req, res) => {
      try {
        const { search, category, minPrice, maxPrice, sort, page = 1, limit = 8 } = req.query;
        let query = {};

        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { artistName: { $regex: search, $options: "i" } },
          ];
        }
        if (category) query.category = category;
        if (minPrice || maxPrice) {
          query.price = {};
          if (minPrice) query.price.$gte = parseFloat(minPrice);
          if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        let sortOptions = {};
        if (sort === "price_asc") sortOptions.price = 1; 
        else if (sort === "price_desc") sortOptions.price = -1; 
        else sortOptions._id = -1; 

        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        const artworks = await artworksCollection.find(query).sort(sortOptions).skip(skip).limit(limitNumber).toArray();
        const totalArtworks = await artworksCollection.countDocuments(query);

        res.send({
          artworks,
          totalArtworks,
          totalPages: Math.ceil(totalArtworks / limitNumber),
          currentPage: pageNumber,
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch artworks", error });
      }
    });

    app.get("/api/artworks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) return res.status(400).send({ message: "Invalid Artwork ID" });
        
        const query = { _id: new ObjectId(id) };
        const artwork = await artworksCollection.findOne(query);
        
        if (!artwork) return res.status(404).send({ message: "Artwork not found" });
        res.send(artwork);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch artwork details", error });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {}
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});