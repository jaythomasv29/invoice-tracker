import {
  comparablePrice,
  compareRetailPurchases,
} from '../../../shared/receiptComparison.ts';
const PRICE_ALERT_THRESHOLD_PCT = 3;
export async function detectPriceCreep(
  supabase: any,
  organizationId: string,
  vendorId: string,
  invoiceId: string,
  lineItems: any[],
): Promise<void> {
  const { data: currentInvoice } = await supabase
    .from('invoices')
    .select('invoice_date,created_at,status')
    .eq('id', invoiceId)
    .single();
  const cutoff =
    currentInvoice?.invoice_date ?? currentInvoice?.created_at ?? '';
  if (organizationId.startsWith('pws_') && currentInvoice?.status !== 'saved')
    return;
  const eligible = lineItems.filter(
    (li) =>
      li.line_item_type === 'charge' &&
      li.clean_name &&
      li.unit_of_measure &&
      li.unit_price > 0,
  );

  await Promise.all(
    eligible.map(async (li) => {
      try {
        let query = supabase
          .from('invoice_line_items')
          .select(
            'unit_price, qty, extended_price, retail_product, invoices!inner(vendor_id, invoice_date, created_at, status)',
          )
          .eq('organization_id', organizationId)
          .eq('invoices.vendor_id', vendorId)
          .eq('line_item_type', 'charge')
          .is('voided_at', null)
          .eq('invoices.status', 'saved')
          .neq('invoice_id', invoiceId);
        const personal = organizationId.startsWith('pws_');
        const current = personal
          ? comparablePrice(
              li.retail_product,
              Number(li.qty),
              Number(li.extended_price),
              vendorId,
            )
          : null;
        if (personal) {
          if (!current) return;
          const identity = li.retail_product?.barcode
            ? { barcode: li.retail_product.barcode }
            : { store_sku: li.retail_product.store_sku };
          query = query.contains('retail_product', identity);
        } else
          query = query
            .eq('clean_name', li.clean_name)
            .ilike('unit_of_measure', li.unit_of_measure);
        const { data: priorRows, error } = await query
          .order('created_at', { ascending: false })
          .limit(1000);
        if (error) throw error;
        const previous = (priorRows ?? []).filter(
          (row: any) =>
            (row.invoices?.invoice_date ?? row.invoices?.created_at ?? '') <
              cutoff &&
            (!personal ||
              !!compareRetailPurchases(
                comparablePrice(
                  row.retail_product,
                  Number(row.qty),
                  Number(row.extended_price),
                  vendorId,
                ),
                current,
              )),
        );
        if (!previous.length) return;

        const mostRecent = previous.reduce((latest: any, row: any) => {
          const rowDate =
            row.invoices?.invoice_date ?? row.invoices?.created_at ?? '';
          const latestDate =
            latest.invoices?.invoice_date ?? latest.invoices?.created_at ?? '';
          return rowDate > latestDate ? row : latest;
        });

        let previousPrice = Number(mostRecent.unit_price);
        let newPrice = Number(li.unit_price);
        let comparisonUnit = li.unit_of_measure;
        if (personal) {
          const comparison = compareRetailPurchases(
            comparablePrice(
              mostRecent.retail_product,
              Number(mostRecent.qty),
              Number(mostRecent.extended_price),
              vendorId,
            ),
            comparablePrice(
              li.retail_product,
              Number(li.qty),
              Number(li.extended_price),
              vendorId,
            ),
          );
          if (!comparison) return;
          previousPrice = comparison.previous;
          newPrice = comparison.current;
          comparisonUnit = comparison.unit;
        }
        if (!previousPrice || previousPrice <= 0) return;

        const pctChange = ((newPrice - previousPrice) / previousPrice) * 100;
        if (pctChange <= PRICE_ALERT_THRESHOLD_PCT) return;

        await supabase.from('price_alerts').insert({
          organization_id: organizationId,
          vendor_id: vendorId,
          line_item_id: li.id,
          item_name: li.clean_name,
          previous_price: previousPrice,
          new_price: newPrice,
          unit: comparisonUnit,
          pct_change: Math.round(pctChange * 100) / 100,
        });
      } catch {
        // Best-effort — a failed comparison for one item shouldn't fail the
        // whole extraction the client is waiting on.
      }
    }),
  );
}
