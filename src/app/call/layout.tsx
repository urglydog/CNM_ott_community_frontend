"use client";

/**
 * Minimal layout for the call window route.
 * No sidebar, no chat layout — just the call UI.
 */
export default function CallLayout({
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
