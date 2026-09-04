import { Router, Request, Response } from "express";
import jwt, { SignOptions } from "jsonwebtoken";
import bcryptjs from "bcryptjs";
import { queryDatabase } from "../utils/database";
import { IApiResponse, IUser, UserRole } from "../types";
import { authMiddleware, AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();
const ALLOWED_SELF_REGISTER: UserRole[] = [
  UserRole.CITIZEN,
  UserRole.SURVEYOR,
  UserRole.REGISTRAR,
];

function signToken(user: { id: string; email: string; role: string }): string {
  const options: SignOptions = {
    expiresIn: (process.env.JWT_EXPIRY || "7d") as SignOptions["expiresIn"],
  };
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || "secret",
    options
  );
}

function mapUser(row: Record<string, unknown>): Partial<IUser> {
  return {
    id: row.id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phoneNumber: row.phone_number as string,
    role: row.role as UserRole,
    eKycVerified: Boolean(row.e_kyc_verified),
    walletAddress: (row.wallet_address as string) || "",
  };
}

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { fullName, email, phoneNumber, role, password, walletAddress } =
      req.body;

    if (!fullName || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: fullName, email, password, role",
        timestamp: new Date(),
      });
    }

    if (!ALLOWED_SELF_REGISTER.includes(role)) {
      return res.status(400).json({
        success: false,
        error: "Invalid role. Use CITIZEN, SURVEYOR, or REGISTRAR",
        timestamp: new Date(),
      });
    }

    const existingUser = await queryDatabase(
      "SELECT id FROM users WHERE email = $1",
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: "User already exists",
        timestamp: new Date(),
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    const result = await queryDatabase(
      `INSERT INTO users (id, full_name, email, phone_number, role, password_hash, e_kyc_verified, wallet_address)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, false, $6)
       RETURNING id, full_name, email, phone_number, role, e_kyc_verified, wallet_address, created_at`,
      [
        fullName,
        email,
        phoneNumber || null,
        role,
        hashedPassword,
        walletAddress || null,
      ]
    );

    const user = result.rows[0];
    const token = signToken(user);

    const response: IApiResponse<Partial<IUser> & { token: string }> = {
      success: true,
      data: { ...mapUser(user), token } as Partial<IUser> & { token: string },
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

    const result = await queryDatabase("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        timestamp: new Date(),
      });
    }

    const user = result.rows[0];
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        timestamp: new Date(),
      });
    }

    const token = signToken(user);

    res.status(200).json({
      success: true,
      data: {
        token,
        user: mapUser(user),
      },
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      error: "Login failed",
      timestamp: new Date(),
    });
  }
});

router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await queryDatabase(
      `SELECT id, full_name, email, phone_number, role, e_kyc_verified, wallet_address, created_at
       FROM users WHERE id = $1`,
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        timestamp: new Date(),
      });
    }

    res.status(200).json({
      success: true,
      data: mapUser(result.rows[0]),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Me error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load profile",
      timestamp: new Date(),
    });
  }
});

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
  } catch {
    res.status(401).json({
      success: false,
      error: "Invalid token",
      timestamp: new Date(),
    });
  }
});

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

    let decoded: { id: string; email: string; role: string };
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as {
        id: string;
        email: string;
        role: string;
      };
    } catch (error: unknown) {
      const err = error as { name?: string };
      if (err.name === "TokenExpiredError") {
        decoded = jwt.decode(token) as { id: string; email: string; role: string };
      } else {
        throw error;
      }
    }

    const newToken = signToken(decoded);

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
