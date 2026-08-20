import type { Metadata } from "next";
import { BoothRoute } from "@/components/booth/booth-route";

export const metadata: Metadata = {
  title: "Booth",
};

export default function Page() {
  return <BoothRoute />;
}
