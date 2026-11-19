"use client";
import { useParams } from "next/navigation";
import { ProjectScreen } from "@/components/studio/project";

export function ProjectRoute() {
  const { id } = useParams<{ id: string }>();
  return <ProjectScreen id={id} />;
}
