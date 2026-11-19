"use client";
import { useParams } from "next/navigation";
import { ProjectScreen } from "@/components/studio/project";

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectScreen id={id} />;
}
