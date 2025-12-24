
import { describe, it, expect } from 'vitest';
import { checkPlanLimit } from './planLimits';

describe('planLimits', () => {
    describe('checkPlanLimit', () => {
        it('should allow everything for enterprise plan', () => {
            const result = checkPlanLimit('enterprise', 'users', 100);
            expect(result.allowed).toBe(true);

            const resultProducts = checkPlanLimit('enterprise', 'products', 1000);
            expect(resultProducts.allowed).toBe(true);
        });

        it('should enforce user limits for free plan', () => {
            // Free plan limit is 2
            const resultAllowed = checkPlanLimit('free', 'users', 1);
            expect(resultAllowed.allowed).toBe(true);

            const resultBlocked = checkPlanLimit('free', 'users', 2); // value is current count? assuming logic is < max
            // Logic in file: allowed: value < limits.maxUsers
            // If Limit is 2. 
            // If I have 1 user, can I add another? value passed usually typically "current count" or "new total"?
            // Reading source: "allowed: value < limits.maxUsers". 
            // If maxUsers is 2. value=1 -> 1 < 2 (True). value=2 -> 2 < 2 (False).
            // So 'value' seems to be the count *before* adding? Or the desired new total?
            // If it represents "current count", then if I have 2, 2 < 2 is false. Correct.

            expect(resultBlocked.allowed).toBe(false);
        });

        it('should default to free plan if unknown plan provided', () => {
            const result = checkPlanLimit('unknown_plan', 'users', 2);
            expect(result.allowed).toBe(false); // Should behave like free plan (limit 2)
        });
    });
});
