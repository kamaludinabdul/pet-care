import { describe, it, expect } from 'vitest';
import { normalizePermissions, AVAILABLE_PERMISSIONS } from './permissions';

describe('permissions', () => {
    describe('AVAILABLE_PERMISSIONS', () => {
        it('should have required permission entries', () => {
            expect(AVAILABLE_PERMISSIONS).toBeDefined();
            expect(Array.isArray(AVAILABLE_PERMISSIONS)).toBe(true);

            // Check for POS permission
            const posPermission = AVAILABLE_PERMISSIONS.find(p => p.id === 'pos');
            expect(posPermission).toBeDefined();
            expect(posPermission.label).toBe('Akses POS (Kasir)');
        });

        it('should have categories with items', () => {
            const categories = AVAILABLE_PERMISSIONS.filter(p => p.category);
            expect(categories.length).toBeGreaterThan(0);

            const productCategory = categories.find(c => c.category === 'Produk & Stok');
            expect(productCategory).toBeDefined();
            expect(productCategory.items).toBeDefined();
            expect(productCategory.items.length).toBeGreaterThan(0);
        });
    });

    describe('normalizePermissions', () => {
        it('should return default permissions when input is null', () => {
            const result = normalizePermissions(null);

            expect(result.admin).toBeDefined();
            expect(result.admin).toContain('dashboard');
            expect(result.admin).toContain('pos');
            expect(result.staff).toContain('pos');
            expect(result.sales).toContain('pos');
        });

        it('should expand products parent permission to sub-permissions for admin', () => {
            const input = {
                admin: ['products']
            };

            const result = normalizePermissions(input);

            expect(result.admin).toContain('products');
            expect(result.admin).toContain('products.manage');
            expect(result.admin).toContain('products.categories');
            expect(result.admin).toContain('products.stock');
        });

        it('should expand reports parent permission to sub-permissions for staff', () => {
            const input = {
                staff: ['reports']
            };

            const result = normalizePermissions(input);

            expect(result.staff).toContain('reports');
            expect(result.staff).toContain('reports.profit_loss');
            expect(result.staff).toContain('reports.sales_items');
            expect(result.staff).toContain('reports.shifts');
        });

        it('should not modify permissions without parent keys', () => {
            const input = {
                admin: ['pos', 'dashboard'],
                staff: ['pos']
            };

            const result = normalizePermissions(input);

            expect(result.admin).toEqual(['pos', 'dashboard']);
            expect(result.staff).toEqual(['pos']);
        });

        it('should handle sales role permissions', () => {
            const input = {
                sales: ['pos', 'products']
            };

            const result = normalizePermissions(input);

            expect(result.sales).toContain('pos');
            expect(result.sales).toContain('products.manage');
        });
    });
});
