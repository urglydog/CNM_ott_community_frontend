"use client";

/**
 * Minimal layout for the group call window route.
 * No sidebar, no chat layout — just the group call UI.
 */
export default function GroupCallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen w-screen bg-gray-900 overflow-hidden">
      {children}
    </div>
  );
}
