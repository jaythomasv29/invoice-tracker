# Product prices and Business recipe labor — November 5, 2026

Home → Search items & prices and Profile → Products & prices are available in Personal and Business, including Free. Purchased searches saved, active charge lines by item or supplier. Saving a result creates a product reference; it does not merge, rewrite, relink or delete invoice records. Saved products can also be entered manually, with clearly labeled estimated prices.

Product identity deliberately retains supplier, raw printed description and billed unit. Different brands/package descriptions are not automatically merged. Historical purchases use invoice date, with an explicit upload-date fallback. Search supports literal text and pagination. Existing strict Personal price-alert identity/discount rules are unchanged.

## Measurement and prices

- Mass: g, kg, oz, lb. Volume: mL, L and US liquid units. Count: each, when an actual count is known.
- No weight/volume conversion without a verified density. Fluid ounces and weight ounces stay distinct. Cups are US customary.
- Printed total catch weight is used once, regardless of case count. A clear `2 x 12 OZ` package is multiplied by billed quantity. Ambiguous slash sizes, cases such as `#40`, and unknown EA cartons require confirmation.
- Personal receipt prices require an attributable, complete net discount amount. Invoice-level tax and shipping are excluded and labeled.
- A saved product's current recipe price is the quantity-weighted average of up to three recent usable, dimension-compatible observations (among the latest 20 source-group observations). No early currency rounding.
- Manual package size overrides apply only to the selected source line. They never assume older packages had identical sizes. Manual products require an explicit package size and price.
- Recipe unit changes convert equivalent quantities within the same measurement family; a different family requires checking and confirming the quantity.

Conversion constants follow NIST Handbook 130 and Unicode CLDR US customary conversions: 1 lb = 453.59237 g; 1 US fluid ounce = 29.5735295625 mL. Recipe costs exclude waste/yield loss unless the operator accounts for it in ingredient quantities.

## Business Pro recipes only

Set servings per batch, estimated prep/cooking minutes, active person-minutes and an hourly wage or loaded labor rate. Blank labor stays unknown. Explicit zero labor minutes is zero cost. Two people actively working 15 minutes means 30 person-minutes. Elapsed cooking time never automatically adds labor.

Labor cost = person-minutes ÷ 60 × hourly rate. Ingredient and entered labor costs are shown per batch and per serving. Missing ingredient prices create a labeled subtotal, and manual/AI prices remain estimates. Menu price is per serving; ingredient share and contribution after food/labor do not claim net profit. Gas, utilities, packaging and other overhead are excluded.

No native dependency or configuration changed. Hosted migration `20261105010000_product_catalog_and_recipe_labor` is additive and retains build 7 compatibility.

## Validation

- TypeScript, Expo lint and 41 Node tests, including unit families, catch weights, ambiguous pack sizes, discounts, weighted averages, AI estimate conversion, precision and labor/yield math.
- Fresh isolated PostgreSQL database with all migrations; product catalog scope, literal search, chronological pricing, manual-source restriction, foreign-source rejection, persistent labor fields, Personal/Business isolation and unchanged invoice lines.
- Authenticated hosted REST checks in a disposable development identity: Business purchase search, source price resolution, recipe settings persistence, Personal isolation and manual product persistence.
- Native iPhone 16 Pro simulator: Home entry, search price, US/metric conversion, product details, recipe list, and recipe breakdown ($4.40 batch ingredients + $12 labor / 4 = $4.10 per serving).
- Source-account invoices are checked against a private baseline after deployment. Fixtures are separate from the customer's restaurant.

Physical-device keyboard, largest Dynamic Type, reduced-motion and compact/landscape checks still require a phone pass. Native Screen/MotionTouchable honor system Reduce Motion; new forms use labeled decimal inputs, scrollable content, keyboard avoidance and 44-point actions. The app uses its existing light palette.
