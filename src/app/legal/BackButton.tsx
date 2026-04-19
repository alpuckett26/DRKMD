'use client'

export default function BackButton() {
  return (
    <button
      onClick={() => window.history.back()}
      className="text-gray-500 text-2xl leading-none active:text-gray-900"
    >
      ‹
    </button>
  )
}
