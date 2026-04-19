'use client'

import Image from 'next/image'

interface Props {
  src: string
  alt: string
  className?: string
  fill?: boolean
}

/** Renders a video element for .mp4/.webm/.mov URLs, otherwise a next/image.
 *  Lets us drop in placeholder videos anywhere we'd use a product/hero photo. */
export function MediaAsset({ src, alt, className, fill = true }: Props) {
  const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(src)

  if (isVideo) {
    return (
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        className={
          fill
            ? `absolute inset-0 w-full h-full object-cover ${className ?? ''}`
            : className
        }
        aria-label={alt}
      />
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      unoptimized
    />
  )
}
