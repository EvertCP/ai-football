import { Suspense } from "react";
import HomePage from "@/components/HomePage";

/**
 * Dashboard Page
 * 
 * Main landing page with Sofascore-style layout:
 * - Search bar and league filter
 * - Date calendar navigation
 * - Match list grouped by league (left column)
 * - Featured matches and quick links (right column)
 */
export default function Home() {
  return (
    <Suspense fallback={<div className="animate-pulse h-96 bg-gray-100 rounded-xl" />}>
      <HomePage />
    </Suspense>
  );
}
