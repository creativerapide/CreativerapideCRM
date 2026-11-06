"use client";

export default function PrintButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={className}>
      Printează / salvează PDF
    </button>
  );
}
