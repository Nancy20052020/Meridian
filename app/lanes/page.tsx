import { Suspense } from "react";
import type { Metadata } from "next";
import LaneBoard from "@/components/LaneBoard";

export const metadata: Metadata = {
  title: "Lanes · Meridian",
  description: "Which of this importer's sea lanes miss payroll on today's weather.",
};

export default function Page() {
  return (
    <Suspense fallback={<main className="frame" />}>
      <LaneBoard />
    </Suspense>
  );
}
