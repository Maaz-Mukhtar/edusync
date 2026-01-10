"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, GraduationCap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { getSubdomainFromHost, getRoleDashboardPath } from "@/lib/utils";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");

  const [isLoading, setIsLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const [serverError, setServerError] = useState<string | null>(
    error === "CredentialsSignin" ? "Invalid credentials" : null
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginInput) => {
    setIsLoading(true);
    setServerError(null);

    try {
      // Get subdomain from current host
      const subdomain = getSubdomainFromHost(window.location.host) || "sns";

      const result = await signIn("credentials", {
        email: loginMethod === "email" ? data.email : undefined,
        phone: loginMethod === "phone" ? data.phone : undefined,
        password: data.password,
        schoolSubdomain: subdomain,
        redirect: false,
      });

      if (result?.error) {
        setServerError(result.error);
        setIsLoading(false);
        return;
      }

      // Fetch session to get user role for redirect
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();

      // Redirect to callback URL or role-based dashboard
      if (callbackUrl && callbackUrl !== "/") {
        router.push(callbackUrl);
      } else if (session?.user?.role) {
        router.push(getRoleDashboardPath(session.user.role));
      } else {
        router.push("/admin");
      }
      router.refresh();
    } catch {
      setServerError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-3">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Welcome to EduSync</CardTitle>
        <CardDescription>
          Sign in to access your school portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Login Method Toggle */}
          <div className="flex rounded-lg border p-1">
            <button
              type="button"
              onClick={() => setLoginMethod("email")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                loginMethod === "email"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setLoginMethod("phone")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                loginMethod === "phone"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Phone
            </button>
          </div>

          {/* Email Field */}
          {loginMethod === "email" && (
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                {...register("email")}
                disabled={isLoading}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          )}

          {/* Phone Field */}
          {loginMethod === "phone" && (
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="03001234567"
                {...register("phone")}
                disabled={isLoading}
              />
              {errors.phone && (
                <p className="text-sm text-destructive">{errors.phone.message}</p>
              )}
            </div>
          )}

          {/* Password Field */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              {...register("password")}
              disabled={isLoading}
            />
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Server Error */}
          {serverError && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>

          {/* Forgot Password Link */}
          <div className="text-center">
            <a
              href="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary"
            >
              Forgot your password?
            </a>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LoginFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-primary/10 p-3">
            <GraduationCap className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">Welcome to EduSync</CardTitle>
        <CardDescription>
          Sign in to access your school portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-10 bg-muted animate-pulse rounded" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Suspense fallback={<LoginFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
