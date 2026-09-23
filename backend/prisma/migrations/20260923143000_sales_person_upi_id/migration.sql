-- Optional UPI payout destination. Existing sales persons keep working with NULL.
ALTER TABLE "sales_persons" ADD COLUMN IF NOT EXISTS "upiId" TEXT;
