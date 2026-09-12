import { describe, expect, it } from "vitest";
import {
	computeReferenceDifferences,
	findBankLedgerMismatches,
	normalizeReferencedAmounts,
	sumLedgerTotals,
	toBigIntCents,
} from "../lib/accounting-semantics.js";
import { sha256Canonical } from "../lib/canonicalization.js";

describe("deterministic accounting semantics", () => {
	it("normalizes JSON integer cents to bigint without float arithmetic", () => {
		expect(toBigIntCents(125, "test")).toBe(125n);
		expect(toBigIntCents("9007199254740993", "test")).toBe(
			9_007_199_254_740_993n,
		);
		expect(() => toBigIntCents(10.5, "test")).toThrow(/test: float money/i);
		expect(() => toBigIntCents("10.5", "test")).toThrow(/integer cents/i);
	});

	it("normalizes reference amounts in stable order and sums ledger sides", () => {
		expect(
			normalizeReferencedAmounts(
				[
					{ reference: "B2", amountCents: "20" },
					{ reference: "B1", amountCents: 10 },
				],
				"test",
			),
		).toEqual([
			{ reference: "B1", amountCents: 10n },
			{ reference: "B2", amountCents: 20n },
		]);
		expect(
			sumLedgerTotals(
				[
					{
						account: "101",
						reference: "B1",
						debitCents: "9007199254740993",
						creditCents: 0,
					},
					{
						account: "401",
						reference: "B1",
						debitCents: 0,
						creditCents: "9007199254740993",
					},
				],
				"test",
			),
		).toEqual({
			debitCents: 9_007_199_254_740_993n,
			creditCents: 9_007_199_254_740_993n,
		});
	});

	it("computes reference differences and canonical payload hashes deterministically", () => {
		const input = {
			bank: [
				{ reference: "B2", amountCents: 250 },
				{ reference: "B1", amountCents: 100 },
			],
			ledger: [
				{ reference: "B1", amountCents: 100 },
				{ reference: "B2", amountCents: 230 },
			],
			consumer: "test",
		};
		const differences = computeReferenceDifferences(input);
		expect(differences).toEqual(computeReferenceDifferences(input));
		expect(differences).toHaveLength(1);
		expect(differences[0]).toEqual({
			reference: "B2",
			bankCents: 250n,
			ledgerCents: 230n,
			differenceCents: 20n,
			payloadHash: sha256Canonical({
				reference: "B2",
				bankCents: 250n,
				ledgerCents: 230n,
				differenceCents: 20n,
			}),
		});
	});

	it("reconciles bank movements against only the selected journal account", () => {
		const mismatches = findBankLedgerMismatches({
			bank: [
				{ reference: "B1", amountCents: 100 },
				{ reference: "B2", amountCents: 40 },
			],
			ledger: [
				{
					account: "101",
					reference: "B1",
					debitCents: 100,
					creditCents: 0,
				},
				{
					account: "401",
					reference: "B1",
					debitCents: 0,
					creditCents: 100,
				},
				{
					account: "101",
					reference: "B2",
					debitCents: 50,
					creditCents: 0,
				},
			],
			consumer: "test",
			bankAccount: "101",
		});
		expect(mismatches).toEqual([
			{ reference: "B2", bankCents: 40n, ledgerCents: 50n },
		]);
	});
});
