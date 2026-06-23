const express = require("express");
const dotenv = require("dotenv"); 
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
dotenv.config();

const uri = process.env.MONGODB_URI;

const app = express();
const PORT = process.env.PORT;

app.use(
  cors({
    credentials: true,
    origin: process.env.CLIENT_URL 
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

    
    app.get("/api/my-artworks/:email", async (req, res) => {
      const email = req.params.email;
      try {
        const query = { artistEmail: email };
        const artworks = await artworksCollection.find(query).sort({ createdAt: -1 }).toArray();
        res.send(artworks);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch your artworks", error });
      }
    });

    
    app.put("/api/artworks/update/:id", async (req, res) => {
      const id = req.params.id;
      const updatedData = req.body;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Artwork ID" });
        }
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            title: updatedData.title,
            artistName: updatedData.artistName,
            description: updatedData.description,
            price: parseFloat(updatedData.price),
            category: updatedData.category,
            ...(updatedData.imageUrl && { imageUrl: updatedData.imageUrl }), 
            updatedAt: new Date()
          },
        };
        const result = await artworksCollection.updateOne(filter, updateDoc);
        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Artwork updated successfully" });
        } else {
          res.send({ success: false, message: "No changes made or artwork not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Failed to update artwork", error });
      }
    });

   
app.get("/api/admin/analytics", async (req, res) => {
  try {
   
    const totalUsers = await db.collection("user").countDocuments({});
    const totalArtists = await db.collection("user").countDocuments({ role: "artist" });

    const purchases = await db.collection("purchases").find({}).toArray();
    const totalArtworksSold = purchases.length;
    const totalRevenue = purchases.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    
    const artworks = await artworksCollection.find({}).toArray();
    const counts = {};
    artworks.forEach((art) => {
      const cat = art.category || "Uncategorized";
      counts[cat] = (counts[cat] || 0) + 1;
    });

    const chartData = Object.keys(counts).map((key) => ({
      name: key,
      value: counts[key],
    }));

    
    res.send({
      stats: { totalUsers, totalArtists, totalArtworksSold, totalRevenue },
      chartData,
    });
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch analytics", error });
  }
});

   
    app.delete("/api/artworks/:id", async (req, res) => {
      const id = req.params.id;
      try {
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid Artwork ID" });
        }
        const query = { _id: new ObjectId(id) };
        const result = await artworksCollection.deleteOne(query);
        if (result.deletedCount > 1 || result.deletedCount === 1) {
          res.send({ success: true, message: "Artwork deleted successfully" });
        } else {
          res.status(404).send({ success: false, message: "Artwork not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Failed to delete artwork", error });
      }
    });

   
  app.get("/api/users", async (req, res) => {
  try {
    const users = await db.collection("user").find({}).toArray();
    res.send(users);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch users", error });
  }
});


app.put("/api/users/change-role/:id", async (req, res) => {
  const { id } = req.params;
  const { role } = req.body; 

  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid User ID" });
    }

    const result = await db.collection("user").updateOne(
      { _id: new ObjectId(id) },
      { $set: { role: role, updatedAt: new Date() } }
    );

    if (result.modifiedCount > 0) {
      res.send({ success: true, message: "User role updated successfully" });
    } else {
      res.send({ success: false, message: "No changes made or user not found" });
    }
  } catch (error) {
    res.status(500).send({ message: "Failed to update user role", error });
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

        const artwork = await artworksCollection.findOne({ _id: new ObjectId(artworkId) });
        if (!artwork) {
          return res.status(404).send({ message: "Artwork not found in database" });
        }

        const result = await db.collection("purchases").insertOne({
          userId,
          artworkId,
          sessionId,
          artworkName: artwork.title,    
          artistName: artwork.artistName, 
          price: artwork.price,           
          imageUrl: artwork.imageUrl,     
          purchasedAt: new Date(),
        });
        
        res.send({ success: true, result });
      } catch (error) {
        console.error("Purchase error:", error);
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

    app.put("/api/users/:id", async (req, res) => {
      const { id } = req.params;
      const { name, image } = req.body;
      try {
        let queryId;
        if (ObjectId.isValid(id)) {
          queryId = new ObjectId(id);
        } else {
          return res.status(400).send({ message: "Invalid User ID" });
        }

        const result = await db.collection("user").updateOne(
          { _id: queryId },
          { $set: { name, image, updatedAt: new Date() } }
        );

        if (result.modifiedCount > 0) {
          res.send({ success: true, message: "Profile updated successfully" });
        } else {
          res.send({ success: false, message: "No changes made or user not found" });
        }
      } catch (error) {
        res.status(500).send({ message: "Failed to update profile", error });
      }
    });

   
app.get("/api/admin/transactions", async (req, res) => {
  try {
    
    const purchases = await db.collection("purchases").find({}).sort({ purchasedAt: -1 }).toArray();
    
    const allTransactions = [];

    
    for (let purchase of purchases) {
      let userEmail = "Unknown User";
      
      if (purchase.userId) {
        
        const queryId = ObjectId.isValid(purchase.userId) ? new ObjectId(purchase.userId) : purchase.userId;
        const user = await db.collection("user").findOne({ _id: queryId });
        
        if (user && user.email) {
          userEmail = user.email;
        }
      }

      
      allTransactions.push({
        _id: purchase._id,
        transactionId: purchase.sessionId || "N/A", 
        type: "Purchase", 
        email: userEmail,
        amount: purchase.price,
        date: purchase.purchasedAt
      });
    }

    res.send(allTransactions);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch transactions", error });
  }
});
   
    app.get("/api/artist-sales/:email", async (req, res) => {
      try {
        const email = req.params.email;
        
       
        const myArtworks = await artworksCollection.find({ artistEmail: email }).toArray();
        const myArtworkIds = myArtworks.map(art => art._id.toString());

        
        if (myArtworkIds.length === 0) {
          return res.send([]);
        }

        
        const sales = await db.collection("purchases")
          .find({ artworkId: { $in: myArtworkIds } })
          .sort({ purchasedAt: -1 })
          .toArray();

        
        const userIds = [...new Set(sales.map(s => s.userId))]; 
        const buyerObjectIds = userIds.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id);
        
        const buyers = await db.collection("user")
          .find({ _id: { $in: buyerObjectIds } })
          .project({ name: 1 }) 
          .toArray();

        
        const enrichedSales = sales.map(sale => {
          
          const buyer = buyers.find(b => b._id.toString() === sale.userId);
          return {
            ...sale,
            buyerName: buyer ? buyer.name : "Unknown Buyer"
          };
        });

        res.send(enrichedSales);
      } catch (error) {
        console.error("Sales fetch error:", error);
        res.status(500).send({ message: "Failed to fetch sales history", error });
      }
    });
   
app.get("/api/admin/artworks", async (req, res) => {
  try {
   
    const artworks = await artworksCollection.find({}).sort({ createdAt: -1 }).toArray();
    res.send(artworks);
  } catch (error) {
    res.status(500).send({ message: "Failed to fetch all artworks for admin", error });
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

    app.get("/api/my-purchases/:userId", async (req, res) => {
      try {
        const userId = req.params.userId;
        const purchases = await db.collection("purchases").find({ userId }).toArray();
        res.send(purchases);
      } catch (error) {
        res.status(500).send({ message: "Error fetching purchases", error });
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