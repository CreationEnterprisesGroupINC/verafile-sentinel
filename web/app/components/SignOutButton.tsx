"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton({
  className = "",
}: {
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={
        className ||
        "text-sm text-[#6B7280] hover:text-white transition-colors"
      }
    >
      Sign out
    </button>
  );
}
