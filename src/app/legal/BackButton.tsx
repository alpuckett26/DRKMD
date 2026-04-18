'use client'

export default function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="text-gray-400 text-2xl leading-none active:text-white"
    >
      ‹
    </button>
  )
}
