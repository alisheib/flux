"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      expand={false}
      richColors
      closeButton
      duration={4000}
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-500" />,
        info: <InfoIcon className="size-4 text-sky-500" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-500" />,
        error: <OctagonXIcon className="size-4 text-red-500" />,
        loading: <Loader2Icon className="size-4 animate-spin text-[#d97706]" />,
      }}
      toastOptions={{
        classNames: {
          toast: "!rounded-[10px] !border !shadow-lg !font-[inherit] !text-sm !border-l-[3px]",
          title: "!font-semibold !text-[13px]",
          description: "!text-xs !opacity-70",
          closeButton: "!rounded-full !border-0 !bg-transparent hover:!bg-black/5 dark:hover:!bg-white/10",
          success: "!bg-card !border-border !text-foreground !border-l-emerald-500",
          error: "!bg-card !border-border !text-foreground !border-l-red-500",
          warning: "!bg-card !border-border !text-foreground !border-l-amber-500",
          info: "!bg-card !border-border !text-foreground !border-l-blue-500",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "10px",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster, ShieldCheck, Zap }
