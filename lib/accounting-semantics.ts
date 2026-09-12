import { sha256Canonical } from "./canonicalization.js";

/** Money accepted at JSON boundaries before deterministic BigInt normalization. */
export type JsonIntegerCents = number | string;

/** A reference and amount accepted by deterministic accounting operations. */
export interface ReferencedAmount {
	reference: string;
	amountCents: JsonIntegerCents;
}

/** One debit/credit ledger leg accepted by deterministic accounting operations. */
export interface LedgerLeg {
	account: string;
	reference: string;
	debitCents: JsonIntegerCents;
	creditCents: JsonIntegerCents;
}

/** A normalized reference and amount. */
export interface NormalizedReferencedAmount {
	reference: string;
	amountCents: bigint;
}

/** Deterministic totals for the two sides of a journal. */
export interface LedgerTotals {
	debitCents: bigint;
	creditCents: bigint;
}

/** One deterministic difference between two reference-indexed amount lists. */
export interface ReferenceDifference {
	reference: string;
	bankCents: bigint;
	ledgerCents: bigint;
	differenceCents: bigint;
	payloadHash: string;
}

/** One mismatch between a bank movement and the journal net for its reference. */
export interface BankLedgerMismatch {
	reference: string;
	bankCents?: bigint;
	ledgerCents: bigint;
}

const INTEGER_RE = /^-?\d+$/;

/**
 * Convert JSON-boundary money to BigInt cents. The caller label keeps boundary
 * errors attributable without duplicating the accounting rule in each consumer.
 */
export function toBigIntCents(
	value: JsonIntegerCents,
	consumer: string,
): bigint {
	if (typeof value === "number") {
		if (!Number.isInteger(value)) {
			throw new Error(
				`${consumer}: float money rejected at the manifest boundary (${value}) — use integer cents or an integer decimal string`,
			);
		}
		return BigInt(value);
	}
	if (typeof value === "bigint") {
		throw new Error(
			`${consumer}: money at the JSON boundary must be integer cents or an integer decimal string — bigint is not a JSON type; convert with BigInt() after parsing`,
		);
	}
	if (typeof value !== "string" || !INTEGER_RE.test(value)) {
		throw new Error(
			`${consumer}: money must be integer cents or an integer decimal string (got ${String(value)})`,
		);
	}
	return BigInt(value);
}

/** Normalize amount entries to BigInt cents and a stable reference order. */
export function normalizeReferencedAmounts(
	entries: readonly ReferencedAmount[],
	consumer: string,
): NormalizedReferencedAmount[] {
	return [...entries]
		.map((entry) => ({
			reference: entry.reference,
			amountCents: toBigIntCents(entry.amountCents, consumer),
		}))
		.sort((left, right) => left.reference.localeCompare(right.reference));
}

/** Sum debit and credit sides independently using BigInt cents only. */
export function sumLedgerTotals(
	entries: readonly LedgerLeg[],
	consumer: string,
): LedgerTotals {
	let debitCents = 0n;
	let creditCents = 0n;
	for (const entry of entries) {
		debitCents += toBigIntCents(entry.debitCents, consumer);
		creditCents += toBigIntCents(entry.creditCents, consumer);
	}
	return { debitCents, creditCents };
}

/**
 * Compare two amount lists by reference. Repeated references retain the current
 * manifest semantics: the last normalized entry for a reference wins.
 */
export function computeReferenceDifferences(input: {
	bank: readonly ReferencedAmount[];
	ledger: readonly ReferencedAmount[];
	consumer: string;
}): ReferenceDifference[] {
	const bank = new Map<string, bigint>(
		normalizeReferencedAmounts(input.bank, input.consumer).map((entry) => [
			entry.reference,
			entry.amountCents,
		]),
	);
	const ledger = new Map<string, bigint>(
		normalizeReferencedAmounts(input.ledger, input.consumer).map((entry) => [
			entry.reference,
			entry.amountCents,
		]),
	);
	const references = new Set<string>([...bank.keys(), ...ledger.keys()]);
	const differences: ReferenceDifference[] = [];
	for (const reference of [...references].sort()) {
		const bankCents = bank.get(reference) ?? 0n;
		const ledgerCents = ledger.get(reference) ?? 0n;
		const differenceCents = bankCents - ledgerCents;
		if (differenceCents !== 0n) {
			differences.push({
				reference,
				bankCents,
				ledgerCents,
				differenceCents,
				payloadHash: sha256Canonical({
					reference,
					bankCents,
					ledgerCents,
					differenceCents,
				}),
			});
		}
	}
	return differences;
}

/** Compute journal net amounts per reference, optionally for one account only. */
export function computeLedgerNetByReference(
	entries: readonly LedgerLeg[],
	consumer: string,
	account?: string,
): Map<string, bigint> {
	const net = new Map<string, bigint>();
	for (const entry of entries) {
		if (account !== undefined && entry.account !== account) {
			continue;
		}
		const current = net.get(entry.reference) ?? 0n;
		net.set(
			entry.reference,
			current +
				toBigIntCents(entry.debitCents, consumer) -
				toBigIntCents(entry.creditCents, consumer),
		);
	}
	return net;
}

/** Compare bank movements with journal net amounts while preserving input order. */
export function findBankLedgerMismatches(input: {
	bank: readonly ReferencedAmount[];
	ledger: readonly LedgerLeg[];
	consumer: string;
	bankAccount?: string;
}): BankLedgerMismatch[] {
	const ledgerNet = computeLedgerNetByReference(
		input.ledger,
		input.consumer,
		input.bankAccount,
	);
	const mismatches: BankLedgerMismatch[] = [];
	for (const bankEntry of input.bank) {
		const ledgerCents = ledgerNet.get(bankEntry.reference) ?? 0n;
		const bankCents = toBigIntCents(bankEntry.amountCents, input.consumer);
		if (bankCents !== ledgerCents) {
			mismatches.push({
				reference: bankEntry.reference,
				bankCents,
				ledgerCents,
			});
		}
	}
	for (const [reference, ledgerCents] of ledgerNet) {
		if (!input.bank.some((entry) => entry.reference === reference)) {
			mismatches.push({ reference, ledgerCents });
		}
	}
	return mismatches;
}
