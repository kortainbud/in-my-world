"use client";
import { useParams } from "next/navigation";
import { Builder } from "@/components/studio/builder";

export function EditCharacterRoute() {
  const { id } = useParams<{ id: string }>();
  return <Builder id={id} />;
}
