export type ExtractionStatus =
  | "pending"
  | "success"
  | "failed"
  | "adaptive_failed"
  | "provider_outage";

export type ModuleSource = "builtin" | "generated" | "promoted" | null;

export interface UploadStatus {
  id: string;
  originalFilename: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
  extractionStatus: ExtractionStatus;
  extractionMethod: string | null;
  moduleSource: ModuleSource;
  confirmed: boolean;
  reportFlagged: boolean;
  errorMessage?: string | null;
}

export interface Transaction {
  date: string; // ISO date string
  description: string;
  amount: string; // Decimal as string
  currency: string;
  category_hint: string | null;
  balance_after: string | null;
}

export interface LineItem {
  label: string;
  amount: string;
}

// Note: ExtractedDocument fields use snake_case because the API returns
// doc.model_dump(mode="json") which preserves Python's snake_case field names.
export interface ExtractedDocument {
  document_type: "bank_statement" | "payslip" | "receipt" | "utility_bill" | "unknown";
  module_name: string | null;
  module_source: ModuleSource;
  module_version: string | null;
  // bank_statement
  transactions?: Transaction[];
  account_holder?: string | null;
  account_iban?: string | null;
  statement_period_start?: string | null;
  statement_period_end?: string | null;
  // payslip
  employer?: string | null;
  employee_name?: string | null;
  gross_income?: string | null;
  net_income?: string | null;
  currency?: string;
  deductions?: LineItem[];
  // receipt
  merchant?: string | null;
  purchase_date?: string | null;
  total_amount?: string | null;
  line_items?: LineItem[];
  // utility_bill
  provider?: string | null;
  service_type?: string | null;
  billing_period_start?: string | null;
  billing_period_end?: string | null;
  total_due?: string | null;
  account_number?: string | null;
}
