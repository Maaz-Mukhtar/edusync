"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { ChildInfo } from "@/lib/data/parent";

interface ChildSwitcherProps {
  childList: ChildInfo[];
  selectedChildId?: string;
  basePath: string;
}

export default function ChildSwitcher({
  childList,
  selectedChildId,
  basePath,
}: ChildSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Default to first child if none selected
  const currentChildId = selectedChildId || childList[0]?.studentId;

  const handleChildChange = (childId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("child", childId);
    router.push(`${basePath}?${params.toString()}`);
  };

  if (childList.length === 0) {
    return null;
  }

  if (childList.length === 1) {
    const child = childList[0];
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-md">
        <Avatar className="h-6 w-6">
          <AvatarFallback className="text-xs">
            {child.name.split(" ").map((n) => n[0]).join("")}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium">{child.name}</p>
          <p className="text-xs text-muted-foreground">
            {child.className} - {child.sectionName}
          </p>
        </div>
      </div>
    );
  }

  return (
    <Select value={currentChildId} onValueChange={handleChildChange}>
      <SelectTrigger className="w-[250px]">
        <SelectValue placeholder="Select child" />
      </SelectTrigger>
      <SelectContent>
        {childList.map((child) => (
          <SelectItem key={child.studentId} value={child.studentId}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {child.name.split(" ").map((n) => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{child.name}</p>
                <p className="text-xs text-muted-foreground">
                  {child.className} - {child.sectionName}
                </p>
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
