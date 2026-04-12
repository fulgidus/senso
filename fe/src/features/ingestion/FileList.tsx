import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { UploadStatus } from "./types";

type Props = {
  uploads: UploadStatus[];
  allConfirmed: boolean;
  onInspect: (id: string) => void;
  onRetry: (id: string) => void;
  onReport: (id: string) => void;
  onRemove: (id: string) => void;
  onConfirmOne: (id: string) => void;
  onConfirmAll: () => void;
};

function ExtractionMethodCell({ upload }: { upload: UploadStatus }) {
  const { t } = useTranslation();
  const { extractionStatus, extractionMethod, moduleSource, errorMessage } = upload;

  if (extractionStatus === "failed") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-destructive text-sm font-medium">{t("ingestion.statusFailed")}</span>
        {errorMessage && (
          <span className="text-destructive/80 text-xs truncate max-w-[250px]" title={errorMessage}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
  if (extractionStatus === "provider_outage") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-destructive text-sm font-medium">{t("ingestion.statusOutage")}</span>
        {errorMessage && (
          <span className="text-destructive/80 text-xs truncate max-w-[250px]" title={errorMessage}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
  if (extractionStatus === "pending") {
    return (
      <span className="text-muted-foreground text-sm animate-pulse">
        {t("ingestion.statusProcessing")}
      </span>
    );
  }
  if (extractionStatus === "adaptive_failed") {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-destructive text-sm font-medium">
          {t("ingestion.statusAdaptiveFailed")}
        </span>
        {errorMessage && (
          <span className="text-destructive/80 text-xs truncate max-w-[250px]" title={errorMessage}>
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
  if (!extractionMethod) {
    return <span className="text-muted-foreground text-sm">-</span>;
  }

  if (extractionMethod.startsWith("module:") || extractionMethod.startsWith("adaptive:")) {
    const name = extractionMethod.replace(/^(module:|adaptive:)/, "");
    if (moduleSource === "generated") {
      return (
        <span className="text-sm flex items-center gap-1.5">
          <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
            {"{NEW}"}
          </span>
          {t("ingestion.extractionConversionNew", { name })}
        </span>
      );
    }
    if (moduleSource === "promoted") {
      return (
        <span className="text-sm">{t("ingestion.extractionConversionPromoted", { name })}</span>
      );
    }
    return <span className="text-sm">{t("ingestion.extractionConversion", { name })}</span>;
  }
  if (extractionMethod === "ocr_text" || extractionMethod === "llm_text") {
    return <span className="text-sm">{t("ingestion.extractionOcrLlm")}</span>;
  }
  if (extractionMethod === "llm_vision") {
    return <span className="text-sm">{t("ingestion.extractionLlmVision")}</span>;
  }
  return <span className="text-sm">{extractionMethod}</span>;
}

function canRetry(upload: UploadStatus): boolean {
  return (
    upload.extractionStatus === "failed" ||
    upload.extractionStatus === "adaptive_failed" ||
    upload.extractionStatus === "provider_outage" ||
    upload.moduleSource === "generated"
  );
}

export function FileList({
  uploads,
  onInspect,
  onRetry,
  onReport,
  onRemove,
  onConfirmOne,
  onConfirmAll,
}: Props) {
  const { t } = useTranslation();

  if (uploads.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">{t("ingestion.noFiles")}</p>
    );
  }

  const allEligibleConfirmed = uploads
    .filter((u) => u.extractionStatus === "success")
    .every((u) => u.confirmed);

  const hasAnySuccess = uploads.some((u) => u.extractionStatus === "success");

  return (
    <div className="space-y-3">
      {/* Mobile card list */}
      <div className="sm:hidden space-y-2">
        {uploads.map((upload) => (
          <div key={upload.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex items-start gap-2">
              {upload.confirmed && (
                <span
                  className="text-green-600 font-bold shrink-0"
                  title={t("ingestion.confirmedTitle")}
                >
                  ✓
                </span>
              )}
              <span
                className="font-medium text-foreground text-sm truncate"
                title={upload.originalFilename}
              >
                {upload.originalFilename}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">{upload.contentType}</div>
            <ExtractionMethodCell upload={upload} />
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onInspect(upload.id)}
                disabled={upload.extractionStatus !== "success"}
              >
                {t("ingestion.actionInspect")}
              </Button>
              {canRetry(upload) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onRetry(upload.id)}
                >
                  {t("ingestion.actionRetry")}
                </Button>
              )}
              {upload.extractionStatus === "success" && !upload.confirmed && (
                <Button size="sm" className="h-7 text-xs" onClick={() => onConfirmOne(upload.id)}>
                  {t("ingestion.actionConfirm")}
                </Button>
              )}
              {upload.extractionStatus === "success" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => onReport(upload.id)}
                >
                  {t("ingestion.actionReport")}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => onRemove(upload.id)}
              >
                {t("ingestion.actionRemove")}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                {t("ingestion.colFile")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                {t("ingestion.colType")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                {t("ingestion.colExtractionMethod")}
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                {t("ingestion.colActions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <tr
                key={upload.id}
                className="border-b border-border last:border-0 hover:bg-secondary/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {upload.confirmed && (
                      <span
                        className="text-green-600 font-bold"
                        title={t("ingestion.confirmedTitle")}
                      >
                        ✓
                      </span>
                    )}
                    <span
                      className="font-medium text-foreground truncate max-w-[200px]"
                      title={upload.originalFilename}
                    >
                      {upload.originalFilename}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{upload.contentType}</td>
                <td className="px-4 py-3">
                  <ExtractionMethodCell upload={upload} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Inspect - always shown but disabled when not success */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onInspect(upload.id)}
                      disabled={upload.extractionStatus !== "success"}
                    >
                      {t("ingestion.actionInspect")}
                    </Button>
                    {/* Retry - per D-36: failed | adaptive_failed | provider_outage | generated */}
                    {canRetry(upload) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onRetry(upload.id)}
                      >
                        {t("ingestion.actionRetry")}
                      </Button>
                    )}
                    {/* Individual Confirm - success + not yet confirmed */}
                    {upload.extractionStatus === "success" && !upload.confirmed && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onConfirmOne(upload.id)}
                      >
                        {t("ingestion.actionConfirm")}
                      </Button>
                    )}
                    {/* Report - success only per D-36 */}
                    {upload.extractionStatus === "success" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => onReport(upload.id)}
                      >
                        {t("ingestion.actionReport")}
                      </Button>
                    )}
                    {/* Remove - always shown */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => onRemove(upload.id)}
                    >
                      {t("ingestion.actionRemove")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm all / All confirmed - only show when there are eligible files */}
      {hasAnySuccess && (
        <div className="flex justify-end">
          <Button disabled={allEligibleConfirmed} onClick={onConfirmAll} className="min-w-36">
            {allEligibleConfirmed ? t("ingestion.allEligibleConfirmed") : t("ingestion.confirmAll")}
          </Button>
        </div>
      )}
    </div>
  );
}
