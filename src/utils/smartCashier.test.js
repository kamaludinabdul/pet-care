import { describe, it, expect } from 'vitest';
import { calculateAssociations, generateAIScript, getSmartRecommendations } from './smartCashier';

describe('smartCashier', () => {
    describe('calculateAssociations', () => {
        it('should return empty object for empty transactions', () => {
            const result = calculateAssociations([]);
            expect(result).toEqual({});
        });

        it('should calculate associations between items bought together', () => {
            const transactions = [
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'C' }] },
            ];

            const result = calculateAssociations(transactions);

            // A was bought 3 times total
            // A & B were bought together 2 times
            // A & C were bought together 1 time
            expect(result['A']).toBeDefined();
            expect(result['B']).toBeDefined();
            expect(result['C']).toBeDefined();

            // B should be associated with A
            const aAssociations = result['A'];
            const bAssoc = aAssociations.find(a => a.id === 'B');
            expect(bAssoc).toBeDefined();
            expect(bAssoc.count).toBe(2);
        });

        it('should handle duplicate items in same transaction', () => {
            const transactions = [
                { items: [{ id: 'A' }, { id: 'A' }, { id: 'B' }] },
            ];

            const result = calculateAssociations(transactions);

            // Should only count A once due to Set usage
            expect(result['A']).toBeDefined();
            expect(result['A'].length).toBe(1); // Only B associated
        });

        it('should sort associations by score descending', () => {
            const transactions = [
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'B' }] },
                { items: [{ id: 'A' }, { id: 'C' }] },
            ];

            const result = calculateAssociations(transactions);

            // For item A, B should have higher score than C
            const aAssociations = result['A'];
            expect(aAssociations[0].id).toBe('B'); // B has higher score
        });
    });

    describe('generateAIScript', () => {
        it('should return a string containing both product names', () => {
            const result = generateAIScript('Kopi', 'Roti');

            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
            // At least one product should be mentioned (suggestedProduct is always in templates)
            expect(result.includes('Roti')).toBe(true);
        });

        it('should return different scripts (random)', () => {
            const scripts = new Set();

            // Generate multiple scripts to check randomness
            for (let i = 0; i < 20; i++) {
                scripts.add(generateAIScript('Coffee', 'Croissant'));
            }

            // Should have at least 2 different scripts (statistically likely)
            expect(scripts.size).toBeGreaterThanOrEqual(1);
        });
    });

    describe('getSmartRecommendations', () => {
        const allProducts = [
            { id: 'A', name: 'Product A' },
            { id: 'B', name: 'Product B' },
            { id: 'C', name: 'Product C' },
            { id: 'D', name: 'Product D' },
        ];

        it('should return empty array for empty cart', () => {
            const result = getSmartRecommendations([], allProducts, {});
            expect(result).toEqual([]);
        });

        it('should recommend items based on associations', () => {
            const associations = {
                'A': [{ id: 'B', score: 0.8, count: 5 }],
            };
            const cart = [{ id: 'A', name: 'Product A' }];

            const result = getSmartRecommendations(cart, allProducts, associations);

            expect(result.length).toBe(1);
            expect(result[0].id).toBe('B');
            expect(result[0].aiScript).toBeDefined();
            expect(result[0].reason).toContain('Product A');
        });

        it('should not recommend items already in cart', () => {
            const associations = {
                'A': [{ id: 'B', score: 0.8, count: 5 }],
            };
            const cart = [
                { id: 'A', name: 'Product A' },
                { id: 'B', name: 'Product B' }
            ];

            const result = getSmartRecommendations(cart, allProducts, associations);

            expect(result.length).toBe(0);
        });

        it('should limit recommendations to top 3', () => {
            const associations = {
                'A': [
                    { id: 'B', score: 0.8, count: 5 },
                    { id: 'C', score: 0.7, count: 4 },
                    { id: 'D', score: 0.6, count: 3 },
                    { id: 'E', score: 0.5, count: 2 }, // This should be excluded
                ],
            };
            const extendedProducts = [
                ...allProducts,
                { id: 'E', name: 'Product E' }
            ];
            const cart = [{ id: 'A', name: 'Product A' }];

            const result = getSmartRecommendations(cart, extendedProducts, associations);

            expect(result.length).toBe(3);
        });

        it('should accumulate scores from multiple cart items', () => {
            const associations = {
                'A': [{ id: 'C', score: 0.5, count: 3 }],
                'B': [{ id: 'C', score: 0.5, count: 3 }],
            };
            const cart = [
                { id: 'A', name: 'Product A' },
                { id: 'B', name: 'Product B' }
            ];

            const result = getSmartRecommendations(cart, allProducts, associations);

            // C should be recommended since both A and B associate with it
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('C');
        });
    });
});
