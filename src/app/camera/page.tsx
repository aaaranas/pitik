import type { Metadata } from "next";
import { CameraRoute } from "@/components/camera/camera-route";

export const metadata: Metadata = {
  title: "Camera",
};

export default function Page() {
  return <CameraRoute />;
}
