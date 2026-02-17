import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true, // lowercase to avoid duplicates
      match: [/^\S+@\S+\.\S+$/, "Please use a valid email address"], // Basic Regex check
    },
    password: {
      type: String,
      required: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      // This regex matches: 0911223344, 0711223344, or +251911223344
      match: [
        /^(?:\+251|0)[79]\d{8}$/,
        "Please enter a valid Ethiopian phone number (09... or 07...)",
      ],
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female"],
    },
    age: {
      type: Number,
      required: true,
      min: [5, "Age must be at least 5"],
      max: [100, "Age must be realistic"],
    },
    role: {
      type: String,
      enum: ["user", "mosque_admin", "super_admin"],
      default: "user",
    },
    assignedMosque: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Mosque",
      default: null,
    }, // Helpful for Mosque Admins
    // For event attendance tracking, we can add a field to track if the user is an official member or a student (if needed for special access)
    membershipStatus: {
      type: String,
      enum: ["none", "official_member", "student"],
      default: "none",
    },
  },
  { timestamps: true },
); // This automatically adds 'createdAt' and 'updatedAt' fields!

const User = mongoose.model("User", userSchema);
export default User;
