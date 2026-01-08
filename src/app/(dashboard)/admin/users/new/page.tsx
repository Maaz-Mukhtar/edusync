"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

const userSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().min(10, "Phone must be at least 10 characters").optional().or(z.literal("")),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  // Student fields
  sectionId: z.string().optional(),
  rollNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  // Teacher fields
  employeeId: z.string().optional(),
  qualification: z.string().optional(),
  // Parent fields
  occupation: z.string().optional(),
  relationship: z.string().optional(),
}).refine((data) => data.email || data.phone, {
  message: "Either email or phone is required",
  path: ["email"],
});

type UserFormData = z.infer<typeof userSchema>;

interface Section {
  id: string;
  name: string;
  class: { id: string; name: string };
}

export default function NewUserPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [sections, setSections] = useState<Section[]>([]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: "STUDENT",
    },
  });

  const selectedRole = watch("role");

  useEffect(() => {
    // Fetch sections for student role
    const fetchSections = async () => {
      try {
        const response = await fetch("/api/sections");
        const data = await response.json();
        if (response.ok) {
          setSections(data.sections);
        }
      } catch (error) {
        console.error("Failed to fetch sections:", error);
      }
    };

    fetchSections();
  }, []);

  const onSubmit = async (data: UserFormData) => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          email: data.email || null,
          phone: data.phone || null,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("User created successfully");
        router.push("/admin/users");
      } else {
        toast.error(result.error || "Failed to create user");
      }
    } catch {
      toast.error("Failed to create user");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New User</h1>
          <p className="text-muted-foreground">
            Create a new user account for your school
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>
              Enter the user&apos;s basic details and login credentials
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  {...register("firstName")}
                  placeholder="John"
                />
                {errors.firstName && (
                  <p className="text-sm text-destructive">{errors.firstName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  {...register("lastName")}
                  placeholder="Doe"
                />
                {errors.lastName && (
                  <p className="text-sm text-destructive">{errors.lastName.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="john@example.com"
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...register("phone")}
                  placeholder="03001234567"
                />
                {errors.phone && (
                  <p className="text-sm text-destructive">{errors.phone.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  {...register("password")}
                  placeholder="Minimum 6 characters"
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select
                  value={selectedRole}
                  onValueChange={(value) => setValue("role", value as UserFormData["role"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="TEACHER">Teacher</SelectItem>
                    <SelectItem value="STUDENT">Student</SelectItem>
                    <SelectItem value="PARENT">Parent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Student-specific fields */}
        {selectedRole === "STUDENT" && (
          <Card>
            <CardHeader>
              <CardTitle>Student Information</CardTitle>
              <CardDescription>
                Additional details for the student
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sectionId">Class & Section *</Label>
                  <Select
                    onValueChange={(value) => setValue("sectionId", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select class and section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.class.name} - {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rollNumber">Roll Number</Label>
                  <Input
                    id="rollNumber"
                    {...register("rollNumber")}
                    placeholder="e.g., 001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  {...register("dateOfBirth")}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Teacher-specific fields */}
        {selectedRole === "TEACHER" && (
          <Card>
            <CardHeader>
              <CardTitle>Teacher Information</CardTitle>
              <CardDescription>
                Additional details for the teacher
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="employeeId">Employee ID</Label>
                  <Input
                    id="employeeId"
                    {...register("employeeId")}
                    placeholder="e.g., EMP001"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="qualification">Qualification</Label>
                  <Input
                    id="qualification"
                    {...register("qualification")}
                    placeholder="e.g., M.Ed, B.Sc"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Parent-specific fields */}
        {selectedRole === "PARENT" && (
          <Card>
            <CardHeader>
              <CardTitle>Parent Information</CardTitle>
              <CardDescription>
                Additional details for the parent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    {...register("occupation")}
                    placeholder="e.g., Engineer, Doctor"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relationship">Relationship</Label>
                  <Select
                    onValueChange={(value) => setValue("relationship", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select relationship" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Father">Father</SelectItem>
                      <SelectItem value="Mother">Mother</SelectItem>
                      <SelectItem value="Guardian">Guardian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-4">
          <Link href="/admin/users">
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create User
          </Button>
        </div>
      </form>
    </div>
  );
}
