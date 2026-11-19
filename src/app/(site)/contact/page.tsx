import type { Metadata } from "next";
import { SITE } from "@/config/site";
import { Prose } from "@/components/site/prose";

export const metadata: Metadata = { title: "Contact" };

export default function Contact() {
  return (
    <Prose title="Contact" lead="Questions, partnerships, featured-character requests or press.">
      <p>Email us at <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.</p>
      <p>For problems with a specific video, include the link to the project page so we can find it quickly.</p>
    </Prose>
  );
}
