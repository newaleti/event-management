import mongoose from "mongoose";
const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    date: {
        type: Date,
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    organiser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    eventType: {
        type: String,
        enum: ["Muhadera", "Ders", "community_event", "conference", "other"],
        default: "Muhadera",
    },
    capacity: { type: Number, default: 0 }, // 0 could mean unlimited
    bookedCount: { type: Number, default: 0 },
    mosque: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Mosque",
        required: true,
    },
}, { timestamps: true });
// Prevent duplicate events in same mosque by title + date
eventSchema.index({ mosque: 1, title: 1, date: 1 }, { unique: true });
const Event = mongoose.model("Event", eventSchema);
export default Event;
