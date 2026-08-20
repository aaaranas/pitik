import type { Metadata } from "next";
import { RollsScreen } from "@/components/roll/rolls-screen";

export const metadata: Metadata = {
  title: "Rolls",
};

export default function Page() {
  return <RollsScreen />;
}
