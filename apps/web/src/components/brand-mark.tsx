import { BRAND } from '@/lib/brand';

/** Decorative beside the existing visible SnagFlow wordmark/link label. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 256 256" className={className} aria-hidden="true" focusable="false">
      <rect width="256" height="256" rx="56" fill={BRAND.green} />
      <g transform="translate(32 44) scale(.75)">
        <path fill={BRAND.white} d={BRAND.body} />
        <path fill={BRAND.orange} d={BRAND.check} />
      </g>
    </svg>
  );
}
