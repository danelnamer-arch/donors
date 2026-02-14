export function SparkleIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg
      className={`inline-block text-amber-500 ${className}`}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z" />
    </svg>
  );
}
