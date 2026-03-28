import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import type { ExtractedDocument } from "./types"

type Props = {
  uploadId: string | null
  onClose: () => void
  getExtracted: (id: string) => Promise<ExtractedDocument>
}

export function InspectModal({ uploadId, onClose, getExtracted }: Props) {
  const [doc, setDoc] = useState<ExtractedDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uploadId) return
    setLoading(true)
    setDoc(null)
    setError(null)
    getExtracted(uploadId)
      .then(setDoc)
      .catch(() => setError("Impossibile caricare i dati estratti."))
      .finally(() => setLoading(false))
  }, [uploadId, getExtracted])

  if (!uploadId) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-3xl max-h-[80vh] overflow-auto rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-card">
          <h2 className="text-lg font-semibold text-foreground">Dati estratti</h2>
          <Button variant="outline" size="sm" onClick={onClose}>
            Chiudi
          </Button>
        </div>
        <div className="px-6 py-4">
          {loading && <p className="text-muted-foreground text-sm">Caricamento...</p>}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {doc && <DocRenderer doc={doc} />}
        </div>
      </div>
    </div>
  )
}

function DocRenderer({ doc }: { doc: ExtractedDocument }) {
  if (doc.document_type === "bank_statement") {
    const txns = doc.transactions ?? []
    const currency = txns[0]?.currency ?? "EUR"
    return (
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs text-muted-foreground">
            {txns.length} transazioni · modulo: {doc.module_name ?? "sconosciuto"}
          </p>
          {doc.account_holder && (
            <p className="text-xs text-muted-foreground">
            Account: {doc.account_holder}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-semibold pr-4">Data</th>
                <th className="pb-2 font-semibold pr-4">Descrizione</th>
                <th className="pb-2 text-right font-semibold pr-4">
                  Importo ({currency})
                </th>
                <th className="pb-2 font-semibold">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((t, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-4 text-muted-foreground whitespace-nowrap">
                    {t.date}
                  </td>
                  <td
                    className="py-1.5 pr-4 max-w-[300px] truncate"
                    title={t.description}
                  >
                    {t.description}
                  </td>
                  <td
                    className={`py-1.5 pr-4 text-right ${
                      Number(t.amount) < 0 ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {t.amount}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {Number(t.amount) < 0 ? "addebito" : "accredito"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {txns.length === 0 && (
            <p className="text-muted-foreground text-sm mt-2">
              Nessuna transazione estratta.
            </p>
          )}
        </div>
      </div>
    )
  }

  if (doc.document_type === "payslip") {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <KV label="Datore di lavoro" value={doc.employer} />
          <KV label="Dipendente" value={doc.employee_name} />
          <KV label="Lordo" value={doc.gross_income} />
          <KV label="Netto" value={doc.net_income} />
          <KV label="Valuta" value={doc.currency} />
        </div>
        {(doc.deductions ?? []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Trattenute</p>
            {doc.deductions!.map((d, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border/50 py-1">
                <span>{d.label}</span>
                <span>{d.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (doc.document_type === "utility_bill") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <KV label="Fornitore" value={doc.provider} />
        <KV label="Servizio" value={doc.service_type} />
        <KV
          label="Periodo di fatturazione"
          value={
            doc.billing_period_start && doc.billing_period_end
              ? `${doc.billing_period_start} → ${doc.billing_period_end}`
              : null
          }
        />
        <KV label="Totale dovuto" value={doc.total_due} />
        <KV label="Numero conto" value={doc.account_number} />
      </div>
    )
  }

  if (doc.document_type === "receipt") {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <KV label="Esercente" value={doc.merchant} />
          <KV label="Data" value={doc.purchase_date} />
          <KV label="Totale" value={doc.total_amount} />
        </div>
        {(doc.line_items ?? []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Articoli</p>
            {doc.line_items!.map((item, i) => (
              <div
                key={i}
                className="flex justify-between text-sm border-b border-border/50 py-1"
              >
                <span>{item.label}</span>
                <span>{item.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // unknown / fallback — show as formatted JSON
  return (
    <pre className="text-xs text-muted-foreground overflow-auto max-h-64 bg-secondary/30 rounded p-3">
      {JSON.stringify(doc, null, 2)}
    </pre>
  )
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  )
}
