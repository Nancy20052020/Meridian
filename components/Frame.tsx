"use client";

import Link from "next/link";
import Nav from "./Nav";

export default function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="frame">
      <header className="frame-bar">
        <Link href="/" className="brand brand-link">
          Meridian
        </Link>
        <Nav />
      </header>
      <main>{children}</main>
    </div>
  );
}
