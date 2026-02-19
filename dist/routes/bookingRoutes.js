import express from "express";
import Booking from "../models/Booking.js";
import Event from "../models/Event.js";
import { protect, authorize } from "../middleware/authMiddleware.js";
const router = express.Router();
// 1. CREATE A BOOKING (Any logged-in user)
router.post("/", protect, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: "Not authorized" });
        }
        const { eventId } = req.body;
        // Find the event
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        // Check if event is restricted and if user has the right membership status
        if (event.accessType === "restricted") {
            const membership = req.user.mosqueMemberships?.find((m) => m.mosque.toString() === event.mosque.toString());
            if (!membership || membership.status !== "student") {
                return res.status(403).json({
                    message: "You are not a registered student at this specific mosque.",
                });
            }
        }
        // Check if event is in the past
        if (new Date(event.date) < new Date()) {
            return res.status(400).json({ message: "Cannot book a past event" });
        }
        // Check Capacity (If capacity is 0, it's unlimited)
        if (event.capacity > 0 && event.bookedCount >= event.capacity) {
            return res.status(400).json({ message: "Event is fully booked" });
        }
        // Check if user already booked (Safety check even with unique index)
        const alreadyBooked = await Booking.findOne({
            event: eventId,
            user: req.user?.id,
        });
        if (alreadyBooked) {
            return res
                .status(400)
                .json({ message: "You have already booked this event" });
        }
        // Create the booking
        const newBooking = new Booking({
            event: eventId,
            user: req.user?.id,
        });
        await newBooking.save();
        // Increment the bookedCount on the Event model
        event.bookedCount += 1;
        await event.save();
        res.status(201).json({
            message: "Booking confirmed successfully!",
            booking: newBooking,
        });
    }
    catch (error) {
        console.error("Booking Error:", error);
        res.status(500).json({ message: "Error processing booking" });
    }
});
// 2. GET USER'S BOOKINGS
router.get("/my-bookings", protect, async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user?.id })
            .populate({
            path: "event",
            populate: { path: "mosque", select: "name location" },
        })
            .sort("-createdAt");
        res.status(200).json(bookings);
    }
    catch (error) {
        res.status(500).json({ message: "Error fetching bookings" });
    }
});
// 3. CANCEL A BOOKING
router.delete("/:id", protect, async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }
        // Authorization: Check if the booking belongs to the logged-in user
        if (booking.user.toString() !== req.user?.id) {
            return res
                .status(403)
                .json({ message: "Not authorized to cancel this booking" });
        }
        // Prevent double-cancellation logic
        if (booking.status === "cancelled") {
            return res.status(400).json({ message: "Booking is already cancelled" });
        }
        // We use a transaction-like approach:
        // 1. Mark booking as cancelled (or delete it, but marking is better for records)
        booking.status = "cancelled";
        await booking.save();
        // 2. Decrement the bookedCount on the Event
        await Event.findByIdAndUpdate(booking.event, { $inc: { bookedCount: -1 } });
        res.status(200).json({ message: "Booking cancelled successfully" });
    }
    catch (error) {
        console.error("Cancellation Error:", error);
        res.status(500).json({ message: "Error cancelling booking" });
    }
});
// GET /api/bookings/event/:eventId (Mosque Admin & Super Admin only)
router.get("/event/:eventId", protect, authorize("mosque_admin", "super_admin"), async (req, res) => {
    try {
        const { eventId } = req.params;
        // 1. Verify the event exists
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: "Event not found" });
        }
        // 2. Security: If Mosque Admin, ensure they own the mosque this event belongs to
        if (req.user?.role === "mosque_admin") {
            if (event.mosque.toString() !== req.user?.assignedMosque?.toString()) {
                return res
                    .status(403)
                    .json({
                    message: "Not authorized to view attendees for this mosque.",
                });
            }
        }
        // 3. Get all bookings for this event and pull in User names/emails
        const attendees = await Booking.find({
            event: eventId,
            status: "confirmed",
        })
            .populate("user", "username email")
            .select("user bookingDate"); // Only return user info and when they booked
        res.status(200).json({
            eventName: event.title,
            totalAttendees: attendees.length,
            attendees,
        });
    }
    catch (error) {
        console.error("Attendance Error:", error);
        res.status(500).json({ message: "Error fetching attendance list" });
    }
});
export default router;
