"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** Legacy route — redirect to per-repo review detail. */
export default function LegacyReviewRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api"}/reviews/${id}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((review: { repositoryId?: string } | null) => {
        if (review?.repositoryId) {
          router.replace(`/dashboard/repositories/${review.repositoryId}/reviews/${id}`);
        } else {
          router.replace("/reviews");
        }
      })
      .catch(() => router.replace("/reviews"));
  }, [id, router]);

  return <div className="animate-pulse h-64 bg-card rounded-xl" />;
}
