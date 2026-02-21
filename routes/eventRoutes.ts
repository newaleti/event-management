import express from "express";
import Event from "../models/Event.js";
import User from "../models/User.js";
import Booking from "../models/Booking.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- 1. SEARCH & FILTERS (Place this BEFORE any /:id routes) ---
router.get("/search", async (req, res) => {
  try {
    const { keyword, location, category, startDate, endDate, upcoming, mosque } = req.query;

    let query: any = {};

    // Text Search
    if (keyword) {
      query.$or = [
        { title: { $regex: String(keyword), $options: "i" } },
        { description: { $regex: String(keyword), $options: "i" } },
      ];
    }

    // Location Filter
    if (location) {
      query.location = { $regex: String(location), $options: "i" };
    }

    // Category Filter
    if (category) {
      query.eventType = category; // Note: using eventType as per your model
    }

    // Specific Mosque Filter
    if (mosque) {
      query.mosque = mosque;
    }

    // Date Filters
    if (upcoming === "true") {
      query.date = { $gte: new Date() };
    } else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate as string);
      if (endDate) query.date.$lte = new Date(endDate as string);
    }

    const events = await Event.find(query)
      .populate("organiser", "username")
      .populate("mosque", "name address location")
      .sort({ date: 1 });

    res.status(200).json({
      count: events.length,
      events,
    });
  } catch (error) {
    console.error("Search Error:", error);
    res.status(500).json({ message: "Error searching for events" });
  }
});

// --- 2. GET ALL (Standard list with pagination) ---
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const skip = (page - 1) * limit;

    const totalEvents = await Event.countDocuments();
    const events = await Event.find()
      .populate("organiser", "username email")
      .populate("mosque", "name address location")
      .sort({ date: 1 })
      .limit(limit)
      .skip(skip);

    res.status(200).json({
      currentPage: page,
      totalPages: Math.ceil(totalEvents / limit),
      totalEvents,
      events,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching events" });
  }
});

// --- 3. GET SINGLE EVENT ---
router.get("/:id", async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("mosque", "name location")
      .populate("organiser", "username");
    
    if (!event) return res.status(404).json({ message: "Event not found" });
    res.status(200).json(event);
  } catch (error) {
    res.status(500).json({ message: "Error fetching event" });
  }
});

// 4. CREATE an Event (Mosque Admin & Super Admin only)
router.post(
  "/",
  protect,
  authorize("mosque_admin", "super_admin"),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }

      const {
        title,
        description,
        date,
        mosque,
        eventType,
        capacity,
        image,
        location,
        accessType,
        teacher,
      } = req.body;

      // Basic validation
      if (
        !title ||
        !description ||
        !date ||
        !mosque ||
        !image ||
        !location ||
        !accessType ||
        !teacher
      ) {
        return res.status(400).json({
          message:
            "Required fields: title, description, date, mosque, image, location, accessType, teacher",
        });
      }

      // ROLE CHECK: Mosque admins can only post to their assigned mosque
      if (req.user.role === "mosque_admin") {
        if (req.user.assignedMosque?.toString() !== mosque) {
          return res.status(403).json({
            message: "You are not authorized to post events for this mosque.",
          });
        }
      }

      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid date" });
      }

      const existing = await Event.findOne({
        mosque,
        title: title?.trim(),
        date: parsedDate,
      });

      if (existing) {
        return res.status(409).json({ message: "Event already exists" });
      }

      // RULE: If Ders, it MUST be restricted. If Muhadera, it is usually open.
      if (eventType === "Ders") {
        req.body.accessType = "restricted";
      }

      // RULE: Both Ders and Muhadera need a person assigned
      if ((eventType === "Ders" || eventType === "Muhadera") && !teacher) {
        return res.status(400).json({
          message: `A ${eventType === "Ders" ? "teacher" : "speaker"} is required.`,
        });
      }

      const newEvent = new Event({
        title: title.trim(),
        description: description.trim(),
        date: parsedDate,
        location: location.trim(),
        mosque,
        eventType: eventType || "Muhadera",
        capacity: capacity || 0,
        image: image.trim(),
        organiser: req.user.id,
        accessType: req.body.accessType || "open",
        teacher: teacher.trim() || null,
      });

      const savedEvent = await newEvent.save();
      res.status(201).json(savedEvent);
    } catch (error) {
      res.status(500).json({ message: "Error creating event" });
    }
  },
);

