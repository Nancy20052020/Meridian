import { Suspense } from "react";
import type { Metadata } from "next";
import BookView from "@/components/BookView";

export const metadata: Metadata = {
  title: "Book · Meridian",
  description: "The cash book for one shipment: the bill, payroll, the invoice, and the first day the balance hits zero.",
};

export default function Page() {
  return (
    <Suspense fallback={<main className="frame" />}>
      <BookView />
    </Suspense>
  );
}
