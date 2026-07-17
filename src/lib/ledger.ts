import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Recompute every running balance for one customer in a SINGLE atomic statement.
 *
 * This is a behaviour-identical, faster replacement for the old row-by-row loop:
 *   balance[n] = Σ(debit − credit) from the oldest entry through n
 *   ordered by date then id, starting from zero.
 *   Positive → customer owes us; negative → they've paid ahead.
 *
 * Why one statement: the Neon HTTP driver can't run interactive multi-statement
 * transactions, and the old loop did one round-trip per entry (slow) with no
 * atomicity — a mid-loop failure left the ledger half-updated. A single windowed
 * UPDATE is both fast and atomic, and produces the exact same numbers the loop did.
 *
 * ⚠️ KNOWN PRE-EXISTING LIMITATION (carried over deliberately, not introduced here):
 * this starts from zero, so it does NOT preserve (a) opening balances that predate
 * a customer's first entry, or (b) any manual balance adjustment that isn't a
 * debit/credit row. A couple of seeded customers rely on both. Calling this after
 * an edit will "correct" such a customer to a pure running total. Fixing that
 * properly needs a product decision (model opening balances / adjustments as real
 * rows or an explicit column) — see the note handed to the owner. It is flagged
 * rather than silently changed because it rewrites real financial figures.
 */
export async function recalcBalances(customerId: number) {
  await db.execute(sql`
    UPDATE customer_entries AS ce
    SET balance = t.running
    FROM (
      SELECT id,
             SUM(debit - credit) OVER (
               ORDER BY date, id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
             ) AS running
      FROM customer_entries
      WHERE customer_id = ${customerId}
    ) AS t
    WHERE ce.id = t.id
  `);
}
