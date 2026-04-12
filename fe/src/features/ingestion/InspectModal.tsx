import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { ExtractedDocument } from "./types";

type Props = {
  uploadId: string | null;
  onClose: () => void;
  getExtracted: (id: string) => Promise<ExtractedDocument>;
};

export function InspectModal({ uploadId, onClose, getExtracted }: Props) {
  const { t } = useTranslation();
  const [doc, setDoc] = useState<ExtractedDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uploadId) return;
    setLoading(true);
    setDoc(null);
    setError(null);
    getExtracted(uploadId)
      .then(setDoc)
      .catch(() => setError(t("ingestion.inspectError")))
      .finally(() => setLoading(false));
  }, [uploadId, getExtracted, t]);

  if (!uploadId) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl max-h-[80vh] overflow-auto rounded-2xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4 sticky top-0 bg-card">
          <h2 className="text-lg font-semibold text-foreground">{t("ingestion.inspectTitle")}</h2>
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("ingestion.inspectClose")}
          </Button>
        </div>
        <div className="px-6 py-4">
          {loading && (
            <p className="text-muted-foreground text-sm">{t("ingestion.inspectLoading")}</p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {doc && <DocRenderer doc={doc} />}
        </div>
      </div>
    </div>
  );
}

function DocRenderer({ doc }: { doc: ExtractedDocument }) {
  const { t } = useTranslation();

  if (doc.document_type === "bank_statement") {
    const txns = doc.transactions ?? [];
    const currency = txns[0]?.currency ?? "EUR";
    return (
      <div>
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs text-muted-foreground">
            {t("ingestion.inspectTransactions", {
              count: txns.length,
              module: doc.module_name ?? "sconosciuto",
            })}
          </p>
          {doc.account_holder && (
            <p className="text-xs text-muted-foreground">
              {t("ingestion.inspectAccount", { name: doc.account_holder })}
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="pb-2 font-semibold pr-4">{t("ingestion.inspectColDate")}</th>
                <th className="pb-2 font-semibold pr-4">{t("ingestion.inspectColDescription")}</th>
                <th className="pb-2 text-right font-semibold pr-4">
                  {t("ingestion.inspectColAmount", { currency })}
                </th>
                <th className="pb-2 font-semibold">{t("ingestion.inspectColType")}</th>
              </tr>
            </thead>
            <tbody>
              {txns.map((tx, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  <td className="py-1.5 pr-4 text-muted-foreground whitespace-nowrap">{tx.date}</td>
                  <td className="py-1.5 pr-4 max-w-[300px] truncate" title={tx.description}>
                    {tx.description}
                  </td>
                  <td
                    className={`py-1.5 pr-4 text-right ${
                      Number(tx.amount) < 0 ? "text-destructive" : "text-green-600"
                    }`}
                  >
                    {tx.amount}
                  </td>
                  <td className="py-1.5 text-muted-foreground">
                    {Number(tx.amount) < 0
                      ? t("ingestion.inspectDebit")
                      : t("ingestion.inspectCredit")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {txns.length === 0 && (
            <p className="text-muted-foreground text-sm mt-2">
              {t("ingestion.inspectNoTransactions")}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (doc.document_type === "payslip") {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <KV label={t("ingestion.inspectPayslipEmployer")} value={doc.employer} />
          <KV label={t("ingestion.inspectPayslipEmployee")} value={doc.employee_name} />
          <KV label={t("ingestion.inspectPayslipGross")} value={doc.gross_income} />
          <KV label={t("ingestion.inspectPayslipNet")} value={doc.net_income} />
          <KV label={t("ingestion.inspectPayslipCurrency")} value={doc.currency} />
        </div>
        {(doc.deductions ?? []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {t("ingestion.inspectPayslipDeductions")}
            </p>
            {doc.deductions!.map((d, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border/50 py-1">
                <span>{d.label}</span>
                <span>{d.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (doc.document_type === "utility_bill") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <KV label={t("ingestion.inspectUtilityProvider")} value={doc.provider} />
        <KV label={t("ingestion.inspectUtilityService")} value={doc.service_type} />
        <KV
          label={t("ingestion.inspectUtilityBillingPeriod")}
          value={
            doc.billing_period_start && doc.billing_period_end
              ? `${doc.billing_period_start} → ${doc.billing_period_end}`
              : null
          }
        />
        <KV label={t("ingestion.inspectUtilityTotalDue")} value={doc.total_due} />
        <KV label={t("ingestion.inspectUtilityAccountNumber")} value={doc.account_number} />
      </div>
    );
  }

  if (doc.document_type === "receipt") {
    return (
      <div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <KV label={t("ingestion.inspectReceiptMerchant")} value={doc.merchant} />
          <KV label={t("ingestion.inspectReceiptDate")} value={doc.purchase_date} />
          <KV label={t("ingestion.inspectReceiptTotal")} value={doc.total_amount} />
        </div>
        {(doc.line_items ?? []).length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">
              {t("ingestion.inspectReceiptItems")}
            </p>
            {doc.line_items!.map((item, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-border/50 py-1">
                <span>{item.label}</span>
                <span>{item.amount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // unknown / fallback - show as formatted JSON
  return (
    <pre className="text-xs text-muted-foreground overflow-auto max-h-64 bg-secondary/30 rounded p-3">
      {JSON.stringify(doc, null, 2)}
    </pre>
  );
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value ?? "-"}</p>
    </div>
  );
}
