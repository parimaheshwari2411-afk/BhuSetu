import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { queryDatabase } from "../utils/database";
import { IApiResponse, IUser, UserRole } from "../types";

const router = Router();

/**
 * POST /api/v1/auth/register
 * Register new user (CITIZEN, SURVEYOR)
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, role, password } = req.body;

    if (!fullName || !email || !phoneNumber || !role || !password) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        timestamp: new Date(),
      });
    }

    // Check if user exists
    const existingUser = await queryDatabase(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "User already exists",
        timestamp: new Date(),
      });
    }

    // Hash password
    const hashedPassword = await bcryptjs.hash(password, 10);

    // Insert user
    const result = await queryDatabase(
      `INSERT INTO users (id, full_name, email, phone_number, role, password_hash, e_kyc_verified)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false)
       RETURNING id, full_name, email, phone_number, role, e_kyc_verified, created_at`,
      [fullName, email, phoneNumber, role, hashedPassword]
    );

    const user = result.rows[0];

    const response: IApiResponse<Partial<IUser>> = {
      success: true,
      data: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        phoneNumber: user.phone_number,
        role: user.role as UserRole,
        eKycVerified: user.e_kyc_verified,
      },
      timestamp: new Date(),
    };

    res.status(201).json(response);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      error: "Registration failed",
      timestamp: new Date(),
    });
  }
});

/**
 * POST /api/v1/auth/login
 * Authenticate user and return JWT token
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password required",
        timestamp: new Date(),
      });
    }

    // Find user
    const result = await queryDatabase(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        timestamp: new Date(),
      });
    }

    const user = result.rows[0];

    // Verify password
    const isPasswordValid = await bcryptjs.compare(
      password,
      user.password_hash
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        timestamp: new Date(),
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "secret",
      {
        expiresIn: process.env.JWT_EXPIRY || "7d",
      }
    );

    const response: IApiResponse = {
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          fullName: user.full_name,
          email: user.email,
          role: user.role,
          eKycVerified: user.e_kyc_verified,
          walletAddress: user.wallet_address,
        },
      },
      timestamp: new Date(),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
      timestamp: new Date(),
    });
  }
});

/**
 * POST /api/v1/auth/verify-token
 * Verify JWT token validity
 */
router.post("/verify-token", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
        timestamp: new Date(),
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");

    res.status(200).json({
      success: true,
      data: { valid: true, decoded },
      timestamp: new Date(),
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: "Invalid token",
      timestamp: new Date(),
    });
  }
});

/**
 * POST /api/v1/auth/refresh-token
 * Refresh JWT token
 */
router.post("/refresh-token", async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
        timestamp: new Date(),
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secret");
    } catch (error: any) {
      if (error.name === "TokenExpiredError") {
        const payload = jwt.decode(token) as any;
        decoded = payload;
      } else {
        throw error;
      }
    }

    // Generate new token
    const newToken = jwt.sign(
      {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
      },
      process.env.JWT_SECRET || "secret",
      {
        expiresIn: process.env.JWT_EXPIRY || "7d",
      }
    );

    res.status(200).json({
      success: true,
      data: { token: newToken },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    res.status(500).json({
      success: false,
      error: "Token refresh failed",
      timestamp: new Date(),
    });
  }
});

export default router;
