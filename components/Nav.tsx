"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { DEFAULT_HOME, DEFAULT_ORIGIN, laneHref, readExtra } from "@/lib/routes";

const LINKS = [
  ["/", "Watch"],
  ["/lanes", "Lanes"],
  ["/book", "Book"],
] as const;

export default function Nav() {
  const path = usePathname();
  const params = useSearchParams();
  const from = params.get("from") ?? DEFAULT_ORIGIN;
  const to = params.get("to") ?? DEFAULT_HOME;
  const extra = readExtra(params.get("extra"));

  return (
    <nav className="nav">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={laneHref(href, from, to, extra)} aria-current={path === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
