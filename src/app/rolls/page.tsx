import type { Metadata } from "next";
import { LibraryRoute } from "@/components/roll/library-route";

export const metadata: Metadata = {
  title: "Your photos",
};

export default function Page() {
  return <LibraryRoute />;
}
