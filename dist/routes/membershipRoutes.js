import express from "express";
import MembershipRequest from "../models/MembershipRequest.js";
import User from "../models/User.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
const router = express.Router();
// 1. USER: Apply for membership
router.post("/apply", protect, async (req, res) => {
    try {
        const { mosqueId, message } = req.body;
        // Check if a pending request already exists
        const existing = await MembershipRequest.findOne({
            user: req.user?.id,
            mosque: mosqueId,
            status: "pending",
        });
        if (existing)
            return res.status(400).json({ message: "Application already pending" });
        const newRequest = new MembershipRequest({
            user: req.user?.id,
            mosque: mosqueId,
            message,
        });
        await newRequest.save();
        res.status(201).json({ message: "Application submitted successfully" });
    }
    catch (error) {
        res.status(500).json({ message: "Error submitting application" });
    }
});
// 2. ADMIN: View all applications for their mosque
router.get("/mosque-requests", protect, authorize("mosque_admin"), async (req, res) => {
    const requests = await MembershipRequest.find({
        mosque: req.user?.assignedMosque,
    }).populate("user", "firstName lastName email phoneNumber gender age").sort("-createdAt");
    res.json(requests);
});
// 3. ADMIN: Approve or Reject
router.put("/:id/decide", protect, authorize("mosque_admin"), async (req, res) => {
    const { status } = req.body; // "approved" or "rejected"
    const request = await MembershipRequest.findById(req.params.id);
    if (!request)
        return res.status(404).json({ message: "Request not found" });
    request.status = status;
    await request.save();
    if (status === "approved") {
        await User.findOneAndUpdate({ _id: request.user, "mosqueMemberships.mosque": request.mosque }, { $set: { "mosqueMemberships.$.status": "student" } }).then(async (user) => {
            // If user didn't already have a membership entry for this mosque, push it
            if (!user) {
                await User.findByIdAndUpdate(request.user, {
                    $push: {
                        mosqueMemberships: { mosque: request.mosque, status: "student" },
                    },
                });
            }
        });
    }
    res.json({ message: `Application ${status}` });
});
// 4. USER: View their own applications
router.get("/my-requests", protect, async (req, res) => {
    const requests = await MembershipRequest.find({ user: req.user?.id });
    res.json(requests);
});
// 5. USER: Delete their own applications
router.delete("/my-requests", protect, async (req, res) => {
    await MembershipRequest.deleteMany({ user: req.user?.id });
    res.json({ message: "All requests deleted" });
});
// 6. ADMIN: View and Filter applications for their mosque
router.get("/mosque-requests", protect, authorize("mosque_admin"), async (req, res) => {
    try {
        const { name, gender, status } = req.query;
        // Start with the basic filter: only this admin's mosque
        let filter = { mosque: req.user?.assignedMosque };
        // 1. Filter by Status (pending, approved, rejected)
        if (status)
            filter.status = status;
        // Prepare the User population with optional filters
        const userMatch = {};
        if (gender)
            userMatch.gender = gender;
        // 2. Filter by Name (Search)
        if (name) {
            userMatch.$or = [
                { firstName: { $regex: name, $options: "i" } },
                { lastName: { $regex: name, $options: "i" } }
            ];
        }
        const requests = await MembershipRequest.find(filter)
            .populate({
            path: "user",
            match: userMatch, // This filters the JOINED user data
            select: "firstName lastName email phoneNumber gender age"
        })
            .sort("-createdAt");
        // Because .populate(match) returns null for non-matching users, 
        // we filter out the nulls before sending to frontend
        const filteredRequests = requests.filter(req => req.user !== null);
        res.json(filteredRequests);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching filtered requests" });
    }
});
export default router;
