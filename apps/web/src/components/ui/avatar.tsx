import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold text-muted-foreground select-none",
  {
    variants: {
      size: {
        sm: "size-6 text-[10px]",
        md: "size-8",
        lg: "size-12 text-sm",
      },
    },
    defaultVariants: { size: "md" },
  },
);

type AvatarProps = React.ComponentProps<"span"> &
  VariantProps<typeof avatarVariants> & {
    src?: string | null;
    alt?: string;
    fallback: string;
  };

function Avatar({ src, alt = "", fallback, size, className, ...props }: AvatarProps) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;
  return (
    <span className={cn(avatarVariants({ size }), className)} {...props}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- user avatars come from Supabase Storage signed URLs with unknown dimensions; next/image is not worth the config here
        <img src={src!} alt={alt} className="size-full object-cover" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{fallback.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}

export { Avatar, avatarVariants };
