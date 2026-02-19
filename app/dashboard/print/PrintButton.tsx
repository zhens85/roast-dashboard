'use client'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="print:hidden bg-amber-600 hover:bg-amber-700 text-white text-sm
                 font-semibold px-4 py-2 rounded-lg transition-colors"
    >
      Print
    </button>
  )
}
