import { SectionNav } from "@/components/nav/section-nav";

function isProduction(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export default function QALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const showQANavigation = !isProduction();

  return (
    <>
      <SectionNav showQANavigation={showQANavigation} />
      {children}
    </>
  );
}
