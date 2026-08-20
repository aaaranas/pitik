import type { Metadata } from "next";
import { BoothPicker } from "@/components/booth/booth-picker";

export const metadata: Metadata = {
  title: "Photobooth",
  description: "Pick a layout, line everyone up, and let the booth count you in.",
};

export default function Page() {
  return <BoothPicker />;
}
