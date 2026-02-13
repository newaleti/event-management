import mongoose from "mongoose";
const bookingSchema = new mongoose.Schema({
    event: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Event",
        required: true,
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    status: {
        type: String,
        enum: ["confirmed", "cancelled"],
        default: "confirmed",
    },
    bookingDate: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });
// Prevent a user from booking the same event twice
bookingSchema.index({ event: 1, user: 1 }, { unique: true });
const Booking = mongoose.model("Booking", bookingSchema);
export default Booking;
