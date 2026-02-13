import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";
import jwt from "jsonwebtoken";
import Mosque from "../models/Mosque.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
const router = express.Router();
// User registration route
router.post("/register", async (req, res) => {
    const { firstName, lastName, username, email, password } = req.body;
    // Basic validation
    if (!firstName || !lastName || !username || !email || !password) {
        return res.status(400).json({ message: "All fields are required" });
    }
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim();
    try {
        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
        });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }
        // Hash the password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        // Create new user
        const newUser = new User({
            firstName,
            lastName,
            username,
            email,
            password: hashedPassword,
        });
        // Save user
        await newUser.save();
        res.status(201).json({
            message: "User registered successfully",
            userId: newUser._id,
        });
    }
    catch (error) {
        if (error && typeof error === "object" && "code" in error) {
            const err = error;
            if (err.code === 11000) {
                return res.status(400).json({ message: "User already exists" });
            }
        }
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error("Unknown error", error);
        }
        res.status(500).json({ message: "Server error" });
    }
});
// User login route
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    // Basic validation
    if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
    }
    try {
        // 1. Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // 2. Compare passwords
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        // 3. Success! Send back a token or success message
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return res.status(500).json({ message: "JWT secret is not configured" });
        }
        const token = jwt.sign({ id: user._id, role: user.role, assignedMosque: user.assignedMosque }, // Payload: data we want to store
        secret, // Secret key to sign the token
        { expiresIn: "1h" });
        res.status(200).json({
            message: "Login successful!",
            token: token,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                assignedMosque: user.assignedMosque,
            },
        });
    }
    catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }
        else {
            console.error("Unknown error", error);
        }
        res.status(500).json({ message: "Server error" });
    }
});
// Assign a Mosque Admin (Super Admin only)
router.patch("/assign-mosque/:userId", protect, authorize("super_admin"), async (req, res) => {
    try {
        const { mosqueId } = req.body;
        // 1. Validation
        if (!mosqueId) {
            return res.status(400).json({ message: "Mosque ID is required" });
        }
        // 2. Check if the target user exists
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }
        // 3. THE SHIELD: Block if target is a Super Admin
        if (targetUser.role === "super_admin") {
            return res.status(403).json({
                message: "Protection: Super Admins cannot be demoted via API.",
            });
        }
        // 4. STRICT CHECK: Block if already assigned to a mosque
        if (targetUser.assignedMosque &&
            targetUser.assignedMosque.toString() !== "") {
            return res.status(400).json({
                message: "User is already assigned to a mosque. Unassign them first.",
            });
        }
        // 5. Check if mosque exists
        const mosque = await Mosque.findById(mosqueId);
        if (!mosque) {
            return res.status(404).json({ message: "Mosque not found" });
        }
        // 6. Update
        targetUser.role = "mosque_admin";
        targetUser.assignedMosque = mosqueId;
        await targetUser.save();
        // Convert to object and remove password before sending response
        const { password, ...userResponse } = targetUser.toObject();
        res.status(200).json({
            message: `Success: ${targetUser.username} is now admin for ${mosque.name}`,
            user: userResponse,
        });
    }
    catch (error) {
        console.error("Assign Mosque Error:", error);
        res.status(500).json({ message: "Error assigning mosque admin" });
    }
});
// Unassign a Mosque Admin (Super Admin only)
router.patch("/unassign-mosque/:userId", protect, authorize("super_admin"), async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }
        // Reset role to default 'user' and clear mosque reference
        targetUser.role = "user";
        targetUser.assignedMosque = undefined;
        await targetUser.save();
        // Convert to object and remove password before sending response
        const { password, ...userResponse } = targetUser.toObject();
        res.status(200).json({
            message: `User ${targetUser.username} has been unassigned and returned to regular user status.`,
            user: userResponse,
        });
    }
    catch (error) {
        console.error("Unassign Mosque Error:", error);
        res.status(500).json({ message: "Error unassigning mosque admin" });
    }
});
export default router;
