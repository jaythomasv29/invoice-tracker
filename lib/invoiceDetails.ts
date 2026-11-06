export type InvoiceDetails = {
  vendorName: string;
  invoiceNumber: string;
  dateIso: string | null;
  subtotal: number;
  tax: number;
  total: number;
};
export function validateInvoiceDetails(
  details: InvoiceDetails,
  today: string,
): string | null {
  if (!details.vendorName.trim() || details.vendorName.trim().length > 200)
    return "Enter a vendor name (up to 200 characters).";
  if (details.invoiceNumber.length > 200)
    return "Invoice numbers can contain up to 200 characters.";
  if (details.dateIso) {
    const d = new Date(`${details.dateIso}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(details.dateIso) ||
      !Number.isFinite(d.getTime()) ||
      d.toISOString().slice(0, 10) !== details.dateIso
    )
      return "Enter a valid date as YYYY-MM-DD, or leave it empty.";
    if (details.dateIso > today)
      return "The purchase date cannot be in the future.";
  }
  if (
    ![details.subtotal, details.tax, details.total].every(
      (n) => Number.isFinite(n) && Math.abs(n) < 100000000,
    )
  )
    return "Enter valid amounts with no more than eight digits before the decimal.";
  return null;
}
