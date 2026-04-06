import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold text-foreground">404 — Page not found</h1>
      <Link href="/" className="text-sm text-primary underline underline-offset-4">
        Go back home
      </Link>
    </div>
  );
}
