import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import prisma from "./prisma";
import type { UserRole } from "@prisma/client";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      schoolId: string;
      schoolSubdomain: string;
    };
  }

  interface User {
    id: string;
    role: UserRole;
    schoolId: string;
    schoolSubdomain: string;
    firstName: string;
    lastName: string;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        phone: { label: "Phone", type: "text" },
        password: { label: "Password", type: "password" },
        schoolSubdomain: { label: "School", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.password || !credentials?.schoolSubdomain) {
          throw new Error("Missing credentials");
        }

        const password = credentials.password as string;
        const schoolSubdomain = credentials.schoolSubdomain as string;
        // Normalize email to lowercase for case-insensitive comparison
        const email = (credentials.email as string | undefined)?.toLowerCase();
        const phone = credentials.phone as string | undefined;

        if (!email && !phone) {
          throw new Error("Email or phone is required");
        }

        // Find the school by subdomain
        const school = await prisma.school.findUnique({
          where: { subdomain: schoolSubdomain },
        });

        if (!school) {
          throw new Error("School not found");
        }

        // Build the where clause for finding the user
        const whereConditions: Array<{ email?: string; phone?: string }> = [];
        if (email) whereConditions.push({ email });
        if (phone) whereConditions.push({ phone });

        // Find user by email or phone within the school
        const user = await prisma.user.findFirst({
          where: {
            schoolId: school.id,
            OR: whereConditions,
            isActive: true,
          },
          include: {
            school: {
              select: {
                subdomain: true,
              },
            },
          },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid credentials");
        }

        const isPasswordValid = await compare(password, user.passwordHash);

        if (!isPasswordValid) {
          throw new Error("Invalid credentials");
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          schoolId: user.schoolId,
          schoolSubdomain: user.school.subdomain,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),
  ],
});
