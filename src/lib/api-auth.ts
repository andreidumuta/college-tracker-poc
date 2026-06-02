import { adminAuth } from "./firebaseAdmin";

export interface DecodedAuthUser {
  uid: string;
  email?: string;
  admin: boolean;
}

export async function verifyAuth(
  req: Request,
  requireAdmin = false
): Promise<{ user?: DecodedAuthUser; error?: string; status?: number }> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return { error: "Unauthorized: Missing or invalid Authorization header", status: 401 };
    }

    const token = authHeader.substring(7); // "Bearer " is 7 characters
    const decodedToken = await adminAuth.verifyIdToken(token);
    const isAdmin = !!decodedToken.admin;

    if (requireAdmin && !isAdmin) {
      return { error: "Forbidden: Admin access required", status: 403 };
    }

    return {
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email,
        admin: isAdmin,
      },
    };
  } catch (error) {
    console.error("Token verification failed:", error);
    return { error: "Unauthorized: Invalid auth token", status: 401 };
  }
}
