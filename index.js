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
    origin: [process.env.CLIENT_URL],
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

   
    app.get("/api/artworks", async (req, res) => {
      try {
        const { 
          search, 
          category, 
          minPrice, 
          maxPrice, 
          sort, 
          page = 1, 
          limit = 8 
        } = req.query;

        
        let query = {};

       
        if (search) {
          query.$or = [
            { title: { $regex: search, $options: "i" } },
            { artistName: { $regex: search, $options: "i" } },
          ];
        }

        
        if (category) {
          query.category = category;
        }

       
        if (minPrice || maxPrice) {
          query.price = {};
          if (minPrice) query.price.$gte = parseFloat(minPrice);
          if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        
        let sortOptions = {};
        if (sort === "price_asc") {
          sortOptions.price = 1; 
        } else if (sort === "price_desc") {
          sortOptions.price = -1; 
        } else {
          sortOptions._id = -1; 
        }

        
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);
        const skip = (pageNumber - 1) * limitNumber;

        
        const artworks = await artworksCollection
          .find(query)
          .sort(sortOptions)
          .skip(skip)
          .limit(limitNumber)
          .toArray();

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
       
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Artwork ID" });
        }
        
        const query = { _id: new ObjectId(id) };
        const artwork = await artworksCollection.findOne(query);
        
        if (!artwork) {
          return res.status(404).send({ message: "Artwork not found" });
        }
        
        res.send(artwork);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch artwork details", error });
      }
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running fine!");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});