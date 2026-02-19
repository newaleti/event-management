import jwt from "jsonwebtoken";
import User from "../models/User.js";
export const protect = async (req, res, next) => {
    console.log("Authorization Header Check...");
    let token;
    // 1. Check for token in headers
    if (req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")) {
        try {
            // 2. Extract token
            token = req.headers.authorization.split(" ")[1];
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                res.status(500).json({ message: "JWT secret is not configured" });
                return;
            }
            // 3. Verify token
            const decoded = jwt.verify(token, secret);
            // 4. Fetch latest user data from Database
            // We do this so membershipStatus is always up-to-date
            const user = await User.findById(decoded.id).select("-password");
            if (!user) {
                res
                    .status(401)
                    .json({ message: "Not authorized, user no longer exists" });
                return;
            }
            // 5. Attach fresh user info to request object
            req.user = {
                id: user._id.toString(),
                role: user.role,
                assignedMosque: user.assignedMosque?.toString(),
                mosqueMemberships: (user.mosqueMemberships || [])
                    .filter((m) => m.mosque)
                    .map((m) => ({
                    mosque: m.mosque.toString(),
                    status: m.status,
                })),
            };
            next();
        }
        catch (error) {
            console.error("Auth Middleware Error:", error);
            res.status(401).json({ message: "Not authorized, token failed" });
        }
    }
    if (!token) {
        res.status(401).json({ message: "Not authorized, no token" });
    }
};
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: "Not authorized" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                message: `Role (${req.user.role}) is not authorized to access this resource`,
            });
        }
        next();
    };
};
