"use client";
import { useParams } from "next/navigation";
import { SharedVideo } from "./shared-video";

export function ShareRoute() {
  const { id } = useParams<{ id: string }>();
  return <SharedVideo id={id} />;
}
