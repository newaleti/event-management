import express from "express";
import Mosque from "../models/Mosque.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
const router = express.Router();
// 1. CREATE a Mosque (Only Super Admin)
router.post("/", protect, authorize("super_admin"), async (req, res) => {
    try {
        const { name, address, coordinates, description } = req.body;
        const existing = await Mosque.findOne({
            name: name?.trim(),
            address: address?.trim(),
        });
        if (existing) {
            return res.status(409).json({ message: "Mosque already exists" });
        }
        const newMosque = new Mosque({
            name: name?.trim(),
            address: address?.trim(),
            location: { type: "Point", coordinates },
            description,
        });
        const savedMosque = await newMosque.save();
        res.status(201).json(savedMosque);
    }
    catch (error) {
        res.status(500).json({ message: "Error creating mosque" });
    }
});
// 2. GET ALL Mosques (Public - for the Map)
router.get("/", async (req, res) => {
    try {
        const mosques = await Mosque.find();
        res.status(200).json(mosques);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching mosques" });
    }
});
export default router;
