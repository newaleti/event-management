import jwt from "jsonwebtoken";
export const protect = (req, res, next) => {
    console.log("Authorization Header:", req.headers.authorization);
    let token;
    // Check for token in headers
    if (req.headers.authorization &&
        req.headers.authorization.startsWith("Bearer")) {
        try {
            // Get token from header
            token = req.headers.authorization.split(" ")[1];
            const secret = process.env.JWT_SECRET;
            if (!secret) {
                res.status(500).json({ message: "JWT secret is not configured" });
                return;
            }
            // Verify token
            const decoded = jwt.verify(token, secret);
            // Attach user info to request object
            req.user = {
                id: decoded.id,
                role: decoded.role,
                assignedMosque: decoded.assignedMosque,
            };
            next();
        }
        catch (error) {
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
