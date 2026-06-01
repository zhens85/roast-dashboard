import { getQBOCredentials } from '@/lib/quickbooks'

export const dynamic = 'force-dynamic'

// Status message from OAuth callback redirect
const QBO_MESSAGES: Record<string, { text: string; color: string }> = {
  connected:     { text: '✓ QuickBooks connected successfully.',        color: '#15803d' },
  denied:        { text: 'Authorization was denied by the user.',       color: '#dc2626' },
  error:         { text: 'Something went wrong during authorization.',  color: '#dc2626' },
  state_mismatch:{ text: 'Security check failed. Please try again.',   color: '#dc2626' },
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ qbo?: string }>
}) {
  const params   = await searchParams
  const qboCreds = await getQBOCredentials()
  const isConnected = !!qboCreds
  const flash = params.qbo ? QBO_MESSAGES[params.qbo] : null

  const missingEnv = !process.env.QUICKBOOKS_CLIENT_ID || !process.env.QUICKBOOKS_REDIRECT_URI

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold" style={{ color: '#3b4858' }}>Settings</h1>
      </div>

      {flash && (
        <div className="mb-6 px-4 py-3 rounded-lg border text-sm font-medium"
             style={{ color: flash.color, borderColor: flash.color + '40', backgroundColor: flash.color + '10' }}>
          {flash.text}
        </div>
      )}

      {/* QuickBooks */}
      <section className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-stone-100 flex items-center gap-3">
          <svg viewBox="0 0 40 40" className="w-7 h-7 flex-shrink-0">
            <circle cx="20" cy="20" r="20" fill="#2CA01C"/>
            <text x="20" y="26" textAnchor="middle" fontSize="18" fontWeight="bold" fill="white">Q</text>
          </svg>
          <div>
            <h2 className="font-semibold text-stone-800">QuickBooks Online</h2>
            <p className="text-xs text-stone-400">Auto-generate invoices when wholesale orders are confirmed</p>
          </div>
          <div className="ml-auto">
            {isConnected ? (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700">
                Connected
              </span>
            ) : (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-stone-100 text-stone-500">
                Not connected
              </span>
            )}
          </div>
        </div>

        <div className="px-6 py-5">
          {missingEnv ? (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 text-sm text-amber-800 space-y-1">
              <p className="font-medium">Environment variables required before connecting:</p>
              <ul className="list-disc list-inside space-y-0.5 text-amber-700">
                <li><code className="font-mono text-xs">QUICKBOOKS_CLIENT_ID</code></li>
                <li><code className="font-mono text-xs">QUICKBOOKS_CLIENT_SECRET</code></li>
                <li><code className="font-mono text-xs">QUICKBOOKS_REDIRECT_URI</code> — set to{' '}
                  <code className="font-mono text-xs">https://goodfolks.coffee/api/integrations/quickbooks/callback</code>
                </li>
              </ul>
              <p className="text-xs text-amber-600 pt-1">
                Get your Client ID and Secret from{' '}
                <a href="https://developer.intuit.com" target="_blank" rel="noopener noreferrer"
                   className="underline">developer.intuit.com</a>.
                Add them as environment variables in Vercel, then redeploy.
              </p>
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="text-sm space-y-1" style={{ color: '#555' }}>
                {qboCreds.company_name && (
                  <p><span className="font-medium text-stone-700">Company:</span>{' '}{qboCreds.company_name}</p>
                )}
                <p>
                  <span className="font-medium text-stone-700">Token expires:</span>{' '}
                  {new Date(qboCreds.expires_at).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit',
                  })}
                </p>
                <p className="text-xs text-stone-400">
                  Tokens refresh automatically. Invoices are created when orders are confirmed
                  with document number <code className="font-mono">GFC-[order id]</code> and
                  Net 30 terms.
                </p>
              </div>
              <form method="POST" action="/api/integrations/quickbooks/disconnect">
                <button
                  type="submit"
                  className="text-sm font-medium px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                >
                  Disconnect QuickBooks
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-stone-600">
                Connect your QuickBooks Online account to automatically create invoices
                whenever a wholesale order is confirmed. Invoices use doc number{' '}
                <code className="font-mono text-xs bg-stone-100 px-1 py-0.5 rounded">GFC-[order id]</code>{' '}
                and Net 30 terms. Customers are matched by company name and created if they
                don&apos;t exist.
              </p>
              <div className="rounded-lg bg-stone-50 border border-stone-100 px-4 py-3 text-xs text-stone-500 space-y-1">
                <p className="font-medium text-stone-700">Also required — run once in Supabase SQL Editor:</p>
                <pre className="font-mono bg-white border border-stone-200 rounded p-2 text-xs overflow-x-auto">
{`CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT        PRIMARY KEY,
  value      JSONB       NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`}
                </pre>
              </div>
              <a
                href="/api/integrations/quickbooks/connect"
                className="inline-flex items-center gap-2 text-sm font-semibold text-white px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ backgroundColor: '#2CA01C' }}
              >
                Connect to QuickBooks
              </a>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