// // 5. GET ALL Events (Public with Mosque Population)
// router.get("/", async (req, res) => {
//   try {
//     const query: any = {};

//     if (req.query.keyword) {
//       query.title = { $regex: String(req.query.keyword).trim(), $options: "i" };
//     }

//     if (req.query.upcoming === "true") {
//       query.date = { $gte: new Date() };
//     }

//     if (req.query.mosque) {
//       query.mosque = req.query.mosque;
//     }

//     const page = parseInt(req.query.page as string) || 1;
//     const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
//     const skip = (page - 1) * limit;

//     const totalEvents = await Event.countDocuments(query);
//     const events = await Event.find(query)
//       .populate("organiser", "username email")
//       .populate("mosque", "name address location")
//       .sort({ date: 1 })
//       .limit(limit)
//       .skip(skip);

//     res.status(200).json({
//       currentPage: page,
//       totalPages: Math.ceil(totalEvents / limit),
//       totalEvents,
//       events,
//     });
//   } catch (error) {
//     res.status(500).json({ message: "Error fetching events" });
//   }
// });

// 6. UPDATE an event (Owner or Super Admin)
router.put(
  "/:id",
  protect,
  authorize("mosque_admin", "super_admin"),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }

      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });

      // Authorization: Only the creator (organiser) or a Super Admin can edit
      const isOwner = event.organiser.toString() === req.user.id;
      const isSuperAdmin = req.user.role === "super_admin";

      if (!isOwner && !isSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Not authorized to update this event" });
      }

      const updates = { ...req.body };
      if (updates.title) updates.title = updates.title.trim();
      if (updates.teacher) updates.teacher = updates.teacher.trim();

      const updatedEvent = await Event.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true },
      );
      res.status(200).json(updatedEvent);
    } catch (error) {
      res.status(500).json({ message: "Error updating event" });
    }
  },
);

// 7. DELETE an event (Owner or Super Admin)
router.delete(
  "/:id",
  protect,
  authorize("mosque_admin", "super_admin"),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }

      const event = await Event.findById(req.params.id);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const isOwner = event.organiser.toString() === req.user.id;
      const isSuperAdmin = req.user.role === "super_admin";

      if (!isOwner && !isSuperAdmin) {
        return res
          .status(403)
          .json({ message: "Not authorized to delete this event" });
      }

      await event.deleteOne();
      res.status(200).json({ message: "Event removed successfully" });
    } catch (error) {
      res.status(500).json({ message: "Server error" });
    }
  },
);

// 8. ASSIGN TEACHER TO EVENT (Mosque Admin  for their mosque's events)
router.patch(
  "/assign-teacher-to-event/:eventId",
  protect,
  authorize("mosque_admin", "super_admin"),
  async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Not authorized" });
      }
      if (!req.user.assignedMosque) {
        return res.status(403).json({ message: "No mosque assigned." });
      }

      const assignedMosqueId = req.user.assignedMosque.toString();

      const { teacherId } = req.body;
      const { eventId } = req.params;

      // 1. Verify the teacher exists and has the correct role
      const teacher = await User.findById(teacherId);
      if (!teacher || teacher.role !== "teacher") {
        return res
          .status(400)
          .json({ message: "Selected user is not a registered teacher." });
      }

      // 2. Find the event
      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      // 3. Security: Ensure this Mosque Admin owns this event
      if (event.mosque.toString() !== req.user.assignedMosque.toString()) {
        return res.status(403).json({
          message: "You can only assign teachers to events in your mosque.",
        });
      }

      // 4. Assign the teacher to the event
      event.teacher = teacherId;
      await event.save();

      res.status(200).json({
        message: `Successfully assigned ${teacher.firstName} to ${event.title}`,
        event,
      });
    } catch (error) {
      res.status(500).json({ message: "Error assigning teacher to event" });
    }
  },
);

// Get all students registered for a specific event
router.get("/event-students/:eventId", protect, authorize("teacher", "mosque_admin"), async (req, res) => {
  try {
    const bookings = await Booking.find({ 
      event: req.params.eventId, 
      status: "confirmed" 
    }).populate("user", "firstName lastName email");

    const studentList = bookings.map(b => b.user);
    res.status(200).json(studentList);
  } catch (error) {
    res.status(500).json({ message: "Error fetching student list" });
  }
});

export default router;
