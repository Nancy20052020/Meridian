import { Suspense } from "react";
import Stage from "@/components/Stage";

export default function Page() {
  return (
    <Suspense fallback={<main className="stage" />}>
      <Stage />
    </Suspense>
  );
}
