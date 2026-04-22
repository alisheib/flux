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
          toast: "!rounded-xl !border !shadow-lg !font-[inherit] !text-sm",
          title: "!font-semibold !text-[13px]",
          description: "!text-xs !opacity-70",
          closeButton: "!rounded-full !border-0 !bg-transparent hover:!bg-black/5 dark:hover:!bg-white/10",
          success: "!bg-emerald-50 !border-emerald-200 !text-emerald-900 dark:!bg-emerald-950/80 dark:!border-emerald-800 dark:!text-emerald-100",
          error: "!bg-red-50 !border-red-200 !text-red-900 dark:!bg-red-950/80 dark:!border-red-800 dark:!text-red-100",
          warning: "!bg-amber-50 !border-amber-200 !text-amber-900 dark:!bg-amber-950/80 dark:!border-amber-800 dark:!text-amber-100",
          info: "!bg-sky-50 !border-sky-200 !text-sky-900 dark:!bg-sky-950/80 dark:!border-sky-800 dark:!text-sky-100",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.75rem",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster, ShieldCheck, Zap }
