import mongoose from "mongoose";

const membershipRequestSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mosque: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mosque",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    message: String, // Optional: User can say why they want to join
  },
  { timestamps: true },
);

const MembershipRequest = mongoose.model(
  "MembershipRequest",
  membershipRequestSchema,
);
export default MembershipRequest;

// This is a request to join a mosque as a member. Mosque admins can approve or reject these requests. Once approved, the user's membershipStatus in the User model can be updated to "official_member".